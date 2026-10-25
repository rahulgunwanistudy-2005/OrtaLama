import {readFile} from 'node:fs/promises';
import {verifyDossier} from '../packages/protocol/src/dossier.js';
const values:Record<string,string>={};let offline=false;
for(let i=2;i<process.argv.length;i++){
 const key=process.argv[i]!;
 if(key==='--offline'){offline=true;continue;}
 if(!['--rpc','--deployment','--dossier'].includes(key)||!process.argv[i+1])throw new Error('InvalidVerificationArguments');
 values[key]=process.argv[++i]!;
}
if(!values['--deployment']||!values['--dossier'])throw new Error('Require dossier and independently selected public deployment anchor');
const packet=JSON.parse(await readFile(values['--dossier'],'utf8'));
const deployment=JSON.parse(await readFile(values['--deployment'],'utf8'));
const result=await verifyDossier(packet,{deployment,rpc:values['--rpc']??process.env.ORTALAMA_RPC,offline});
process.stdout.write(JSON.stringify(result,null,2)+'\n',()=>process.exit(0));
