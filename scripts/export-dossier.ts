import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildDossier,verifyDossier} from '../packages/protocol/src/dossier.js';

const values:Record<string,string>={};
for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i]!;if(!['--rpc','--deployment','--indexer','--round','--block','--output'].includes(key)||!process.argv[i+1])throw new Error('InvalidExportArguments');values[key]=process.argv[i+1]!;}
const rpc=values['--rpc']??process.env.ORTALAMA_RPC;
const deploymentPath=values['--deployment']??process.env.ORTALAMA_DEPLOYMENT;
const indexer=values['--indexer']??process.env.ORTALAMA_INDEXER;
if(!rpc||!deploymentPath||!indexer||!/^\d+$/.test(values['--round']??''))throw new Error('Require public RPC, deployment anchor, indexer and round');
const roundId=BigInt(values['--round']!);
const prefix=values['--output']??`output/pdf/SIMULATED_dossier_round_${roundId}`;
if(!path.basename(prefix).startsWith('SIMULATED_'))throw new Error('SimulationFilenameRequired');
const deployment=JSON.parse(await readFile(deploymentPath,'utf8'));
const packet=await buildDossier({rpc,deployment,indexer,roundId,block:values['--block']?BigInt(values['--block']):undefined});
const verification=await verifyDossier(packet,{rpc,deployment});
await mkdir(path.dirname(prefix),{recursive:true});
await writeFile(prefix+'.json',JSON.stringify(packet,null,2)+'\n');
const python=process.env.ORTALAMA_SERVICE_PYTHON??'.tools/service-venv/bin/python';
const rendered=spawnSync(python,['-m','services.indexer.dossier',prefix+'.json',prefix+'.pdf'],{encoding:'utf8'});
if(rendered.status!==0){process.stderr.write(rendered.stderr.slice(0,4000));throw new Error('DossierPDFRenderFailed');}
await writeFile(prefix+'_verification.json',JSON.stringify(verification,null,2)+'\n');
process.stdout.write(JSON.stringify({simulation:true,status:'EXPORTED_AND_REPRODUCED',json:prefix+'.json',pdf:prefix+'.pdf',payloadSHA256:packet.payloadSHA256})+'\n',()=>process.exit(0));
