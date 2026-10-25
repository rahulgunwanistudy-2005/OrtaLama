/** Fund only the three deployment-bound simulated trustees, from a private file. */
import {parseEther,type Hex} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {client,wallet,deployment,json,runtimePath,assertSimulationContext,publicTestnet,stringify} from '../packages/protocol/src/runtime.js';
import {sendTestnetTransaction} from '../packages/protocol/src/testnet-transactions.js';
const d=await deployment();await assertSimulationContext(d);
if(!publicTestnet)throw new Error('PublicTestnetRequired');
const governor=(await json(runtimePath('SIMULATED_governor_secret.json'))).signingKey as Hex;
const w=wallet(governor),receipts=[],topUp=process.argv.includes('--top-up'),faultTopUp=process.argv.includes('--fault-top-up'),publicationTopUp=process.argv.includes('--publication-top-up');
for(let i=1;i<=3;i++){
 if((topUp||publicationTopUp)&&i===1)continue;
 if(faultTopUp&&i!==1)continue;
 const cfg=await json(runtimePath(`SIMULATED_trustee_${i}_secret.json`));
 if(cfg.chainId!==10143||cfg.deployment!==d.round)throw new Error('TrusteeDeploymentMismatch');
 const to=privateKeyToAccount(cfg.signingKey).address;
 if(!topUp&&!faultTopUp&&!publicationTopUp&&await client.getBalance({address:to})>0n)continue;
 const r=await sendTestnetTransaction(client,w,{to,value:parseEther(publicationTopUp?'0.03':topUp||faultTopUp?'0.35':'0.7')},`${publicationTopUp?'trustee-publication-topup':faultTopUp?'trustee-fault-topup':topUp?'trustee-topup':'trustee-funding'}:${d.round}:${i}`);
 if(r.status!=='success')throw new Error('TrusteeFundingFailed');
 receipts.push({index:i,address:to,hash:r.transactionHash,block:String(r.blockNumber)});
}
console.log(stringify({simulation:true,chainId:10143,receipts}));
