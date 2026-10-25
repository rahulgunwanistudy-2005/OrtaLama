"""Prepare project-local tools and exact public parameters. Never publishes code."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request
import urllib.error
from bootstrap_install import install

ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
parser=argparse.ArgumentParser()
parser.add_argument('--check',action='store_true',help='Check prerequisites without downloading')
args=parser.parse_args()
releases=json.loads(Path('scripts/toolchain-releases.json').read_text())
system={'Darwin':'darwin','Linux':'linux'}.get(platform.system())
arch={'arm64':'arm64','aarch64':'arm64','x86_64':'amd64','AMD64':'amd64'}.get(platform.machine())
if not system or not arch:raise SystemExit('Use macOS or Linux, or the documented Linux container workflow')
if sys.version_info<(3,11):raise SystemExit('Python 3.11+ required')
for name in ['node','npm','make','git']:
    if not shutil.which(name):raise SystemExit(f'{name} is required')
if int(subprocess.check_output(['node','--version'],text=True).strip().lstrip('v').split('.')[0])<24:raise SystemExit('Node.js 24+ required')
pg=os.getenv('ORTALAMA_PG_BIN') or shutil.which('pg_ctl')
if not pg:
    candidates=sorted(Path('/usr/lib/postgresql').glob('*/bin/pg_ctl'))+[Path('/opt/homebrew/opt/postgresql@14/bin/pg_ctl')]
    pg=next((str(p) for p in candidates if p.exists()),None)
if not pg:raise SystemExit('PostgreSQL server binaries required. Set ORTALAMA_PG_BIN to pg_ctl; see docs/LOCAL_DEMO.md')
if args.check:
    print(f'Host prerequisites available: {system}/{arch}; PostgreSQL at {pg}')
    raise SystemExit(0)

def run(*command):subprocess.run(command,check=True)
def download(asset):
    directory=Path('.tools/downloads');directory.mkdir(parents=True,exist_ok=True)
    path=directory/asset['name']
    def valid():
        if not path.exists() or path.stat().st_size!=asset['bytes']:return False
        with path.open('rb') as data:return hashlib.file_digest(data,'sha256').hexdigest()==asset['sha256']
    if not valid():
        partial=path.with_name(path.name+'.download')
        if path.exists() and path.stat().st_size<asset['bytes'] and not partial.exists():path.replace(partial)
        print('Downloading pinned public runtime: '+asset['name'],flush=True)
        # Some proxies cap each response at a few MB; retain bounded resumable
        # retries even for the 1.5 GB Linux runtime. A stalled transfer stops.
        stalled=0
        for attempt in range(512):
            offset=partial.stat().st_size if partial.exists() else 0
            if offset==asset['bytes']:break
            if offset>asset['bytes']:raise ValueError('Runtime archive exceeds pinned size')
            request=urllib.request.Request(asset['url'],headers={'Range':f'bytes={offset}-'} if offset else {})
            try:
                with urllib.request.urlopen(request,timeout=120) as response:
                    append=offset>0 and response.status==206 and response.headers.get('Content-Range','').startswith(f'bytes {offset}-')
                    if offset and response.status==206 and not append:raise ValueError('Unexpected archive range')
                    with partial.open('ab' if append else 'wb') as output:shutil.copyfileobj(response,output)
            except (urllib.error.URLError,TimeoutError,ConnectionError):
                if attempt==511:raise
            size=partial.stat().st_size if partial.exists() else 0
            stalled=stalled+1 if size<=offset else 0
            if stalled>=8:raise ValueError('Runtime transfer made no progress; retry bootstrap to resume')
            print(f'Public runtime download: {size}/{asset["bytes"]} bytes',flush=True)
            if size==asset['bytes']:break
            time.sleep(1)
        if not partial.exists() or partial.stat().st_size!=asset['bytes']:raise ValueError('Incomplete runtime transfer; retry bootstrap to resume')
        partial.replace(path)
    if not valid():raise ValueError('Release SHA-256 mismatch: '+asset['name'])
    return path

foundry=Path('.tools/foundry/bin')
if not all((foundry/name).exists() for name in ['forge','anvil','cast']):
    asset=next(a for a in releases['foundry']['assets'] if a['name']==f'foundry_v1.8.5_{system}_{arch}.tar.gz')
    archive=download(asset);foundry.mkdir(parents=True,exist_ok=True)
    with tarfile.open(archive) as source:
        for member in source.getmembers():
            if member.isfile() and member.name in ['forge','anvil','cast','chisel']:
                with source.extractfile(member) as data,(foundry/member.name).open('wb') as output:shutil.copyfileobj(data,output)
                (foundry/member.name).chmod(0o755)
if '1.8.5' not in subprocess.check_output([str(foundry/'forge'),'--version'],text=True):raise ValueError('Expected Foundry 1.8.5')

ollama=Path('.tools/ollama/ollama' if system=='darwin' else '.tools/ollama/bin/ollama')
if not ollama.exists():
    name='ollama-darwin.tgz' if system=='darwin' else f'ollama-linux-{arch}.tar.zst'
    archive=download(next(a for a in releases['ollama']['assets'] if a['name']==name))
    target=Path('.tools/ollama');target.mkdir(parents=True,exist_ok=True)
    # SHA-256 pins the official archive. Reject absolute/traversal member names
    # before handing its relative binary/library paths to the host tar tool.
    listing=subprocess.check_output(['tar','-tf',str(archive)],text=True).splitlines()
    if any(Path(n).is_absolute() or '..' in Path(n).parts for n in listing):raise ValueError('Unsafe runtime archive')
    run('tar','-xf',str(archive),'-C',str(target))
if '0.40.7' not in subprocess.check_output([str(ollama),'--version'],text=True,stderr=subprocess.STDOUT):raise ValueError('Expected Ollama 0.40.7')

install('npm','ci','--ignore-scripts')
for directory,requirements in [('.venv','packages/crypto-py/requirements.txt'),('.tools/service-venv','services/requirements.txt')]:
    python=Path(directory)/'bin/python'
    if not python.exists():run(sys.executable,'-m','venv',directory)
    install(str(python),'-m','pip','install','--timeout','60','--retries','3','-r',requirements)
run('bash','scripts/bootstrap-contracts.sh')
run('node','scripts/build-circuits.mjs')
run('node','scripts/restore-public-keys.mjs')
run('node','scripts/assert-generated-verifiers.mjs')
run(str(foundry/'forge'),'build')
run('node','scripts/build-dossier-schema.mjs')
run('node','scripts/prepare-web.mjs')
subprocess.run(['npm','run','build','-w','@ortalama/web'],env={**os.environ,'VITE_PUBLIC_EVIDENCE':'0'},check=True)
print('Local build prepared. The demo runner will start its own model service and seed real transactions.',flush=True)
