import { hashTypedData, hexToBytes, verifyTypedData, type Address, type Hex, type PrivateKeyAccount } from 'viem';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { Point } from './index.js';

export const statementTypes = {
  PlantStatement: [
    { name: 'roundId', type: 'uint256' }, { name: 'installationId', type: 'bytes32' },
    { name: 'CEx', type: 'uint256' }, { name: 'CEy', type: 'uint256' },
    { name: 'CPx', type: 'uint256' }, { name: 'CPy', type: 'uint256' },
    { name: 'AEx', type: 'uint256' }, { name: 'AEy', type: 'uint256' },
    { name: 'APx', type: 'uint256' }, { name: 'APy', type: 'uint256' },
    { name: 'reportHash', type: 'bytes32' }, { name: 'metadataHash', type: 'bytes32' },
    { name: 'pqKeyHash', type: 'bytes32' },
  ],
} as const;
export type Statement = {
  chainId: bigint; verifyingContract: Address; roundId: bigint; installationId: Hex;
  CE: Point; CP: Point; AE: Point; AP: Point; reportHash: Hex; metadataHash: Hex; pqKeyHash: Hex;
};
export const pqKeygen = () => ml_dsa65.keygen();
export const pqPublicKeyHash = (key: Uint8Array): Hex => `0x${bytesToHex(keccak_256(key))}`;
export const pqLinkTypes = { PQLink: [{ name: 'statementDigest', type: 'bytes32' }, { name: 'pqSignatureHash', type: 'bytes32' }] } as const;
export function typedPQLink(s: Statement, statementDigest: Hex, pqSignatureHash: Hex) {
  return { domain: typedStatement(s).domain, types: pqLinkTypes, primaryType: 'PQLink' as const, message: { statementDigest, pqSignatureHash } };
}
export function typedStatement(s: Statement) {
  return {
    domain: { name: 'Ortalama', version: '2', chainId: s.chainId, verifyingContract: s.verifyingContract },
    types: statementTypes, primaryType: 'PlantStatement' as const,
    message: { roundId: s.roundId, installationId: s.installationId,
      CEx: s.CE[0], CEy: s.CE[1], CPx: s.CP[0], CPy: s.CP[1], AEx: s.AE[0], AEy: s.AE[1], APx: s.AP[0], APy: s.AP[1],
      reportHash: s.reportHash, metadataHash: s.metadataHash, pqKeyHash: s.pqKeyHash },
  };
}
export async function coSign(s: Statement, account: PrivateKeyAccount, pq: { secretKey: Uint8Array; publicKey: Uint8Array }) {
  if (pqPublicKeyHash(pq.publicKey) !== s.pqKeyHash) throw new Error('PQKeyIdentityMismatch');
  const typed = typedStatement(s), digest = hashTypedData(typed);
  const ecdsa = await account.signTypedData(typed);
  const pqSignature = ml_dsa65.sign(hexToBytes(digest), pq.secretKey, { context: new TextEncoder().encode('ORTALAMA_VERIFIER_v2') });
  const pqSignatureHash = `0x${bytesToHex(keccak_256(pqSignature))}` as Hex;
  const pqLink = await account.signTypedData(typedPQLink(s, digest, pqSignatureHash));
  return { digest, ecdsa, pqSignature, pqSignatureHash, pqLink };
}
/** expectedPQKeyHash and ECDSA address must come from an authenticated allowlist. */
export async function verifyCoSignature(s: Statement, signer: Address, expectedPQKeyHash: Hex, publicKey: Uint8Array, signatures: { ecdsa: Hex; pqSignature: Uint8Array; pqSignatureHash: Hex; pqLink: Hex }): Promise<boolean> {
  try {
    if (s.pqKeyHash !== expectedPQKeyHash || pqPublicKeyHash(publicKey) !== expectedPQKeyHash) return false;
    if (`0x${bytesToHex(keccak_256(signatures.pqSignature))}` !== signatures.pqSignatureHash) return false;
    const typed = typedStatement(s);
    return await verifyTypedData({ ...typed, address: signer, signature: signatures.ecdsa }) && await verifyTypedData({ ...typedPQLink(s, hashTypedData(typed), signatures.pqSignatureHash), address: signer, signature: signatures.pqLink }) && ml_dsa65.verify(signatures.pqSignature, hexToBytes(hashTypedData(typed)), publicKey, { context: new TextEncoder().encode('ORTALAMA_VERIFIER_v2') });
  } catch { return false; }
}
