import {getPagedContractEvents} from '../packages/protocol/src/public-chain.js';
/** Resumable real testnet gate. No clock manipulation or fixture signing keys. */
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {decodeFunctionData,parseTransaction,keccak256,toHex,encodeAbiParameters,type Hex} from 'viem';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {typedStatement} from '../packages/crypto-ts/src/index.js';
import {artifact,deployment,json,client,readRound,readPlant,transact,badgeProof,save,stringify,runtimePath,assertSimulationContext,publicTestnet} from '../packages/protocol/src/runtime.js';
import {verifySnapshot,verifyPublicAttestations} from '../packages/protocol/src/verify.js';
import {preparePlant,commitPlantRecoverable,submissionArgs} from './plant-agent/agent.js';
import {createSimulatedRound} from './rounds.js';

const d=await deployment();await assertSimulationContext(d);assert.equal(publicTestnet,true);
const scenario=await json(runtimePath('SIMULATED_scenario.json'));
const governor=(await json(runtimePath('SIMULATED_governor_secret.json'))).signingKey as Hex;
const a=await artifact('OrtalamaRound'),b=await artifact('BadgeRegistry');
const base=process.env.ORTALAMA_INDEXER!,trusteePort=Number(process.env.ORTALAMA_TRUSTEE_BASE_PORT);
const started=performance.now(),checkpoint=runtimePath('SIMULATED_monad_gate_checkpoint.json');
let state:any;
try{state=await json(checkpoint);}catch(e:any){if(e.code!=='ENOENT')throw e;state={simulation:true,chainId:10143,deployment:d.round,attacks:[],guards:[],status:'RUNNING'};}
assert.equal(state.deployment,d.round);
const persist=async()=>save(checkpoint,state,true);
const stage=async(message:string)=>{console.log(message);state.stage=message;await persist();};
async function post(url:string,body:any,token?:string,expected=200){
 for(let attempt=0;attempt<3;attempt++){
  let response:Response;
  try{response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:stringify(body)});}
  catch(error){if(attempt===2)throw error;continue;}
  const value=await response.json() as any;
  if(expected===200&&[409,503].includes(response.status)&&['BridgeOperationFailed','Index sync unavailable','BridgeRPCFailed'].includes(value.detail)&&attempt<2)continue;
  assert.equal(response.status,expected,`Service rejected operation: ${value.detail??response.status}`);return value;
 }
 throw new Error('ServiceRetryExhausted');
}
async function journal(){
 const entries=[];
 for(const file of await readdir('.runtime/testnet/SIMULATED_transactions')){
  if(!/^0x[0-9a-f]{64}\.json$/.test(file))continue;
  const e=await json('.runtime/testnet/SIMULATED_transactions/'+file),tx=parseTransaction(e.raw);
  if(![d.round.toLowerCase(),d.badge.toLowerCase()].includes(tx.to?.toLowerCase()))continue;
  const abi=tx.to?.toLowerCase()===d.round.toLowerCase()?a.abi:b.abi;
  const decoded=decodeFunctionData({abi,data:tx.data!});
  entries.push({e,tx,abi,decoded,args:decoded.args as any[]});
 }
 return entries;
}
async function previousNegative(fn:string,id:bigint,errorName:string){
 const found=(await journal()).find(x=>x.e.operation===`protocol:${fn}:${errorName}`&&x.decoded.functionName===fn&&BigInt(typeof x.args[0]==='object'?x.args[0].roundId:x.args[0])===id);
 if(!found)return undefined;
 const receipt=await client.getTransactionReceipt({hash:found.e.hash});assert.equal(receipt.status,'reverted');
 let reason='';
 try{await client.simulateContract({address:found.tx.to!,abi:found.abi,functionName:fn,args:found.args,account:found.e.account,blockNumber:receipt.blockNumber,gas:BigInt(found.e.gas)});}
 catch(error:any){for(let e=error;e;e=e.cause)if(e.data?.errorName){reason=e.data.errorName;break;}}
 assert.equal(reason,errorName,'Historical receipt/error recovery failed');
 return {hash:receipt.transactionHash,blockNumber:receipt.blockNumber,status:receipt.status,gasUsed:receipt.gasUsed,error:reason,recoveredFromSavedTransaction:true};
}
async function negative(number:number,label:string,id:bigint,address:Hex,name:string,fn:string,args:()=>Promise<any[]>,error:string){
 let result:any=await previousNegative(fn,id,error);
 if(!result)result=await transact(governor,address,name,fn,await args(),error);
 const attack:any={id:number,label,roundId:id,...result};
 state.attacks=state.attacks.filter((x:any)=>x.id!==number);state.attacks.push(attack);await persist();return attack;
}
async function roundAt(ordinal:bigint){
 const count=await client.readContract({address:d.round,abi:a.abi,functionName:'roundCount'}) as bigint;
 if(count<ordinal){assert.equal(count,ordinal-1n);const result=await createSimulatedRound();assert.equal(result.id,ordinal);}
 const round=await readRound(ordinal);assert.equal(round.config.cohortRoot,scenario.cohortRoot);assert.equal(round.config.verifierRoot,scenario.verifierRoot);
 return ordinal;
}
async function plantsFor(id:bigint,count:number,main=false){
 const plants=[];
 for(let i=0;i<count;i++){
  const seed=scenario.plants[i];let plant;
  try{plant=await json(runtimePath(`plants/SIMULATED_round_${id}_${seed.installationId}_secret.json`));}
  catch(error:any){if(error.code!=='ENOENT')throw error;plant=await preparePlant(id,seed.installationId,BigInt(seed.E),BigInt(seed.P));}
  assert.equal(plant.typedStatement.verifyingContract.toLowerCase(),d.round.toLowerCase());assert.equal(BigInt(plant.typedStatement.chainId),10143n);
  if(main&&i===0)await negative(2,'Non-allowlisted verifier',id,d.round,'OrtalamaRound','commit',async()=>{
   const signature=await privateKeyToAccount(generatePrivateKey()).signTypedData(typedStatement(Object.fromEntries(Object.entries(plant.typedStatement).map(([k,v])=>[k,['chainId','roundId'].includes(k)?BigInt(v as string):v])) as any));
   return submissionArgs({...plant.submission,verifierSignature:signature});
  },'UnknownVerifier');
  await commitPlantRecoverable(plant,governor);
  await post(`${base}/rounds/${id}/attestations/${plant.installationId}`,plant.attestation);
  if(main&&i===0)await negative(3,'Duplicate installation',id,d.round,'OrtalamaRound','commit',async()=>submissionArgs(plant.submission),'AlreadyCommitted');
  // Restored JSON scalar fields are canonical decimal strings.
  plant.opening=Object.fromEntries(['E','P','r','s'].map(k=>[k,BigInt(plant.opening[k])]));
  plants.push(plant);await stage(`Monad round ${id}: plant ${i+1}/${count} committed or exact receipt recovered`);
 }
 return plants;
}
async function publish(id:bigint,index:number,omitted?:Hex){
 const cfg=await json(runtimePath(`SIMULATED_trustee_${index}_secret.json`));
 return post(`http://127.0.0.1:${trusteePort+index}/rounds/${id}/publish`,{simulation:true,omitInstallationId:omitted??null},cfg.controlToken);
}
async function closeRound(id:bigint,plants:any[],main=false){
 let r=await readRound(id);
 if(Number(r.state)===1){await transact(governor,d.round,'OrtalamaRound','startSharing',[id]);r=await readRound(id);}
 if(Number(r.state)===2){
  for(const plant of plants){
   const stored=await readPlant(id,plant.installationId);
   await Promise.all([1,2,3].map(async index=>{
    let durable=false;
    if(Number(stored.receipts)&(1<<(index-1))){
     const response=await fetch(`http://127.0.0.1:${trusteePort+index}/rounds/${id}/receipts/${plant.installationId}`);
     if(response.ok){const value=await response.json() as any;durable=value.acknowledged&&value.ciphertextHash===plant.submission.ciphertextHashes[index-1];}
    }
    if(!durable)await post(`http://127.0.0.1:${trusteePort+index}/shares`,{simulation:true,roundId:String(id),installationId:plant.installationId,envelope:plant.envelopes[index-1]});
   }));
   await stage(`Monad round ${id}: three durable ACKs checked for ${plant.installationId.slice(0,10)}`);
  }
  await transact(governor,d.round,'OrtalamaRound','startClosing',[id]);r=await readRound(id);
 }
 if(Number(r.state)===3){
  if(main){
   const prior=await previousNegative('publishSum',id,'AggregateMismatch');
   if(!prior||!(Number(r.faultMask)&1)){
    const bad=await publish(id,1,plants.at(-1)!.installationId);
    assert.equal(bad.receipt.error,'AggregateMismatch');assert.equal(bad.faultReceipt.status,'success');
    state.attacks=state.attacks.filter((x:any)=>x.id!==1);state.attacks.push({id:1,label:'Trustee omits a committed member',roundId:id,...bad.receipt,faultReceipt:bad.faultReceipt,faultyTrusteeIndex:1});await persist();
   }else if(!state.attacks.some((x:any)=>x.id===1)){state.attacks.push({id:1,label:'Trustee omits a committed member',roundId:id,...prior,faultyTrusteeIndex:1});await persist();}
  }
  for(const index of [2,3])if(!(Number((await readRound(id)).publicationMask)&(1<<(index-1))))await publish(id,index);
  await transact(governor,d.round,'OrtalamaRound','close',[id]);
 }
 r=await readRound(id);assert.equal(Number(r.state),4);
 const E=plants.reduce((s,p)=>s+p.opening.E,0n),P=plants.reduce((s,p)=>s+p.opening.P,0n);
 assert.equal(r.SE,E);assert.equal(r.SP,P);assert.equal(r.intensity,E*1_000_000n/P);
 await stage(`Monad round ${id}: CLOSED, intensity ${r.intensity}/1000000`);return r;
}
if(!state.mainRoundId){
 const count=await client.readContract({address:d.round,abi:a.abi,functionName:'roundCount'}) as bigint;
 let next=1n;
 if(count>=1n){
  const previous=await readRound(1n),head=await client.getBlock();
  if(Number(previous.state)===5||(Number(previous.state)!==4&&head.timestamp>previous.config.closingDeadline)){
   await save(runtimePath('SIMULATED_expired_round_1_checkpoint.json'),state,true);
   const aborted=Number(previous.state)===5?undefined:await transact(governor,d.round,'OrtalamaRound','abort',[1n,keccak256(toHex('SIMULATED interrupted round deadline expired'))]);
   state={simulation:true,chainId:10143,deployment:d.round,attacks:[],guards:[],status:'RUNNING',supersededRounds:[{roundId:'1',reason:'Interrupted 12-plant round exceeded its immutable closing deadline',abortReceipt:aborted}]};
   next=count+1n;
  }
 }
 state.mainRoundId=String(next);state.mainCount=5;await persist();
}
const main=await roundAt(BigInt(state.mainRoundId)),plants=await plantsFor(main,state.mainCount,true),result=await closeRound(main,plants,true);
assert.equal(Number(result.faultMask),1);
const clean=plants[0],dirty=plants.at(-1),badgeId=keccak256(encodeAbiParameters([{type:'uint64'},{type:'bytes32'},{type:'uint64'}],[main,clean.installationId,0n]));
let proof=state.badgeProof;
if(!proof){proof=await badgeProof(clean.opening,main,clean.installationId,result.SE,result.SP,0n);state.badgeProof=proof;await persist();}
const existing:any=await client.readContract({address:d.badge,abi:b.abi,functionName:'getBadge',args:[badgeId]});
let badgeReceipt=state.badgeReceipt;
if(!existing.issued){badgeReceipt=await transact(governor,d.badge,'BadgeRegistry','attest',[main,main,clean.installationId,0n,proof]);state.badgeReceipt=badgeReceipt;await persist();}
else if(!badgeReceipt){const found=(await journal()).find(x=>x.e.status==='success'&&x.tx.to?.toLowerCase()===d.badge.toLowerCase()&&x.decoded.functionName==='attest'&&BigInt(x.args[0])===main&&x.args[2]===clean.installationId&&BigInt(x.args[3])===0n);if(!found)throw new Error('IssuedBadgeReceiptNotInSavedGate');const receipt=await client.getTransactionReceipt({hash:found.e.hash});badgeReceipt={hash:receipt.transactionHash,status:receipt.status,blockNumber:receipt.blockNumber};state.badgeReceipt=badgeReceipt;await persist();}
let blocked=false;try{await badgeProof(dirty.opening,main,dirty.installationId,result.SE,result.SP,0n);}catch{blocked=true;}assert.equal(blocked,true);
const invalid=await negative(5,'Above-average witness blocked; different-threshold proof rejected',main,d.badge,'BadgeRegistry','attest',async()=>[main,main,dirty.installationId,0n,await badgeProof(dirty.opening,main,dirty.installationId,result.config.thresholdNumerators[0],result.config.thresholdDenominators[0],1n)],'InvalidProof');invalid.witnessGenerationBlocked=true;
const second=await roundAt(main+1n),nextPlants=await plantsFor(second,5);await closeRound(second,nextPlants);
await negative(6,'Previous-round badge replay at a distinct closed round',second,d.badge,'BadgeRegistry','attest',async()=>[second,main,clean.installationId,0n,proof],'WrongRound');
const contextLie={status:'NOT_RUN_ON_PUBLIC_TESTNET',reason:'The context-lie negative passed locally; the public replay gate mines WrongRound at a distinct closed round.'};
const small=await roundAt(main+2n);await plantsFor(small,1);
if(Number((await readRound(small)).state)===1)await transact(governor,d.round,'OrtalamaRound','startSharing',[small]);
const smallAttack=await negative(4,'One plant is below the five-plant minimum; separate successful abort',small,d.round,'OrtalamaRound','startClosing',async()=>[small],'CohortTooSmall');
if(Number((await readRound(small)).state)!==5)smallAttack.abortReceipt=await transact(governor,d.round,'OrtalamaRound','abort',[small,keccak256(toHex('SIMULATED CohortTooSmall gate'))]);
assert.equal(Number((await readRound(small)).state),5);
await post(base+'/sync',{});
const response=await fetch(`${base}/rounds/${main}/evidence`),evidence=await response.json() as any;
const verified=await verifySnapshot(evidence.snapshot,a.abi.find((x:any)=>x.name==='createRound').inputs[0],a.abi.find((x:any)=>x.name==='commit').inputs[0]);
const cosignatures=await verifyPublicAttestations(evidence.snapshot,evidence.attestations);
const tampered=structuredClone(evidence.snapshot);tampered.round.SE=String(BigInt(tampered.round.SE)+1n);
await assert.rejects(verifySnapshot(tampered,a.abi.find((x:any)=>x.name==='createRound').inputs[0],a.abi.find((x:any)=>x.name==='commit').inputs[0]));
assert.equal(state.attacks.length,6);assert.ok(state.attacks.every((x:any)=>x.status==='reverted'));
const successfulReceipts=(await journal()).filter(x=>x.e.status==='success').map(x=>({hash:x.e.hash,blockNumber:x.e.blockNumber,status:x.e.status,gasUsed:x.e.gasUsed,gasLimit:x.e.gas}));
const output={simulation:true,status:'PASS',chainId:10143,deployment:d.round,scope:'Actual Monad testnet; three separately keyed local trustee processes, PostgreSQL, real Groth16 proofs and all six mined rejections. Interrupted run recovered exact prior receipts and encrypted shares.',supersededRounds:state.supersededRounds??[],mainRoundId:main,mainCohortSize:state.mainCount,secondClosedRoundId:second,abortedRoundIds:[small],publicResult:verified,cosignatures,badge:{id:badgeId,receipt:badgeReceipt,proof},attacks:state.attacks.sort((x:any,y:any)=>x.id-y.id),additionalContextLieRevert:contextLie,guards:['Exact original commitment receipts recovered after service interruption','Already acknowledged encrypted shares checked against durable local trustee records','Stored aggregate tampering rejected by independent arithmetic verification'],successfulReceipts,indexedEvents:evidence.events.length,elapsedSeconds:Number(((performance.now()-started)/1000).toFixed(2)),limitations:['Synthetic report values and identities; no human approval or accreditation claimed','Three trustee processes share one host; no independent institutional custody','Public-chain reorganisation and clock manipulation were not attempted; isolated local regression covers those paths','The public minimum-cohort attack uses one plant; the four-plant boundary case passed in the local contract and CLI gates','Physical-phone verification and owner hosting remain external gates']};
await save(runtimePath('SIMULATED_e2e_evidence.json'),output);await save('docs/SIMULATED_MONAD_ROUND_RESULTS.json',output);
state.status='PASS';await persist();console.log(stringify({status:'PASS',chainId:10143,mainRoundId:main,intensity:verified.intensity,revertedAttacks:6,badgeId}));process.exit(0);
