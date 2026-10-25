import {createPublicClient,http,defineChain} from 'viem';
import {fetchPublicSnapshot} from '../../../packages/protocol/src/public-chain';
import {verifySnapshot,verifyPublicAttestations} from '../../../packages/protocol/src/verify';
self.onmessage=async(event)=>{
  try{
    const {config,roundId,rpc,attestations,signaturesOnly}=event.data;
    self.postMessage({type:'progress',message:'Fetching the selected chain and checking deployment code hashes'});
    const chain=defineChain({id:Number(config.deployment.chainId),name:'Selected evidence chain',nativeCurrency:Number(config.deployment.chainId)===10143?{name:'Monad',symbol:'MON',decimals:18}:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[rpc]}}});
    const client=createPublicClient({chain,transport:http(rpc,{batch:true,retryCount:2,retryDelay:500,timeout:15000})});
    const snapshot=await fetchPublicSnapshot(client,config,BigInt(roundId));
    if(signaturesOnly){const signatures=await verifyPublicAttestations(snapshot,attestations);self.postMessage({type:'result',value:{signatures}});return;}
    self.postMessage({type:'progress',message:'Recomputing the frozen manifest, curve sums and threshold interpolation'});
    const abi=config.abis.OrtalamaRound;
    const result=await verifySnapshot(snapshot,abi.find((x:any)=>x.name==='createRound').inputs[0],abi.find((x:any)=>x.name==='commit').inputs[0]);
    self.postMessage({type:'progress',message:'Checking every allowlisted ECDSA and ML-DSA-65 co-signature'});
    const signatures=await verifyPublicAttestations(snapshot,attestations);
    self.postMessage({type:'result',value:JSON.parse(JSON.stringify({snapshot,result,signatures},(_,v)=>typeof v==='bigint'?String(v):v))});
  }catch(error:any){self.postMessage({type:'error',message:String(error?.message??'Verification failed').slice(0,180)});}
};
