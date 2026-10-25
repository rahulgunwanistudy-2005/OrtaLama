/** Fresh, mined local attacks. Never accepts a key or private value over HTTP. */
import {strict as assert} from 'node:assert';
import {keccak256,toHex,type Hex} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {typedStatement} from '../packages/crypto-ts/src/index.js';
import {deployment,json,runtimePath,client,readRound,transact,badgeProof,stringify,assertSeedReady} from '../packages/protocol/src/runtime.js';
import {preparePlant,commitPlant,submissionArgs} from './plant-agent/agent.js';
import {createSimulatedRound} from './rounds.js';

const number=Number(process.argv[2]);
const stage=(message:string)=>process.stdout.write(stringify({stage:message})+'\n');
const d=await deployment();
if(process.env.ORTALAMA_SIMULATION!=='1'||d.simulation!==true||await client.getChainId()!==31337||![1,2,3,4,5,6].includes(number))throw new Error('SimulationOnly');
await assertSeedReady();
const scenario=await json(runtimePath('SIMULATED_scenario.json'));
const governor=(await json(runtimePath('SIMULATED_governor_secret.json'))).signingKey as Hex;
const post=async(url:string,body:any,token?:string)=>{
 const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:stringify(body)});
 if(!response.ok)throw new Error(`FixtureHTTP${response.status}`);
 return response.json() as Promise<any>;
};
async function fixture(count:number){
 const {id}=await createSimulatedRound();const plants=[];
 for(let i=0;i<count;i++){
  stage(`SIMULATED round ${id}: generating proof and committing plant ${i+1}/${count}`);
  const seed=scenario.plants[i],plant=await preparePlant(id,seed.installationId,BigInt(seed.E),BigInt(seed.P));
  await commitPlant(plant,toHex(BigInt(100+i),{size:32}));
  await post(`${process.env.ORTALAMA_INDEXER}/rounds/${id}/attestations/${plant.installationId}`,plant.attestation);
  plants.push(plant);
 }
 return {id,plants};
}
async function publish(id:bigint,index:number,omitted?:Hex){
 const cfg=await json(runtimePath(`SIMULATED_trustee_${index}_secret.json`));
 return post(`http://127.0.0.1:${Number(process.env.ORTALAMA_TRUSTEE_BASE_PORT)+index}/rounds/${id}/publish`,{simulation:true,omitInstallationId:omitted??null},cfg.controlToken);
}
let result:any;
if(number===1){
 const {id,plants}=await fixture(5);
 await transact(governor,d.round,'OrtalamaRound','startSharing',[id]);
 for(const plant of plants)for(const index of [1,2,3]){
  stage(`SIMULATED round ${id}: trustee ${index} acknowledging an encrypted share`);
  await post(`http://127.0.0.1:${Number(process.env.ORTALAMA_TRUSTEE_BASE_PORT)+index}/shares`,{simulation:true,roundId:String(id),installationId:plant.installationId,envelope:plant.envelopes[index-1]});
 }
 await transact(governor,d.round,'OrtalamaRound','startClosing',[id]);
 stage('Submitting the incomplete sum, then recording the separately signed fault');
 const bad=await publish(id,1,plants.at(-1)!.installationId);
 assert.equal(bad.receipt.error,'AggregateMismatch');assert.equal(bad.faultReceipt.status,'success');
 await publish(id,2);await publish(id,3);
 const closeReceipt=await transact(governor,d.round,'OrtalamaRound','close',[id]);
 assert.equal(Number((await readRound(id)).faultMask),1);
 result={...bad.receipt,roundId:id,faultReceipt:bad.faultReceipt,faultyTrusteeIndex:1,closeReceipt};
}else if(number===2){
 const {id}=await createSimulatedRound(),seed=scenario.plants[0];
 stage(`SIMULATED round ${id}: preparing a real proof with a foreign verifier signature`);
 const plant=await preparePlant(id,seed.installationId,BigInt(seed.E),BigInt(seed.P));
 const signature=await privateKeyToAccount(toHex(99n,{size:32})).signTypedData(typedStatement(plant.typedStatement));
 result={...await transact(toHex(100n,{size:32}),d.round,'OrtalamaRound','commit',submissionArgs({...plant.submission,verifierSignature:signature}),'UnknownVerifier'),roundId:id};
 await transact(governor,d.round,'OrtalamaRound','abort',[id,keccak256(toHex('SIMULATED attack fixture complete'))]);
}else if(number===3||number===4){
 const {id,plants}=await fixture(number===3?1:4);
 if(number===3)result={...await transact(toHex(100n,{size:32}),d.round,'OrtalamaRound','commit',submissionArgs(plants[0]!.submission),'AlreadyCommitted'),roundId:id};
 else{
  await transact(governor,d.round,'OrtalamaRound','startSharing',[id]);
  result={...await transact(governor,d.round,'OrtalamaRound','startClosing',[id],'CohortTooSmall'),roundId:id};
 }
 result.abortReceipt=await transact(governor,d.round,'OrtalamaRound','abort',[id,keccak256(toHex('SIMULATED attack fixture complete'))]);
 assert.equal(Number((await readRound(id)).state),5);
}else{
 const seed=await json(runtimePath('SIMULATED_e2e_evidence.json'));
 assert.equal(seed.status,'PASS','Seeded CLI round required');
 const id=BigInt(seed.mainRoundId),r=await readRound(id);
 assert.equal(Number(r.state),4);
 if(number===5){
  const plant=scenario.plants.at(-1);
  const prepared=await json(runtimePath(`plants/SIMULATED_round_${id}_${plant.installationId}_secret.json`));
  const opening=Object.fromEntries(['E','P','r','s'].map(k=>[k,BigInt(prepared.opening[k])])) as any;
  stage('Trying the above-average witness against the actual sector threshold');
  let blocked=false;try{await badgeProof(opening,id,plant.installationId,r.SE,r.SP,0n);}catch{blocked=true;}
  assert.ok(blocked,'Above-average witness unexpectedly proved');
  const proof=await badgeProof(opening,id,plant.installationId,r.config.thresholdNumerators[0],r.config.thresholdDenominators[0],1n);
  result={...await transact(governor,d.badge,'BadgeRegistry','attest',[id,id,plant.installationId,0n,proof],'InvalidProof'),roundId:id,witnessGenerationBlocked:true};
 }else{
  const target=BigInt(seed.secondClosedRoundId);
  assert.equal(Number((await readRound(target)).state),4);
  stage(`Replaying the actual round ${id} proof at closed round ${target}`);
  result={...await transact(governor,d.badge,'BadgeRegistry','attest',[target,id,scenario.plants[0].installationId,0n,seed.badge.proof],'WrongRound'),roundId:target,proofRoundId:id};
 }
}
assert.equal(result.status,'reverted');
await post(`${process.env.ORTALAMA_INDEXER}/sync`,{});
process.stdout.write(stringify({status:'PASS',simulation:true,result})+'\n',()=>process.exit(0));
