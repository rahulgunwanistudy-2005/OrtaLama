import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import * as snarkjs from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import { createCrypto } from '../../packages/crypto-ts/src/index.ts';

const c = await createCrypto(), poseidon = await buildPoseidon();
after(async () => { const curve = await snarkjs.curves.getCurveFromName('bn128'); await curve.terminate(); });
const hash = values => poseidon.F.toObject(poseidon(values));
const serialise = x => JSON.parse(JSON.stringify(x, (_, v) => typeof v === 'bigint' ? v.toString() : v));
const context = { roundId: 1n, installationHi: 2n, installationLo: 3n, chainId: 31337n, contractAddress: 12345n };
const base = { ...context, E: 880n, r: c.l - 1n, P: 1000n, s: 20n };
const badge = (patch = {}) => {
  const input = { ...base, thresholdNum: 880n, thresholdDen: 1000n, thresholdId: 0n, ...patch };
  const CE = c.commit(input.E, input.r < c.l ? input.r : input.r % c.l), CP = c.commit(input.P, input.s < c.l ? input.s : input.s % c.l);
  return { ...input, CE, CP, contextTag: hash([2n, ...CE, ...CP, input.thresholdNum, input.thresholdDen, input.roundId, input.installationHi, input.installationLo, input.thresholdId, input.chainId, input.contractAddress]) };
};
const validity = (patch = {}) => {
  const input = { ...base, aE: 9n, ar: 11n, aP: 13n, as: 17n, ...patch };
  const CE = c.commit(input.E, input.r % c.l), CP = c.commit(input.P, input.s % c.l), AE = c.commit(input.aE % c.l, input.ar % c.l), AP = c.commit(input.aP % c.l, input.as % c.l);
  return { ...input, CE, CP, AE, AP, contextTag: hash([1n, ...CE, ...CP, ...AE, ...AP, input.roundId, input.installationHi, input.installationLo, input.chainId, input.contractAddress]) };
};
const wasm = name => `circuits/build/${name}_js/${name}.wasm`;
async function witness(name, input) {
  const w = { type: 'mem' };
  await snarkjs.wtns.calculate(serialise(input), wasm(name), w);
  return w;
}
let positiveCases = 0, negativeCases = 0;
test('badge accepts equality, below threshold and zero emissions with genuine checked witnesses', async () => {
  for (const input of [badge(), badge({ E: 600n }), badge({ E: 0n, r: 0n, s: 0n }), badge({ E: (1n << 48n) - 1n, P: (1n << 48n) - 1n, thresholdNum: 1n, thresholdDen: 1n })]) {
    const w = await witness('below_threshold', input);
    assert.equal(await snarkjs.wtns.check('circuits/build/below_threshold.r1cs', w), true);
    positiveCases++;
  }
});
test('badge blocks wrong opening, above threshold, range violations, zero denominator/production and context replay', async () => {
  const good = badge();
  const negative = [
    { ...good, E: 879n }, badge({ E: 881n }),
    badge({ E: 1n << 48n, thresholdNum: (1n << 56n) - 1n, thresholdDen: 1n }),
    badge({ P: 1n << 48n }), badge({ r: c.l }), badge({ s: c.l }),
    badge({ P: 0n, E: 0n }), badge({ thresholdDen: 0n }),
    badge({ thresholdNum: 1n << 56n }),
    { ...good, roundId: 2n }, { ...good, installationLo: 4n },
    { ...good, chainId: 1n }, { ...good, contractAddress: 2n }, { ...good, thresholdId: 1n },
    badge({ roundId: 1n << 64n }), badge({ installationHi: 1n << 128n }),
  ];
  for (const input of negative) { await assert.rejects(() => witness('below_threshold', input)); negativeCases++; }
});
test('validity accepts bounded openings and proves knowledge of slope commitment openings', async () => {
  for (const input of [validity(), validity({ E: 0n, r: 0n, s: 0n, aE: 0n, ar: 0n, aP: 0n, as: 0n }), validity({ E: (1n << 48n) - 1n, P: (1n << 48n) - 1n, aE: c.l - 1n, as: c.l - 1n })]) {
    const w = await witness('commitment_validity', input);
    assert.equal(await snarkjs.wtns.check('circuits/build/commitment_validity.r1cs', w), true);
    positiveCases++;
  }
});
test('validity blocks modular aliases, zero production, out-of-range inputs and context/slope substitutions', async () => {
  const good = validity();
  for (const input of [validity({ E: 1n << 48n }), validity({ P: 0n }), validity({ P: 1n << 48n }), validity({ r: c.l }), validity({ aE: c.l }), validity({ ar: c.l }), validity({ aP: c.l }), validity({ as: c.l }), { ...good, aE: 10n }, { ...good, roundId: 2n }, { ...good, AE: good.AP }]) {
    await assert.rejects(() => witness('commitment_validity', input)); negativeCases++;
  }
});
test('real Groth16 proofs verify; altered public inputs and invalid witness do not', async () => {
  const measurements = [];
  for (const [name, input, publicCount] of [['below_threshold', badge(), 13], ['commitment_validity', validity(), 14]]) {
    const vk = JSON.parse(await readFile(`circuits/ceremony/${name}_verification_key.json`, 'utf8'));
    const start = performance.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(serialise(input), wasm(name), `circuits/ceremony/${name}_final.zkey`, undefined, undefined, { singleThread: true });
    const provingMs = performance.now() - start;
    assert.equal(publicSignals.length, publicCount);
    assert.equal(await snarkjs.groth16.verify(vk, publicSignals, proof), true);
    // Every public input independently participates in proof verification.
    for (let i = 0; i < publicSignals.length; i++) {
      const changed = [...publicSignals]; changed[i] = ((BigInt(changed[i]) + 1n) % c.q).toString();
      assert.equal(await snarkjs.groth16.verify(vk, changed, proof), false, `${name} unconstrained public input ${i}`);
    }
    await assert.rejects(() => snarkjs.groth16.fullProve(serialise({ ...input, E: input.E + 1n }), wasm(name), `circuits/ceremony/${name}_final.zkey`, undefined, undefined, { singleThread: true }));
    measurements.push({ name, publicInputs: publicCount, nodeProvingMs: Number(provingMs.toFixed(2)), browserProvingMs: null, browserStatus: 'NOT_MEASURED' });
  }
  const report = { phase: 2, simulation: true, status: 'PARTIAL', witnessPositiveCases: positiveCases, witnessNegativeCases: negativeCases, publicInputMutationsRejected: 27, measurements, remaining: ['Browser proving measurement', 'Independent security review of protocol/circuits'] };
  await writeFile('docs/PHASE2_RESULTS.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
});
