/** Build a public, read-only site from actual RPC state and verified sidecars. */
import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildDossier,verifyDossier} from '../packages/protocol/src/dossier.js';
const arg=(name:string)=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const publicRPC=arg('--public-rpc')??'https://testnet-rpc.monad.xyz';
// Only audited credential-free public endpoints may appear in browser artifacts.
if(!['https://testnet-rpc.monad.xyz','https://testnet-rpc.monad.xyz/'].includes(publicRPC))throw new Error('ApprovedCredentialFreePublicRPCRequired');
const runtime=arg('--runtime')??'.runtime/monad_20261024';
const env=JSON.parse(await readFile(runtime+'/SIMULATED_testnet_endpoints.json','utf8'));
const d=JSON.parse(await readFile(env.ORTALAMA_DEPLOYMENT,'utf8'));
if(d.simulation!==true||d.chainId!==10143||d.networkMode!=='PUBLIC_TESTNET_SIMULATION')throw new Error('ExplicitMonadSimulationRequired');
const results=JSON.parse(await readFile('docs/SIMULATED_MONAD_ROUND_RESULTS.json','utf8'));
if(results.status!=='PASS'||results.chainId!==10143||results.deployment?.toLowerCase()!==d.round.toLowerCase())throw new Error('ActualTestnetScenarioRequired');
const output=resolve('output/SIMULATED_monad_site');
const build=spawnSync('node',['node_modules/vite/bin/vite.js','build','apps/web','--config','apps/web/vite.config.ts','--outDir',output],{env:{...process.env,VITE_PUBLIC_EVIDENCE:'1'},encoding:'utf8'});
if(build.status!==0)throw new Error('PublicWebBuildFailed:'+build.stderr.slice(0,300));
// The public verifier needs no proving-key bundles or synthetic source reports.
await rm(output+'/crypto',{recursive:true,force:true});
await rm(output+'/reports',{recursive:true,force:true});
await copyFile('LICENSE',output+'/LICENSE');
const write=async(path:string,value:any)=>{await mkdir(dirname(output+'/'+path),{recursive:true});await writeFile(output+'/'+path,JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v,2)+'\n');};
const get=async(path:string)=>{const r=await fetch(env.ORTALAMA_INDEXER+path);if(!r.ok)throw new Error('IndexerExportHTTP'+r.status);return r.json() as Promise<any>;};
const artifact=async(name:string)=>JSON.parse(await readFile(`contracts/out/${name}.sol/${name}.json`,'utf8'));
const scenario=JSON.parse(await readFile(runtime+'/SIMULATED_scenario.json','utf8'));
const abis=Object.fromEntries(await Promise.all(['OrtalamaRound','BadgeRegistry','CommitmentValidityVerifier'].map(async name=>[name,(await artifact(name)).abi])));
const config={badgeReceipts:{[results.badge.id]:results.badge.receipt.hash},simulation:true,publicEvidence:true,seedStatus:'READY',publishedAt:new Date().toISOString(),deployment:d,rpc:publicRPC,abis,plants:scenario.plants.map((p:any,i:number)=>({installationId:p.installationId,label:p.label,actor:p.actor,slot:i})),trustees:scenario.trustees,verifier:scenario.verifier,pqKeyHash:scenario.pqKeyHash,cohortRoot:scenario.cohortRoot,verifierRoot:scenario.verifierRoot,custody:'Three separately keyed trustee processes on one host; simulated identities, not independent organisations'};
await write('operator/config.json',config);
const rounds=await get('/rounds');await write('api/rounds.json',rounds);
await write('api/deployment.json',d);
for(const snapshot of rounds){
 const id=String(snapshot.roundId);
 await write(`api/rounds/${id}.json`,snapshot);
 await write(`api/rounds/${id}/evidence.json`,await get(`/rounds/${id}/evidence`));
 if(Number(snapshot.round.state)!==4)continue;
 const packet=await buildDossier({rpc:env.ORTALAMA_RPC,deployment:d,indexer:env.ORTALAMA_INDEXER,roundId:BigInt(id)});
 const verified=await verifyDossier(packet,{rpc:env.ORTALAMA_RPC,deployment:d});
 await write(`api/rounds/${id}/dossier.json`,packet);
 await write(`api/rounds/${id}/reproduction.json`,verified);
 const prefix=`output/pdf/SIMULATED_monad_dossier_round_${id}`;
 await mkdir(dirname(prefix),{recursive:true});
 await writeFile(prefix+'.json',JSON.stringify(packet,null,2)+'\n');
 const rendered=spawnSync('.tools/service-venv/bin/python',['-m','services.indexer.dossier',prefix+'.json',prefix+'.pdf'],{encoding:'utf8'});
 if(rendered.status!==0)throw new Error('DossierPDFRenderFailed');
 await copyFile(prefix+'.pdf',output+`/api/rounds/${id}/dossier.pdf`);
 await writeFile(prefix+'_verification.json',JSON.stringify(verified,null,2)+'\n');
}
await write('data/SIMULATED_MONAD_ROUND_RESULTS.json',results);
await write('api/health.json',{simulation:true,status:'PUBLISHED_SNAPSHOT',chainId:10143,publishedAt:config.publishedAt,authority:'Browser verification fetches and checks current RPC state independently'});
await write('vercel.json',{cleanUrls:false,headers:[{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]}],rewrites:[{source:'/operator/config',destination:'/operator/config.json'},{source:'/api/rounds',destination:'/api/rounds.json'},{source:'/api/deployment',destination:'/api/deployment.json'},{source:'/api/health',destination:'/api/health.json'},{source:'/api/rounds/:id/evidence',destination:'/api/rounds/:id/evidence.json'},{source:'/api/rounds/:id',destination:'/api/rounds/:id.json'},{source:'/((?!api/|operator/|assets/|data/|images/|fonts/).*)',destination:'/index.html'}]});
await write('SIMULATED_hosting_manifest.json',{simulation:true,chainId:10143,round:d.round,badge:d.badge,mainRoundId:results.mainRoundId,publicReadOnly:true,privateServicesIncluded:false,transactionsSentByPackaging:0,publishedAt:config.publishedAt,limits:['Static snapshot and public signature sidecars are replaceable evidence caches','Verification independently fetches selected RPC state and checks code hashes and all co-signatures','Publishing new rounds or signatures requires regenerating the bundle','Private participation, trustee and operator services remain local; no institutional custody claimed','Hosting and physical-phone verification are performed by the project owner']});
const source=spawnSync('python3',['scripts/package-source-handoff.py'],{encoding:'utf8'});
if(source.status!==0)throw new Error('SourceHandoffFailed');
await mkdir(output+'/source',{recursive:true});
await copyFile('output/SIMULATED_source_handoff.zip',output+'/source/SIMULATED_source_handoff.zip');
console.log(JSON.stringify({simulation:true,status:'PUBLIC_HOSTING_BUNDLE_READY',output,closedRounds:rounds.filter((x:any)=>Number(x.round.state)===4).length}));
process.exit(0);
