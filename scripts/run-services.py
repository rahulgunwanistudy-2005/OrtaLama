"""Own and clean up an isolated SIMULATED local stack; never touch user services."""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import time
import tempfile
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
parser = argparse.ArgumentParser()
parser.add_argument('--keep', action='store_true', help='Keep stack running for local UI work')
parser.add_argument('--scenario', choices=['cli', 'agent', 'indexer', 'empty'], default='cli')
parser.add_argument('--web', action='store_true', help='Serve the built web application and local role adapters')
parser.add_argument('--model', action='store_true', help='Start an owned local Ollama service and pull the pinned demonstration model')
args = parser.parse_args()
run = ROOT / '.runtime' / ('SIMULATED_run_' + time.strftime('%Y%m%d_%H%M%S'))
run.mkdir(parents=True, mode=0o700)
run.chmod(0o700)
(run/'SIMULATED_seed_state.json').write_text(json.dumps({'simulation':True,'status':'SEEDING' if args.scenario=='cli' else 'READY'}))
env = {**os.environ, 'ORTALAMA_SIMULATION': '1', 'ORTALAMA_PUBLIC_TESTNET':'0',
       'ORTALAMA_INDEXER_NO_BACKGROUND_SYNC':'0',
       'ORTALAMA_RUNTIME': str(run), 'ORTALAMA_DEPLOYMENT': str(run / 'SIMULATED_deployment.json')}
processes = []
logs = []
pg_started = False
pg_socket = None
chosen_ports = set()


def interrupted(signum, frame):
    raise KeyboardInterrupt


signal.signal(signal.SIGTERM, interrupted)


def port():
    while True:
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            candidate = s.getsockname()[1]
            if candidate not in chosen_ports:
                chosen_ports.add(candidate)
                return candidate


def execute(command, **kwargs):
    return subprocess.run(command, env=env, check=True, **kwargs)


