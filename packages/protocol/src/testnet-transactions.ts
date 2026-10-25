/** Monad-only transaction journal. Raw transactions never enter public output. */
import {mkdir,open,readFile,rename,writeFile} from 'node:fs/promises';
import {keccak256,parseEther,toHex,parseTransaction,type Hex} from 'viem';

const defaultRoot='.runtime/testnet/SIMULATED_transactions';
const serial=(v:any)=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?String(x):x);
const transactionId=(account:string,request:{to?:Hex;data?:Hex;value?:bigint},operation?:string)=>keccak256(toHex(serial({chain:10143,account,to:request.to,data:request.data,value:request.value,operation})));
export async function journalledTestnetReceipt(client:any,account:string,request:{to?:Hex;data?:Hex;value?:bigint},operation?:string){
 const id=transactionId(account,request,operation);
 let entry;
 try{entry=JSON.parse(await readFile(defaultRoot+'/'+id+'.json','utf8'));}catch(error:any){if(error.code==='ENOENT')return undefined;throw error;}
 const receipt=await client.getTransactionReceipt({hash:entry.hash});
 if(receipt.status!=='success')throw new Error('SavedTransactionWasNotSuccessful');
 return receipt;
}
async function atomic(path:string,value:any){
 const temporary=path+'.tmp';
 await writeFile(temporary,serial(value)+'\n',{mode:0o600});
 await rename(temporary,path);
}
export async function sendTestnetTransaction(client:any,wallet:any,request:{to?:Hex;data?:Hex;value?:bigint;gas?:bigint},operation?:string,root=defaultRoot,maximumAllowedCost?:bigint){
 if(await client.getChainId()!==10143||wallet.chain?.id!==10143)throw new Error('MonadTestnetRequired');
 await mkdir(root,{recursive:true,mode:0o700});
 // One project-wide lock also makes the aggregate cost reservation atomic.
 let lock;
 for(let attempt=0;attempt<120;attempt++){
  try{lock=await open(root+'/SIMULATED_write.lock','wx',0o600);break;}
  catch(error:any){if(error.code!=='EEXIST')throw error;await new Promise(resolve=>setTimeout(resolve,250));}
 }
 if(!lock)throw new Error('TestnetTransactionBusyInspectJournalBeforeRetry');
 try{
  const id=transactionId(wallet.account.address,request,operation);
  const path=root+'/'+id+'.json';
  let entry:any;
  try{entry=JSON.parse(await readFile(path,'utf8'));}catch(e:any){if(e.code!=='ENOENT')throw e;}
  if(entry&&maximumAllowedCost!==undefined&&BigInt(entry.maximumCost)>maximumAllowedCost)throw new Error('OperationCostCapExceeded');
  if(!entry){
   const latest=await client.getTransactionCount({address:wallet.account.address,blockTag:'latest'});
   const pending=await client.getTransactionCount({address:wallet.account.address,blockTag:'pending'});
   if(latest!==pending)throw new Error('PendingNonceConflict');
   const estimate=request.gas??await client.estimateGas({account:wallet.account.address,...request});
   const gas=request.gas??(estimate*105n+99n)/100n;
   if(gas>30_000_000n)throw new Error('MonadTransactionGasLimit');
   const fees=await client.estimateFeesPerGas();
   if(!fees.maxFeePerGas||fees.maxFeePerGas>300_000_000_000n)throw new Error('TestnetFeeCapExceeded');
   let maximumCost=gas*fees.maxFeePerGas+(request.value??0n);
   let ledger:any;
   try{ledger=JSON.parse(await readFile(root+'/SIMULATED_budget.json','utf8'));}catch(e:any){if(e.code!=='ENOENT')throw e;ledger={maximumReservedWei:'0',capWei:String(parseEther('8')),entries:0};}
   const balance=await client.getBalance({address:wallet.account.address});
   let available=BigInt(ledger.capWei)-BigInt(ledger.maximumReservedWei);
   if(maximumAllowedCost!==undefined&&maximumAllowedCost<available)available=maximumAllowedCost;
   if(balance<available)available=balance;
   if(maximumCost>available){
    const value=request.value??0n;
    if(available<=value)throw new Error('ProjectTestMONBudgetExceeded');
    const affordableFee=(available-value)/gas;
    const head=await client.getBlock();
    if(head.baseFeePerGas===null||head.baseFeePerGas===undefined||affordableFee<head.baseFeePerGas+(fees.maxPriorityFeePerGas??0n))throw new Error(balance===available?'InsufficientTestMONForBoundedTransaction':'ProjectTestMONBudgetExceeded');
    // Cap the signed fee itself to the remaining allowance. Never reduce the
    // gas needed by the measured execution or exceed the project budget.
    fees.maxFeePerGas=affordableFee;
    maximumCost=gas*fees.maxFeePerGas+value;
   }
   if(BigInt(ledger.maximumReservedWei)+maximumCost>BigInt(ledger.capWei))throw new Error('ProjectTestMONBudgetExceeded');
   if(balance<maximumCost)throw new Error('InsufficientTestMONForBoundedTransaction');
   const tx=await wallet.prepareTransactionRequest({...request,gas,nonce:pending,...fees});
   const raw=await wallet.signTransaction(tx),hash=keccak256(raw);
   entry={chainId:10143,account:wallet.account.address,nonce:pending,operation,hash,raw,gas:String(gas),maximumCost:String(maximumCost),status:'SIGNED_NOT_CONFIRMED'};
   // Reserve before journalling: a crash can overcount but cannot overspend.
   await atomic(root+'/SIMULATED_budget.json',{...ledger,maximumReservedWei:String(BigInt(ledger.maximumReservedWei)+maximumCost),entries:ledger.entries+1});
   await atomic(path,entry);
  }
  let receipt;
  try{receipt=await client.getTransactionReceipt({hash:entry.hash});}catch{}
  if(!receipt){
   const nonce=await client.getTransactionCount({address:wallet.account.address,blockTag:'latest'});
   if(nonce>entry.nonce)throw new Error('SavedTransactionNonceConsumedByAnotherTransaction');
   try{const hash=await wallet.sendRawTransaction({serializedTransaction:entry.raw});if(hash!==entry.hash)throw new Error('TransactionHashMismatch');}
   catch(error){
    // Never sign a replacement after a lost response. Wait for this exact hash.
    try{await client.getTransaction({hash:entry.hash});}catch{throw new Error('BroadcastUncertainRetryExactSavedTransaction');}
   }
  }
  // A cached receipt can still be newly mined. Apply the same confirmation
  // threshold to recovery before releasing any fee reservation.
  receipt=await client.waitForTransactionReceipt({hash:entry.hash,confirmations:6,timeout:120_000});
  await atomic(path,{...entry,status:receipt.status,blockNumber:String(receipt.blockNumber),gasUsed:String(receipt.gasUsed),effectiveGasPrice:String(receipt.effectiveGasPrice)});
  // Settle only confirmed fee overestimates. Monad charges the gas limit;
  // execution gasUsed must never be mistaken for a refundable allowance.
  const budgetPath=root+'/SIMULATED_budget.json';
  const budget=JSON.parse(await readFile(budgetPath,'utf8'));
  const charged=BigInt(entry.gas)*BigInt(receipt.effectiveGasPrice)+(parseTransaction(entry.raw).value??0n);
  const prior=BigInt(budget.settledCosts?.[id+'.json']??entry.maximumCost);
  if(charged>prior)throw new Error('ConfirmedCostExceedsReservation');
  await atomic(budgetPath,{...budget,maximumReservedWei:String(BigInt(budget.maximumReservedWei)-prior+charged),settledCosts:{...(budget.settledCosts??{}),[id+'.json']:String(charged)}});
  return {...receipt,maximumCostWei:BigInt(entry.maximumCost),gasLimit:BigInt(entry.gas)};
 }finally{await lock.close();await import('node:fs/promises').then(fs=>fs.unlink(root+'/SIMULATED_write.lock'));}
}
