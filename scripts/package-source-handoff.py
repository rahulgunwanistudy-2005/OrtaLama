"""Package the working source without Git history, dependencies or private runtime."""
import hashlib,json,subprocess,zipfile
from pathlib import Path

root=Path.cwd();out=Path('output/SIMULATED_source_handoff.zip')
names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z']).decode().split('\0')
excluded={'output','broadcast','.claude','.agents','.codex','.git','.runtime','.tools','.venv','tmp','node_modules'}
files=[]
for name in sorted(set(names)):
 if not name:continue
 p=Path(name)
 if p.parts[0] in excluded or name.startswith('docs/media/') or name.startswith('docs/qa/'):continue
 if name in ['docs/FINAL_TESTNET_AUDIT.json','docs/FINAL_FUNCTIONAL_AUDIT.json','docs/SIMULATED_SOURCE_HANDOFF_RESULTS.json']:continue
 if 'node_modules' in p.parts or '__pycache__' in p.parts or any(x.startswith('.env') for x in p.parts):continue
 if not p.is_file() or p.is_symlink():continue
 files.append(p)
for required in ['package-lock.json','scripts/package-testnet.ts','apps/web/src/main.tsx','circuits/ceremony/public/below_threshold_final.zkey','circuits/ceremony/public/commitment_validity_final.zkey']:
 assert Path(required) in files,required
# Compare against actual private runtime values without printing any secret.
values=set();sensitive={'signingKey','secretKey','storageKey','controlToken','privateKey','x25519SecretKey'}
def collect(value):
 if isinstance(value,dict):
  for key,item in value.items():
   if key in sensitive and isinstance(item,str) and len(item)>=24:values.add(item)
   else:collect(item)
 elif isinstance(value,list):
  for item in value:collect(item)
for directory in ['.runtime/monad_20261024','.runtime/testnet']:
 for p in Path(directory).glob('*secret*.json'):collect(json.loads(p.read_text()))
for p in Path('.runtime/testnet').glob('*secret*.key'):values.add(p.read_text().strip())
needles={v.encode() for v in values}|{v[2:].encode() for v in values if v.startswith('0x')}
manifest={}
for p in files:
 body=p.read_bytes()
 if any(value in body for value in needles):raise ValueError('Actual runtime secret detected; source export refused')
 manifest[str(p)]=hashlib.sha256(body).hexdigest()
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for p in files:z.write(p,str(p))
 z.writestr('SIMULATED_source_manifest.json',json.dumps({'simulation':True,'scope':'Current uncommitted working source, public parameters and build scripts; excludes private runtime, dependencies, Git history, generated output and separately delivered media','sha256':manifest},indent=2)+'\n')
record={'simulation':True,'status':'SOURCE_HANDOFF_READY','files':len(files),'actualPrivateValuesChecked':len(values),'privateMatches':0,'bytes':out.stat().st_size,'sha256':hashlib.file_digest(out.open('rb'),'sha256').hexdigest()}
Path('docs/SIMULATED_SOURCE_HANDOFF_RESULTS.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
