import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { keccak256, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { typedStatement } from '../packages/crypto-ts/src/index.js';
import { artifact, deployment, json, client, readRound, transact, badgeProof, save, stringify, runtimePath, publicTestnet, assertSimulationContext } from '../packages/protocol/src/runtime.js';
import { verifySnapshot, verifyPublicAttestations } from '../packages/protocol/src/verify.js';
import { preparePlant, commitPlant, submissionArgs } from './plant-agent/agent.js';

const started = performance.now(), d = await deployment(), scenario = await json(runtimePath('SIMULATED_scenario.json'));
await assertSimulationContext(d);
const governor = (await json(runtimePath('SIMULATED_governor_secret.json'))).signingKey as Hex;
const a = await artifact('OrtalamaRound');
const base = process.env.ORTALAMA_INDEXER ?? 'http://127.0.0.1:8700';
const trusteePort = Number(process.env.ORTALAMA_TRUSTEE_BASE_PORT ?? 8700);
const attacks: any[] = [], guards: any[] = [], receipts: any[] = [];
await save(runtimePath('SIMULATED_e2e_evidence.json'), { simulation: true, status: 'RUNNING' });
async function post(url: string, payload: unknown, token?: string, expectedStatus = 200) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: stringify(payload) });
  const text = await response.text();
  let body: any;
  try { body = JSON.parse(text); } catch { throw new Error(`HTTP ${response.status} from ${url}: non-JSON service response`); }
  assert.equal(response.status, expectedStatus, `${url}: ${JSON.stringify(body)}`);
  return body;
}
const delivery = (plant: any, index: number) => ({ simulation: true, roundId: String(plant.roundId), installationId: plant.installationId, envelope: plant.envelopes[index - 1] });
async function send(plant: any, index: number, expectedStatus = 200) { return post(`http://127.0.0.1:${trusteePort + index}/shares`, delivery(plant, index), undefined, expectedStatus); }
async function createRound() {
  const count = await client.readContract({ address: d.round, abi: a.abi, functionName: 'roundCount' }) as bigint;
  const id = count + 1n, now = (await client.getBlock()).timestamp;
  const production = scenario.plants.reduce((total: bigint, p: any) => total + BigInt(p.P), 0n);
  const sector = (5n * production + 3n) / 4n;
  const facts = await json('data/real/facts.json');
  const threshold = facts.facts.find((x: any) => x.name === 'fallback_by_year');
  assert.equal(threshold.status, 'VERIFIED');
  const cfg = { productCN: toHex('25231000', { size: 8 }), country: toHex('TR', { size: 2 }), period: 2025, cohortRoot: scenario.cohortRoot, verifierRoot: scenario.verifierRoot, trustees: scenario.trustees.map((x: any) => x.address), encryptionKeys: scenario.trustees.map((x: any) => x.publicKey), commitDeadline: now + 3600n, sharingDeadline: now + 7200n, closingDeadline: now + 10800n, minimumPlants: 5, sectorProduction: sector, sectorAttestationHash: keccak256(toHex(stringify({ simulation: true, sectorProductionKg: sector, source: 'SIMULATED coverage denominator, not national statistics' }))), metadataHash: keccak256(toHex(stringify({ simulation: true, fixedThreshold: 'S01/F03 2026 fallback including mark-up; boundary comparability UNVERIFIED', realPlantReports: false }))), thresholdNumerators: [BigInt(threshold.value['2026'].replace('.', '')), 0n, 0n], thresholdDenominators: [1000n, 0n, 0n], fixedThresholdCount: 1, simulated: true };
  receipts.push(await transact(governor, d.round, 'OrtalamaRound', 'createRound', [cfg]));
  receipts.push(await transact(governor, d.round, 'OrtalamaRound', 'open', [id]));
  return id;
}
async function publish(id: bigint, index: number, omitted?: Hex) {
  const cfg = await json(runtimePath(`SIMULATED_trustee_${index}_secret.json`));
  return post(`http://127.0.0.1:${trusteePort + index}/rounds/${id}/publish`, { simulation: true, omitInstallationId: omitted ?? null }, cfg.controlToken);
}
async function sealPlants(id: bigint, count: number, main = false) {
  const plants = [];
  for (let i = 0; i < count; i++) {
    const seed = scenario.plants[i], plant = await preparePlant(id, seed.installationId, BigInt(seed.E), BigInt(seed.P));
    const signer = publicTestnet?governor:toHex(BigInt(100 + i), { size: 32 });
    if (main && i === 0) {
      const foreignSignature = await privateKeyToAccount(publicTestnet?(await import('viem/accounts')).generatePrivateKey():toHex(99n,{size:32})).signTypedData(typedStatement(plant.typedStatement));
      const bad = { ...plant.submission, verifierSignature: foreignSignature };
      attacks.push({ id: 2, label: 'Non-allowlisted verifier', ...await transact(signer, d.round, 'OrtalamaRound', 'commit', submissionArgs(bad), 'UnknownVerifier') });
    }
    receipts.push(await commitPlant(plant, signer));
    await post(`${base}/rounds/${id}/attestations/${plant.installationId}`, plant.attestation);
    if (main && i === 0) {
      attacks.push({ id: 3, label: 'Duplicate installation', ...await transact(signer, d.round, 'OrtalamaRound', 'commit', submissionArgs(plant.submission), 'AlreadyCommitted') });
      await send(plant, 1, 409); guards.push('Share rejected before Sharing');
      const poisoned = { ...plant.attestation, pqSignature: '00'.repeat(3309) };
      await post(`${base}/rounds/${id}/attestations/${plant.installationId}`, poisoned, undefined, 409); guards.push('Poisoned PQ sidecar rejected');
    }
    plants.push(plant);
    console.log(`SIMULATED round ${id}: sealed plant ${i + 1}/${count}`);
  }
  return plants;
}
async function shareAndClose(id: bigint, plants: any[], main = false) {
  receipts.push(await transact(governor, d.round, 'OrtalamaRound', 'startSharing', [id]));
  if (main) {
    const bad = delivery(plants[0], 1); bad.envelope = { ...bad.envelope, ciphertext: (bad.envelope.ciphertext.startsWith('00') ? '01' : '00') + bad.envelope.ciphertext.slice(2) };
    await post(`http://127.0.0.1:${trusteePort + 1}/shares`, bad, undefined, 409); guards.push('Ciphertext tampering rejected');
    await post(`http://127.0.0.1:${trusteePort + 1}/shares`, { ...delivery(plants[0], 1), roundId: '999999' }, undefined, 409); guards.push('Unknown-round share rejected');
  }
  for (const plant of plants) for (let index = 1; index <= 3; index++) receipts.push((await send(plant, index)).receipt);
  const duplicate = await send(plants[0], 1); assert.equal(duplicate.receipt.alreadyAcknowledged, true); guards.push('Duplicate delivery returns the actual original receipt');
  receipts.push(await transact(governor, d.round, 'OrtalamaRound', 'startClosing', [id]));
  if (main) {
    await post(`http://127.0.0.1:${trusteePort + 1}/rounds/${id}/publish`, { simulation: true }, 'invalid', 403); guards.push('Unauthorised publication controller rejected');
    const bad = await publish(id, 1, plants.at(-1)!.installationId);
    assert.equal(Number(bad.receipt.errorArgs[0]), 1);
    assert.equal(bad.faultReceipt.status, 'success');
    attacks.push({ id: 1, label: 'Trustee omits a committed member', ...bad.receipt, faultReceipt: bad.faultReceipt, faultyTrusteeIndex: 1 });
  }
  receipts.push((await publish(id, 2)).receipt, (await publish(id, 3)).receipt);
  receipts.push(await transact(governor, d.round, 'OrtalamaRound', 'close', [id]));
  await send(plants[0], 1, 409); guards.push('Post-close share rejected');
  const result = await readRound(id);
  const E = plants.reduce((sum, p) => sum + p.opening.E, 0n), P = plants.reduce((sum, p) => sum + p.opening.P, 0n);
  assert.equal(result.SE, E); assert.equal(result.SP, P); assert.equal(result.intensity, E * 1_000_000n / P);
  console.log(`SIMULATED round ${id}: closed ${plants.length} plants; public intensity ${result.intensity}/1000000`);
  return result;
}
// The index is disposable: an actually orphaned round must disappear on rebuild.
if(!publicTestnet){
const checkpoint = await (client as any).request({ method: 'evm_snapshot', params: [] });
await createRound();
const beforeReorg = await post(`${base}/sync`, {});
assert.equal((await (await fetch(`${base}/rounds`)).json()).length, 1);
assert.equal(await (client as any).request({ method: 'evm_revert', params: [checkpoint] }), true);
await (client as any).request({ method: 'evm_mine', params: [] });
const rebuilt = await post(`${base}/sync`, {});
assert.ok(rebuilt.reorgRebuildCount > beforeReorg.reorgRebuildCount, 'Reorg rebuild counter did not advance');
assert.equal((await (await fetch(`${base}/rounds`)).json()).length, 0);
guards.push('Actual Anvil chain reorganisation removes the orphaned PostgreSQL round');
receipts.length = 0; // Orphaned transactions are never reported as final-chain evidence.
}

