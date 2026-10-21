import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = 'https://circom.info/powersOfTau28_hez_final_15.ptau';
const target = 'circuits/ceremony/powersOfTau28_hez_final_15.ptau';
const expected = '982372c867d229c236091f767e703253249a9b432c1710b4f326306bfa2428a17b06240359606cfe4d580b10a5a1f63fbed499527069c18ae17060472969ae6e';
let bytes;
try { bytes = await readFile(target); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const response = await fetch(source, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error(`PowersOfTauDownloadFailed:${response.status}`);
  bytes = new Uint8Array(await response.arrayBuffer());
}
if (createHash('blake2b512').update(bytes).digest('hex') !== expected) throw new Error('PublishedPowersOfTauHashMismatch');
await mkdir('circuits/ceremony', { recursive: true });
await writeFile(target + '.download', bytes);
await rename(target + '.download', target);
console.log('Public powers-of-tau file matches the published BLAKE2b-512 checksum (S20).');