def start(name, command, extra=None):
    output = (run / f'SIMULATED_{name}.log').open('w')
    logs.append(output)
    process = subprocess.Popen(command, env={**env, **(extra or {})}, stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
    processes.append(process)
    return process


def ready(url, process):
    for _ in range(120):
        if process.poll() is not None:
            raise RuntimeError(f'Service exited; inspect {run}')
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(.5)
    raise RuntimeError(f'Health deadline: {url}; inspect {run}')


try:
    if args.model:
        llm_port=port()
        binary=ROOT/('.tools/ollama/ollama' if os.uname().sysname=='Darwin' else '.tools/ollama/bin/ollama')
        if not binary.exists():raise RuntimeError('Run the demo bootstrap to install the pinned model runtime')
        model_env={'OLLAMA_HOST':f'127.0.0.1:{llm_port}','OLLAMA_MODELS':str(ROOT/'.tools/ollama/models'),'OLLAMA_NO_CLOUD':'1','OLLAMA_NUM_PARALLEL':'1','OLLAMA_MAX_LOADED_MODELS':'1'}
        env.update(ORTALAMA_LLM_URL=f'http://127.0.0.1:{llm_port}',ORTALAMA_LLM_MODEL='qwen2.5:1.5b',**model_env)
        model=start('ollama',[str(binary),'serve'])
        ready(env['ORTALAMA_LLM_URL']+'/api/version',model)
        print('Preparing pinned local model; first download is approximately 986 MB.',flush=True)
        execute([str(binary),'pull','qwen2.5:1.5b'])
        with urllib.request.urlopen(env['ORTALAMA_LLM_URL']+'/api/tags',timeout=10) as response:
            installed=next(m for m in json.load(response)['models'] if m['name']=='qwen2.5:1.5b')
        if installed['digest']!='65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b':raise RuntimeError('Pinned model digest mismatch; review the changed upstream model before use')
        (run/'SIMULATED_model_provenance.json').write_text(json.dumps({'simulation':True,'context':'Extraction of generated SIMULATED reports only','model':installed,'runtimeVersion':'0.40.7','cloudDisabled':True},indent=2))
    pg_candidate = os.getenv('ORTALAMA_PG_BIN') or shutil.which('pg_ctl')
    if not pg_candidate:
        candidates = sorted(Path('/usr/lib/postgresql').glob('*/bin/pg_ctl')) + [Path('/opt/homebrew/opt/postgresql@14/bin/pg_ctl')]
        pg_candidate = next((str(p) for p in candidates if p.exists()), None)
    if not pg_candidate:
        raise RuntimeError('PostgreSQL server binaries required; set ORTALAMA_PG_BIN to the pg_ctl executable')
    pg_bin = Path(pg_candidate).parent
    # Keep Unix socket paths short even when the checkout is deeply nested.
    # This private, exclusively owned temporary directory contains no keys.
    pg_socket=Path(tempfile.mkdtemp(prefix='ortalama-pg-',dir='/tmp'))
    pg_port, rpc_port, api_port = port(), port(), port()
    while True:
        trustee_base = port()
        sockets = []
        try:
            for i in [1, 2, 3]:
                if trustee_base + i in chosen_ports:
                    raise OSError('Port already selected for this stack')
                s = socket.socket()
                sockets.append(s)
                s.bind(('127.0.0.1', trustee_base + i))
            break
        except OSError:
            pass
        finally:
            for s in sockets:
                s.close()
    pg_data = run / 'SIMULATED_postgres'
    execute([str(pg_bin / 'initdb'), '-D', str(pg_data), '-U', 'ortalama', '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--locale=C'], stdout=(run / 'SIMULATED_initdb.log').open('w'), stderr=subprocess.STDOUT)
    # Loopback-only trust is limited to the explicitly synthetic local demo.
    execute([str(pg_bin / 'pg_ctl'), '-D', str(pg_data), '-l', str(run / 'SIMULATED_postgres.log'), '-o', f'-h 127.0.0.1 -p {pg_port} -k {pg_socket}', '-w', 'start'], stdout=subprocess.DEVNULL)
    pg_started = True
    execute([str(pg_bin / 'createdb'), '-h', '127.0.0.1', '-p', str(pg_port), '-U', 'ortalama', 'ortalama'])
    env.update(DATABASE_URL=f'postgresql://ortalama@127.0.0.1:{pg_port}/ortalama', ORTALAMA_RPC=f'http://127.0.0.1:{rpc_port}', ORTALAMA_INDEXER=f'http://127.0.0.1:{api_port}', ORTALAMA_TRUSTEE_BASE_PORT=str(trustee_base))
    anvil_binary = ROOT / '.tools/foundry/bin/anvil'
    anvil_command = str(anvil_binary) if anvil_binary.exists() else shutil.which('anvil')
    if not anvil_command:
        raise RuntimeError('Foundry Anvil required')
    anvil = start('anvil', [anvil_command, '--host', '127.0.0.1', '--port', str(rpc_port), '--gas-limit', '30000000', '--silent'])
    for _ in range(100):
        try:
            with socket.create_connection(('127.0.0.1', rpc_port), timeout=1):
                break
        except OSError:
            time.sleep(.1)
    execute(['node', '--import', 'tsx', 'services/bootstrap.ts'])
    python = str(ROOT / '.tools/service-venv/bin/python')
    indexer = start('indexer', [python, '-m', 'uvicorn', 'services.indexer.app:app', '--host', '127.0.0.1', '--port', str(api_port), '--no-access-log'])
    ready(env['ORTALAMA_INDEXER'] + '/health', indexer)
    for i in [1, 2, 3]:
        trustee = start(f'trustee_{i}', [python, '-m', 'uvicorn', 'services.trustee.app:app', '--host', '127.0.0.1', '--port', str(trustee_base + i), '--no-access-log'], {'ORTALAMA_TRUSTEE_CONFIG': str(run / f'SIMULATED_trustee_{i}_secret.json'), 'ORTALAMA_TRUSTEE_STORAGE': str(run / f'trustee-{i}')})
        ready(f'http://127.0.0.1:{trustee_base + i}/health', trustee)
    (run / 'SIMULATED_local_endpoints.json').write_text(json.dumps({k: v for k, v in env.items() if k.startswith('ORTALAMA_') and 'SECRET' not in k}, indent=2))
    (ROOT / '.runtime/SIMULATED_latest_run.txt').write_text(str(run))
    print(f'SIMULATED isolated stack ready; logs: {run}', flush=True)
    if args.scenario == 'agent' or args.web:
        agent_port = port()
        env.update(ORTALAMA_AGENT=f'http://127.0.0.1:{agent_port}')
        if args.scenario == 'agent':
            env['ORTALAMA_AUTOMATED_REVIEW_TEST']='1'
        agent = start('plant_agent', [python, '-m', 'uvicorn', 'services.plant_agent.app:app', '--host', '127.0.0.1', '--port', str(agent_port), '--no-access-log'])
        ready(env['ORTALAMA_AGENT'] + '/health', agent)
    if args.web:
        operator_port, web_port = port(), port()
        if os.getenv('ORTALAMA_WEB_PORT'):
            web_port=int(os.environ['ORTALAMA_WEB_PORT'])
            if not 1024<=web_port<=65535:raise ValueError('Invalid web port')
        env.update(ORTALAMA_OPERATOR=f'http://127.0.0.1:{operator_port}', ORTALAMA_WEB=f'http://127.0.0.1:{web_port}')
        controller=start('operator',[python,'-m','uvicorn','services.operator_app:app','--host','127.0.0.1','--port',str(operator_port),'--no-access-log'])
        ready(env['ORTALAMA_OPERATOR']+'/health',controller)
        web=start('web',['node','node_modules/vite/bin/vite.js','preview','apps/web','--config','apps/web/vite.config.ts','--port',str(web_port),'--strictPort','--host',os.getenv('ORTALAMA_WEB_HOST','127.0.0.1')])
        ready(env['ORTALAMA_WEB'],web)
        (run/'SIMULATED_local_endpoints.json').write_text(json.dumps({k:v for k,v in env.items() if k.startswith('ORTALAMA_')},indent=2))
        print(f"SIMULATED web application: {env['ORTALAMA_WEB']}",flush=True)
    if args.scenario == 'agent':
        execute(['node', '--import', 'tsx', 'services/e2e-agent.ts'])
    elif args.scenario == 'indexer':
        execute(['node', '--import', 'tsx', 'services/e2e-indexer.ts'])
    elif args.scenario == 'cli':
        execute(['node', '--import', 'tsx', 'services/e2e-cli.ts'])
        execute([python, 'services/check_storage.py'])
    if args.scenario != 'cli':
        if args.keep:
            (run / 'SIMULATED_local_endpoints.json').write_text(json.dumps({k: v for k, v in env.items() if k.startswith('ORTALAMA_')}, indent=2))
            print('SIMULATED stack ready. Interrupt to stop only this stack.', flush=True)
            while True:
                time.sleep(1)
        raise SystemExit(0)
    execute([str(pg_bin / 'pg_ctl'), '-D', str(pg_data), '-m', 'fast', '-w', 'stop'], stdout=subprocess.DEVNULL)
    pg_started = False
    for route in ['/health', '/rounds']:
        try:
            urllib.request.urlopen(env['ORTALAMA_INDEXER'] + route, timeout=10)
            raise AssertionError('Database outage was hidden')
        except urllib.error.HTTPError as error:
            assert error.code == 503
            assert 'unavailable' in json.load(error)['detail'].lower()
    execute([str(pg_bin / 'pg_ctl'), '-D', str(pg_data), '-l', str(run / 'SIMULATED_postgres.log'), '-o', f'-h 127.0.0.1 -p {pg_port} -k {pg_socket}', '-w', 'start'], stdout=subprocess.DEVNULL)
    pg_started = True
    ready(env['ORTALAMA_INDEXER'] + '/health', indexer)
    (run/'SIMULATED_seed_state.json').write_text(json.dumps({'simulation':True,'status':'READY'}))
    summary = {'simulation': True, 'status': 'LOCAL_PASS', 'database': subprocess.check_output([str(pg_bin / 'pg_ctl'), '--version'], text=True).strip(), 'databaseOutageResponses': 2, 'databaseRecovery': True, 'storage': json.loads((run / 'SIMULATED_storage_check.json').read_text()), 'cliEvidence': 'data/simulated/SIMULATED_PHASE4_CLI_RESULTS.json', 'ci': 'Run remotely by .github/workflows/ci.yml'}
    (ROOT / 'docs/PHASE4_GATE.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary), flush=True)
    if args.keep:
        print('SIMULATED stack ready for local use. Interrupt to stop only this stack.', flush=True)
        while True:
            if any(p.poll() is not None for p in processes):
                raise RuntimeError('A local demo service exited; inspect preserved logs')
            time.sleep(1)
except KeyboardInterrupt:
    pass
finally:
    for process in reversed(processes):
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
    for process in processes:
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
    if pg_started:
        subprocess.run([str(pg_bin / 'pg_ctl'), '-D', str(pg_data), '-m', 'fast', '-w', 'stop'], stdout=subprocess.DEVNULL, check=False)
    if pg_socket is not None:
        shutil.rmtree(pg_socket)
    for output in logs:
        output.close()