const id = await createRound(), plants = await sealPlants(id, 12, true);
const result = await shareAndClose(id, plants, true);
assert.equal(Number(result.faultMask), 1);
const clean = plants[0]!, proof = await badgeProof(clean.opening, id, clean.installationId, result.SE, result.SP, 0n);
const badgeReceipt = await transact(governor, d.badge, 'BadgeRegistry', 'attest', [id, id, clean.installationId, 0n, proof]);
const dirty = plants.at(-1)!;
let impossibleBlocked = false;
try { await badgeProof(dirty.opening, id, dirty.installationId, result.SE, result.SP, 0n); } catch { impossibleBlocked = true; }
assert.equal(impossibleBlocked, true, 'Above-average witness unexpectedly proved');
const fixedNum = result.config.thresholdNumerators[0], fixedDen = result.config.thresholdDenominators[0];
const realDifferentThresholdProof = await badgeProof(dirty.opening, id, dirty.installationId, fixedNum, fixedDen, 1n);
attacks.push({ id: 5, label: 'Above-average badge: witness blocked, different-threshold proof rejected', witnessGenerationBlocked: true, ...await transact(governor, d.badge, 'BadgeRegistry', 'attest', [id, id, dirty.installationId, 0n, realDifferentThresholdProof], 'InvalidProof') });
const second = await createRound(), nextPlants = await sealPlants(second, 5);
await shareAndClose(second, nextPlants);
attacks.push({ id: 6, label: 'Actual previous-round badge replay at a distinct closed round', ...await transact(governor, d.badge, 'BadgeRegistry', 'attest', [second, id, clean.installationId, 0n, proof], 'WrongRound') });
const falseContextReceipt = await transact(governor, d.badge, 'BadgeRegistry', 'attest', [second, second, clean.installationId, 0n, proof], 'InvalidProof');
const small = await createRound(); await sealPlants(small, 4);
receipts.push(await transact(governor, d.round, 'OrtalamaRound', 'startSharing', [small]));
const smallFailure = await transact(governor, d.round, 'OrtalamaRound', 'startClosing', [small], 'CohortTooSmall');
assert.equal(Number((await readRound(small)).state), 2);
const abortReceipt = await transact(governor, d.round, 'OrtalamaRound', 'abort', [small, keccak256(toHex('CohortTooSmall'))]);
assert.equal(Number((await readRound(small)).state), 5);
attacks.push({ id: 4, label: 'Four plants cannot enter Closing; separate successful abort', ...smallFailure, abortReceipt });

