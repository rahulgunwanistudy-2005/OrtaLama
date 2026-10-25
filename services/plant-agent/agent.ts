import {journalledTestnetReceipt} from '../../packages/protocol/src/testnet-transactions.js';
import {getPagedContractEvents} from '../../packages/protocol/src/public-chain.js';
/** Plant-local CLI sealing; no plaintext values are sent to the indexer. */
import assert from 'node:assert/strict';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeAbiParameters, keccak256, toHex, type Hex } from 'viem';
import { seal, envelopeHash, coSign, pqPublicKeyHash, verifyCoSignature, type Statement } from '../../packages/crypto-ts/src/index.js';
import { json, deployment, readRound, readPlant, client, wallet, artifact, getPrimitives, validityProof, pointObject, save, stringify, transact, runtimePath, assertSimulationContext, publicTestnet } from '../../packages/protocol/src/runtime.js';
import { encodeFunctionData } from 'viem';
import { assertApprovedReview } from '../../packages/protocol/src/review.js';

export async function preparePlant(roundId: bigint, installationId: Hex, E: bigint, P: bigint, simulatedBadShareIndex?: number, approvedReview?: any) {
  const d = await deployment(), cfg = await json(runtimePath('SIMULATED_verifier_secret.json')), scenario = await json(runtimePath('SIMULATED_scenario.json'));
  await assertSimulationContext(d);
  if(publicTestnet && simulatedBadShareIndex!==undefined)throw new Error('PublicNegativeShareFixtureDisabled');
  const round = await readRound(roundId); assert.equal(Number(round.state), 1);
  const { crypto } = await getPrimitives();
  const opening = crypto.validateOpening({ E, P, r: crypto.randomScalar(), s: crypto.randomScalar() });
  const sharing = crypto.sharePlant(opening);
  const envelopes = sharing.shares.map((share, i) => {
    // Negative integration fixture only; the Anvil-only guard above is mandatory.
    const sealed = i + 1 === simulatedBadShareIndex ? { ...share, E: (share.E + 1n) % crypto.l } : share;
    return seal(new Uint8Array(Buffer.from(round.config.encryptionKeys[i].slice(2), 'hex')), new TextEncoder().encode(stringify({ simulation: true, ...sealed })), { chainId: String(d.chainId), verifyingContract: d.round.toLowerCase(), roundId: String(roundId), installationId, trusteeIndex: i + 1 });
  });
  const ciphertextHashes = envelopes.map(e => `0x${envelopeHash(e)}` as Hex) as [Hex, Hex, Hex];
  if (approvedReview) {
    const actor = scenario.plants.find((p: any) => p.installationId === installationId)?.actor;
    assert.ok(actor);
    await assertApprovedReview(approvedReview, { chainId: d.chainId, address: d.round, roundId, installationId, E, P, officer: actor });
  }
  const review = approvedReview ?? { simulation: true, mode: 'AUTOMATED_SIMULATED_FIXTURE', humanApprovalPerformed: false, validationScope: 'canonical integer and cryptographic bounds only; physics and report review are a later gate' };
  const validationHash = keccak256(toHex(stringify(review)));
  const reportHash = approvedReview?.core.reportHash ?? keccak256(toHex(stringify({ simulation: true, installationId, E, P, label: 'SIMULATED CLI report input; not a verified report' })));
  const metadataHash = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32[3]' }], [validationHash, ciphertextHashes]));
  const pq = { secretKey: new Uint8Array(Buffer.from(cfg.secretKey, 'hex')), publicKey: new Uint8Array(Buffer.from(cfg.publicKey, 'hex')) };
  const pqKeyHash = pqPublicKeyHash(pq.publicKey);
  const statement: Statement = { chainId: BigInt(d.chainId), verifyingContract: d.round, roundId, installationId, CE: sharing.CE, CP: sharing.CP, AE: sharing.AE, AP: sharing.AP, reportHash, metadataHash, pqKeyHash };
  const signer = privateKeyToAccount(cfg.signingKey);
  const signature = await coSign(statement, signer, pq);
  assert.equal(await verifyCoSignature(statement, signer.address, pqKeyHash, pq.publicKey, signature), true);
  pq.secretKey.fill(0);
  const proof = await validityProof(opening, sharing, roundId, installationId, d.round);
  const cohort = StandardMerkleTree.of(scenario.plants.map((p: any) => [p.installationId]), ['bytes32']);
  const entry = [...cohort.entries()].find(([, value]) => value[0] === installationId); assert.ok(entry);
  assert.equal(cohort.root, round.config.cohortRoot);
  const submission = { statement: { roundId, installationId, CE: pointObject(sharing.CE), CP: pointObject(sharing.CP), AE: pointObject(sharing.AE), AP: pointObject(sharing.AP), reportHash, metadataHash, pqKeyHash }, validationHash, ciphertextHashes, verifierSignature: signature.ecdsa, pqLink: signature.pqLink, pqSignatureHash: signature.pqSignatureHash, cohortProof: cohort.getProof(entry[0]), verifierProof: [] as Hex[], proof };
  const attestation = { simulation: true, signer: signer.address, publicKey: cfg.publicKey, ecdsa: signature.ecdsa, pqSignature: Buffer.from(signature.pqSignature).toString('hex'), pqSignatureHash: signature.pqSignatureHash, pqLink: signature.pqLink, verifierProof: [] };
  const result = { simulation: true, roundId, installationId, opening, envelopes, submission, attestation, review, typedStatement: statement };
  await save(runtimePath(`plants/SIMULATED_round_${roundId}_${installationId}_secret.json`), result, true);
  return result;
}

