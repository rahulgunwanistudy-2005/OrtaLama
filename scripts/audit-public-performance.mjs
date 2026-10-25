/** Lighthouse observations of the exported public site, without request mocks. */
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=process.argv[2]??'http://127.0.0.1:49310';
const output='docs/qa/monad';await mkdir(output,{recursive:true});
const observations=[];
for(const [name,route] of [['home','/'],['verify','/verify/2']]){
 const path=`${output}/SIMULATED_lighthouse_${name}.json`;
 const run=spawnSync(process.execPath,['node_modules/lighthouse/cli/index.js',new URL(route,base).href,'--chrome-flags=--headless --no-sandbox','--only-categories=performance,accessibility','--output=json',`--output-path=${path}`,'--quiet'],{stdio:'inherit',timeout:180000});
 if(run.status!==0)throw new Error(`Lighthouse failed for ${route}`);
 const report=JSON.parse(await readFile(path,'utf8'));
 const scores=Object.fromEntries(Object.entries(report.categories).map(([k,v])=>[k,Math.round(v.score*100)]));
 observations.push({route,scores,fetchTime:report.fetchTime,lighthouseVersion:report.lighthouseVersion,evidence:path});
 console.log(JSON.stringify({route,scores}));
}
const buildHTMLSHA256=createHash('sha256').update(await readFile('output/SIMULATED_monad_site/index.html')).digest('hex');
const status=observations.every(x=>x.scores.performance>=95&&x.scores.accessibility>=95)?'PASS':'FAIL';
await writeFile('docs/SIMULATED_MONAD_LIGHTHOUSE_RESULTS.json',JSON.stringify({simulation:true,status,buildHTMLSHA256,observations,limits:['Single headless mobile-emulation observations of the exact public export on loopback, not physical-phone or public-host measurements','Lighthouse measures page rendering; completed protocol verification is checked separately against actual RPC']},null,2)+'\n');
if(status!=='PASS')process.exitCode=1;
