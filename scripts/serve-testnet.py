"""Preview the public Monad verifier with live localhost evidence services."""
import argparse,json,os,signal,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
parser=argparse.ArgumentParser()
parser.add_argument('--runtime',default='.runtime/monad_20261024')
parser.add_argument('--port',type=int,default=49300)
args=parser.parse_args()
if not 1024<=args.port<=65534:raise ValueError('Invalid port')
run=(ROOT/args.runtime).resolve()
env={**os.environ,**json.loads((run/'SIMULATED_testnet_endpoints.json').read_text()),'VITE_PUBLIC_EVIDENCE':'1','ORTALAMA_OPERATOR':f'http://127.0.0.1:{args.port+1}'}
output=ROOT/'output/SIMULATED_monad_preview'
subprocess.run(['node','node_modules/vite/bin/vite.js','build','apps/web','--config','apps/web/vite.config.ts','--outDir',str(output)],env=env,check=True,stdout=(run/'SIMULATED_preview_build.log').open('w'),stderr=subprocess.STDOUT)
processes=[];logs=[]
def interrupted(signum,frame):raise KeyboardInterrupt
signal.signal(signal.SIGTERM,interrupted)
try:
    for name,command in [
        ('public_config',[str(ROOT/'.tools/service-venv/bin/python'),'-m','uvicorn','services.operator_app:app','--host','127.0.0.1','--port',str(args.port+1),'--no-access-log']),
        ('public_preview',['node','node_modules/vite/bin/vite.js','preview','apps/web','--config','apps/web/vite.config.ts','--outDir',str(output),'--host','127.0.0.1','--port',str(args.port),'--strictPort'])
    ]:
        log=(run/f'SIMULATED_{name}.log').open('w');logs.append(log)
        processes.append(subprocess.Popen(command,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True))
    print(f'Live Monad testnet evidence preview: http://127.0.0.1:{args.port}',flush=True)
    while all(p.poll() is None for p in processes):time.sleep(1)
except KeyboardInterrupt:pass
finally:
    for p in processes:
        if p.poll() is None:os.killpg(p.pid,signal.SIGTERM)
    for p in processes:
        try:p.wait(timeout=10)
        except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL)
    for log in logs:log.close()
