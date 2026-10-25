"""Actual ASGI routes + live RPC/DB/signatures, without a mock bridge."""
import json
import os
import argparse
from pathlib import Path
from urllib.parse import urlencode
from fastapi.testclient import TestClient

from services.indexer.dossier import render_dossier
parser=argparse.ArgumentParser();parser.add_argument('--url');args=parser.parse_args()
if args.url:
    import httpx
    client=httpx.Client(base_url=args.url,timeout=180)
else:
    run=Path(os.environ['ORTALAMA_RUNTIME'])
    ports=(run/'SIMULATED_postgres/postmaster.pid').read_text().splitlines()
    os.environ['DATABASE_URL']=f'postgresql://ortalama@127.0.0.1:{int(ports[3])}/ortalama'
    from services.indexer.app import app
    client=TestClient(app)
response=client.get('/rounds/1/dossier.json')
assert response.status_code==200,response.text[:200]
packet=response.json();block=packet['payload']['snapshot']['block']
params={'block':block,'digest':packet['payloadSHA256']}
repeat=client.get('/rounds/1/dossier.json',params=params)
assert repeat.status_code==200 and repeat.json()==packet
pdf=client.get('/rounds/1/dossier.pdf',params=params)
assert pdf.status_code==200 and pdf.content.startswith(b'%PDF')
assert 'SIMULATED_' in pdf.headers['content-disposition']
assert pdf.content==render_dossier(packet),'JSON/PDF download pair used different evidence'
bad=client.get('/rounds/1/dossier.json',params={'block':block,'digest':'0x'+'00'*32})
assert bad.status_code==409
assert client.get('/rounds/1/dossier.json',params={'block':'-1'}).status_code==422
assert client.get('/rounds/invalid/dossier.json').status_code==422
directory=Path('output/pdf');directory.mkdir(parents=True,exist_ok=True)
(directory/'SIMULATED_dossier_seed_round_1.json').write_text(json.dumps(packet,indent=2)+'\n')
(directory/'SIMULATED_dossier_seed_round_1.pdf').write_bytes(pdf.content)
result={'simulation':True,'status':'LOCAL_PASS','scope':('Actual HTTP download routes' if args.url else 'Actual ASGI handlers')+' using the running local RPC, PostgreSQL sidecars and real signature/arithmetic checks; no request or bridge mocks','roundId':'1','pinnedBlock':block,'payloadSHA256':packet['payloadSHA256'],'matchingJSONAndPDF':True,'wrongDigestRejected':True,'invalidBlockRejected':True,'invalidRoundRejected':True}
Path('docs/SIMULATED_DOSSIER_API_RESULTS.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
