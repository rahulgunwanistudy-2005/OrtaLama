/** Mobile Lighthouse observations on actual pages, with no route mocks. */
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [base,roundId='1']=process.argv.slice(2);
if(!base)throw new Error('Usage: node scripts/audit-performance.mjs http://127.0.0.1:PORT ROUND_ID');
const output='docs/qa';await mkdir(output,{recursive:true});
const observations=[];
for(const [name,route] of [['home','/'],['verify',`/verify/${roundId}`]]){
 const target=`${output}/SIMULATED_lighthouse_${name}.json`;
 const run=spawnSync(process.execPath,['node_modules/lighthouse/cli/index.js',new URL(route,base).href,'--chrome-flags=--headless --no-sandbox','--only-categories=performance,accessibility','--output=json',`--output-path=${target}`,'--quiet'],{stdio:'inherit',env:process.env,timeout:180000});
 if(run.status!==0)throw new Error(`Lighthouse process failed for ${route}`);
 const raw=JSON.parse(await readFile(target,'utf8'));
 raw.simulation=true;raw.simulationContext='Local app with SIMULATED actors and inputs; actual Lighthouse measurement';
 await writeFile(target,JSON.stringify(raw,null,2)+'\n');
 const scores=Object.fromEntries(Object.entries(raw.categories).map(([key,value])=>[key,Math.round(value.score*100)]));
 const metrics=Object.fromEntries(['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index'].map(key=>[key,raw.audits[key].numericValue]));
 observations.push({route,url:raw.finalDisplayedUrl,scores,metrics,fetchTime:raw.fetchTime,lighthouseVersion:raw.lighthouseVersion,environment:raw.environment,evidence:target});
 console.log(JSON.stringify({simulation:true,route,scores}));
}
const htmlSHA256=createHash('sha256').update(await readFile('apps/web/dist/index.html')).digest('hex');
const pass=observations.every(x=>x.scores.performance>=95&&x.scores.accessibility>=95);
await writeFile('docs/SIMULATED_LIGHTHOUSE_RESULTS.json',JSON.stringify({simulation:true,status:pass?'LOCAL_PASS':'FAIL',buildHTMLSHA256:htmlSHA256,observations,limits:['Single local mobile-emulation observations; not physical-phone measurements or a controlled production benchmark','Protocol verification remains an actual worker calculation; no request mocking or hard-coded result']},null,2)+'\n');
if(!pass)process.exitCode=1;
