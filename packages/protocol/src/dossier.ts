/** Public-only export and independent reproduction; no signing-key reads. */
import {readFile} from 'node:fs/promises';
import {Ajv} from 'ajv';
import {createPublicClient,http,sha256,toHex} from 'viem';
import {canonicalJSON} from './review.js';
import {fetchPublicSnapshot,getPagedContractEvents} from './public-chain.js';
import {verifySnapshot,verifyPublicAttestations} from './verify.js';
import {DOSSIER_LIMITS,DOSSIER_SOURCE_FILES} from './dossier-policy.js';

const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const serial=(value:any)=>JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v));
export const dossierDigest=(payload:any)=>sha256(toHex(canonicalJSON(payload)));
let schemaValidator:any;
async function validateShape(packet:any){
 schemaValidator??=new Ajv({allErrors:true,strict:true}).compile(await read('schemas/dossier.schema.json'));
 if(!schemaValidator(packet))throw new Error(`DossierSchemaRejected:${schemaValidator.errors?.[0]?.instancePath??''}`);
 if(canonicalJSON(packet.payload.limitations)!==canonicalJSON(DOSSIER_LIMITS))throw new Error('DossierLimitationsChanged');
 if(packet.payloadSHA256!==dossierDigest(packet.payload))throw new Error('DossierDigestMismatch');
}
async function abis(){
 const names=['OrtalamaRound','BadgeRegistry'];
 return Object.fromEntries(await Promise.all(names.map(async name=>[name,(await read(`contracts/out/${name}.sol/${name}.json`)).abi])));
}
async function sourceHashes(){
 return Object.fromEntries(await Promise.all(DOSSIER_SOURCE_FILES.map(async path=>[path,sha256(new Uint8Array(await readFile(path))).slice(2)])));
}
const deploymentFields=(d:any)=>serial({simulation:d.simulation,chainId:d.chainId,round:d.round,badge:d.badge,validity:d.validity,below:d.below,blockNumber:d.blockNumber,runtimeCodeHashes:d.runtimeCodeHashes});
const eventRecord=(event:any)=>serial({name:event.eventName,transactionHash:event.transactionHash,blockNumber:event.blockNumber,blockHash:event.blockHash,logIndex:event.logIndex,address:event.address,args:event.args});
async function publicSources(){
 const registry=await read('data/real/sources.json');
 return registry.sources.map((s:any)=>Object.fromEntries(['id','title','url','accessed_on','evidence_class','scope','retrieved'].map(k=>[k,s[k]])));
}
async function chainEvents(client:any,d:any,abi:any,roundId:bigint,block:bigint){
 const logs=(await Promise.all([
  getPagedContractEvents(client,{address:d.round,abi:abi.OrtalamaRound,fromBlock:BigInt(d.blockNumber),toBlock:block,strict:true}),
  getPagedContractEvents(client,{address:d.badge,abi:abi.BadgeRegistry,fromBlock:BigInt(d.blockNumber),toBlock:block,strict:true})
 ])).flat().filter((event:any)=>event.args.roundId!==undefined&&BigInt(event.args.roundId)===roundId);
 return logs.sort((a:any,b:any)=>Number(a.blockNumber-b.blockNumber)||a.logIndex-b.logIndex).map(eventRecord);
}
function proofParameters(abi:any){
 return [abi.find((x:any)=>x.name==='createRound').inputs[0],abi.find((x:any)=>x.name==='commit').inputs[0]];
}
export async function buildDossier(options:{rpc:string;deployment:any;indexer:string;roundId:bigint;block?:bigint}){
 const d=deploymentFields(options.deployment);
 if(d.simulation!==true||![31337,10143].includes(d.chainId))throw new Error('CurrentDossierFormatIsSimulationOnly');
 const abi=await abis(),client=createPublicClient({transport:http(options.rpc,{batch:true,retryCount:0})});
 const snapshot=serial(await fetchPublicSnapshot(client,{deployment:d,abis:abi},options.roundId,options.block));
 const response=await fetch(`${options.indexer.replace(/\/$/,'')}/rounds/${options.roundId}/evidence`);
 if(!response.ok)throw new Error('PublicCoSignatureSidecarsUnavailable');
 const publicData=await response.json() as any;
 const attestations=publicData.attestations;
 if(!Array.isArray(attestations))throw new Error('MissingCoSignatures');
 // Stable manifest order makes repeated exports at the same block deterministic.
 attestations.sort((a:any,b:any)=>snapshot.plants.findIndex((p:any)=>p.installationId===a.installationId)-snapshot.plants.findIndex((p:any)=>p.installationId===b.installationId));
 const [cfg,statement]=proofParameters(abi.OrtalamaRound);
 const arithmetic=await verifySnapshot(snapshot,cfg,statement);
 const coSignatures=await verifyPublicAttestations(snapshot,attestations);
 const block=await client.getBlock({blockNumber:BigInt(snapshot.block)});
 const sourceRecords=await publicSources();
 const payload=serial({snapshot,attestations,events:await chainEvents(client,d,abi,options.roundId,BigInt(snapshot.block)),deployment:d,blockTimestamp:block.timestamp,sourceSHA256:await sourceHashes(),sourceRecords,provenance:{identityAssurance:'SIMULATED_NOT_ACCREDITED',reportTruth:'NOT_ESTABLISHED',denominatorAssurance:'SIMULATED_DECLARATION',privateReportsIncluded:false,privateOpeningsIncluded:false,officialAcceptance:false},arithmetic,coSignatures,limitations:DOSSIER_LIMITS});
 const packet={kind:'SIMULATED_ORTALAMA_EVIDENCE',version:2,simulation:true,payloadSHA256:dossierDigest(payload),payload};
 await validateShape(packet);
 return packet;
}

