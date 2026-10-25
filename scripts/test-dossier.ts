import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {sha256} from 'viem';
import {buildDossier,verifyDossier,dossierDigest} from '../packages/protocol/src/dossier.js';
import {canonicalJSON} from '../packages/protocol/src/review.js';
const [file,anchor,rpc,indexer]=process.argv.slice(2);
if(!file||!anchor||!rpc||!indexer)throw new Error('Usage: test-dossier.ts DOSSIER PUBLIC_DEPLOYMENT RPC INDEXER');
const packet=JSON.parse(await readFile(file,'utf8')),deployment=JSON.parse(await readFile(anchor,'utf8'));
const offline=await verifyDossier(packet,{deployment,offline:true});assert.equal(offline.chainQueried,false);
const online=await verifyDossier(packet,{deployment,rpc});assert.equal(online.matchesSelectedRPC,true);
const cases:any[]=[];
async function reject(label:string,change:(x:any)=>void,rehash=true,network=false){
 const candidate=structuredClone(packet);change(candidate);
 if(rehash)candidate.payloadSHA256=dossierDigest(candidate.payload);
 let reason='';
 try{await verifyDossier(candidate,{deployment,rpc,offline:!network});}
 catch(error:any){reason=String(error.message).split('\n')[0]!.slice(0,180);}
 assert.ok(reason,`Tampered dossier accepted: ${label}`);cases.push({label,rejected:true,reason});
}
await reject('Unadvertised payload change',x=>x.payload.snapshot.round.SE=String(BigInt(x.payload.snapshot.round.SE)+1n),false);
await reject('Rehashed false emissions aggregate',x=>x.payload.snapshot.round.SE=String(BigInt(x.payload.snapshot.round.SE)+1n));
await reject('Rehashed false published intensity',x=>x.payload.snapshot.round.intensity=String(BigInt(x.payload.snapshot.round.intensity)+1n));
await reject('Duplicate frozen member',x=>x.payload.snapshot.plants[1]=structuredClone(x.payload.snapshot.plants[0]));
await reject('Invalid commitment point',x=>x.payload.snapshot.plants[0].statement.CE={x:'0',y:'0'});
await reject('Changed ML-DSA co-signature',x=>{const a=x.payload.attestations[0];a.pqSignature=(a.pqSignature.startsWith('00')?'01':'00')+a.pqSignature.slice(2);});
await reject('Missing signature identity with unchanged count',x=>x.payload.attestations[1]=structuredClone(x.payload.attestations[0]));
await reject('Private opening injected into public export',x=>x.payload.snapshot.plants[0].opening={E:'1',P:'2'});
await reject('Invented regulatory acceptance',x=>x.payload.provenance.officialAcceptance=true);
await reject('Suppressed limitations',x=>x.payload.limitations.pop());
await reject('Changed source scope',x=>x.payload.sourceRecords[0].scope='Unsupported endorsement claim');
await reject('Changed reproduction source hash',x=>x.payload.sourceSHA256['packages/crypto-ts/src/index.ts']='00'.repeat(32));
await reject('Rehashed counterfeit transaction event',x=>x.payload.events[0].transactionHash='0x'+'00'.repeat(32),true,true);
const wrong=structuredClone(deployment);wrong.round='0x'+'11'.repeat(20);
await assert.rejects(verifyDossier(packet,{deployment:wrong,offline:true}),/IndependentDeploymentAnchorMismatch/);
cases.push({label:'Wrong independently selected deployment anchor',rejected:true,reason:'IndependentDeploymentAnchorMismatch'});
const repeated=await buildDossier({deployment,rpc,indexer,roundId:BigInt(packet.payload.snapshot.roundId),block:BigInt(packet.payload.snapshot.block)});
assert.equal(canonicalJSON(packet),canonicalJSON(repeated),'Same pinned evidence did not export deterministically');
await mkdir('tmp/pdfs',{recursive:true});
const output='tmp/pdfs/SIMULATED_dossier_reproduced.pdf';
const run=spawnSync('.tools/service-venv/bin/python',['-m','services.indexer.dossier',file,output],{encoding:'utf8'});
assert.equal(run.status,0,run.stderr);
const originalPDF=file.replace(/\.json$/,'.pdf');
const original=await readFile(originalPDF),rendered=await readFile(output);
assert.equal(sha256(original),sha256(rendered),'PDF changed under the recorded toolchain');
const forbidden=new Set(['opening','slopes','secretKey','signingKey','storageKey','token','reportPath','sourcePages','proposal']);
function publicOnly(x:any){if(Array.isArray(x)){x.forEach(publicOnly);return;}if(x&&typeof x==='object')for(const [k,v]of Object.entries(x)){assert.ok(!forbidden.has(k),`Private field in dossier: ${k}`);publicOnly(v);}}
publicOnly(packet);
const result={simulation:true,status:'LOCAL_PASS',roundId:packet.payload.snapshot.roundId,pinnedBlock:packet.payload.snapshot.block,payloadSHA256:packet.payloadSHA256,pdfSHA256:sha256(original),offlineStatus:offline.status,onlineStatus:online.status,transactionsChecked:online.transactionsChecked,deterministicJSON:true,deterministicPDFUnderRecordedToolchain:true,tamperRejections:cases,publicOnlyFieldCheck:true,limits:['Selected RPC and independent deployment anchor are trust inputs; this is not a light client','No physical report truth, accreditation or regulatory acceptance is established']};
await writeFile('docs/SIMULATED_DOSSIER_RESULTS.json',JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify(result)+'\n',()=>process.exit(0));
