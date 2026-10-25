import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {keccak256,parseEther,serializeTransaction} from 'viem';
import {sendTestnetTransaction} from '../packages/protocol/src/testnet-transactions.js';

test('lost broadcast response recovers the exact signed hash and retry sends nothing',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ortalama-journal-'));
 let sent=0,signed=0,nonce=0,receipt:any,confirmationChecks=0;
 const raw=serializeTransaction({type:'eip1559',chainId:10143,nonce:0,to:'0x0000000000000000000000000000000000000123',value:0n,gas:105000n,maxFeePerGas:122n,maxPriorityFeePerGas:1n},{r:'0x01',s:'0x02',yParity:0}),hash=keccak256(raw);
 const client={getChainId:async()=>10143,getTransactionCount:async()=>nonce,estimateGas:async()=>100000n,estimateFeesPerGas:async()=>({maxFeePerGas:122n,maxPriorityFeePerGas:1n}),getBalance:async()=>parseEther('100'),getTransactionReceipt:async()=>{if(!receipt)throw new Error('missing');return receipt;},getTransaction:async()=>({hash}),waitForTransactionReceipt:async(options:any)=>{assert.equal(options.confirmations,6);confirmationChecks++;return receipt;}};
 const wallet={chain:{id:10143},account:{address:'0x0000000000000000000000000000000000000123'},prepareTransactionRequest:async(x:any)=>x,signTransaction:async()=>{signed++;return raw;},sendRawTransaction:async()=>{sent++;nonce++;receipt={transactionHash:hash,status:'success',blockNumber:42n,gasUsed:90000n,effectiveGasPrice:100n};throw new Error('response lost after mining');}};
 try{
  const first=await sendTestnetTransaction(client,wallet,{data:'0xab'},'lost',root);
  const second=await sendTestnetTransaction(client,wallet,{data:'0xab'},'lost',root);
  assert.equal(first.transactionHash,hash);assert.equal(second.transactionHash,hash);
  assert.equal(sent,1);assert.equal(signed,1);assert.equal(confirmationChecks,2);
  await assert.rejects(sendTestnetTransaction(client,wallet,{data:'0xab'},'lost',root,1n),/OperationCostCapExceeded/);
  assert.equal(sent,1);
  const budget=JSON.parse(await readFile(join(root,'SIMULATED_budget.json'),'utf8'));
  assert.equal(budget.entries,1);assert.equal(budget.maximumReservedWei,'10500000');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('wrong chain, pending nonce and excessive fee all fail before signing',async()=>{
 for(const kind of ['chain','nonce','fee','budget']){
  const root=await mkdtemp(join(tmpdir(),'ortalama-budget-'));let signed=false;
  const client={getChainId:async()=>kind==='chain'?1:10143,getTransactionCount:async(x:any)=>kind==='nonce'&&x.blockTag==='pending'?1:0,estimateGas:async()=>kind==='budget'?30_000_000n:21000n,estimateFeesPerGas:async()=>({maxFeePerGas:kind==='fee'?301_000_000_000n:300_000_000_000n,maxPriorityFeePerGas:1n}),getBalance:async()=>parseEther('100'),getBlock:async()=>({baseFeePerGas:300_000_000_000n})};
  const wallet={chain:{id:10143},account:{address:'0x123'},signTransaction:async()=>{signed=true;}};
  try{await assert.rejects(sendTestnetTransaction(client,wallet,{data:'0xab',...(kind==='budget'?{gas:30_000_000n}:{})},kind,root),new RegExp({chain:'MonadTestnetRequired',nonce:'PendingNonceConflict',fee:'TestnetFeeCapExceeded',budget:'ProjectTestMONBudgetExceeded'}[kind]!));assert.equal(signed,false);}
  finally{await rm(root,{recursive:true,force:true});}
 }
});

test('signed fee can fit the remaining cap without cutting execution gas',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ortalama-tight-cap-'));let receipt:any,prepared:any;
 await writeFile(join(root,'SIMULATED_budget.json'),JSON.stringify({maximumReservedWei:'0',capWei:'12500000',entries:0}));
 const address='0x0000000000000000000000000000000000000123';
 const client={getChainId:async()=>10143,getTransactionCount:async()=>0,estimateGas:async()=>100000n,estimateFeesPerGas:async()=>({maxFeePerGas:122n,maxPriorityFeePerGas:1n}),getBlock:async()=>({baseFeePerGas:100n}),getBalance:async()=>parseEther('1'),getTransactionReceipt:async()=>{throw new Error('not yet');},waitForTransactionReceipt:async()=>receipt};
 const wallet={chain:{id:10143},account:{address},prepareTransactionRequest:async(x:any)=>{prepared=x;return x;},signTransaction:async(x:any)=>serializeTransaction({type:'eip1559',chainId:10143,to:address,value:0n,...x},{r:'0x01',s:'0x02',yParity:0}),sendRawTransaction:async({serializedTransaction}:any)=>{const hash=keccak256(serializedTransaction);receipt={transactionHash:hash,status:'success',blockNumber:1n,gasUsed:90000n,effectiveGasPrice:100n};return hash;}};
 try{
  await sendTestnetTransaction(client,wallet,{to:address},'tight',root);
  assert.equal(prepared.gas,105000n);assert.equal(prepared.maxFeePerGas,119n);
  const budget=JSON.parse(await readFile(join(root,'SIMULATED_budget.json'),'utf8'));
  assert.equal(budget.maximumReservedWei,'10500000');
 }finally{await rm(root,{recursive:true,force:true});}
});
