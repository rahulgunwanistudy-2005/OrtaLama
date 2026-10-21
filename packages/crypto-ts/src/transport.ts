import { x25519 } from '@noble/curves/ed25519.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils.js';

export type ShareContext = {
  chainId: string;
  verifyingContract: string;
  roundId: string;
  installationId: string;
  trusteeIndex: number;
};
export type Envelope = {
  version: 1;
  ephemeralPublicKey: string;
  salt: string;
  nonce: string;
  aad: string;
  ciphertext: string;
};
const utf8 = new TextEncoder();
const domain = utf8.encode('ORTALAMA_SHARE_ECIES_v1');
export const trusteeKeygen = () => x25519.keygen();
const concat = (...arrays: Uint8Array[]) => {
  const result = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
};
function fixedHex(value: string, bytes: number): Uint8Array {
  if (typeof value !== 'string' || !new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(value)) throw new Error('NonCanonicalHex');
  return hexToBytes(value);
}
export function contextBytes(c: ShareContext): Uint8Array {
  if (typeof c.chainId !== 'string' || typeof c.roundId !== 'string' || c.chainId.length > 78 || c.roundId.length > 78 || !/^[1-9][0-9]*$/.test(c.chainId) || !/^[1-9][0-9]*$/.test(c.roundId) || BigInt(c.chainId) >= 1n << 256n || BigInt(c.roundId) >= 1n << 256n) throw new Error('InvalidContextInteger');
  if (!/^0x[0-9a-f]{40}$/.test(c.verifyingContract) || !/^0x[0-9a-f]{64}$/.test(c.installationId)) throw new Error('InvalidContextIdentity');
  if (!Number.isInteger(c.trusteeIndex) || c.trusteeIndex < 1 || c.trusteeIndex > 3) throw new Error('InvalidTrusteeIndex');
  return utf8.encode(JSON.stringify(['ORTALAMA_SHARE_v1', c.chainId, c.verifyingContract, c.roundId, c.installationId, c.trusteeIndex]));
}
function key(shared: Uint8Array, salt: Uint8Array, epk: Uint8Array, recipient: Uint8Array, aad: Uint8Array) {
  return hkdf(sha256, shared, salt, concat(domain, epk, recipient, aad), 32);
}
export function seal(recipient: Uint8Array, plaintext: Uint8Array, context: ShareContext): Envelope {
  if (!(recipient instanceof Uint8Array) || recipient.length !== 32) throw new Error('InvalidRecipientKey');
  if (!(plaintext instanceof Uint8Array) || plaintext.length > 65_536) throw new Error('InvalidPayloadSize');
  const aad = contextBytes(context);
  const ephemeral = x25519.keygen();
  const salt = randomBytes(32);
  const nonce = randomBytes(24);
  const shared = x25519.getSharedSecret(ephemeral.secretKey, recipient);
  const symmetric = key(shared, salt, ephemeral.publicKey, recipient, aad);
  try {
    return { version: 1, ephemeralPublicKey: bytesToHex(ephemeral.publicKey), salt: bytesToHex(salt), nonce: bytesToHex(nonce), aad: bytesToHex(aad), ciphertext: bytesToHex(xchacha20poly1305(symmetric, nonce, aad).encrypt(plaintext)) };
  } finally { ephemeral.secretKey.fill(0); shared.fill(0); symmetric.fill(0); }
}
export function open(secretKey: Uint8Array, envelope: Envelope, expected: ShareContext): Uint8Array {
  if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) throw new Error('InvalidSecretKey');
  if (envelope.version !== 1 || Object.keys(envelope).sort().join(',') !== 'aad,ciphertext,ephemeralPublicKey,nonce,salt,version') throw new Error('UnsupportedEnvelope');
  const aad = contextBytes(expected);
  if (envelope.aad !== bytesToHex(aad)) throw new Error('WrongShareContext');
  const epk = fixedHex(envelope.ephemeralPublicKey, 32);
  const salt = fixedHex(envelope.salt, 32);
  const nonce = fixedHex(envelope.nonce, 24);
  if (typeof envelope.ciphertext !== 'string' || !/^(?:[0-9a-f]{2}){16,65552}$/.test(envelope.ciphertext)) throw new Error('InvalidCiphertext');
  const shared = x25519.getSharedSecret(secretKey, epk);
  const recipient = x25519.getPublicKey(secretKey);
  const symmetric = key(shared, salt, epk, recipient, aad);
  try { return xchacha20poly1305(symmetric, nonce, aad).decrypt(hexToBytes(envelope.ciphertext)); }
  finally { shared.fill(0); symmetric.fill(0); }
}
/** The complete canonical envelope, not merely its ciphertext body, is committed. */
export function envelopeHash(e: Envelope): string {
  return bytesToHex(keccak_256(utf8.encode(JSON.stringify([e.version, e.ephemeralPublicKey, e.salt, e.nonce, e.aad, e.ciphertext]))));
}
