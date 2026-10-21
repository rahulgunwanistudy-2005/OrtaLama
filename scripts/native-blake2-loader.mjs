// Verification-only acceleration. Identical BLAKE2b-512 input/output; no check
// is removed. The public power-28 challenge hashes ~96 GiB of repeated points.
// Native OpenSSL avoids spending that time in JavaScript's BLAKE2b loop.
import { registerHooks } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
import { blake2b } from '@noble/hashes/blake2.js';
import assert from 'node:assert/strict';

for (const length of [0, 1, 127, 128, 129, 1024, 1_000_000]) {
  const bytes = randomBytes(length);
  const native = createHash('blake2b512'), noble = blake2b.create({ dkLen: 64 });
  for (let offset = 0; offset < bytes.length; offset += 97) {
    const block = bytes.subarray(offset, offset + 97);
    native.update(block); noble.update(block);
  }
  assert.deepEqual(new Uint8Array(native.digest()), noble.digest());
}
registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (!url.endsWith('/snarkjs/src/powersoftau_utils.js')) return loaded;
    const text = typeof loaded.source === 'string' ? loaded.source : new TextDecoder().decode(loaded.source);
    const marker = 'export function calculateFirstChallengeHash(curve, power, logger) {';
    const start = text.indexOf(marker), end = text.indexOf('export async function keyFromBeacon', start);
    assert.ok(start > 0 && end > start, 'upstream source changed; refusing patch');
    const functionText = text.slice(start, end);
    const needle = 'const hasher = blake2b.create({ dkLen: 64 });';
    assert.equal(functionText.split(needle).length, 2);
    const replaced = functionText.replace(needle, 'const hasher = ortalamaNativeHash("blake2b512");');
    return { ...loaded, source: 'import { createHash as ortalamaNativeHash } from "node:crypto";\n' + text.slice(0, start) + replaced + text.slice(end) };
  },
});
