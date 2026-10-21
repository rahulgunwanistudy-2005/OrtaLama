import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createCrypto, seal, open, trusteeKeygen, type ShareContext } from '../packages/crypto-ts/src/index.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const started = performance.now();
const c = await createCrypto();
const serialise = (v: unknown) => JSON.stringify(v, (_, x) => typeof x === 'bigint' ? x.toString() : x);
const fixed = (i: number, label: string) => BigInt(`0x${bytesToHex(keccak_256(new TextEncoder().encode(`SIMULATED_VECTOR_${i}_${label}`)))}`) % c.l;
// Deterministic, publicly known fixtures; modulo here is NOT used as an RNG.
const vectors = Array.from({ length: 224 }, (_, i) => ({
  value: i === 0 ? 0n : i === 1 ? c.l - 1n : i === 2 ? (1n << 48n) - 1n : fixed(i, 'value'),
  blinding: i === 0 ? 0n : fixed(i, 'blinding'), slope: i === 0 ? 0n : fixed(i, 'slope'),
}));
const context: ShareContext = { chainId: '31337', verifyingContract: `0x${'11'.repeat(20)}`, roundId: '1', installationId: `0x${'22'.repeat(32)}`, trusteeIndex: 1 };
const transport = Array.from({ length: 16 }, (_, i) => {
  const keys = trusteeKeygen();
  const ctx = { ...context, roundId: String(i + 1), trusteeIndex: i % 3 + 1 };
  const plaintext = new TextEncoder().encode(`SIMULATED transport fixture ${i}`);
  return { envelope: seal(keys.publicKey, plaintext, ctx), context: ctx, SIMULATED_secretKey: bytesToHex(keys.secretKey), plaintext: bytesToHex(plaintext) };
});
const request = { simulation: true, vectors, transport };
const python = process.env.ORTALAMA_PYTHON ?? '.venv/bin/python';
const reference = await new Promise<any>((resolve, reject) => {
  const child = spawn(python, ['packages/crypto-py/reference.py'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', x => { stdout += x; });
  child.stderr.on('data', x => { stderr += x; });
  child.on('error', reject);
  child.on('close', code => {
    if (code !== 0) reject(new Error(`Python reference exited ${code}: ${stderr}`));
    else { try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); } }
  });
  child.stdin.end(serialise(request));
});
assert.equal(reference.q, c.q.toString()); assert.equal(reference.l, c.l.toString());
assert.deepEqual(reference.G, c.G.map(String)); assert.deepEqual(reference.H, c.H.map(String));
assert.equal(reference.counter, c.derivation.counter); assert.equal(reference.digest, c.derivation.digest); assert.equal(reference.input, c.derivation.input);
for (let i = 0; i < vectors.length; i++) {
  const v = vectors[i]!, p = reference.vectors[i];
  assert.deepEqual(c.commit(v.value, v.blinding).map(String), p.commitment, `commitment vector ${i}`);
  const shares = c.evaluate(v.value, v.slope);
  assert.equal(serialise(shares), JSON.stringify(p.shares), `shares vector ${i}`);
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) assert.equal(c.reconstruct([shares[a!]!, shares[b!]!]), v.value);
  assert.deepEqual(p.reconstructed, [v.value.toString(), v.value.toString(), v.value.toString()]);
}
for (let i = 0; i < transport.length; i++) {
  const t = transport[i]!, r = reference.transport[i];
  assert.equal(r.plaintext, t.plaintext);
  assert.equal(bytesToHex(open(Uint8Array.from(Buffer.from(t.SIMULATED_secretKey, 'hex')), r.envelope, t.context)), t.plaintext);
}
const derivation = JSON.parse(serialise({ protocol: 'ORTALAMA_PEDERSEN_H_v1', q: c.q, l: c.l, G: c.G, ...c.derivation }));
const saved = JSON.parse(await readFile('packages/crypto-ts/H.json', 'utf8'));
assert.deepEqual(derivation, saved, 'committed generator record differs from independently re-derived H');
const report = { simulation: true, phase: 1, vectorCount: vectors.length, pairReconstructionsPerLanguage: vectors.length * 3, bidirectionalTransportCases: transport.length, status: 'PASS', elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(3)), node: process.version };
if (process.env.ORTALAMA_RECORD_METRICS === '1') {
  await mkdir('data/simulated', { recursive: true });
  // Never persist the temporary private transport fixture keys.
  await writeFile('data/simulated/SIMULATED_cross_language_vectors.json', serialise({ simulation: true, vectors, expected: reference.vectors, generator: derivation }) + '\n');
  await writeFile('docs/PHASE1_RESULTS.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report));
