"""Loopback-only SIMULATED role controls; never deploy as an unauthenticated API."""
import json
import os
from pathlib import Path
import threading
import secrets
import subprocess
from typing import Annotated, Literal
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import Field
from services.common import bridge, read_json
from services.plant_agent.schema import Strict

app=FastAPI(title='Ortalama local SIMULATED role controls',version='2')
lock=threading.Lock()

@app.middleware('http')
async def public_testnet_read_only(request,call_next):
    # Reject before a handler can publish a trustee sum or start a background
    # attack job. Guards in the governor bridge alone do not cover those paths.
    if os.getenv('ORTALAMA_PUBLIC_TESTNET')=='1' and request.method not in {'GET','HEAD','OPTIONS'}:
        return JSONResponse(status_code=403,content={'detail':'PrivateTestnetCLIRequired'})
    return await call_next(request)

@app.exception_handler(ValueError)
async def invalid(request,error):
    return JSONResponse(status_code=409,content={'detail':str(error)[:100]})

@app.get('/health')
def health():
    return {'simulation':True,'status':'ready'}

@app.get('/config')
def config():
    return bridge('operatorConfig')

class NewRound(Strict):
    mode:Literal['cli','report','live']='live'
    sectorProduction:str|None=Field(default=None,pattern=r'^[1-9][0-9]{0,16}$')
    country:str=Field(default='TR',pattern=r'^[A-Z]{2}$')
    productCN:str=Field(default='25231000',pattern=r'^[0-9]{8}$')
    period:int=Field(default=2025,ge=2000,le=9999)

@app.post('/rounds')
def create(options:NewRound):
    with lock:
        return bridge('operatorCreate',**options.model_dump())

Decimal=Annotated[str,Field(pattern=r'^(0|[1-9][0-9]{0,77})$')]
Hash=Annotated[str,Field(pattern=r'^0x[0-9a-f]{64}$')]
ProofScalar=Annotated[str,Field(pattern=r'^(0x[0-9a-fA-F]{1,64}|[0-9]{1,78})$')]
ProofPair=Annotated[list[ProofScalar],Field(min_length=2,max_length=2)]

class PublicPoint(Strict):
    x:Decimal
    y:Decimal

class PublicStatement(Strict):
    roundId:Decimal
    installationId:Hash
    CE:PublicPoint
    CP:PublicPoint
    AE:PublicPoint
    AP:PublicPoint
    reportHash:Hash
    metadataHash:Hash
    pqKeyHash:Hash

class PublicProof(Strict):
    a:ProofPair
    b:Annotated[list[ProofPair],Field(min_length=2,max_length=2)]
    c:ProofPair
    contextTag:Decimal

class PublicSubmission(Strict):
    statement:PublicStatement
    validationHash:Hash
    ciphertextHashes:Annotated[list[Hash],Field(min_length=3,max_length=3)]
    proof:PublicProof

class LiveDeclaration(Strict):
    simulation:Literal[True]
    mode:Literal['BROWSER_SECRET_INPUT']
    reportReview:Literal[False]
    nonce:Annotated[str,Field(pattern=r'^[0-9a-f]{64}$')]

class LiveSubmission(Strict):
    submission:PublicSubmission
    declaration:LiveDeclaration
    actorConsent:str=Field(pattern=r'^0x[0-9a-f]{130}$')

@app.post('/rounds/{round_id}/cosign-live')
def cosign(round_id:str,options:LiveSubmission):
    # The nested statement/proof contains only public inputs. All secret E/P,
    # blindings, slopes and share plaintexts stay in the participant browser.
    if len(json.dumps(options.model_dump()))>30000:
        raise HTTPException(413,'Public submission too large')
    return bridge('operatorCosignLive',roundId=round_id,**options.model_dump())

@app.post('/rounds/{round_id}/sharing')
def sharing(round_id:str):
    with lock:
        return bridge('operatorLifecycle',roundId=round_id,operation='startSharing')

def publish(round_id,index):
    cfg=read_json(Path(os.getenv('ORTALAMA_RUNTIME','.runtime'))/f'SIMULATED_trustee_{index}_secret.json')
    response=httpx.post(f"http://127.0.0.1:{int(os.getenv('ORTALAMA_TRUSTEE_BASE_PORT','8700'))+index}/rounds/{round_id}/publish",json={'simulation':True},headers={'authorization':'Bearer '+cfg['controlToken']},timeout=120)
    if not response.is_success:
        raise HTTPException(409,f'Trustee {index} publication rejected; check lifecycle and common receipts')
    return response.json()

