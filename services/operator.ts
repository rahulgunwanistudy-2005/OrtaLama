/** Local SIMULATED role adapter. Never returns signing or trustee secrets. */
import { coSign, pqPublicKeyHash, typedStatement, type Statement } from '../packages/crypto-ts/src/index.js';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeAbiParameters, keccak256, toHex, verifyTypedData, type Hex } from 'viem';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { artifact, client, deployment, json, runtimePath, readRound, readPlant, pointArray, transact, readSeedStatus, assertSimulationContext, publicTestnet } from '../packages/protocol/src/runtime.js';
import { canonicalJSON } from '../packages/protocol/src/review.js';
import { createSimulatedRound } from './rounds.js';

export async function operator(request: any) {
  const d = await deployment();
  await assertSimulationContext(d);
  const scenario = await json(runtimePath('SIMULATED_scenario.json'));
  const seedStatus=await readSeedStatus();
  if (request.action === 'operatorConfig') {
    const abis = Object.fromEntries(await Promise.all(['OrtalamaRound','BadgeRegistry','CommitmentValidityVerifier'].map(async n => [n,(await artifact(n)).abi])));
    return {simulation:true,seedStatus,deployment:d,rpc:'/rpc',abis,plants:scenario.plants.map((p: any,i: number)=>({installationId:p.installationId,label:p.label,actor:p.actor,slot:i})),trustees:scenario.trustees,verifier:scenario.verifier,pqKeyHash:scenario.pqKeyHash,cohortRoot:scenario.cohortRoot,verifierRoot:scenario.verifierRoot,custody:'All actors are SIMULATED on one host; no independent institutional custody'};
  }
  if(publicTestnet)throw new Error('PrivateTestnetCLIRequired');
  if(seedStatus!=='READY')throw new Error('SeedScenarioInProgress');
  if (request.action === 'operatorCreate') return createSimulatedRound(request.mode, request.sectorProduction ? BigInt(request.sectorProduction) : undefined, request);
  const id = BigInt(request.roundId);
  if (request.action === 'operatorLifecycle') {
    if (!['startSharing','startClosing','close','abort'].includes(request.operation)) throw new Error('UnknownOperation');
    const governor = (await json(runtimePath('SIMULATED_governor_secret.json'))).signingKey as Hex;
    return transact(governor,d.round,'OrtalamaRound',request.operation,request.operation === 'abort' ? [id,keccak256(toHex('SIMULATED operator requested abort'))] : [id]);
  }
  if (request.action === 'operatorCosignLive') {
    const sub = request.submission, raw = sub.statement;
    const r = await readRound(id);
    const plant = scenario.plants.find((p: any)=>p.installationId===raw.installationId);
    if (Number(r.state)!==1 || !plant || BigInt(raw.roundId)!==id || (await readPlant(id,raw.installationId)).committed) throw new Error('RoundNotAcceptingLiveInput');
    const declaration=request.declaration;
    if (Object.keys(declaration).sort().join(',')!=='mode,nonce,reportReview,simulation' || declaration.simulation!==true || declaration.mode!=='BROWSER_SECRET_INPUT' || declaration.reportReview!==false || !/^[0-9a-f]{64}$/.test(declaration.nonce)) throw new Error('ExplicitLiveSimulationDeclarationRequired');
    if (sub.validationHash!==keccak256(toHex(canonicalJSON(declaration)))) throw new Error('WrongLiveDeclarationHash');
    const metadata=keccak256(encodeAbiParameters([{type:'bytes32'},{type:'bytes32[3]'}],[sub.validationHash,sub.ciphertextHashes]));
    if (metadata!==raw.metadataHash || sub.ciphertextHashes.some((h: string)=>!/^0x[0-9a-f]{64}$/.test(h)) || sub.ciphertextHashes.length!==3) throw new Error('WrongCiphertextBinding');
    const cfg=await json(runtimePath('SIMULATED_verifier_secret.json'));
    const pq={secretKey:new Uint8Array(Buffer.from(cfg.secretKey,'hex')),publicKey:new Uint8Array(Buffer.from(cfg.publicKey,'hex'))};
    if (raw.pqKeyHash!==pqPublicKeyHash(pq.publicKey)) throw new Error('UnknownVerifierKey');
    const s: Statement={chainId:BigInt(d.chainId),verifyingContract:d.round,roundId:id,installationId:raw.installationId,CE:pointArray(raw.CE),CP:pointArray(raw.CP),AE:pointArray(raw.AE),AP:pointArray(raw.AP),reportHash:raw.reportHash,metadataHash:raw.metadataHash,pqKeyHash:raw.pqKeyHash};
    if (!await verifyTypedData({...typedStatement(s),address:plant.actor,signature:request.actorConsent})) throw new Error('InvalidLiveActorConsent');
    const hi=BigInt(raw.installationId)>>128n,lo=BigInt(raw.installationId)&((1n<<128n)-1n);
    const signals=[...s.CE,...s.CP,...s.AE,...s.AP,id,hi,lo,BigInt(d.chainId),BigInt(d.round),BigInt(sub.proof.contextTag)];
    const v=await artifact('CommitmentValidityVerifier');
    if (!(await client.simulateContract({address:d.validity,abi:v.abi,functionName:'verifyProof',args:[sub.proof.a,sub.proof.b,sub.proof.c,signals],gas:2_000_000n})).result) throw new Error('InvalidInputProof');
    const sig=await coSign(s,privateKeyToAccount(cfg.signingKey),pq);
    pq.secretKey.fill(0);
    const cohort=StandardMerkleTree.of(scenario.plants.map((p: any)=>[p.installationId]),['bytes32']);
    if (cohort.root!==r.config.cohortRoot) throw new Error('WrongCohortRoot');
    const entry=[...cohort.entries()].find(([,value])=>value[0]===raw.installationId)!;
    return {simulation:true,verifierSignature:sig.ecdsa,pqLink:sig.pqLink,pqSignatureHash:sig.pqSignatureHash,cohortProof:cohort.getProof(entry[0]),verifierProof:[],attestation:{simulation:true,signer:scenario.verifier,publicKey:cfg.publicKey,ecdsa:sig.ecdsa,pqSignature:Buffer.from(sig.pqSignature).toString('hex'),pqSignatureHash:sig.pqSignatureHash,pqLink:sig.pqLink,verifierProof:[]},scope:'SIMULATED manual browser inputs; no report truth or physics review asserted'};
  }
  throw new Error('UnknownOperatorAction');
}
