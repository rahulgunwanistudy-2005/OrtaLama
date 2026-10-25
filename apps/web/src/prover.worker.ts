import {createCrypto,seal,envelopeHash,canonicalDecimal,typedStatement} from '@ortalama/crypto';
import {buildPoseidon} from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import {encodeAbiParameters,keccak256,toHex,hexToBytes,sha256} from 'viem';
import {randomBytes,bytesToHex} from '@noble/hashes/utils.js';
import {canonicalJSON} from '../../../packages/protocol/src/review';

const serial=(x:any)=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
const progress=(message:string)=>self.postMessage({type:'progress',message});
async function asset(name:string){
  const manifest=await(await fetch('/crypto/manifest.json')).json();
  const response=await fetch(`/crypto/${name}`);
  if(!response.ok)throw new Error('ProvingAssetUnavailable');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(sha256(bytes).slice(2)!==manifest.sha256[name])throw new Error('ProvingAssetHashMismatch');
  return bytes;
}
async function prove(name:string,input:any){
  progress('Generating a real Groth16 proof in this browser');
  (globalThis as any).curve_bn128=await snarkjs.curves.getCurveFromName('bn128',{singleThread:true});
  const [wasm,key,vkey]=await Promise.all([asset(`${name}.wasm`),asset(`${name}.zkey`),asset(`${name}_vkey.json`)]);
  const p=await snarkjs.groth16.fullProve(serial(input),wasm,key,undefined,undefined,{singleThread:true});
  if(!await snarkjs.groth16.verify(JSON.parse(new TextDecoder().decode(vkey)),p.publicSignals,p.proof))throw new Error('GeneratedProofInvalid');
  const call=JSON.parse(`[${await snarkjs.groth16.exportSolidityCallData(p.proof,p.publicSignals)}]`);
  return {a:call[0],b:call[1],c:call[2],contextTag:String(input.contextTag)};
}
self.onmessage=async(event)=>{
  try{
    const x=event.data,c=await createCrypto(),poseidon=await buildPoseidon();
    const d=x.config.deployment,roundId=BigInt(x.roundId),installationId=x.config.plants[x.slot].installationId;
    const hi=BigInt(installationId)>>128n,lo=BigInt(installationId)&((1n<<128n)-1n);
    if(x.action==='prepare'){
      progress('Sealing private values and encrypting trustee shares');
      const opening=c.validateOpening({E:canonicalDecimal(x.E),P:canonicalDecimal(x.P),r:c.randomScalar(),s:c.randomScalar()});
      const sharing=c.sharePlant(opening);
      const envelopes=sharing.shares.map((share:any,i:number)=>seal(hexToBytes(x.round.config.encryptionKeys[i]),new TextEncoder().encode(JSON.stringify(serial({simulation:true,...share}))),{chainId:String(d.chainId),verifyingContract:d.round.toLowerCase(),roundId:String(roundId),installationId,trusteeIndex:i+1}));
      const hashes=envelopes.map(e=>`0x${envelopeHash(e)}`) as any;
      const declaration={simulation:true,mode:'BROWSER_SECRET_INPUT',reportReview:false,nonce:bytesToHex(randomBytes(32))};
      const validationHash=keccak256(toHex(canonicalJSON(declaration)));
      // A private random nonce prevents the synthetic input digest being a cheap
      // public dictionary of small E/P pairs. This is not a report-truth claim.
      const reportHash=keccak256(toHex(canonicalJSON({simulation:true,E:x.E,P:x.P,nonce:bytesToHex(randomBytes(32))})));
      const metadataHash=keccak256(encodeAbiParameters([{type:'bytes32'},{type:'bytes32[3]'}],[validationHash,hashes]));
      const point=(p:any)=>({x:String(p[0]),y:String(p[1])});
      const contextTag=poseidon.F.toObject(poseidon([1n,...sharing.CE,...sharing.CP,...sharing.AE,...sharing.AP,roundId,hi,lo,BigInt(d.chainId),BigInt(d.round)]));
      const proof=await prove('commitment_validity',{...opening,CE:sharing.CE,CP:sharing.CP,AE:sharing.AE,AP:sharing.AP,aE:sharing.slopes.E,ar:sharing.slopes.r,aP:sharing.slopes.P,as:sharing.slopes.s,roundId,installationHi:hi,installationLo:lo,chainId:d.chainId,contractAddress:BigInt(d.round),contextTag});
      const actorTyped=typedStatement({chainId:BigInt(d.chainId),verifyingContract:d.round,roundId,installationId,CE:sharing.CE,CP:sharing.CP,AE:sharing.AE,AP:sharing.AP,reportHash,metadataHash,pqKeyHash:x.config.pqKeyHash});
      self.postMessage({type:'result',value:serial({simulation:true,opening,envelopes,declaration,actorTyped,submission:{statement:{roundId,installationId,CE:point(sharing.CE),CP:point(sharing.CP),AE:point(sharing.AE),AP:point(sharing.AP),reportHash,metadataHash,pqKeyHash:x.config.pqKeyHash},validationHash,ciphertextHashes:hashes,proof}})});
    }else if(x.action==='badge'){
      const opening=Object.fromEntries(['E','P','r','s'].map(k=>[k,canonicalDecimal(x.opening[k])])) as any;
      const CE=c.commit(opening.E,opening.r),CP=c.commit(opening.P,opening.s),tid=BigInt(x.thresholdId);
      const numerator=tid===0n?BigInt(x.round.SE):BigInt(x.round.config.thresholdNumerators[Number(tid)-1]);
      const denominator=tid===0n?BigInt(x.round.SP):BigInt(x.round.config.thresholdDenominators[Number(tid)-1]);
      const contextTag=poseidon.F.toObject(poseidon([2n,...CE,...CP,numerator,denominator,roundId,hi,lo,tid,BigInt(d.chainId),BigInt(d.badge)]));
      const proof=await prove('below_threshold',{...opening,CE,CP,thresholdNum:numerator,thresholdDen:denominator,thresholdId:tid,roundId,installationHi:hi,installationLo:lo,chainId:d.chainId,contractAddress:BigInt(d.badge),contextTag});
      self.postMessage({type:'result',value:proof});
    }else throw new Error('UnknownProverAction');
  }catch(error:any){self.postMessage({type:'error',message:error?.message?.includes('Assert')?'The private input cannot satisfy this threshold. No badge was issued.':String(error?.message??'Proof failed').slice(0,140)});}
};