export async function verifyDossier(packet:any,options:{deployment:any;rpc?:string;offline?:boolean}){
 await validateShape(packet);
 const expected=deploymentFields(options.deployment),p=packet.payload;
 if(canonicalJSON(expected)!==canonicalJSON(p.deployment))throw new Error('IndependentDeploymentAnchorMismatch');
 if(canonicalJSON(await sourceHashes())!==canonicalJSON(p.sourceSHA256))throw new Error('ReproductionSourceBuildMismatch');
 if(canonicalJSON(await publicSources())!==canonicalJSON(p.sourceRecords))throw new Error('DossierSourceProvenanceMismatch');
 if(p.snapshot.address.toLowerCase()!==expected.round.toLowerCase()||p.snapshot.chainId!==expected.chainId)throw new Error('DossierChainContextMismatch');
 const abi=await abis(),[cfg,statement]=proofParameters(abi.OrtalamaRound);
 const arithmetic=await verifySnapshot(p.snapshot,cfg,statement);
 const signatures=await verifyPublicAttestations(p.snapshot,p.attestations);
 if(canonicalJSON(arithmetic)!==canonicalJSON(p.arithmetic)||canonicalJSON(signatures)!==canonicalJSON(p.coSignatures))throw new Error('StoredVerificationResultMismatch');
 if(options.offline)return {simulation:true,status:'ARITHMETIC_AND_SIGNATURES_VERIFIED_CHAIN_NOT_QUERIED',chainQueried:false,matchesSelectedRPC:null,finalityProof:false,payloadSHA256:packet.payloadSHA256,arithmetic,signatures};
 if(!options.rpc)throw new Error('ExplicitRPCRequired');
 const client=createPublicClient({transport:http(options.rpc,{batch:true,retryCount:0})});
 const live=serial(await fetchPublicSnapshot(client,{deployment:expected,abis:abi},BigInt(p.snapshot.roundId),BigInt(p.snapshot.block)));
 if(canonicalJSON(live)!==canonicalJSON(p.snapshot))throw new Error('PinnedChainSnapshotMismatch');
 const block=await client.getBlock({blockNumber:BigInt(p.snapshot.block)});
 if(String(block.timestamp)!==p.blockTimestamp)throw new Error('PinnedBlockTimestampMismatch');
 const events=await chainEvents(client,expected,abi,BigInt(p.snapshot.roundId),BigInt(p.snapshot.block));
 if(canonicalJSON(events)!==canonicalJSON(p.events))throw new Error('PinnedTransactionEventsMismatch');
 const hashes=[...new Set(events.map((event:any)=>event.transactionHash))] as `0x${string}`[];
 await Promise.all(hashes.map(async hash=>{
  const receipt=await client.getTransactionReceipt({hash});
  if(receipt.status!=='success'||receipt.blockNumber>BigInt(p.snapshot.block))throw new Error('DossierTransactionReceiptRejected');
  const matches=events.filter((e:any)=>e.transactionHash===hash);
  if(matches.some((e:any)=>e.blockHash!==receipt.blockHash||BigInt(e.blockNumber)!==receipt.blockNumber))throw new Error('DossierReceiptBlockMismatch');
 }));
 return {simulation:true,status:'PINNED_RPC_STATE_ARITHMETIC_AND_SIGNATURES_VERIFIED',chainQueried:true,matchesSelectedRPC:true,finalityProof:false,chainAuthority:'Explicitly selected RPC and independent deployment anchor, not a light client',payloadSHA256:packet.payloadSHA256,transactionsChecked:hashes.length,arithmetic,signatures};
}
