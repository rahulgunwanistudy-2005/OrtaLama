/** Explicit, separately funded testnet deployment. No synthetic signing keys. */
import {readFile,writeFile,mkdir,stat,access} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createPublicClient,createWalletClient,http,isAddress,keccak256,encodeDeployData,parseEther,type Hex} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {arbitrumSepolia,baseSepolia,monadTestnet} from 'viem/chains';
import {sendTestnetTransaction} from '../packages/protocol/src/testnet-transactions.js';

const argv=process.argv.slice(2);
const option=(name:string)=>{const i=argv.indexOf(name);return i<0?undefined:argv[i+1];};
if(argv.includes('--help')){
 console.log('deploy-testnet.ts --chain monad-testnet|arbitrum-sepolia|base-sepolia --rpc URL --governor ADDRESS --output SIMULATED_deployment.json [--broadcast --key-file PRIVATE_FILE]');
 process.exit(0);
}
const chain=option('--chain')==='monad-testnet'?monadTestnet:option('--chain')==='arbitrum-sepolia'?arbitrumSepolia:option('--chain')==='base-sepolia'?baseSepolia:undefined;
const rpc=option('--rpc'),governor=option('--governor'),output=option('--output');
if(!chain||!rpc||!governor||!isAddress(governor)||!output||!output.split('/').at(-1)!.startsWith('SIMULATED_'))throw new Error('Explicit chain, RPC, governor and SIMULATED output required; use --help');
const outputFile=output;
const url=new URL(rpc);if(!['https:','http:'].includes(url.protocol))throw new Error('HTTP RPC required');
const client=createPublicClient({chain,transport:http(rpc,{retryCount:0})});
if(await client.getChainId()!==chain.id)throw new Error('SelectedChainMismatch');
const contracts=['CommitmentValidityVerifier','BelowThresholdVerifier','OrtalamaRound','BadgeRegistry'] as const;
const artifacts=Object.fromEntries(await Promise.all(contracts.map(async name=>[name,JSON.parse(await readFile(`contracts/out/${name}.sol/${name}.json`,'utf8'))])));
const head=await client.getBlock();
const plan={simulation:true,status:'PLAN_ONLY',chainId:chain.id,governor,contracts,headBlock:String(head.number),blockGasLimit:String(head.gasLimit),note:'No transaction sent. This deploys contracts only; a testnet round, independent custody, hosted services, explorer verification and phone test are separate gates.'};
if(!argv.includes('--broadcast')){console.log(JSON.stringify(plan,null,2));process.exit(0);}
const keyFile=option('--key-file');if(!keyFile)throw new Error('Explicit funded testnet key file required');
let exists=false;try{await access(outputFile);exists=true;}catch(error:any){if(error.code!=='ENOENT')throw error;}
if(exists&&!argv.includes('--resume'))throw new Error('OutputAlreadyExistsInspectPriorDeployment');
if(chain.id!==10143)throw new Error('HardenedBroadcastCurrentlyMonadOnly');
const mode=(await stat(keyFile)).mode;if(mode&0o077)throw new Error('Key file must be private to its owner');
const signingKey=(await readFile(keyFile,'utf8')).trim() as Hex;
if(!/^0x[0-9a-fA-F]{64}$/.test(signingKey)||BigInt(signingKey)<=111n)throw new Error('Private testnet key required; known demo keys forbidden');
const account=privateKeyToAccount(signingKey);
if(await client.getBalance({address:account.address})===0n)throw new Error('Fund the explicit testnet deployer before broadcasting');
const wallet=createWalletClient({chain,account,transport:http(rpc,{retryCount:0})});
const previous=exists?JSON.parse(await readFile(outputFile,'utf8')):undefined;
if(previous&&(previous.chainId!==chain.id||previous.governor.toLowerCase()!==governor.toLowerCase()))throw new Error('ResumeDeploymentMismatch');
if(previous?.status==='CONTRACTS_DEPLOYED_NOT_FULL_PHASE8'){console.log(JSON.stringify(previous,null,2));process.exit(0);}
const transactions:Record<string,any>=previous?.transactions??{},addresses:Record<string,Hex>={};
let deploymentMaximum=Object.values(transactions).reduce((total:bigint,t:any)=>total+BigInt(t.maximumCost??'0'),0n);
await mkdir(dirname(outputFile),{recursive:true});
// Persist each successful receipt so an interrupted run never hides expenditure.
async function deploy(name:typeof contracts[number],args:readonly unknown[]=[]){
 const a=artifacts[name];
 if(transactions[name]?.address)return transactions[name].address as Hex;
 const data=encodeDeployData({abi:a.abi,bytecode:a.bytecode.object,args});
 const gas=(await client.estimateGas({account:account.address,data}))*110n/100n+1n;
 const fees=await client.estimateFeesPerGas();
 const maximumCost=gas*fees.maxFeePerGas!;
 if(deploymentMaximum+maximumCost>parseEther('2'))throw new Error('DeploymentTwoTestMONCapExceeded');
 const r=await sendTestnetTransaction(client,wallet,{data,gas},'deploy:'+name+':'+outputFile,undefined,parseEther('2')-deploymentMaximum);
 if(r.status!=='success'||!r.contractAddress)throw new Error('DeploymentFailed:'+name);
 deploymentMaximum+=r.maximumCostWei;
 addresses[name]=r.contractAddress;
 transactions[name]={hash:r.transactionHash,blockNumber:String(r.blockNumber),gasUsed:String(r.gasUsed),gasLimit:String(gas),maximumCost:String(r.maximumCostWei),address:r.contractAddress};
 await writeFile(outputFile,JSON.stringify({...plan,status:'PARTIAL_CONTRACT_DEPLOYMENT',transactions},null,2)+'\n');
 return r.contractAddress;
}
let validity:Hex,below:Hex;
const reuse=option('--reuse-verifiers-from');
if(reuse){
 const verified=JSON.parse(await readFile(reuse,'utf8'));
 if(verified.chainId!==chain.id)throw new Error('VerifierReuseChainMismatch');
 for(const [name,field] of [['CommitmentValidityVerifier','validity'],['BelowThresholdVerifier','below']] as const){
  const address=verified[field] as Hex,code=await client.getBytecode({address});
  if(!code||keccak256(code)!==keccak256(artifacts[name!].deployedBytecode.object))throw new Error('GeneratedVerifierReuseCodeMismatch');
  transactions[name!]={...verified.transactions[name!],reused:true,maximumCost:'0'};
 }
 validity=verified.validity;below=verified.below;
}else{validity=await deploy('CommitmentValidityVerifier');below=await deploy('BelowThresholdVerifier');}
const round=await deploy('OrtalamaRound',[governor,validity]),badge=await deploy('BadgeRegistry',[round,below]);
const named={round,badge,validity,below};
const runtimeCodeHashes=Object.fromEntries(await Promise.all(Object.entries(named).map(async([name,address])=>{const code=await client.getBytecode({address});if(!code||code==='0x')throw new Error('MissingDeployedCode');return [name,keccak256(code)];})));
const record={simulation:true,networkMode:'PUBLIC_TESTNET_SIMULATION',status:'CONTRACTS_DEPLOYED_NOT_FULL_PHASE8',instanceId:randomUUID(),chainId:chain.id,...named,blockNumber:(transactions.OrtalamaRound as any).blockNumber,transactions,runtimeCodeHashes,governor,custody:'Trustee/services custody not deployed or attested by this script',explorerVerification:'PENDING',phoneVerification:'PENDING'};
await writeFile(outputFile,JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record,null,2));
