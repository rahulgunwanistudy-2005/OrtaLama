import {getPagedContractEvents} from '../packages/protocol/src/public-chain.js';
/** Private stdin/stdout bridge: production arithmetic uses circomlibjs/Noble,
 * never the variable-time independent Python test oracle. No private argv. */
import { privateKeyToAccount } from 'viem/accounts';
import { type Hex } from 'viem';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { open, envelopeHash, canonicalDecimal, verifyCoSignature, type Statement } from '../packages/crypto-ts/src/index.js';
import { artifact, deployment, client, readRound, readPlant, installations, transact, pointArray, getPrimitives, stringify, assertSeedReady } from '../packages/protocol/src/runtime.js';
import { json, runtimePath, badgeProof, assertSimulationContext, actorSigningKey } from '../packages/protocol/src/runtime.js';
import { preparePlant, commitPlantRecoverable } from './plant-agent/agent.js';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
const id = BigInt(request.roundId ?? 1);
const d = await deployment(), a = await artifact('OrtalamaRound');
const cfg = request.config;
async function snapshot() {
  const block = await client.getBlockNumber({ cacheTime: 0 });
  const round = await readRound(id, block), ids = await installations(id, block);
  const plants = await Promise.all(ids.map(async installationId => ({ installationId, ...await readPlant(id, installationId, block) })));
  const sums = await Promise.all([1, 2, 3].map(async index => ({ index, ...await client.readContract({ address: d.round, abi: a.abi, functionName: 'getSum', args: [id, index], blockNumber: block }) as any })));
  return { simulation: round.config.simulated, chainId: await client.getChainId(), address: d.round, roundId: id, round, plants, sums, block, blockHash: (await client.getBlock({ blockNumber: block })).hash };
}
async function run() {
  if (request.action === 'dossier') {
    const {buildDossier}=await import('../packages/protocol/src/dossier.js');
    return buildDossier({rpc:process.env.ORTALAMA_RPC??'http://127.0.0.1:8547',deployment:d,indexer:process.env.ORTALAMA_INDEXER??'http://127.0.0.1:8700',roundId:id,block:request.block?BigInt(request.block):undefined});
  }
  if (request.action.startsWith('operator')) return (await import('./operator.js')).operator(request);
  if(cfg){await assertSimulationContext(d);if(cfg.simulation!==true||cfg.chainId!==d.chainId||cfg.deployment.toLowerCase()!==d.round.toLowerCase())throw new Error('TrusteeDeploymentMismatch');}
  if (request.action === 'snapshot') return snapshot();
  if (request.action === 'indexHead') {
    const block=await client.getBlock({blockTag:'latest'});
    let previousHash;
    if(request.previousBlock!==undefined){
      try{previousHash=(await client.getBlock({blockNumber:BigInt(request.previousBlock)})).hash;}
      catch{previousHash=null;}
    }
    return {block:block.number,blockHash:block.hash,previousHash};
  }
  if (['sealReviewed', 'commitReviewed', 'reviewedEnvelopes', 'reviewedBadge'].includes(request.action)) {
    await assertSeedReady();
    if (process.env.ORTALAMA_SIMULATION !== '1' || d.simulation !== true || await client.getChainId() !== 31337 || !/^0x[0-9a-f]{64}$/.test(request.installationId)) throw new Error('SimulationContextRequired');
    const scenario = await json(runtimePath('SIMULATED_scenario.json'));
    const actorIndex = scenario.plants.findIndex((p: any) => p.installationId === request.installationId);
    if (actorIndex < 0) throw new Error('UnknownInstallation');
    if (request.action === 'sealReviewed') {
      const core = request.review.core;
      const prepared = await preparePlant(id, request.installationId, canonicalDecimal(core.E), canonicalDecimal(core.P), undefined, request.review);
      return { simulation: true, prepared: true, reportHash: prepared.submission.statement.reportHash, validationHash: prepared.submission.validationHash, metadataHash: prepared.submission.statement.metadataHash, approvalKind: core.approvalKind };
    }
    const prepared = await json(runtimePath(`plants/SIMULATED_round_${id}_${request.installationId}_secret.json`));
    if (!prepared.review?.core) throw new Error('OfficerApprovalRequired');
    if (request.reviewDigest !== prepared.review.reviewDigest) throw new Error('ReviewBindingMismatch');
    if (request.action === 'reviewedEnvelopes') return { envelopes: prepared.envelopes };
    const { toHex } = await import('viem');
    const signingKey = toHex(BigInt(100 + actorIndex), { size: 32 });
    if (request.action === 'commitReviewed') return { receipt: await commitPlantRecoverable(prepared, signingKey), attestation: prepared.attestation };
    const r = await readRound(id), thresholdId = BigInt(request.thresholdId ?? '0');
    if (thresholdId < 0n || thresholdId > BigInt(r.config.fixedThresholdCount)) throw new Error('UnknownThreshold');
    const opening = Object.fromEntries(['E','r','P','s'].map(k => [k, canonicalDecimal(prepared.opening[k])])) as any;
    const proof = await badgeProof(opening, id, request.installationId, thresholdId === 0n ? r.SE : r.config.thresholdNumerators[Number(thresholdId) - 1], thresholdId === 0n ? r.SP : r.config.thresholdDenominators[Number(thresholdId) - 1], thresholdId);
    return { proof, receipt: await transact(signingKey, d.badge, 'BadgeRegistry', 'attest', [id,id,request.installationId,thresholdId,proof]) };
  }
  if (request.action === 'blockHash') return { hash: (await client.getBlock({ blockNumber: BigInt(request.blockNumber) })).hash };
  if (request.action === 'roundCount') return { count: await client.readContract({ address: d.round, abi: a.abi, functionName: 'roundCount' }) };
  if (request.action === 'verifyAttestation') {
    const plant = await readPlant(id, request.installationId), round = await readRound(id), publicData = request.attestation;
    if (!plant.committed || plant.pqSignatureHash !== publicData.pqSignatureHash || !StandardMerkleTree.verify(round.config.verifierRoot, ['address', 'bytes32'], [publicData.signer, plant.statement.pqKeyHash], publicData.verifierProof)) throw new Error('UnauthenticatedAttestation');
    const statement: Statement = { chainId: BigInt(await client.getChainId()), verifyingContract: d.round, roundId: id, installationId: request.installationId, CE: pointArray(plant.statement.CE), CP: pointArray(plant.statement.CP), AE: pointArray(plant.statement.AE), AP: pointArray(plant.statement.AP), reportHash: plant.statement.reportHash, metadataHash: plant.statement.metadataHash, pqKeyHash: plant.statement.pqKeyHash };
    if (!await verifyCoSignature(statement, publicData.signer, plant.statement.pqKeyHash, new Uint8Array(Buffer.from(publicData.publicKey, 'hex')), { ecdsa: publicData.ecdsa, pqSignature: new Uint8Array(Buffer.from(publicData.pqSignature, 'hex')), pqSignatureHash: publicData.pqSignatureHash, pqLink: publicData.pqLink })) throw new Error('InvalidCoSignature');
    return { valid: true, simulation: round.config.simulated };
  }
  if (request.action === 'events') {
    const latest = await client.getBlockNumber({ cacheTime: 0 });
    const from=BigInt(request.fromBlock??d.blockNumber);
    // Checkpoint long idle gaps in bounded batches; one bridge invocation has
    // a finite service deadline and the provider only accepts 100-block pages.
    const block=latest>from+1999n?from+1999n:latest;
    if (BigInt(request.fromBlock ?? d.blockNumber) > block) return { simulation: true, chainId: await client.getChainId(), block, blockHash: (await client.getBlock({ blockNumber: block })).hash, events: [] };
    const logs = await getPagedContractEvents(client,{ address: d.round, abi: a.abi, fromBlock: BigInt(request.fromBlock ?? d.blockNumber), toBlock: block, strict: true });
    const b = await artifact('BadgeRegistry');
    const badges = await getPagedContractEvents(client,{ address: d.badge, abi: b.abi, fromBlock: BigInt(request.fromBlock ?? d.blockNumber), toBlock: block, strict: true });
    return { simulation: true, chainId: await client.getChainId(), block, blockHash: (await client.getBlock({ blockNumber: block })).hash, events: [...logs, ...badges].sort((x, y) => Number(x.blockNumber! - y.blockNumber!) || x.logIndex! - y.logIndex!) };
  }
  if (request.action === 'validateShare') {
    const round = await readRound(id), plant = await readPlant(id, request.installationId);
    if (Number(round.state) !== 2 || !plant.committed) throw new Error('RoundNotAcceptingShares');
    const index = Number(cfg.index);
    if (index < 1 || index > 3 || cfg.publicKey !== round.config.encryptionKeys[index - 1].slice(2) || privateKeyToAccount(cfg.signingKey).address.toLowerCase() !== round.config.trustees[index - 1].toLowerCase()) throw new Error('TrusteeConfigurationMismatch');
    if ((await client.getBlock()).timestamp > round.config.sharingDeadline) throw new Error('SharingDeadlinePassed');
    const ciphertextHash = `0x${envelopeHash(request.envelope)}`;
    if (ciphertextHash !== plant.ciphertextHashes[index - 1]) throw new Error('WrongCiphertext');
    const context = { chainId: String(await client.getChainId()), verifyingContract: d.round.toLowerCase(), roundId: id.toString(), installationId: request.installationId, trusteeIndex: index };
    const clear = open(new Uint8Array(Buffer.from(cfg.secretKey, 'hex')), request.envelope, context);
    try {
      const data = JSON.parse(new TextDecoder().decode(clear));
      if (data.index !== index || data.simulation !== round.config.simulated || Object.keys(data).sort().join(',') !== 'E,P,index,r,s,simulation') throw new Error('ShareIdentityMismatch');
      const share = { index, E: canonicalDecimal(data.E), P: canonicalDecimal(data.P), r: canonicalDecimal(data.r), s: canonicalDecimal(data.s) };
      const { crypto } = await getPrimitives();
      const points = Object.fromEntries(['CE', 'CP', 'AE', 'AP'].map(k => [k, pointArray(plant.statement[k])])) as any;
      if (!crypto.verifyShare(share, points)) throw new Error('ShareCommitmentMismatch');
      return { share, ciphertextHash, simulation: round.config.simulated };
    } finally { clear.fill(0); }
  }
  if (request.action === 'acknowledge') {
    const plant = await readPlant(id, request.installationId), index = Number(cfg.index);
    if (plant.ciphertextHashes[index - 1] !== request.ciphertextHash) throw new Error('WrongCiphertext');
    if ((Number(plant.receipts) & (1 << (index - 1))) !== 0) {
      const logs = await getPagedContractEvents(client,{ address: d.round, abi: a.abi, eventName: 'ShareAcknowledged', args: { roundId: id, installationId: request.installationId, trusteeIndex: index }, fromBlock: BigInt(d.blockNumber), toBlock: 'latest', strict: true });
      if (!logs.length) throw new Error('ReceiptEvidenceUnavailable');
      return { hash: logs.at(-1)!.transactionHash, status: 'success', alreadyAcknowledged: true };
    }
    return transact(cfg.signingKey, d.round, 'OrtalamaRound', 'acknowledge', [id, request.installationId, index, request.ciphertextHash]);
  }
  if (request.action === 'publish') {
    const round = await readRound(id), index = Number(cfg.index);
    if (Number(round.state) !== 3) throw new Error('RoundNotClosing');
    const sums = Object.fromEntries(['E', 'r', 'P', 's'].map(k => [k, canonicalDecimal(request.sums[k])])) as any;
    const types = { TrusteeSum: [{ name: 'roundId', type: 'uint64' }, { name: 'trusteeIndex', type: 'uint8' }, { name: 'manifestHash', type: 'bytes32' }, ...['E', 'r', 'P', 's'].map(name => ({ name, type: 'uint256' }))] };
    const signature = await privateKeyToAccount(cfg.signingKey).signTypedData({ domain: { name: 'Ortalama', version: '2', chainId: await client.getChainId(), verifyingContract: d.round }, types, primaryType: 'TrusteeSum', message: { roundId: id, trusteeIndex: index, manifestHash: round.manifestHash, ...sums } });
    const receipt = await transact(cfg.signingKey, d.round, 'OrtalamaRound', 'publishSum', [id, index, round.manifestHash, sums], request.expectedError);
    let faultReceipt;
    if (request.expectedError === 'AggregateMismatch') faultReceipt = await transact(cfg.signingKey, d.round, 'OrtalamaRound', 'recordFault', [id, index, round.manifestHash, sums, signature]);
    return { simulation: round.config.simulated, trusteeIndex: index, manifestHash: round.manifestHash, sums, signature, receipt, faultReceipt };
  }
  throw new Error('UnknownBridgeAction');
}
try { const result = await run(); process.stdout.write(stringify(result) + '\n', () => process.exit(0)); }
catch (error: any) {
  const diagnostic=[];
  for(let e=error;e&&diagnostic.length<6;e=e.cause)diagnostic.push({name:e.name,code:e.code,shortMessage:e.shortMessage,errorName:e.data?.errorName});
  // Bounded categories only. RPC request bodies can contain sensitive inputs.
  try{await (await import('../packages/protocol/src/runtime.js')).save(runtimePath('SIMULATED_bridge_error.json'),{action:request.action,diagnostic,observedAt:new Date().toISOString()},true);}catch{}
  process.stderr.write(String(error.message ?? 'BridgeFailed').split(':')[0]?.slice(0,80)??'BridgeFailed');process.exit(1);
}
