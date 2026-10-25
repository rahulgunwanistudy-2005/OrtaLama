/** Refresh UI/source without pretending immutable exported evidence is new. */
import {readFile,writeFile,mkdir,copyFile,cp,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyDossier} from '../packages/protocol/src/dossier.js';
const root=resolve('output/SIMULATED_monad_site');
const config=JSON.parse(await readFile(root+'/operator/config.json','utf8'));
if(config.publicEvidence!==true||config.deployment.chainId!==10143)throw new Error('ExplicitPublicMonadSnapshotRequired');
const rounds=JSON.parse(await readFile(root+'/api/rounds.json','utf8'));
for(const round of rounds){
 if(Number(round.round.state)!==4)continue;
 const packet=JSON.parse(await readFile(`${root}/api/rounds/${round.roundId}/dossier.json`,'utf8'));
 // Reject if any reproduction source changed. Retained packets keep their
 // original pinned block and original online reproduction evidence.
 await verifyDossier(packet,{deployment:config.deployment,offline:true});
}
const temporary=await mkdtemp(join(tmpdir(),'ortalama-public-refresh-'));
try{
 const built=spawnSync('node',['node_modules/vite/bin/vite.js','build','apps/web','--config','apps/web/vite.config.ts','--outDir',temporary],{env:{...process.env,VITE_PUBLIC_EVIDENCE:'1'},encoding:'utf8'});
 if(built.status!==0)throw new Error('PublicWebBuildFailed');
 for(const name of ['assets','images','fonts','data'])await cp(join(temporary,name),join(root,name),{recursive:true});
 for(const name of ['index.html','README_HOSTING.md','THIRD_PARTY_NOTICES.md'])await copyFile(join(temporary,name),join(root,name));
 await copyFile('LICENSE',root+'/LICENSE');
 const source=spawnSync('python3',['scripts/package-source-handoff.py'],{encoding:'utf8'});
 if(source.status!==0)throw new Error('PrivateSourceExportRejected');
 await mkdir(root+'/source',{recursive:true});
 await copyFile('output/SIMULATED_source_handoff.zip',root+'/source/SIMULATED_source_handoff.zip');
 const path=root+'/SIMULATED_hosting_manifest.json',manifest=JSON.parse(await readFile(path,'utf8'));
 const htmlSHA256=createHash('sha256').update(await readFile(root+'/index.html')).digest('hex');
 await writeFile(path,JSON.stringify({...manifest,uiRefreshedAt:new Date().toISOString(),buildHTMLSHA256:htmlSHA256,evidenceRefresh:'Retained original pinned dossiers; source/arithmetic/signatures rechecked offline. This UI refresh sends no transaction and makes no new online-reproduction claim.'},null,2)+'\n');
 console.log(JSON.stringify({status:'PUBLIC_UI_AND_SOURCE_REFRESHED',chainId:10143,buildHTMLSHA256:htmlSHA256,transactionsSent:0}));
}finally{await rm(temporary,{recursive:true,force:true});}
