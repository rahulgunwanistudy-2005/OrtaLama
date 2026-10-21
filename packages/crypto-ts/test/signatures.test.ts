import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { coSign, pqKeygen, pqPublicKeyHash, verifyCoSignature, type Statement } from '../src/signatures.js';
import { createCrypto } from '../src/index.js';
const c = await createCrypto();

test('ECDSA and ML-DSA authenticate the same domain-bound statement and registered key', async () => {
  const signer = privateKeyToAccount(generatePrivateKey()), pq = pqKeygen();
  const s: Statement = { chainId: 31337n, verifyingContract: `0x${'11'.repeat(20)}`, roundId: 1n, installationId: `0x${'22'.repeat(32)}`, CE: c.commit(880n, 10n), CP: c.commit(1000n, 20n), AE: c.commit(4n, 5n), AP: c.commit(6n, 7n), reportHash: `0x${'33'.repeat(32)}`, metadataHash: `0x${'44'.repeat(32)}`, pqKeyHash: pqPublicKeyHash(pq.publicKey) };
  const sig = await coSign(s, signer, pq);
  assert.equal(await verifyCoSignature(s, signer.address, s.pqKeyHash, pq.publicKey, sig), true);
  for (const replacement of [{ roundId: 2n }, { chainId: 1n }, { reportHash: `0x${'55'.repeat(32)}` as const }, { metadataHash: `0x${'55'.repeat(32)}` as const }, { verifyingContract: `0x${'66'.repeat(20)}` as const }, { installationId: `0x${'66'.repeat(32)}` as const }, { CE: c.commit(881n, 10n) }, { AE: c.commit(5n, 5n) }]) assert.equal(await verifyCoSignature({ ...s, ...replacement }, signer.address, s.pqKeyHash, pq.publicKey, sig), false);
  const other = pqKeygen();
  assert.equal(await verifyCoSignature(s, privateKeyToAccount(generatePrivateKey()).address, s.pqKeyHash, pq.publicKey, sig), false);
  assert.equal(await verifyCoSignature(s, signer.address, s.pqKeyHash, other.publicKey, sig), false);
  assert.equal(await verifyCoSignature(s, signer.address, pqPublicKeyHash(other.publicKey), other.publicKey, sig), false);
  const broken = new Uint8Array(sig.pqSignature); broken[0] = broken[0]! ^ 1;
  assert.equal(await verifyCoSignature(s, signer.address, s.pqKeyHash, pq.publicKey, { ...sig, pqSignature: broken }), false);
  await assert.rejects(() => coSign(s, signer, other), /PQKeyIdentityMismatch/);
});