@app.post('/rounds/{round_id}/close')
def close(round_id:str):
    with lock:
        snapshot=bridge('snapshot',roundId=round_id)
        receipts=[]
        if snapshot['round']['state']==2:
            receipts.append(bridge('operatorLifecycle',roundId=round_id,operation='startClosing'))
        snapshot=bridge('snapshot',roundId=round_id)
        if snapshot['round']['state']!=3:
            raise HTTPException(409,'Round must be Sharing or Closing')
        for index in [1,2,3]:
            bit=1<<(index-1)
            if not int(snapshot['round']['publicationMask']) & bit and not int(snapshot['round']['faultMask']) & bit:
                try:
                    receipts.append(publish(round_id,index)['receipt'])
                except (HTTPException,httpx.HTTPError):
                    # Threshold liveness: a missing third node must not prevent
                    # the two complete, validated publications from closing.
                    continue
        receipts.append(bridge('operatorLifecycle',roundId=round_id,operation='close'))
        return {'simulation':True,'receipts':receipts}

@app.post('/rounds/{round_id}/abort')
def abort(round_id:str):
    with lock:
        return bridge('operatorLifecycle',roundId=round_id,operation='abort')

@app.get('/trustees/{index}/health')
def trustee_health(index:int):
    if index not in [1,2,3]:
        raise HTTPException(404,'Unknown trustee')
    response=httpx.get(f"http://127.0.0.1:{int(os.getenv('ORTALAMA_TRUSTEE_BASE_PORT','8700'))+index}/health",timeout=10)
    if not response.is_success:
        raise HTTPException(503,'Trustee unavailable')
    return response.json()

@app.post('/trustees/{index}/rounds/{round_id}/publish')
def publish_one(index:int,round_id:str):
    if index not in [1,2,3]:
        raise HTTPException(404,'Unknown trustee')
    return publish(round_id,index)

# Ephemeral public job records contain receipts and progress, never openings or
# private fixture paths. The one operator lock serialises nonce-bearing fixtures.
attack_jobs={}
jobs_lock=threading.Lock()

def execute_attack(job_id,index):
    try:
        with lock:
            with jobs_lock:
                attack_jobs[job_id]['stage']='Preparing a fresh SIMULATED attack fixture'
            process=subprocess.Popen(['node','--import','tsx','services/attack.ts',str(index)],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
            timer=threading.Timer(600,process.kill)
            timer.start()
            try:
                for line in process.stdout:
                    try:
                        item=json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    with jobs_lock:
                        if 'stage' in item:
                            attack_jobs[job_id]['stage']=item['stage'][:180]
                        elif item.get('status')=='PASS':
                            attack_jobs[job_id].update(item)
                            attack_jobs[job_id]['stage']='Mined revert and exact error checked'
                if process.wait(timeout=10)!=0:
                    raise ValueError('Attack fixture failed; inspect the local service logs')
                with jobs_lock:
                    if attack_jobs[job_id]['status']!='PASS':
                        raise ValueError('Attack produced no verified receipt')
            finally:
                timer.cancel()
                if process.poll() is None:
                    process.terminate()
    except Exception:
        with jobs_lock:
            attack_jobs[job_id].update(status='FAIL',error='Attack fixture failed; inspect local service logs',stage='Failed')

@app.post('/attacks/{index}')
def run_attack(index:int):
    if index not in range(1,7):
        raise HTTPException(404,'Unknown attack')
    with jobs_lock:
        if any(j['status']=='RUNNING' for j in attack_jobs.values()):
            raise HTTPException(409,'Another attack is still running')
        if len(attack_jobs)>=100:
            attack_jobs.pop(next(iter(attack_jobs)))
        job_id=secrets.token_hex(16)
        job={'id':job_id,'simulation':True,'attack':index,'status':'RUNNING','stage':'Queued'}
        attack_jobs[job_id]=job
    threading.Thread(target=execute_attack,args=(job_id,index),daemon=True).start()
    return dict(job)

@app.get('/attacks/jobs/{job_id}')
def attack_status(job_id:str):
    with jobs_lock:
        job=attack_jobs.get(job_id)
        if not job:
            raise HTTPException(404,'Unknown attack job')
        return dict(job)
