// Proving keys are public parameters, never signing keys or ceremony entropy.
import {readFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('circuits/ceremony/ARTIFACT_HASHES.json','utf8'));
for(const circuit of ['below_threshold','commitment_validity']){
 const target=`circuits/ceremony/${circuit}_final.zkey`;
 const source=`circuits/ceremony/public/${circuit}_final.zkey`;
  try{
    const active=await readFile(target);
    if(createHash('sha256').update(active).digest('hex')===manifest.sha256[target])continue;
  }catch(error){if(error.code!=='ENOENT')throw error;}
 const bytes=await readFile(source);
 if(createHash('sha256').update(bytes).digest('hex')!==manifest.sha256[target])throw new Error(`Public proving-key hash mismatch: ${circuit}`);
 await copyFile(source,target);
}
console.log('Exact active public proving keys verified/restored; ceremony trust limitations still apply.');
