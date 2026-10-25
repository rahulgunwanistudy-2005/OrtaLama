import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='apps/web/public';
await mkdir(`${root}/crypto`,{recursive:true});
const pinned=JSON.parse(await readFile('circuits/ceremony/ARTIFACT_HASHES.json','utf8')).sha256;
const hashes={};
for(const circuit of ['below_threshold','commitment_validity']){
  for(const [source,target] of [[`circuits/build/${circuit}_js/${circuit}.wasm`,`${circuit}.wasm`],[`circuits/ceremony/${circuit}_final.zkey`,`${circuit}.zkey`],[`circuits/ceremony/${circuit}_verification_key.json`,`${circuit}_vkey.json`]]){
    const bytes=await readFile(source),hash=createHash('sha256').update(bytes).digest('hex');
    if(pinned[source]!==hash)throw new Error(`Proving bundle mismatch: ${source}`);
    await copyFile(source,`${root}/crypto/${target}`);hashes[target]=hash;
  }
}
await writeFile(`${root}/crypto/manifest.json`,JSON.stringify({simulation:true,algorithm:'SHA-256',sha256:hashes}));
await mkdir(`${root}/data`,{recursive:true});
for(const name of ['facts','sources','physics'])await copyFile(`data/real/${name}.json`,`${root}/data/${name}.json`);
await copyFile('docs/SIMULATED_AI_EVAL.json',`${root}/data/SIMULATED_AI_EVAL.json`);
await mkdir(`${root}/reports`,{recursive:true});
const reports=JSON.parse(await readFile('data/simulated/reports/SIMULATED_report_manifest.json','utf8'));
for(const report of reports.reports){if(!report.simulation || !report.file.startsWith('data/simulated/reports/SIMULATED_'))throw new Error('Only explicit generated simulated PDFs may be public');await copyFile(report.file,`${root}/reports/${report.file.split('/').at(-1)}`);}
console.log('Public-only proving bundle and cited facts prepared; no private runtime files copied.');