const invalidShareRound=publicTestnet?undefined:await negativeShareRound();
async function negativeShareRound(){
const invalidShareRound = await createRound(), seed = scenario.plants[0];
const maliciousPlant = await preparePlant(invalidShareRound, seed.installationId, BigInt(seed.E), BigInt(seed.P), 1);
await commitPlant(maliciousPlant, toHex(100n, { size: 32 }));
await transact(governor, d.round, 'OrtalamaRound', 'startSharing', [invalidShareRound]);
const vssRejection = await send(maliciousPlant, 1, 409); assert.equal(vssRejection.detail, 'ShareCommitmentMismatch'); guards.push('Signed ciphertext containing an invalid VSS share rejected without blaming trustee');
receipts.push((await send(maliciousPlant, 2)).receipt);
assert.equal(Number((await readRound(invalidShareRound)).receipts[0]), 0);
const deadline = (await readRound(invalidShareRound)).config.sharingDeadline;
const clock = (await client.getBlock()).timestamp;
await (client as any).request({ method: 'evm_increaseTime', params: [Number(deadline - clock + 1n)] });
await (client as any).request({ method: 'evm_mine', params: [] });
const expired = await send(maliciousPlant, 3, 409); assert.equal(expired.detail, 'SharingDeadlinePassed'); guards.push('Valid encrypted share rejected after deadline');
await transact(governor, d.round, 'OrtalamaRound', 'abort', [invalidShareRound, keccak256(toHex('SIMULATED invalid-share negative test'))]);
return invalidShareRound;
}

