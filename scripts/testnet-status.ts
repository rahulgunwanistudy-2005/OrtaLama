import {formatEther} from 'viem';
import {client,deployment,json,runtimePath,artifact,readRound,stringify} from '../packages/protocol/src/runtime.js';
const d=await deployment(),s=await json(runtimePath('SIMULATED_scenario.json')),a=await artifact('OrtalamaRound');
if(await client.getChainId()!==10143)throw new Error('MonadTestnetRequired');
const head=await client.getBlock(),balances=[];
for(const [role,address] of [['governor',d.governor],...s.trustees.map((t:any)=>['trustee'+t.index,t.address])])balances.push({role,address,balanceMON:formatEther(await client.getBalance({address}))});
const count=await client.readContract({address:d.round,abi:a.abi,functionName:'roundCount'}) as bigint,rounds=[];
for(let id=1n;id<=count;id++){
 const r=await readRound(id);rounds.push({id,state:Number(r.state),n:r.n,publications:r.publicationMask,faults:r.faultMask,commitDeadline:r.config.commitDeadline,sharingDeadline:r.config.sharingDeadline,closingDeadline:r.config.closingDeadline,closingExpired:head.timestamp>r.config.closingDeadline});
}
console.log(stringify({chainId:10143,checkedAt:new Date().toISOString(),head:head.number,timestamp:head.timestamp,balances,rounds}));
