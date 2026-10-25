/** Private CLI for local or explicitly selected Monad SIMULATED plants. Secret numeric inputs come from a file. */
import assert from 'node:assert/strict';
import { toHex, type Hex } from 'viem';
import { canonicalDecimal } from '../../packages/crypto-ts/src/index.js';
import { client, deployment, json, runtimePath, readRound, badgeProof, transact, stringify, assertSimulationContext, actorSigningKey } from '../../packages/protocol/src/runtime.js';
import { preparePlant, commitPlant } from './agent.js';

const [command, path, threshold = '0'] = process.argv.slice(2);
if (command === '--help' || !command) {
  console.log('SIMULATED private CLI. Usage: plant-agent <prepare|commit|share|badge> <private JSON file> [badge threshold ID]\nprepare input: {roundId,installationId,E,P}, canonical decimal strings. Use a private file, never command-line secret values. Runtime endpoints are supplied through ORTALAMA_* environment variables.');
  process.exit(0);
}
try {
  assert.equal(process.env.ORTALAMA_SIMULATION, '1');
  await assertSimulationContext(await deployment());
  assert.ok(path);
  const input = await json(path), d = await deployment();
  const roundId = canonicalDecimal(String(input.roundId)), installationId = input.installationId as Hex;
  assert.match(installationId, /^0x[0-9a-f]{64}$/);
  const scenario = await json(runtimePath('SIMULATED_scenario.json'));
  const actorIndex = scenario.plants.findIndex((p: any) => p.installationId === installationId);
  assert.ok(actorIndex >= 0);
  const signingKey = await actorSigningKey(actorIndex);
  let output;
  if (command === 'prepare') {
    await preparePlant(roundId, installationId, canonicalDecimal(input.E), canonicalDecimal(input.P));
    output = { privateArtifact: runtimePath(`plants/SIMULATED_round_${roundId}_${installationId}_secret.json`), humanApprovalPerformed: false };
  } else if (command === 'commit') {
    assert.equal(input.simulation, true);
    output = await commitPlant(input, signingKey);
  } else if (command === 'share') {
    assert.equal(input.simulation, true);
    const receipts = [];
    for (let index = 1; index <= 3; index++) {
      const response = await fetch(`http://127.0.0.1:${Number(process.env.ORTALAMA_TRUSTEE_BASE_PORT ?? 8700) + index}/shares`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: stringify({ simulation: true, roundId: String(roundId), installationId, envelope: input.envelopes[index - 1] }) });
      if (!response.ok) throw new Error(`TrusteeDeliveryHTTP${response.status}`);
      receipts.push((await response.json()).receipt);
    }
    output = { receipts };
  } else if (command === 'badge') {
    assert.equal(input.simulation, true);
    const round = await readRound(roundId), tid = canonicalDecimal(threshold);
    assert.ok(tid <= BigInt(round.config.fixedThresholdCount));
    assert.equal(Number(round.state), 4);
    const opening = Object.fromEntries(['E', 'r', 'P', 's'].map(k => [k, canonicalDecimal(input.opening[k])])) as any;
    const proof = await badgeProof(opening, roundId, installationId, tid === 0n ? round.SE : round.config.thresholdNumerators[Number(tid) - 1], tid === 0n ? round.SP : round.config.thresholdDenominators[Number(tid) - 1], tid);
    output = await transact(signingKey, d.badge, 'BadgeRegistry', 'attest', [roundId, roundId, installationId, tid, proof]);
  } else throw new Error('UnknownCommand');
  process.stdout.write(stringify({ simulation: true, ...output }) + '\n', () => process.exit(0));
} catch {
  // RPC errors can embed full request payloads. Keep this public error bounded.
  process.stderr.write('Plant operation failed. Check the local private input, selected deployment, lifecycle and service health.\n');
  process.exit(1);
}
