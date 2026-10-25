import { sha256, toHex, verifyTypedData, type Hex, type Address } from 'viem';

export function canonicalJSON(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const reviewDigest = (core: any) => sha256(toHex(canonicalJSON(core)));
export function typedReview(core: any) {
  return { domain: { name: 'OrtalamaReview', version: '2', chainId: BigInt(core.chainId), verifyingContract: core.contractAddress as Address }, types: { ReviewApproval: [{ name: 'roundId', type: 'uint64' }, { name: 'installationId', type: 'bytes32' }, { name: 'reviewDigest', type: 'bytes32' }] }, primaryType: 'ReviewApproval' as const, message: { roundId: BigInt(core.roundId), installationId: core.installationId as Hex, reviewDigest: reviewDigest(core) } };
}
export async function assertApprovedReview(packet: any, expected: { chainId: number; address: string; roundId: bigint; installationId: string; E: bigint; P: bigint; officer: string }) {
  const c = packet?.core;
  if (!c || c.simulation !== true || !['HUMAN_REVIEW','AUTOMATED_TEST_SIGNATURE'].includes(c.approvalKind) || typeof c.officerName !== 'string' || c.officerName.trim().length < 2 || c.chainId !== expected.chainId || c.contractAddress.toLowerCase() !== expected.address.toLowerCase() || String(c.roundId) !== String(expected.roundId) || c.installationId !== expected.installationId || c.E !== String(expected.E) || c.P !== String(expected.P) || c.officerAddress.toLowerCase() !== expected.officer.toLowerCase() || !/^0x[0-9a-f]{64}$/.test(c.reportHash) || !/^[0-9a-f]{64}$/.test(c.reviewNonce) || reviewDigest(c) !== packet.reviewDigest) throw new Error('ReviewBindingMismatch');
  if (!await verifyTypedData({ ...typedReview(c), address: expected.officer as Address, signature: packet.signature })) throw new Error('InvalidOfficerSignature');
  return true;
}
