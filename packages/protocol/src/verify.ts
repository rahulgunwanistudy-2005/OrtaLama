/** Independent public arithmetic; browser-compatible and no private key access. */
import { encodeAbiParameters, keccak256, hexToBytes } from 'viem';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { createCrypto, canonicalDecimal, IDENTITY, verifyCoSignature, type Point, type Statement } from '../../crypto-ts/src/index.js';

function requireCheck(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
const point = (value: any): Point => [canonicalDecimal(String(value.x)), canonicalDecimal(String(value.y))];
export async function verifySnapshot(snapshot: any, configParameter: any, statementParameter: any) {
  const c = await createCrypto(), r = snapshot.round;
  const roundId = BigInt(snapshot.roundId), chainId = BigInt(snapshot.chainId);
  requireCheck(Number(r.state) === 4, 'RoundNotClosed');
  requireCheck(snapshot.plants.length === Number(r.n) && Number(r.n) >= Number(r.config.minimumPlants) && Number(r.n) >= 5 && Number(r.n) <= 256, 'WrongCohortSize');
  let manifest = keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }, { type: 'uint64' }, configParameter], [chainId, snapshot.address, roundId, r.config]));
  const aggregate: Record<string, Point> = { CE: IDENTITY, CP: IDENTITY, AE: IDENTITY, AP: IDENTITY };
  const ids = new Set();
  for (const plant of snapshot.plants) {
    requireCheck(plant.committed && !ids.has(plant.installationId) && plant.installationId === plant.statement.installationId && BigInt(plant.statement.roundId) === roundId, 'InvalidManifestMember');
    ids.add(plant.installationId);
    for (const key of ['CE', 'CP', 'AE', 'AP']) aggregate[key] = c.add(aggregate[key]!, c.point(point(plant.statement[key])));
    manifest = keccak256(encodeAbiParameters([{ type: 'bytes32' }, statementParameter, { type: 'bytes32[3]' }, { type: 'bytes32' }], [manifest, plant.statement, plant.ciphertextHashes, plant.pqSignatureHash]));
  }
  requireCheck(manifest === r.manifestHash, 'FrozenManifestMismatch');
  for (const key of ['CE', 'CP', 'AE', 'AP']) requireCheck(c.equal(aggregate[key]!, point(r[`sum${key}`])), 'StoredPointSumMismatch');
  const sums = snapshot.sums.filter((x: any) => (Number(r.publicationMask) & (1 << (x.index - 1))) !== 0).map((x: any) => ({ index: Number(x.index), E: canonicalDecimal(String(x.E)), r: canonicalDecimal(String(x.r)), P: canonicalDecimal(String(x.P)), s: canonicalDecimal(String(x.s)) }));
  requireCheck(sums.length >= 2 && sums.length <= 3, 'InsufficientPublications');
  for (const sum of sums) requireCheck(c.verifyShare(sum, aggregate as any), 'InconsistentTrusteeSum');
  const total = Object.fromEntries(['E', 'r', 'P', 's'].map(key => [key, c.reconstruct(sums.map((x: any) => ({ index: x.index, value: x[key] })))])) as Record<string, bigint>;
  requireCheck(c.equal(c.commit(total.E!, total.r!), aggregate.CE!) && c.equal(c.commit(total.P!, total.s!), aggregate.CP!), 'AggregateOpeningMismatch');
  requireCheck(total.E === BigInt(r.SE) && total.P === BigInt(r.SP), 'StoredAggregateMismatch');
  const result = c.publicResult(total.E!, total.P!, BigInt(r.config.sectorProduction), Number(r.n));
  requireCheck(result.intensity === BigInt(r.intensity) && result.coveragePpm === BigInt(r.coveragePpm) && result.representative === r.representative, 'StoredResultMismatch');
  return { verified: true, simulation: r.config.simulated, roundId: roundId.toString(), manifestHash: manifest, SE: total.E!.toString(), SP: total.P!.toString(), intensity: result.intensity.toString(), coveragePpm: result.coveragePpm.toString(), representativePolicyFlag: result.representative, steps: ['Exact frozen manifest', 'All incoming points and aggregate point sums', 'Every published trustee sum against VSS commitments', 'Threshold interpolation and aggregate openings', 'Stored intensity and declared-denominator coverage'] };
}

export async function verifyPublicAttestations(snapshot: any, attestations: any[]) {
  requireCheck(attestations.length === snapshot.plants.length, 'MissingCoSignatures');
  let verified = 0;
  for (const plant of snapshot.plants) {
    const data = attestations.find(x => x.installationId === plant.installationId);
    requireCheck(data && data.pqSignatureHash === plant.pqSignatureHash, 'CoSignatureHashMismatch');
    requireCheck(StandardMerkleTree.verify(snapshot.round.config.verifierRoot, ['address', 'bytes32'], [data.signer, plant.statement.pqKeyHash], data.verifierProof), 'UnknownVerifier');
    const s: Statement = { chainId: BigInt(snapshot.chainId), verifyingContract: snapshot.address, roundId: BigInt(snapshot.roundId), installationId: plant.installationId, CE: point(plant.statement.CE), CP: point(plant.statement.CP), AE: point(plant.statement.AE), AP: point(plant.statement.AP), reportHash: plant.statement.reportHash, metadataHash: plant.statement.metadataHash, pqKeyHash: plant.statement.pqKeyHash };
    requireCheck(await verifyCoSignature(s, data.signer, s.pqKeyHash, hexToBytes(`0x${data.publicKey}`), { ecdsa: data.ecdsa, pqSignature: hexToBytes(`0x${data.pqSignature}`), pqSignatureHash: data.pqSignatureHash, pqLink: data.pqLink }), 'InvalidCoSignature');
    verified++;
  }
  return { verified: true, ecdsaAndMLDSA65Statements: verified, keyIdentity: 'Round allowlist root', onChainMLDSAVerification: false };
}
