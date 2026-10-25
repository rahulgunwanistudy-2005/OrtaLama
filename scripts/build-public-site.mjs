/** Build the read-only public verification site from source plus the committed Monad snapshot. */
import {cp,copyFile,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const output=resolve(process.argv[2]??'dist/public-site');
const snapshot=resolve('deploy/public-snapshot');
const config=JSON.parse(await readFile(snapshot+'/operator/config.json','utf8'));
if(config.publicEvidence!==true||config.simulation!==true||config.deployment?.chainId!==10143)throw new Error('ExplicitPublicMonadSnapshotRequired');
// Only the audited credential-free public endpoint may reach browser configuration.
if(!['https://testnet-rpc.monad.xyz','https://testnet-rpc.monad.xyz/'].includes(config.rpc))throw new Error('ApprovedCredentialFreePublicRPCRequired');

await rm(output,{recursive:true,force:true});
const built=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','apps/web','--config','apps/web/vite.config.ts','--outDir',output,'--emptyOutDir'],{env:{...process.env,VITE_PUBLIC_EVIDENCE:'1'},stdio:'inherit'});
if(built.status!==0)throw new Error('PublicWebBuildFailed');
// The public verifier needs no proving-key bundles or synthetic source reports.
await rm(output+'/crypto',{recursive:true,force:true});
await rm(output+'/reports',{recursive:true,force:true});

await cp(snapshot+'/api',output+'/api',{recursive:true});
await cp(snapshot+'/operator',output+'/operator',{recursive:true});
await mkdir(output+'/data',{recursive:true});
for(const name of ['facts','sources','physics'])await copyFile(`data/real/${name}.json`,`${output}/data/${name}.json`);
for(const name of ['AI_EVAL','CONTAINER_RESULTS','FULL_PROJECT_RESULTS','INDEXER_RECOVERY_RESULTS','MONAD_BUNDLE_RESULTS','MONAD_BUNDLE_TAMPER_RESULTS','MONAD_LIGHTHOUSE_RESULTS','MONAD_ROUND_RESULTS','MONAD_SOURCE_VERIFICATION','REPORT_BROWSER_RESULTS','REPORT_STATE_RESULTS','SOURCE_HANDOFF_RESULTS'])
  await copyFile(`docs/SIMULATED_${name}.json`,`${output}/data/SIMULATED_${name}.json`);
await copyFile('LICENSE',output+'/LICENSE');

const manifest=JSON.parse(await readFile(snapshot+'/SIMULATED_hosting_manifest.json','utf8'));
const buildHTMLSHA256=createHash('sha256').update(await readFile(output+'/index.html')).digest('hex');
await writeFile(output+'/SIMULATED_hosting_manifest.json',JSON.stringify({...manifest,buildHTMLSHA256,builtAt:new Date().toISOString()},null,2)+'\n');
console.log(JSON.stringify({simulation:true,status:'PUBLIC_SITE_BUILT',output,chainId:10143,buildHTMLSHA256,transactionsSent:0}));
