"""Run the real Monad simulation with loopback-only private services; no Git writes."""
import argparse
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import tempfile
import time
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
parser=argparse.ArgumentParser()
parser.add_argument('--runtime',default='.runtime/testnet')
parser.add_argument('--rpc',default='https://testnet-rpc.monad.xyz')
parser.add_argument('--key-file',required=True)
parser.add_argument('--reuse-roles-from')
parser.add_argument('--project-cap-mon',choices=['8','16'])
parser.add_argument('--keep',action='store_true')
parser.add_argument('--skip-scenario',action='store_true')
args=parser.parse_args()
run=(ROOT/args.runtime).resolve()
run.mkdir(parents=True,exist_ok=True,mode=0o700)
run.chmod(0o700)
deployment=run/'SIMULATED_monad_deployment.json'
if not deployment.exists():raise RuntimeError('Deploy contracts first with the bounded testnet deployment tool')
env={**os.environ,'ORTALAMA_SIMULATION':'1','ORTALAMA_PUBLIC_TESTNET':'1','ORTALAMA_RUNTIME':str(run),'ORTALAMA_DEPLOYMENT':str(deployment),'ORTALAMA_RPC':args.rpc,'ORTALAMA_TESTNET_KEY_FILE':str((ROOT/args.key_file).resolve())}
if args.reuse_roles_from:env['ORTALAMA_REUSE_ROLE_RUNTIME']=str((ROOT/args.reuse_roles_from).resolve())
processes=[]
logs=[]
used=set()
pg_started=False
def port():
    while True:
        with socket.socket() as s:
            s.bind(('127.0.0.1',0));value=s.getsockname()[1]
        if value not in used:used.add(value);return value
def execute(command,filename):
    with (run/filename).open('w') as log:
        result=subprocess.run(command,env=env,stdout=log,stderr=subprocess.STDOUT)
    if result.returncode:raise RuntimeError(f'Operation failed; inspect {run/filename}')
def start(name,command,extra=None):
    output=(run/f'SIMULATED_{name}.log').open('a');logs.append(output)
    process=subprocess.Popen(command,env={**env,**(extra or {})},stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
    processes.append(process);return process
def ready(url,process):
    for _ in range(120):
        if process.poll() is not None:raise RuntimeError(f'Service exited; inspect {run}')
        try:
            with urllib.request.urlopen(url,timeout=2) as response:
                if response.status==200:return
        except Exception:time.sleep(.5)
    raise RuntimeError(f'Service readiness timeout: {url}')
def interrupted(signum,frame):raise KeyboardInterrupt
signal.signal(signal.SIGTERM,interrupted)
pg_bin=Path(os.getenv('ORTALAMA_PG_BIN','/opt/homebrew/opt/postgresql@14/bin/pg_ctl')).parent
pg_socket=Path(tempfile.mkdtemp(prefix='ortalama-monad-pg-',dir='/tmp'))
pg_data=run/'SIMULATED_monad_postgres'
pg_port,api_port=port(),port()
while True:
    trustee_base=port();sockets=[]
    try:
        for i in (1,2,3):
            if trustee_base+i in used:raise OSError('Port already selected')
            s=socket.socket();sockets.append(s);s.bind(('127.0.0.1',trustee_base+i))
        break
    except OSError:pass
    finally:
        for s in sockets:s.close()
env.update(DATABASE_URL=f'postgresql://ortalama@127.0.0.1:{pg_port}/ortalama',ORTALAMA_INDEXER=f'http://127.0.0.1:{api_port}',ORTALAMA_TRUSTEE_BASE_PORT=str(trustee_base))
try:
    if args.project_cap_mon:execute(['node','--import','tsx','scripts/configure-testnet-budget.ts','--cap-mon',args.project_cap_mon],'SIMULATED_budget_configuration.log')
    if not (run/'SIMULATED_scenario.json').exists():execute(['node','--import','tsx','services/bootstrap-testnet.ts'],'SIMULATED_public_roles.log')
    execute(['node','--import','tsx','services/fund-testnet.ts'],'SIMULATED_trustee_funding.log')
    fresh=not pg_data.exists()
    if fresh:execute([str(pg_bin/'initdb'),'-D',str(pg_data),'-U','ortalama','--auth-local=trust','--auth-host=trust','--encoding=UTF8','--locale=C'],'SIMULATED_pg_init.log')
    execute([str(pg_bin/'pg_ctl'),'-D',str(pg_data),'-l',str(run/'SIMULATED_monad_postgres.log'),'-o',f'-h 127.0.0.1 -p {pg_port} -k {pg_socket}','-w','start'],'SIMULATED_pg_start.log')
    pg_started=True
    if fresh:execute([str(pg_bin/'createdb'),'-h','127.0.0.1','-p',str(pg_port),'-U','ortalama','ortalama'],'SIMULATED_pg_create.log')
    python=str(ROOT/'.tools/service-venv/bin/python')
    indexer=start('monad_indexer',[python,'-m','uvicorn','services.indexer.app:app','--host','127.0.0.1','--port',str(api_port),'--no-access-log'])
    ready(env['ORTALAMA_INDEXER']+'/health',indexer)
    for i in (1,2,3):
        trustee=start(f'monad_trustee_{i}',[python,'-m','uvicorn','services.trustee.app:app','--host','127.0.0.1','--port',str(trustee_base+i),'--no-access-log'],{'ORTALAMA_TRUSTEE_CONFIG':str(run/f'SIMULATED_trustee_{i}_secret.json'),'ORTALAMA_TRUSTEE_STORAGE':str(run/f'trustee-{i}')})
        ready(f'http://127.0.0.1:{trustee_base+i}/health',trustee)
    public_env={k:v for k,v in env.items() if k.startswith('ORTALAMA_') and 'KEY' not in k}
    (run/'SIMULATED_testnet_endpoints.json').write_text(json.dumps(public_env,indent=2))
    print(f'Monad simulation services ready; private controls remain on localhost. Evidence: {run}',flush=True)
    if not args.skip_scenario:
        try:execute(['node','--import','tsx','services/e2e-monad.ts'],'SIMULATED_public_round.log')
        except RuntimeError:
            if not args.keep:raise
            print('Scenario interrupted; private services retained for exact saved-transaction recovery. Inspect SIMULATED_public_round.log.',flush=True)
            while all(p.poll() is None for p in processes):time.sleep(1)
            raise
    print('Monad scenario finished.',flush=True)
    if args.keep:
        while all(p.poll() is None for p in processes):time.sleep(1)
except KeyboardInterrupt:pass
finally:
    for process in reversed(processes):
        if process.poll() is None:os.killpg(process.pid,signal.SIGTERM)
    for process in processes:
        try:process.wait(timeout=10)
        except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL)
    if pg_started:subprocess.run([str(pg_bin/'pg_ctl'),'-D',str(pg_data),'-m','fast','-w','stop'],stdout=subprocess.DEVNULL)
    for output in logs:output.close()
    try:pg_socket.rmdir()
    except OSError:pass
