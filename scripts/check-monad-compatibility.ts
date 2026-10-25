/** Actual Monad VM eth_call checks; no private key, signing or broadcast. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createPublicClient,http,encodeDeployData,decodeAbiParameters,encodeAbiParameters,formatEther,toHex,keccak256,type Hex} from 'viem';
import {monadTestnet} from 'viem/chains';
const address='0x8cf8d07115760a5D4Db4a6561729E8ed4de4D8CA' as const;
const rpc=process.env.ORTALAMA_MONAD_RPC??monadTestnet.rpcUrls.default.http[0];
const client=createPublicClient({chain:monadTestnet,transport:http(rpc,{retryCount:0,timeout:30000})});
assert.equal(await client.getChainId(),monadTestnet.id);
const nonceBefore=await client.getTransactionCount({address,blockTag:'pending'});
const fixture=JSON.parse(await readFile('data/simulated/SIMULATED_verifier_vectors_397cae5a7b64b128.json','utf8'));
const probe=JSON.parse(await readFile('contracts/out/MonadReadOnlyProbe.sol/MonadReadOnlyProbe.json','utf8'));
const cases=[];
for(const [name,badge,count] of [['below_threshold',true,13],['commitment_validity',false,14]] as const){
 const valid=fixture[name];
 for(const tampered of [false,true]){
  let inputs=valid.inputs as Hex;
  if(tampered){const type=`uint256[${count}]` as const;const [decoded]=decodeAbiParameters([{type}],inputs);const changed=decoded.map((v,i)=>i===0?v+1n:v) as unknown as typeof decoded;inputs=encodeAbiParameters([{type}],[changed]);}
  const data=encodeDeployData({abi:probe.abi,bytecode:probe.bytecode.object,args:[badge,valid.proof,inputs]});
  const result=await client.request({method:'eth_call',params:[{from:address,data,gas:toHex(12_000_000n)},'latest']});
  assert.equal(BigInt(result),tampered?0n:1n);
  cases.push({circuit:name,tampered,expected:!tampered,verified:BigInt(result)===1n});
 }
}
const nonceAfter=await client.getTransactionCount({address,blockTag:'pending'});
assert.equal(nonceAfter,nonceBefore,'Another process used the shared wallet during the check; inspect its pending activity');
const sizes=[];
for(const name of ['OrtalamaRound','BadgeRegistry','BelowThresholdVerifier','CommitmentValidityVerifier']){
 const a=JSON.parse(await readFile(`contracts/out/${name}.sol/${name}.json`,'utf8'));
 sizes.push({name,runtimeBytes:a.deployedBytecode.object.replace(/^0x/,'').length/2,runtimeSHA3:keccak256(a.deployedBytecode.object)});
}
const result={simulation:true,status:'READ_ONLY_CRYPTO_COMPATIBILITY_PASS',checkedAt:new Date().toISOString(),chainId:monadTestnet.id,publicAddress:address,balanceMON:formatEther(await client.getBalance({address})),cases,contractSizes:sizes,transactionsSent:0,walletNonceUnchanged:true,scope:'Actual remote Monad eth_call creation executes the exact generated verifier bytecode with valid synthetic proof fixtures and changed public inputs. Temporary execution state is discarded. No stored contract or complete round is deployed.',limits:['Fixture proof domains remain their original synthetic context; this checks verifier/precompile execution only','Full Monad round, signing-domain, gas, indexer, archive access and hosted browser gates remain pending','Same-host SIMULATED inputs/actors; no institutional custody or regulatory acceptance']};
await writeFile('docs/SIMULATED_MONAD_COMPATIBILITY_RESULTS.json',JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify(result)+'\n',()=>process.exit(0));
