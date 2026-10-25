/** Explicit local cap change, serialised against all project transactions. */
import {open,readFile,readdir,writeFile,rename,unlink} from 'node:fs/promises';
import {parseEther} from 'viem';
const i=process.argv.indexOf('--cap-mon'),value=process.argv[i+1];
if(i<0||!value||!/^\d+(\.\d+)?$/.test(value))throw new Error('ExplicitTestMONCapRequired');
const cap=parseEther(value);
if(cap>parseEther('16')||cap<=0n)throw new Error('MaximumApprovedProjectCapIsSixteenTestMON');
const root='.runtime/testnet/SIMULATED_transactions';
let lock;
for(let attempt=0;attempt<40;attempt++){
 try{lock=await open(root+'/SIMULATED_write.lock','wx',0o600);break;}
 catch(e:any){if(e.code!=='EEXIST')throw e;await new Promise(resolve=>setTimeout(resolve,500));}
}
if(!lock)throw new Error('ProjectTransactionBusy');
try{
 const path=root+'/SIMULATED_budget.json',budget=JSON.parse(await readFile(path,'utf8'));
 let journalled=0n;
 for(const file of await readdir(root))if(/^0x[0-9a-f]{64}\.json$/.test(file))journalled+=BigInt(budget.settledCosts?.[file]??JSON.parse(await readFile(root+'/'+file,'utf8')).maximumCost);
 const reserved=BigInt(budget.maximumReservedWei)>journalled?BigInt(budget.maximumReservedWei):journalled;
 if(reserved>cap)throw new Error('CapBelowAlreadyReservedCost');
 const next={...budget,maximumReservedWei:String(reserved),capWei:String(cap),capHistory:[...(budget.capHistory??[]),{capWei:String(cap),changedAt:new Date().toISOString(),reason:'Explicit full Monad protocol test budget, including prior attempts and role funding; test MON only'}]};
 await writeFile(path+'.tmp',JSON.stringify(next)+'\n',{mode:0o600});await rename(path+'.tmp',path);
 console.log(JSON.stringify({chainId:10143,capMON:value,reservedWei:String(reserved),journalAudit:'PASS'}));
}finally{await lock.close();await unlink(root+'/SIMULATED_write.lock');}
