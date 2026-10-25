"""Attach updated local role/web processes to an already seeded private runtime."""
import argparse
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import time
import urllib.request

parser=argparse.ArgumentParser()
parser.add_argument('--runtime',required=True)
parser.add_argument('--refresh-apis',action='store_true',help='Serve current indexer/plant API code with the existing single cache writer')
for name in ['web','operator','indexer','agent']:
    parser.add_argument('--'+name+'-port',type=int)
args=parser.parse_args()
if any(value is not None and not 1024<=value<=65535 for value in [args.web_port,args.operator_port,args.indexer_port,args.agent_port]):
    raise SystemExit('Explicit ports must be between 1024 and 65535')
run=Path(args.runtime).resolve()
env={**os.environ,**json.loads((run/'SIMULATED_local_endpoints.json').read_text())}
if env.get('ORTALAMA_SIMULATION')!='1':raise SystemExit('SIMULATED runtime required')
def port():
    with socket.socket() as s:
        s.bind(('127.0.0.1',0));return s.getsockname()[1]
operator_port,web_port=args.operator_port or port(),args.web_port or port()
env.update(ORTALAMA_OPERATOR=f'http://127.0.0.1:{operator_port}',ORTALAMA_WEB=f'http://127.0.0.1:{web_port}')
processes=[]
def stop(*_):raise KeyboardInterrupt
signal.signal(signal.SIGTERM,stop)
try:
    commands=[]
    if args.refresh_apis:
        index_port,agent_port=args.indexer_port or port(),args.agent_port or port()
        pg_port=int((run/'SIMULATED_postgres/postmaster.pid').read_text().splitlines()[3])
        writer_url=env['ORTALAMA_INDEXER']
        env.update(DATABASE_URL=f'postgresql://ortalama@127.0.0.1:{pg_port}/ortalama',ORTALAMA_INDEXER=f'http://127.0.0.1:{index_port}',ORTALAMA_AGENT=f'http://127.0.0.1:{agent_port}',ORTALAMA_INDEXER_WRITER_URL=writer_url)
        commands.extend([
            ('attached_indexer',['.tools/service-venv/bin/python','-m','uvicorn','services.indexer.app:app','--host','127.0.0.1','--port',str(index_port),'--no-access-log'],{'ORTALAMA_INDEXER_NO_BACKGROUND_SYNC':'1'}),
            ('attached_agent',['.tools/service-venv/bin/python','-m','uvicorn','services.plant_agent.app:app','--host','127.0.0.1','--port',str(agent_port),'--no-access-log'],{}),
        ])
    commands.extend([
        ('attached_operator',['.tools/service-venv/bin/python','-m','uvicorn','services.operator_app:app','--host','127.0.0.1','--port',str(operator_port),'--no-access-log'],{}),
        ('attached_web',['node','node_modules/vite/bin/vite.js','preview','apps/web','--config','apps/web/vite.config.ts','--port',str(web_port),'--strictPort'],{})
    ])
    for name,command,extra in commands:
        log=(run/f'SIMULATED_{name}.log').open('w')
        processes.append(subprocess.Popen(command,env={**env,**extra},stdout=log,stderr=subprocess.STDOUT,start_new_session=True))
        log.close()
    public={k:v for k,v in env.items() if k.startswith('ORTALAMA_')}
    (run/'SIMULATED_attached_endpoints.json').write_text(json.dumps(public,indent=2)+'\n')
    print(env['ORTALAMA_WEB'],flush=True)
    while all(p.poll() is None for p in processes):time.sleep(1)
    raise RuntimeError('Attached local service exited; inspect its log')
except KeyboardInterrupt:pass
finally:
    for process in reversed(processes):
        if process.poll() is None:os.killpg(process.pid,signal.SIGTERM)
    for process in processes:
        try:process.wait(timeout=10)
        except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL)