export function submissionArgs(x: any) { return [x.statement, x.validationHash, x.ciphertextHashes, x.verifierSignature, x.pqLink, x.pqSignatureHash, x.cohortProof, x.verifierProof, x.proof]; }
export async function commitPlant(plant: Awaited<ReturnType<typeof preparePlant>>, signingKey: Hex) {
  const d = await deployment();
  return transact(signingKey, d.round, 'OrtalamaRound', 'commit', submissionArgs(plant.submission));
}

/** Report jobs may lose the bridge response after mining. Recover only the
 * exact saved statement; persist its signed public transaction before sending. */
export async function commitPlantRecoverable(plant: any, signingKey: Hex) {
  const d=await deployment(),a=await artifact('OrtalamaRound'),id=BigInt(plant.roundId),sub=plant.submission;
  const recover=async()=>{
    const stored=await readPlant(id,plant.installationId);
    if(!stored.committed)return undefined;
    const expected=sub.statement,actual=stored.statement;
    const same=String(actual.roundId)===String(expected.roundId)
      &&['installationId','reportHash','metadataHash','pqKeyHash'].every(k=>actual[k].toLowerCase()===expected[k].toLowerCase())
      &&['CE','CP','AE','AP'].every(k=>BigInt(actual[k].x)===BigInt(expected[k].x)&&BigInt(actual[k].y)===BigInt(expected[k].y))
      &&stored.pqSignatureHash===sub.pqSignatureHash&&stored.ciphertextHashes.join(',')===sub.ciphertextHashes.join(',');
    if(!same)throw new Error('DifferentStatementAlreadyCommitted');
    if(publicTestnet){
      const saved=await journalledTestnetReceipt(client,privateKeyToAccount(signingKey).address,{to:d.round,data:encodeFunctionData({abi:a.abi,functionName:'commit',args:submissionArgs(sub)})},'protocol:commit:success');
      if(saved)return {hash:saved.transactionHash,blockNumber:saved.blockNumber,status:saved.status,gasUsed:saved.gasUsed,recoveredFromChain:true};
    }
    const events=await getPagedContractEvents(client,{address:d.round,abi:a.abi,eventName:'PlantCommitted',args:{roundId:id,installationId:plant.installationId},fromBlock:BigInt(d.blockNumber),toBlock:'latest'});
    const event=events.at(-1);if(!event)throw new Error('CommitmentReceiptUnavailable');
    const r=await client.getTransactionReceipt({hash:event.transactionHash!});
    if(r.status!=='success')throw new Error('CommitmentReceiptNotSuccessful');
    return {hash:r.transactionHash,blockNumber:r.blockNumber,status:r.status,gasUsed:r.gasUsed,recoveredFromChain:true};
  };
  const existing=await recover();if(existing)return existing;
  if(publicTestnet)return commitPlant(plant,signingKey);
  const w=wallet(signingKey);
  if(!plant.rawTransaction){
    const data=encodeFunctionData({abi:a.abi,functionName:'commit',args:submissionArgs(sub)});
    const tx=await w.prepareTransactionRequest({to:d.round,data,gas:12_000_000n});
    plant.rawTransaction=await w.signTransaction(tx);plant.transactionHash=keccak256(plant.rawTransaction);
    await save(runtimePath(`plants/SIMULATED_round_${id}_${plant.installationId}_secret.json`),plant,true);
  }
  try{await w.sendRawTransaction({serializedTransaction:plant.rawTransaction});}
  catch(error){const mined=await recover();if(mined)return mined;throw error;}
  const r=await client.waitForTransactionReceipt({hash:plant.transactionHash});
  if(r.status!=='success')throw new Error('CommitmentTransactionReverted');
  return {hash:r.transactionHash,blockNumber:r.blockNumber,status:r.status,gasUsed:r.gasUsed,recoveredFromChain:false};
}
