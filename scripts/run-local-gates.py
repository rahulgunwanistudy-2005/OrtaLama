"""Own a full local stack and exercise the current built UI; never publishes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import urllib.request

parser=argparse.ArgumentParser()
parser.add_argument('--chrome',default=os.getenv('CHROME_PATH'))
args=parser.parse_args()
if not args.chrome:
    mac_chrome=Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    if mac_chrome.is_file():args.chrome=str(mac_chrome)
    else:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:args.chrome=p.chromium.executable_path
if not Path(args.chrome).is_file():raise SystemExit('Install a Playwright Chromium browser or set CHROME_PATH to your browser executable')
root=Path(__file__).resolve().parents[1]
os.chdir(root)
# Validate the source currently being audited, rather than a previous dist/.
# A caller's public-export flag must not turn the private workflow gate read-only.
build_env={**os.environ,'VITE_PUBLIC_EVIDENCE':'0'}
subprocess.run(['make','build-web'],env=build_env,check=True)
subprocess.run(['.tools/service-venv/bin/python','-m','unittest','services.test_operator_boundaries','services.test_report_inputs','scripts.test_bootstrap_install','-v'],check=True)
build_html_sha256=hashlib.sha256((root/'apps/web/dist/index.html').read_bytes()).hexdigest()
started=time.monotonic()
before=set((root/'.runtime').glob('SIMULATED_run_*'))
log_path=root/'.runtime/SIMULATED_local_gate_runner.log'
log_path.parent.mkdir(exist_ok=True)
with log_path.open('w') as log:
    stack=subprocess.Popen(['.tools/service-venv/bin/python','scripts/run-services.py','--scenario','cli','--web','--model','--keep'],env={**os.environ,'ORTALAMA_AUTOMATED_REVIEW_TEST':'1'},stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    try:
        deadline=time.monotonic()+3600
        run=None
        while time.monotonic()<deadline:
            if stack.poll() is not None:raise RuntimeError('Stack failed; inspect '+str(log_path))
            candidates=set((root/'.runtime').glob('SIMULATED_run_*'))-before
            if len(candidates)>1:raise RuntimeError('Ambiguous stack ownership; stop concurrent starts')
            if candidates:
                run=next(iter(candidates))
                status=run/'SIMULATED_seed_state.json'
                try:
                    if json.loads(status.read_text())['status']=='READY':break
                except (FileNotFoundError,json.JSONDecodeError):pass
            time.sleep(2)
        else:raise TimeoutError('Full seed gate did not become READY')
        env={**os.environ,**json.loads((run/'SIMULATED_local_endpoints.json').read_text()),'PYTHONPATH':str(root),'CHROME_PATH':args.chrome}
        url=env['ORTALAMA_WEB']
        def call(*command):subprocess.run(command,env=env,check=True)
        call('node','--import','tsx','scripts/test-agent.ts')
        call('.venv/bin/python','scripts/test-web.py','--url',url,'--chrome',args.chrome)
        browser=json.loads(Path('docs/SIMULATED_BROWSER_RESULTS.json').read_text())
        round_id=str(browser['roundId'])
        badge=browser['badgeId']
        call('.venv/bin/python','scripts/test-web-attacks.py','--url',url,'--chrome',args.chrome)
        call('.venv/bin/python','scripts/audit-web.py','--url',url,'--round',round_id,'--badge',badge,'--chrome',args.chrome)
        call('node','scripts/audit-performance.mjs',url,round_id)
        call('.venv/bin/python','scripts/test-report-browser.py','--url',url,'--chrome',args.chrome)
        call('.venv/bin/python','scripts/test-report-states.py','--runtime',str(run),'--url',url,'--chrome',args.chrome)
        call('.tools/service-venv/bin/python','scripts/test-dossier-api.py')
        call('node','--import','tsx','scripts/test-dossier.ts','output/pdf/SIMULATED_dossier_seed_round_1.json',env['ORTALAMA_DEPLOYMENT'],env['ORTALAMA_RPC'],env['ORTALAMA_INDEXER'])
        # Reuse only the owned model endpoint; this invocation owns its distinct
        # agent-test chain/DB and cleans them up before returning.
        call('.tools/service-venv/bin/python','scripts/run-services.py','--scenario','agent')
        call('.tools/service-venv/bin/python','scripts/run-services.py','--scenario','indexer')
        Path('docs/SIMULATED_FULL_PROJECT_RESULTS.json').write_text(json.dumps({
            'simulation':True,'status':'PASS','checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
            'buildHTMLSHA256':build_html_sha256,'rebuiltCurrentSource':True,
            'elapsedSeconds':round(time.monotonic()-started,2),
            'checks':['Public-testnet HTTP writes rejected before role handlers; local reads/writes preserved',
                      'Real twelve-plant CLI round and six mined attacks','Encrypted storage and database outage/recovery',
                      'Agent unit checks','Five browser participants and three deliberately lost-response recoveries',
                      'Qualifying badge and above-average witness rejection','Six fresh UI attacks',
                      'English/Turkish desktop/mobile accessibility','Mobile Lighthouse rendering',
                      'Five-report editor browser cohort with real model and signed automated-review metadata',
                      'Populated report editor EN/TR desktop/mobile checks and closed-round restoration',
                      'Matching dossier API downloads and independent reproduction','Real local-model report/review/commit/share workflow',
                      'Indexer reorganisation and idle recovery'],
            'remoteCIExecuted':False,'physicalPhoneTest':False,
            'scope':'Fresh owned local Anvil/PostgreSQL/model/trustee stack and newly built private application; no public transactions or hosting'
        },indent=2)+'\n')
        print('SIMULATED full local gates PASS; remote CI status is separate.',flush=True)
    finally:
        if stack.poll() is None:os.killpg(stack.pid,signal.SIGTERM)
        try:stack.wait(timeout=45)
        except subprocess.TimeoutExpired:os.killpg(stack.pid,signal.SIGKILL)
