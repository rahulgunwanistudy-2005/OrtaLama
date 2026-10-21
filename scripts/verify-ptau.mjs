import { appendFile, writeFile, readFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as snarkjs from 'snarkjs';

const path = 'circuits/ceremony/powersOfTau28_hez_final_15.ptau';
const expected = '982372c867d229c236091f767e703253249a9b432c1710b4f326306bfa2428a17b06240359606cfe4d580b10a5a1f63fbed499527069c18ae17060472969ae6e';
if (createHash('blake2b512').update(await readFile(path)).digest('hex') !== expected) throw new Error('PublishedPowersOfTauHashMismatch');
const log = 'circuits/ceremony/ptau-verification.log';
await writeFile(log, 'Published BLAKE2b-512 checksum matches upstream snarkjs table.\n');
// snarkjs 0.7.6's verification API does not expose thread options. Prime the
// ffjavascript cache with the same official single-thread curve implementation.
const curve = await snarkjs.curves.getCurveFromName('bn128', { singleThread: true });
globalThis.curve_bn128 = curve;
const logger = Object.fromEntries(['info', 'debug', 'warn', 'error'].map(level => [level, (...args) => {
  const line = `[${level}] ${args.map(String).join(' ')}`;
  appendFileSync(log, line + '\n');
  if (level !== 'debug') console.log(line);
}]));
try {
  const valid = await snarkjs.powersOfTau.verify(path, logger);
  await appendFile(log, `FULL_TRANSCRIPT_VERIFICATION=${valid ? 'PASS' : 'FAIL'}\n`);
  if (!valid) process.exitCode = 1;
} finally { await curve.terminate(); }
