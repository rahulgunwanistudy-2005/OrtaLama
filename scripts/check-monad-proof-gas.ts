/** Read-only diagnosis using the actual saved 10143-domain plant proof. */
import {readdir} from 'node:fs/promises';
import {client,artifact,deployment,json,runtimePath,stringify,save} from '../packages/protocol/src/runtime.js';
const d=await deployment();
if(d.chainId!==10143||await client.getChainId()!==10143)throw new Error('MonadOnly');
const file=(await readdir(runtimePath('plants'))).find(x=>x.startsWith('SIMULATED_round_1_'))!;
const p=await json(runtimePath('plants/'+file)),s=p.typedStatement,proof=p.submission.proof;
const signals=[...s.CE,...s.CP,...s.AE,...s.AP,s.roundId,BigInt(s.installationId)>>128n,BigInt(s.installationId)&((1n<<128n)-1n),10143n,BigInt(d.round),proof.contextTag].map(BigInt);
const a=await artifact('CommitmentValidityVerifier'),results=[];
const block=await client.getBlock();
const fixture={simulation:true,chainId:10143,verifier:d.validity,round:d.round,blockNumber:String(block.number),blockHash:block.hash,proof:{a:proof.a,b:proof.b,c:proof.c},publicInputs:signals};
await save('data/simulated/SIMULATED_monad_proof_gas_fixture.json',fixture);
for(const gas of [1_000_000n,1_500_000n,2_000_000n,3_000_000n]){
 try{const r=await client.simulateContract({address:d.validity,abi:a.abi,functionName:'verifyProof',args:[proof.a,proof.b,proof.c,signals],gas,blockNumber:block.number});results.push({gas:String(gas),valid:r.result});}
 catch{results.push({gas:String(gas),valid:false,executionReverted:true});}
}
await save('docs/SIMULATED_MONAD_PROOF_GAS_RESULTS.json',{simulation:true,chainId:10143,checkedAt:new Date().toISOString(),verifier:d.validity,round:d.round,blockNumber:String(block.number),blockHash:block.hash,fixture:'data/simulated/SIMULATED_monad_proof_gas_fixture.json',scope:'Actual Monad read-only execution of a fresh chain/contract-domain input proof',transactionsSent:0,results});
console.log(stringify(results));
