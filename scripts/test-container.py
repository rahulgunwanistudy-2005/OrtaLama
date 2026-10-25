"""Wait for the owned demo's genuine gate, then independently verify its UI."""
import argparse,hashlib,json,subprocess,time
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect

parser=argparse.ArgumentParser();parser.add_argument('--container',required=True);parser.add_argument('--url',required=True);parser.add_argument('--wait-seconds',type=int,default=1800)
args=parser.parse_args()
if not args.container.startswith('ortalama-v2-reaudit-') or urlsplit(args.url).hostname not in ['localhost','127.0.0.1']:raise ValueError('Owned loopback audit container required')
files=['scripts/bootstrap-demo.py','scripts/bootstrap_install.py','scripts/run-services.py','services/operator_app.py','services/plant_agent/engine.py','services/indexer/app.py','apps/web/src/pages/ReportPlant.tsx','apps/web/src/pages/Evidence.tsx','apps/web/src/style.css','packages/protocol/src/runtime.ts','packages/protocol/src/verify.ts','packages/protocol/src/public-chain.ts','contracts/src/OrtalamaRound.sol','contracts/src/BadgeRegistry.sol']
script='''import json,hashlib
from pathlib import Path
latest=Path('.runtime/SIMULATED_latest_run.txt')
if not latest.exists():print(json.dumps({'status':'PREPARING'}));raise SystemExit()
run=Path(latest.read_text().strip());state=json.loads((run/'SIMULATED_seed_state.json').read_text())
if state['status']!='READY':print(json.dumps({'status':state['status']}));raise SystemExit()
gate=json.loads((run/'SIMULATED_e2e_evidence.json').read_text());storage=json.loads((run/'SIMULATED_storage_check.json').read_text());phase=json.loads(Path('docs/PHASE4_GATE.json').read_text())
print(json.dumps({'status':'READY','gate':{'status':gate['status'],'chainId':gate['chainId'],'mainRoundId':str(gate['mainRoundId']),'result':gate['publicResult'],'attacks':[{'status':a['status'],'error':a['error']} for a in gate['attacks']]},'storage':storage,'databaseRecovery':phase['databaseRecovery'],'sourceSHA256':{p:hashlib.file_digest(Path(p).open('rb'),'sha256').hexdigest() for p in FILES}}))
'''.replace('FILES',repr(files))
started=time.monotonic();last=''
while time.monotonic()-started<args.wait_seconds:
 query=subprocess.run(['docker','exec',args.container,'.tools/service-venv/bin/python','-c',script],capture_output=True,text=True,timeout=30)
 if query.returncode==0:
  state=json.loads(query.stdout)
  if state['status']!=last:print('Container stage: '+state['status'],flush=True);last=state['status']
  if state['status']=='READY':break
 time.sleep(5)
else:raise TimeoutError('Container did not complete its actual seed gate')
assert state['gate']['status']=='PASS' and state['gate']['chainId']==31337
assert len(state['gate']['attacks'])==6 and all(a['status']=='reverted' for a in state['gate']['attacks'])
assert state['storage']['status']=='PASS' and state['databaseRecovery']
assert state['sourceSHA256']=={p:hashlib.file_digest(Path(p).open('rb'),'sha256').hexdigest() for p in files},'Container source differs from the audited source'
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 page=browser.new_page(viewport={'width':390,'height':844});page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url+'/verify/'+state['gate']['mainRoundId'],wait_until='networkidle',timeout=180000)
 expect(page.get_by_role('heading',name='Verified in this browser',exact=True)).to_be_visible(timeout=180000)
 ppm=int(state['gate']['result']['intensity']);expect(page.locator('.verified-value strong')).to_have_text(f'{ppm//1000000}.{ppm%1000000:06}')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='.runtime/SIMULATED_container_verified.png',full_page=True);browser.close()
assert not errors,errors
result={'simulation':True,'status':'PASS','checkedAt':datetime.now(timezone.utc).isoformat(),'scope':'Linux arm64 Docker source bootstrap, real twelve-plant Anvil/trustee/PostgreSQL gate, six mined rejections, encrypted storage, database outage/recovery and independent host-browser verification through container routing','container':args.container,'containerModelAndRuntimeInitiallyEmpty':True,'publicToolArchivesCached':True,'networkInstallResumedAfterInterruptions':True,'sourceRefreshedDuringRetry':True,'criticalSourceMatchesHost':True,'sourceSHA256':state['sourceSHA256'],'gate':state['gate'],'storage':state['storage'],'databaseRecovery':True,'independentMobileSizedBrowserVerified':True,'physicalPhoneTest':False,'pageErrors':errors,'elapsedSecondsFromReadinessObserver':round(time.monotonic()-started,2),'limits':['Public checksum-verified runtime archives were cached from the initial failed attempt; this is not an uncached Internet-speed benchmark','The same owned container resumed incomplete installs after network interruptions; no host site-packages, chain state or private keys were imported','The application source was refreshed during retry; recorded source hashes identify tested code separately from its original base-image digest']}
Path('docs/SIMULATED_CONTAINER_RESULTS.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':'PASS','round':state['gate']['mainRoundId'],'intensity':state['gate']['result']['intensity'],'attacks':6,'criticalSourceMatchesHost':True}))
