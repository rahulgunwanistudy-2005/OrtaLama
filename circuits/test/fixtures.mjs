import { createCrypto } from '../../packages/crypto-ts/src/index.ts';
import { buildPoseidon } from 'circomlibjs';

/** Public, synthetic fixtures only. No plant data, identity or secret is real. */
export async function createFixtures() {
  const c = await createCrypto(), poseidon = await buildPoseidon();
  const hash = values => poseidon.F.toObject(poseidon(values));
  const context = { roundId: 1n, installationHi: 2n, installationLo: 3n, chainId: 31337n, contractAddress: 12345n };
  const base = { ...context, E: 880n, r: c.l - 1n, P: 1000n, s: 20n };
  const badge = (patch = {}) => {
    const input = { ...base, thresholdNum: 880n, thresholdDen: 1000n, thresholdId: 0n, ...patch };
    const CE = c.commit(input.E, input.r % c.l), CP = c.commit(input.P, input.s % c.l);
    return { ...input, CE, CP, contextTag: hash([2n, ...CE, ...CP, input.thresholdNum, input.thresholdDen, input.roundId, input.installationHi, input.installationLo, input.thresholdId, input.chainId, input.contractAddress]) };
  };
  const validity = (patch = {}) => {
    const input = { ...base, aE: 9n, ar: 11n, aP: 13n, as: 17n, ...patch };
    const CE = c.commit(input.E, input.r % c.l), CP = c.commit(input.P, input.s % c.l), AE = c.commit(input.aE % c.l, input.ar % c.l), AP = c.commit(input.aP % c.l, input.as % c.l);
    return { ...input, CE, CP, AE, AP, contextTag: hash([1n, ...CE, ...CP, ...AE, ...AP, input.roundId, input.installationHi, input.installationLo, input.chainId, input.contractAddress]) };
  };
  return { c, badge, validity };
}