await post(`${base}/sync`, {});
const evidence = await (await fetch(`${base}/rounds/${id}/evidence`)).json();
assert.equal(evidence.snapshot.blockHash, (await client.getBlock({ blockNumber: BigInt(evidence.snapshot.block) })).hash);
const verified = await verifySnapshot(evidence.snapshot, a.abi.find((x: any) => x.name === 'createRound').inputs[0], a.abi.find((x: any) => x.name === 'commit').inputs[0]);
const cosignatures = await verifyPublicAttestations(evidence.snapshot, evidence.attestations);
const tampered = structuredClone(evidence.snapshot); tampered.round.SE = (BigInt(tampered.round.SE) + 1n).toString();
await assert.rejects(verifySnapshot(tampered, a.abi.find((x: any) => x.name === 'createRound').inputs[0], a.abi.find((x: any) => x.name === 'commit').inputs[0])); guards.push('Public verifier rejects tampered stored result');
assert.ok(evidence.events.some((x: any) => x.eventName === 'RoundClosed'));
assert.ok(evidence.events.some((x: any) => x.eventName === 'BadgeAttested'));
assert.equal(attacks.length, 6); assert.ok(attacks.every(x => x.status === 'reverted'));
const output = { simulation: true, status: 'PASS', chainId:d.chainId,deployment:d.round,scope: publicTestnet?'Actual Monad testnet, three local FastAPI trustees, PostgreSQL indexer, Noble co-signatures, real Groth16 proofs and six mined reverting transactions':'Real local chain, three FastAPI trustees, PostgreSQL indexer, Noble co-signatures, real Groth16 proofs and six mined reverting transactions', mainRoundId: id, secondClosedRoundId: second, abortedRoundIds: [small, invalidShareRound], publicResult: verified, cosignatures, badge: { receipt: badgeReceipt, proof }, attacks: attacks.sort((x, y) => x.id - y.id), additionalContextLieRevert: falseContextReceipt, guards, successfulReceipts: receipts, indexedEvents: evidence.events.length, elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2)), limitations: ['All actors and plant values SIMULATED; same-host custody is not independent', 'No physical report validation or human review claimed before Phase 5', publicTestnet?'Local-only reorganisation, invalid-share and clock-advance fixtures skipped on public testnet':'Local test clock advanced only for deadline rejection'] };
await save(runtimePath('SIMULATED_e2e_evidence.json'), output);
await save(publicTestnet?'docs/SIMULATED_MONAD_ROUND_RESULTS.json':'data/simulated/SIMULATED_PHASE4_CLI_RESULTS.json', output);
process.stdout.write(stringify({ simulation: true, status: output.status, roundId: id, intensity: verified.intensity, revertedAttacks: attacks.length, elapsedSeconds: output.elapsedSeconds }) + '\n', () => process.exit(0));
