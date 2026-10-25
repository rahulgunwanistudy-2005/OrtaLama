import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, toHex, type Hex } from 'viem';
import { typedReview } from '../packages/protocol/src/review.js';
import { artifact, client, deployment, json, readPlant, readRound, runtimePath, transact, save, stringify } from '../packages/protocol/src/runtime.js';
import { createSimulatedRound } from './rounds.js';
import { commitPlantRecoverable } from './plant-agent/agent.js';

const base = process.env.ORTALAMA_AGENT!, d = await deployment(), scenario = await json(runtimePath('SIMULATED_scenario.json'));
const round = await createSimulatedRound('report'), officer = privateKeyToAccount(toHex(100n, { size: 32 }));
const installation = scenario.plants[0].installationId;
const governor = (await json(runtimePath('SIMULATED_governor_secret.json'))).signingKey as Hex;
async function post(path: string, body: any, token?: string, status = 200) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? {authorization: `Bearer ${token}`} : {}) }, body: stringify(body) });
  const result = await response.json();
  assert.equal(response.status, status, `${path}: ${stringify(result)}`);
  return result;
}
console.log('SIMULATED agent: actual model extraction and deterministic source/physics checks');
const job = await post('/samples/1/analyse', {});
assert.equal(job.analysis.blocked, false);
assert.equal((await fetch(`${base}/jobs/${job.id}`)).status, 404);
await post(`/jobs/${job.id}/commit`, {}, job.token, 409);
const acks = job.analysis.rules.filter((r: any) => r.status === 'REVIEW').map((r: any) => r.id);
const reviewInput = { officerName: 'SIMULATED automatic API test; no human review performed', officerAddress: officer.address, roundId: String(round.id), installationId: installation, overrides: {}, acknowledgements: acks, approvalKind: 'AUTOMATED_TEST_SIGNATURE' };
for(const parameters of [{country:'DE'},{productCN:'72081000'},{period:2024}]){
  const wrong=await createSimulatedRound('report',undefined,parameters);
  await post(`/jobs/${job.id}/review`,{...reviewInput,roundId:String(wrong.id)},job.token,409);
  await transact(governor,d.round,'OrtalamaRound','abort',[wrong.id,keccak256(toHex('SIMULATED rejected report context fixture'))]);
}
if (acks.length) await post(`/jobs/${job.id}/review`, {...reviewInput, acknowledgements: []}, job.token, 409);
const review = await post(`/jobs/${job.id}/review`, reviewInput, job.token);
assert.equal(review.core.E, job.analysis.calculation.E);
assert.equal(review.core.P, job.analysis.calculation.P);
const signature = await officer.signTypedData(typedReview(review.core));
await post(`/jobs/${job.id}/seal`, { signature: `0x${'11'.repeat(65)}` }, job.token, 409);
await post(`/jobs/${job.id}/seal`, { signature, E: '1' }, job.token, 422);
const sealed = await post(`/jobs/${job.id}/seal`, { signature }, job.token);
assert.equal(sealed.approvalKind, 'AUTOMATED_TEST_SIGNATURE');
// Mine the genuine saved report transaction without saving its response in the
// API job, reproducing a crash/lost bridge response at that exact boundary.
const prepared=await json(runtimePath(`plants/SIMULATED_round_${round.id}_${installation}_secret.json`));
const interruptedReceipt=await commitPlantRecoverable(prepared,toHex(100n,{size:32}));
assert.equal(interruptedReceipt.status,'success');
const different=structuredClone(prepared);different.submission.statement.metadataHash='0x'+'00'.repeat(32);
await assert.rejects(()=>commitPlantRecoverable(different,toHex(100n,{size:32})),/DifferentStatementAlreadyCommitted/);
const receipt = (await post(`/jobs/${job.id}/commit`, {}, job.token)).receipt;
assert.equal(receipt.status, 'success');
assert.equal(receipt.hash,interruptedReceipt.hash);
assert.equal(receipt.recoveredFromChain,true);
assert.equal((await post(`/jobs/${job.id}/commit`, {}, job.token)).receipt.hash, receipt.hash);
const plant = await readPlant(round.id, installation);
assert.equal(plant.statement.reportHash, '0x' + job.analysis.reportHash);
assert.equal(plant.statement.metadataHash, sealed.metadataHash);
await transact(governor,d.round,'OrtalamaRound','startSharing',[round.id]);
const shares = await post(`/jobs/${job.id}/share`, {}, job.token);
assert.equal(shares.receipts.length,3);
assert.ok(shares.receipts.every((r: any) => r.status === 'success'));
assert.equal(Number((await readPlant(round.id, installation)).receipts),7);
const badResponse = await fetch(base + '/samples/16/analyse', {method:'POST',headers:{'content-type':'application/json'},body:'{}'});
assert.ok([200,409].includes(badResponse.status));
let impossibleBlockedAt: string;
if (badResponse.status === 200) {
  const bad = await badResponse.json();
  assert.equal(bad.analysis.blocked,true);
  assert.ok(bad.analysis.rules.some((r: any) => r.status === 'FAIL'));
  const badAcks = bad.analysis.rules.filter((r: any) => r.status === 'REVIEW').map((r: any) => r.id);
  await post(`/jobs/${bad.id}/review`, {...reviewInput, acknowledgements: badAcks}, bad.token,409);
  impossibleBlockedAt='Deterministic physics and unsigned override gate';
} else impossibleBlockedAt='Deterministic source grounding';
const abort = await transact(governor,d.round,'OrtalamaRound','abort',[round.id,keccak256(toHex('SIMULATED one-plant agent integration; full cohorts tested separately'))]);
assert.equal(Number((await readRound(round.id)).state),5);
const result = {simulation:true,status:'LOCAL_PASS',scope:'Actual report PDF → local model → source grounding and physics → named officer test signature → real verifier co-signatures/input proof → mined commitment → three encrypted deliveries/ACKs',humanApprovalPerformed:false,approvalKind:'AUTOMATED_TEST_SIGNATURE',model:job.measurement,reviewFlagsAcknowledged:acks,reportSHA256:job.analysis.reportHash,commitReceipt:receipt,trusteeReceipts:shares.receipts,lostCommitResponseRecovered:true,negativeChecks:['Unknown job capability','Commit before approval','Wrong country','Wrong product','Wrong reporting year','Missing review acknowledgements','Forged officer signature','Injected unsigned value','Different saved statement on recovery','Missing failure override'],impossibleBlockedAt,abortReceipt:abort,limitation:'This one-plant integration round is explicitly aborted; the separate service gate tests complete cohorts.'};
await save('data/simulated/SIMULATED_PHASE5_AGENT_RESULTS.json',result);
process.stdout.write(stringify(result)+'\n',()=>process.exit(0));
