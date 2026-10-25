/** Release fee overestimates only after a recorded confirmed receipt. */
import {open,readdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {parseTransaction} from 'viem';
const root='.runtime/testnet/SIMULATED_transactions';
const lock=await open(root+'/SIMULATED_write.lock','wx',0o600);
try{
 const path=root+'/SIMULATED_budget.json',budget=JSON.parse(await readFile(path,'utf8'));
 const settled={...(budget.settledCosts??{})};let reduction=0n;
 for(const file of await readdir(root)){
  if(!/^0x[0-9a-f]{64}\.json$/.test(file))continue;
  const entry=JSON.parse(await readFile(root+'/'+file,'utf8'));
  if(!['success','reverted'].includes(entry.status)||!entry.effectiveGasPrice)continue;
  const tx=parseTransaction(entry.raw);
  // Monad charges the gas LIMIT; never release the unused execution gas.
  const charged=BigInt(entry.gas)*BigInt(entry.effectiveGasPrice)+(tx.value??0n);
  const previous=BigInt(settled[file]??entry.maximumCost);
  if(charged>previous)throw new Error('RecordedChargeExceedsReservation');
  reduction+=previous-charged;settled[file]=String(charged);
 }
 const next={...budget,maximumReservedWei:String(BigInt(budget.maximumReservedWei)-reduction),settledCosts:settled,lastReconciledAt:new Date().toISOString(),settlementPolicy:'Confirmed gas LIMIT times receipt effective price, plus transferred value; no execution-gas refund assumed'};
 await writeFile(path+'.tmp',JSON.stringify(next)+'\n',{mode:0o600});await rename(path+'.tmp',path);
 console.log(JSON.stringify({status:'RECONCILED_CONFIRMED_TESTNET_FEES',releasedFeeOverestimateWei:String(reduction),maximumReservedWei:next.maximumReservedWei,capWei:next.capWei}));
}finally{await lock.close();await unlink(root+'/SIMULATED_write.lock');}
