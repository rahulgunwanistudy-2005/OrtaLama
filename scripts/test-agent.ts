import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { privateKeyToAccount } from 'viem/accounts';
import { toHex } from 'viem';
import { assertApprovedReview, reviewDigest, typedReview } from '../packages/protocol/src/review.js';

const officer = privateKeyToAccount(toHex(100n, { size: 32 }));
const python = `
import json
from pathlib import Path
from services.plant_agent.engine import read_report,analyse
from services.plant_agent.schema import FIELDS
from services.plant_agent.review import prepare_review
m=json.loads(Path('data/simulated/reports/SIMULATED_report_manifest.json').read_text())
def analysis(index):
 r=read_report(m['reports'][index]['file']); fields={}
 for k,(label,unit) in FIELDS.items():
  for p,lines in enumerate(r['pages']):
   for i,line in enumerate(lines):
    if line.startswith(label+': '): fields[k]={'rawValue':m['reports'][index]['rawValues'][k],'page':p+1,'line':i+1}
 return analyse(r,{'fields':fields})
a=analysis(2); d={'chainId':31337,'round':'0x'+'11'*20}; ids='0x'+'22'*32
for i,record in enumerate(m['reports']):
 assert analysis(i)['blocked']==record['expectedBlocked'], ('Physics oracle mismatch',i)
from copy import deepcopy
r=read_report(m['reports'][0]['file']); a0=analysis(0); proposal=deepcopy(a0['extraction'])
proposal['fields']['E']['rawValue']='1'
try: analyse(r,proposal); raise AssertionError('Hallucinated source value accepted')
except ValueError: pass
proposal=deepcopy(a0['extraction']); proposal['fields']['E']['page']=99
repaired=analyse(r,proposal)
assert repaired['citations']['E']['alignment']!='VERBATIM'
assert repaired['citations']['E']['value']==a0['citations']['E']['value']
assert any(x['id']=='R00' and x['status']=='REVIEW' for x in repaired['rules'])
r2=deepcopy(r); r2['pages'][0].append(r2['pages'][0][6])
try: analyse(r2,proposal); raise AssertionError('Ambiguous citation repaired silently')
except ValueError: pass
acks=[r['id'] for r in a['rules'] if r['status']=='REVIEW']
args=(a,'SIMULATED automated review test', '${officer.address}', '1',ids,d)
try: prepare_review(*args,{},[],approval_kind='AUTOMATED_TEST_SIGNATURE'); raise AssertionError('Review flags not acknowledged')
except ValueError: pass
packet=prepare_review(*args,{},acks,approval_kind='AUTOMATED_TEST_SIGNATURE')
bad=analysis(15); bad_args=(bad,'SIMULATED automated override test','${officer.address}','1',ids,d)
fails=[r['id'] for r in bad['rules'] if r['status']=='FAIL']; reviews=[r['id'] for r in bad['rules'] if r['status']=='REVIEW']
try: prepare_review(*bad_args,{},reviews); raise AssertionError('Unjustified failure accepted')
except ValueError: pass
override=prepare_review(*bad_args,{r:'SIMULATED negative-test override; no truthful measurement asserted.' for r in fails},reviews,approval_kind='AUTOMATED_TEST_SIGNATURE')
try: prepare_review(analysis(13),'SIMULATED bounds test','${officer.address}','1',ids,d,{'R01':'A sufficiently long attempted override'},[]); raise AssertionError('Zero production override accepted')
except ValueError: pass
print(json.dumps({'packet':packet,'override':override}))
`;
const fixtures = JSON.parse(execFileSync('.tools/service-venv/bin/python', ['-c', python], { env: { ...process.env, PYTHONPATH: '.' }, encoding: 'utf8' }));
for (const packet of [fixtures.packet, fixtures.override]) {
  assert.equal(reviewDigest(packet.core), packet.reviewDigest, 'Python and TS canonical digest disagree');
  packet.signature = await officer.signTypedData(typedReview(packet.core));
  const c = packet.core;
  const expected = { chainId: 31337, address: c.contractAddress, roundId: 1n, installationId: c.installationId, E: BigInt(c.E), P: BigInt(c.P), officer: officer.address };
  assert.equal(await assertApprovedReview(packet, expected), true);
  for (const key of ['E','P','reportHash','analysisHash','officerName','reviewNonce']) {
    const tampered = structuredClone(packet);
    tampered.core[key] += '1';
    await assert.rejects(assertApprovedReview(tampered, expected));
  }
  const overrideTamper = structuredClone(packet);
  overrideTamper.core.overrides.R05 = 'An altered justification that was never signed.';
  await assert.rejects(assertApprovedReview(overrideTamper, expected));
  await assert.rejects(assertApprovedReview(packet, { ...expected, roundId: 2n }));
  const badSignature = { ...packet, signature: await privateKeyToAccount(toHex(101n, { size: 32 })).signTypedData(typedReview(c)) };
  await assert.rejects(assertApprovedReview(badSignature, expected));
}
console.log(JSON.stringify({ simulation: true, status: 'PASS', pythonTypeScriptDigestMatches: 2, genuineOfficerSignatures: 2, tamperedReviewAndReplayRejections: 18, physicsOracleReports: 20, plantedImpossibleCaught: 8, hallucinatedValueRejected: true, ambiguousCitationRepairRejected: true, uniqueIdenticalValueRepairRequiresReview: true, unsignedFailureBlocked: true, unacknowledgedReviewBlocked: true, circuitBoundsOverrideBlocked: true, humanApprovalPerformed: false }));
