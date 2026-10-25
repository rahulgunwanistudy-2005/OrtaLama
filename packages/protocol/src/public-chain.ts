import { keccak256 } from 'viem';

/** Public Monad RPC limits eth_getLogs to 100-block ranges. Pin the end once,
 * and bound concurrency so historical reads also work as deployments age. */
export async function getPagedContractEvents(client:any,options:any){
  const start=BigInt(options.fromBlock??0),end=options.toBlock==='latest'||options.toBlock===undefined?await client.getBlockNumber({cacheTime:0}):BigInt(options.toBlock);
  if(start>end)return [];
  const events:any[]=[];
  for(let first=start;first<=end;first+=400n){
    const requests=[];
    for(let from=first;from<=end&&from<first+400n;from+=100n){
      const to=from+99n>end?end:from+99n;
      requests.push(client.getContractEvents({...options,fromBlock:from,toBlock:to}));
    }
    events.push(...(await Promise.all(requests)).flat());
  }
  return events;
}

/** Fetch authority from the selected RPC, independently of the evidence cache. */
export async function fetchPublicSnapshot(client: any, config: any, roundId: bigint, pinnedBlock?: bigint) {
  const d=config.deployment, abi=config.abis.OrtalamaRound;
  if (await client.getChainId()!==Number(d.chainId)) throw new Error('WrongRPCChain');
  const block=pinnedBlock??await client.getBlockNumber({cacheTime:0});
  for(const name of ['round','badge','validity','below']) {
    const code=await client.getBytecode({address:d[name],blockNumber:block});
    if(!code || !d.runtimeCodeHashes?.[name] || keccak256(code)!==d.runtimeCodeHashes[name]) throw new Error('DeploymentCodeHashMismatch');
  }
  const call=(functionName:string,args:any[])=>client.readContract({address:d.round,abi,functionName,args,blockNumber:block});
  const round=await call('getRound',[roundId]);
  const ids=await call('getInstallations',[roundId]);
  const plants=await Promise.all(ids.map(async(installationId:string)=>({installationId,...await call('getPlant',[roundId,installationId])})));
  const sums=await Promise.all([1,2,3].map(async(index)=>({index,...await call('getSum',[roundId,index])})));
  return {simulation:round.config.simulated,chainId:d.chainId,address:d.round,roundId,round,plants,sums,block,blockHash:(await client.getBlock({blockNumber:block})).hash};
}
