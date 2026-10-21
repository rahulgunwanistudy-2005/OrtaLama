/** Actual signatures, encrypted shares and Groth16 proofs on SIMULATED inputs. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeAbiParameters, keccak256, toHex, type Hex, type Address } from 'viem';
import * as snarkjs from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import { createCrypto, pqKeygen, pqPublicKeyHash, coSign, verifyCoSignature, seal, open, envelopeHash, trusteeKeygen, typedStatement, type Statement } from '../packages/crypto-ts/src/index.js';

// Foundry FFI stdout is ABI bytes only. Diagnostic witness messages go to stderr.
console.log = (...args) => { process.stderr.write(args.map(String).join(' ') + '\n'); };
const [roundAddress, badgeAddress, roundString = '1'] = process.argv.slice(2) as [Address, Address, string?];
assert.match(roundAddress, /^0x[0-9a-fA-F]{40}$/); assert.match(badgeAddress, /^0x[0-9a-fA-F]{40}$/);
const roundId = BigInt(roundString), chainId = 31337n;
const keyHash = createHash('sha256').update(await readFile('circuits/ceremony/commitment_validity_final.zkey')).update(await readFile('circuits/ceremony/below_threshold_final.zkey')).digest('hex');
const cache = createHash('sha256').update(`${keyHash}:${roundAddress.toLowerCase()}:${badgeAddress.toLowerCase()}:${roundId}:pq-link-v1`).digest('hex').slice(0, 16);
const file = `data/simulated/SIMULATED_contract_fixtures_${cache}.json`;
try {
  const saved = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(saved.simulation, true); assert.equal(saved.keyHash, keyHash);
  process.stdout.write(encodeAbiParameters([{ type: 'string' }], [file]));
  process.exit(0);
} catch (error: any) { if (error.code !== 'ENOENT') throw error; }

const c = await createCrypto(), poseidon = await buildPoseidon();
(globalThis as any).curve_bn128 = await snarkjs.curves.getCurveFromName('bn128', { singleThread: true });
const hash = (values: bigint[]) => poseidon.F.toObject(poseidon(values)) as bigint;
const serialise = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v);
// Publicly known test-only EOA identities. Never use these keys outside simulation.
const verifier = privateKeyToAccount(toHex(1n, { size: 32 }));
const foreign = privateKeyToAccount(toHex(99n, { size: 32 }));
const trustees = [2n, 3n, 4n].map(x => privateKeyToAccount(toHex(x, { size: 32 })).address);
const encryption = [trusteeKeygen(), trusteeKeygen(), trusteeKeygen()];
const pq = pqKeygen(), pqKeyHash = pqPublicKeyHash(pq.publicKey);
const ids = Array.from({ length: 12 }, (_, i) => keccak256(toHex(`SIMULATED_INSTALLATION_${i}`)));
const tree = StandardMerkleTree.of(ids.map(id => [id]), ['bytes32']);
const verifierTree = StandardMerkleTree.of([[verifier.address, pqKeyHash]], ['address', 'bytes32']);
const cohortProof = new Map<string, Hex[]>();
for (const [i, value] of tree.entries()) cohortProof.set(value[0]!, tree.getProof(i) as Hex[]);
const pointComponents = [{ name: 'x', type: 'uint256' }, { name: 'y', type: 'uint256' }] as const;
const statementComponents = [
  { name: 'roundId', type: 'uint256' }, { name: 'installationId', type: 'bytes32' },
  { name: 'CE', type: 'tuple', components: pointComponents }, { name: 'CP', type: 'tuple', components: pointComponents },
  { name: 'AE', type: 'tuple', components: pointComponents }, { name: 'AP', type: 'tuple', components: pointComponents },
  { name: 'reportHash', type: 'bytes32' }, { name: 'metadataHash', type: 'bytes32' }, { name: 'pqKeyHash', type: 'bytes32' },
] as const;
const proofComponents = [{ name: 'a', type: 'uint256[2]' }, { name: 'b', type: 'uint256[2][2]' }, { name: 'c', type: 'uint256[2]' }, { name: 'contextTag', type: 'uint256' }] as const;
const sumComponents = ['E', 'r', 'P', 's'].map(name => ({ name, type: 'uint256' as const }));
const pointObject = (p: readonly bigint[]) => ({ x: p[0]!, y: p[1]! });
const proofs: Record<string, unknown> = {};
const openings: any[] = [], rows: any[] = [];
const emissions = [700n, 750n, 800n, 820n, 840n, 860n, 880n, 900n, 920n, 950n, 1000n, 1140n];
async function prove(name: string, input: any): Promise<any> {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(JSON.parse(serialise(input)), `circuits/build/${name}_js/${name}.wasm`, `circuits/ceremony/${name}_final.zkey`, undefined, undefined, { singleThread: true });
  const vk = JSON.parse(await readFile(`circuits/ceremony/${name}_verification_key.json`, 'utf8'));
  assert.equal(await snarkjs.groth16.verify(vk, publicSignals, proof), true);
  const call = JSON.parse(`[${await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)}]`);
  const convert = (value: any): any => Array.isArray(value) ? value.map(convert) : BigInt(value);
  return { a: convert(call[0]), b: convert(call[1]), c: convert(call[2]), contextTag: input.contextTag };
}
try {
  for (let i = 0; i < 12; i++) {
    const opening = { E: emissions[i]!, P: 1000n, r: c.randomScalar(), s: c.randomScalar() };
    const sharing = c.sharePlant(opening), id = ids[i]!;
    const ciphertextHashes = sharing.shares.map((share, j) => {
      assert.equal(c.verifyShare(share, sharing), true);
      const context = { chainId: chainId.toString(), verifyingContract: roundAddress.toLowerCase(), roundId: roundId.toString(), installationId: id, trusteeIndex: j + 1 };
      const plaintext = new TextEncoder().encode(serialise({ simulation: true, ...share }));
      const envelope = seal(encryption[j]!.publicKey, plaintext, context);
      assert.deepEqual(open(encryption[j]!.secretKey, envelope, context), plaintext);
      return `0x${envelopeHash(envelope)}` as Hex;
    }) as [Hex, Hex, Hex];
    const validationHash = keccak256(toHex(`SIMULATED reviewed fixture ${i}`));
    const metadataHash = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32[3]' }], [validationHash, ciphertextHashes]));
    const s: Statement = { chainId, verifyingContract: roundAddress, roundId, installationId: id, CE: sharing.CE, CP: sharing.CP, AE: sharing.AE, AP: sharing.AP, reportHash: keccak256(toHex(serialise({ simulation: true, installationId: id, E: opening.E, P: opening.P, report: 'SIMULATED contract test report' }))), metadataHash, pqKeyHash };
    const sig = await coSign(s, verifier, pq);
    assert.equal(await verifyCoSignature(s, verifier.address, pqKeyHash, pq.publicKey, sig), true);
    const statement = { roundId, installationId: id, CE: pointObject(s.CE), CP: pointObject(s.CP), AE: pointObject(s.AE), AP: pointObject(s.AP), reportHash: s.reportHash, metadataHash, pqKeyHash };
    const installationHi = BigInt(id) >> 128n, installationLo = BigInt(id) & ((1n << 128n) - 1n);
    const contextTag = hash([1n, ...s.CE, ...s.CP, ...s.AE, ...s.AP, roundId, installationHi, installationLo, chainId, BigInt(roundAddress)]);
    const input = { CE: s.CE, CP: s.CP, AE: s.AE, AP: s.AP, roundId, installationHi, installationLo, chainId, contractAddress: BigInt(roundAddress), contextTag, ...opening, aE: sharing.slopes.E, ar: sharing.slopes.r, aP: sharing.slopes.P, as: sharing.slopes.s };
    const proof = await prove('commitment_validity', input);
    rows.push({ id, statement: encodeAbiParameters([{ type: 'tuple', components: statementComponents }], [statement]), proof: encodeAbiParameters([{ type: 'tuple', components: proofComponents }], [proof]), validationHash, ciphertextHashes: encodeAbiParameters([{ type: 'bytes32[3]' }], [ciphertextHashes]), verifierSignature: sig.ecdsa, pqLink: sig.pqLink, pqSignatureHash: sig.pqSignatureHash, foreignSignature: await foreign.signTypedData(typedStatement(s)), cohortProof: encodeAbiParameters([{ type: 'bytes32[]' }], [cohortProof.get(id)!]), shares: sharing.shares.map(x => encodeAbiParameters([{ type: 'tuple', components: sumComponents }], [{ E: x.E, r: x.r, P: x.P, s: x.s }])), E: opening.E.toString(), P: opening.P.toString() });
    openings.push({ ...opening, CE: s.CE, CP: s.CP, installationHi, installationLo });
  }
  const sectorE = emissions.reduce((a, b) => a + b, 0n), sectorP = BigInt(emissions.length) * 1000n;
  for (const [name, i, numerator, denominator, thresholdId] of [['below', 0, sectorE, sectorP, 0n], ['equal', 6, sectorE, sectorP, 0n], ['fixed', 0, 1000n, 1000n, 1n]] as const) {
    const o = openings[i];
    const contextTag = hash([2n, ...o.CE, ...o.CP, numerator, denominator, roundId, o.installationHi, o.installationLo, thresholdId, chainId, BigInt(badgeAddress)]);
    const input = { ...o, roundId, thresholdNum: numerator, thresholdDen: denominator, thresholdId, chainId, contractAddress: BigInt(badgeAddress), contextTag };
    const proof = await prove('below_threshold', input);
    proofs[name] = encodeAbiParameters([{ type: 'tuple', components: proofComponents }], [proof]);
  }
  const data = { simulation: true, keyHash, roundAddress, badgeAddress, roundId: roundId.toString(), cohortRoot: tree.root, verifierRoot: verifierTree.root, trustees, encryptionKeys: encryption.map(x => `0x${Buffer.from(x.publicKey).toString('hex')}`), verifier: verifier.address, pqKeyHash, plants: rows, badges: proofs };
  await mkdir('data/simulated', { recursive: true }); await writeFile(file, serialise(data) + '\n');
  process.stdout.write(encodeAbiParameters([{ type: 'string' }], [file]));
} finally { const curve = await snarkjs.curves.getCurveFromName('bn128'); await curve.terminate(); }
