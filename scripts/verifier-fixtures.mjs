import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { encodeAbiParameters } from 'viem';
import * as snarkjs from 'snarkjs';
import { createFixtures } from '../circuits/test/fixtures.mjs';
console.log = (...args) => process.stderr.write(args.map(String).join(' ') + '\n');
const keyHash = createHash('sha256').update(await readFile('circuits/ceremony/commitment_validity_final.zkey')).update(await readFile('circuits/ceremony/below_threshold_final.zkey')).digest('hex');
const file = `data/simulated/SIMULATED_verifier_vectors_${keyHash.slice(0, 16)}.json`;
try {
  const existing = JSON.parse(await readFile(file, 'utf8'));
  if (!existing.simulation || existing.keyHash !== keyHash) throw new Error('InvalidFixtureCache');
  process.stdout.write(encodeAbiParameters([{ type: 'string' }], [file])); process.exit(0);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const fixtures = await createFixtures();
globalThis.curve_bn128 = await snarkjs.curves.getCurveFromName('bn128', { singleThread: true });
const proofComponents = [{ name: 'a', type: 'uint256[2]' }, { name: 'b', type: 'uint256[2][2]' }, { name: 'c', type: 'uint256[2]' }, { name: 'contextTag', type: 'uint256' }];
const results = { simulation: true, keyHash };
try {
  for (const [name, input, count] of [['below_threshold', fixtures.badge(), 13], ['commitment_validity', fixtures.validity(), 14]]) {
    const serialised = JSON.parse(JSON.stringify(input, (_, v) => typeof v === 'bigint' ? v.toString() : v));
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(serialised, `circuits/build/${name}_js/${name}.wasm`, `circuits/ceremony/${name}_final.zkey`, undefined, undefined, { singleThread: true });
    const vk = JSON.parse(await readFile(`circuits/ceremony/${name}_verification_key.json`, 'utf8'));
    if (!await snarkjs.groth16.verify(vk, publicSignals, proof)) throw new Error('InvalidGeneratedProof');
    const call = JSON.parse(`[${await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)}]`);
    const convert = value => Array.isArray(value) ? value.map(convert) : BigInt(value);
    results[name] = { proof: encodeAbiParameters([{ type: 'tuple', components: proofComponents }], [{ a: convert(call[0]), b: convert(call[1]), c: convert(call[2]), contextTag: input.contextTag }]), inputs: encodeAbiParameters([{ type: `uint256[${count}]` }], [convert(publicSignals)]) };
  }
  await mkdir('data/simulated', { recursive: true }); await writeFile(file, JSON.stringify(results) + '\n');
  process.stdout.write(encodeAbiParameters([{ type: 'string' }], [file]));
} finally { const curve = await snarkjs.curves.getCurveFromName('bn128'); await curve.terminate(); }
