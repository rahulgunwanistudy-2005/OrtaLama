import asyncio
import json
import os
import threading
import re
from contextlib import asynccontextmanager
from typing import Literal

import httpx
import psycopg
from psycopg.types.json import Jsonb
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse,Response
from pydantic import BaseModel, ConfigDict, Field
from services.common import bridge, deployment, log

dsn = os.environ['DATABASE_URL']
sync_lock = threading.Lock()


def connection():
    return psycopg.connect(dsn, connect_timeout=5)


def initialise():
    with connection() as conn:
        conn.execute('CREATE TABLE IF NOT EXISTS ortalama_events (deployment TEXT, tx_hash TEXT, log_index INTEGER, block_number BIGINT NOT NULL, block_hash TEXT NOT NULL, payload JSONB NOT NULL, PRIMARY KEY(deployment,tx_hash,log_index))')
        conn.execute('CREATE TABLE IF NOT EXISTS ortalama_snapshots (deployment TEXT, round_id TEXT, payload JSONB NOT NULL, PRIMARY KEY(deployment,round_id))')
        conn.execute('CREATE TABLE IF NOT EXISTS ortalama_cursors (deployment TEXT PRIMARY KEY, block_number BIGINT NOT NULL, block_hash TEXT NOT NULL)')
        conn.execute('ALTER TABLE ortalama_cursors ADD COLUMN IF NOT EXISTS reorg_count INTEGER NOT NULL DEFAULT 0')
        conn.execute('CREATE TABLE IF NOT EXISTS ortalama_attestations (deployment TEXT, round_id TEXT, installation_id TEXT, payload JSONB NOT NULL, PRIMARY KEY(deployment,round_id,installation_id))')


def sync():
    with sync_lock:
        d = deployment()
        namespace = str(d['chainId']) + ':' + d['round'].lower()
        with connection() as conn:
            previous = conn.execute('SELECT block_number,block_hash,reorg_count FROM ortalama_cursors WHERE deployment=%s', (namespace,)).fetchone()
        reorg = False
        if previous:
            head=bridge('indexHead',previousBlock=str(previous[0]))
            reorg=head.get('previousHash')!=previous[1]
            if not reorg and int(head['block'])==previous[0] and head['blockHash']==previous[1]:
                # An unchanged block hash cannot introduce a new chain event.
                # Avoid rebuilding every immutable closed-round snapshot while
                # the local chain is idle; public sidecars are stored separately.
                return {'simulation':True,'block':head['block'],'eventsRead':0,'roundsRead':0,'reorgRebuilt':False,'reorgRebuildCount':previous[2],'unchangedHead':True}
        from_block = int(d['blockNumber']) if not previous or reorg else previous[0] + 1
        batch = bridge('events', fromBlock=str(from_block))
        count = int(bridge('roundCount')['count'])
        # Public networks produce idle blocks continuously. Refresh only rounds
        # named by new events; a reorganisation still rebuilds every round.
        changed = set(range(1, count + 1)) if not previous or reorg else {
            int(event['args']['roundId']) for event in batch['events']
            if event.get('args', {}).get('roundId') is not None
        }
        snapshots = [bridge('snapshot', roundId=str(i)) for i in sorted(changed)]
        reorg_count = (previous[2] if previous else 0) + int(reorg)
        with connection() as conn:
            if reorg:
                # Revalidate sidecars whose commitments survived the fork. They
                # cannot be recovered from chain logs, so deleting every one
                # would strand otherwise valid independent verification.
                conn.execute('LOCK TABLE ortalama_attestations IN SHARE ROW EXCLUSIVE MODE')
                existing=conn.execute('SELECT round_id,installation_id,payload FROM ortalama_attestations WHERE deployment=%s',(namespace,)).fetchall()
                surviving={(str(s['roundId']),p['installationId']):p['pqSignatureHash']
                           for s in snapshots for p in s['plants'] if p['committed']}
                retained=[]
                for round_id,installation_id,payload in existing:
                    if surviving.get((round_id,installation_id))!=payload.get('pqSignatureHash'):
                        continue
                    result=bridge('verifyAttestation',roundId=round_id,installationId=installation_id,attestation=payload)
                    if result['valid'] is not True:raise ValueError('SurvivingCoSignatureRejected')
                    retained.append((namespace,round_id,installation_id,Jsonb(payload)))
                # Only this deployment's disposable public cache is rebuilt.
                conn.execute('DELETE FROM ortalama_events WHERE deployment=%s', (namespace,))
                conn.execute('DELETE FROM ortalama_snapshots WHERE deployment=%s', (namespace,))
                conn.execute('DELETE FROM ortalama_attestations WHERE deployment=%s', (namespace,))
                for attestation in retained:
                    conn.execute('INSERT INTO ortalama_attestations VALUES(%s,%s,%s,%s)',attestation)
            for event in batch['events']:
                if event.get('removed'):
                    continue
                conn.execute('INSERT INTO ortalama_events VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(deployment,tx_hash,log_index) DO UPDATE SET block_number=excluded.block_number,block_hash=excluded.block_hash,payload=excluded.payload', (namespace, event['transactionHash'], event['logIndex'], int(event['blockNumber']), event['blockHash'], Jsonb(event)))
            for snapshot in snapshots:
                conn.execute('INSERT INTO ortalama_snapshots VALUES(%s,%s,%s) ON CONFLICT(deployment,round_id) DO UPDATE SET payload=excluded.payload', (namespace, snapshot['roundId'], Jsonb(snapshot)))
            conn.execute('INSERT INTO ortalama_cursors(deployment,block_number,block_hash,reorg_count) VALUES(%s,%s,%s,%s) ON CONFLICT(deployment) DO UPDATE SET block_number=excluded.block_number,block_hash=excluded.block_hash,reorg_count=excluded.reorg_count', (namespace, int(batch['block']), batch['blockHash'], reorg_count))
        if reorg:
            log('index_rebuilt_after_reorg', simulation=True, deployment=d['round'])
        return {'simulation': True, 'block': batch['block'], 'eventsRead': len(batch['events']), 'roundsRead': len(snapshots), 'reorgRebuilt': reorg, 'reorgRebuildCount': reorg_count}


async def worker():
    while True:
        try:
            await asyncio.to_thread(sync)
        except Exception:
            log('index_sync_retry', simulation=True, reason='Chain or database unavailable')
        await asyncio.sleep(10 if os.getenv('ORTALAMA_PUBLIC_TESTNET')=='1' else 2)


@asynccontextmanager
async def lifespan(app):
    initialise()
    if os.getenv('ORTALAMA_INDEXER_NO_BACKGROUND_SYNC')=='1':
        # A development API refresh may share the existing cache writer while
        # serving updated routes. Never run a second background writer.
        yield
        return
    task = asyncio.create_task(worker())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title='Ortalama public evidence indexer', version='2', lifespan=lifespan)


@app.exception_handler(psycopg.Error)
async def database_unavailable(request, exception):
    log('database_unavailable', simulation=True)
    return JSONResponse(status_code=503, content={'detail': 'Indexer database unavailable'})


def namespace():
    d = deployment()
    return str(d['chainId']) + ':' + d['round'].lower()


@app.get('/health')
def health():
    try:
        with connection() as conn:
            conn.execute('SELECT 1').fetchone()
        d = deployment()
        code = httpx.post(os.getenv('ORTALAMA_RPC', 'http://127.0.0.1:8547'), json={'jsonrpc': '2.0', 'id': 1, 'method': 'eth_getCode', 'params': [d['round'], 'latest']}, timeout=5).json()['result']
        if code == '0x':
            raise ValueError('ContractUnavailable')
        return {'status': 'ready', 'simulation': True, 'database': 'PostgreSQL', 'chainId': d['chainId'], 'roundContract': d['round'], 'badgeContract': d['badge']}
    except Exception:
        raise HTTPException(503, 'Indexer dependencies unavailable')


@app.post('/sync')
def sync_now():
    try:
        if os.getenv('ORTALAMA_INDEXER_NO_BACKGROUND_SYNC')=='1':
            writer=os.getenv('ORTALAMA_INDEXER_WRITER_URL')
            if not writer or writer.rstrip('/')==os.getenv('ORTALAMA_INDEXER','').rstrip('/'):
                raise ValueError('ExistingCacheWriterRequired')
            response=httpx.post(writer.rstrip('/')+'/sync',timeout=120)
            response.raise_for_status()
            return {**response.json(),'syncDelegatedToExistingWriter':True}
        return sync()
    except Exception:
        raise HTTPException(503, 'Index sync unavailable')


@app.get('/deployment')
def public_deployment():
    return deployment()


@app.get('/rounds')
def rounds():
    with connection() as conn:
        return [row[0] for row in conn.execute('SELECT payload FROM ortalama_snapshots WHERE deployment=%s ORDER BY round_id::bigint DESC', (namespace(),)).fetchall()]


@app.get('/rounds/{round_id}')
def round_by_id(round_id: str):
    with connection() as conn:
        row = conn.execute('SELECT payload FROM ortalama_snapshots WHERE deployment=%s AND round_id=%s', (namespace(), round_id)).fetchone()
    if not row:
        raise HTTPException(404, 'Round not indexed')
    return row[0]


@app.get('/rounds/{round_id}/evidence')
def evidence(round_id: str):
    snapshot = round_by_id(round_id)
    with connection() as conn:
        events = [row[0] for row in conn.execute("SELECT payload FROM ortalama_events WHERE deployment=%s AND payload->'args'->>'roundId'=%s ORDER BY block_number,log_index", (namespace(), round_id)).fetchall()]
        attestations = [row[0] for row in conn.execute('SELECT payload FROM ortalama_attestations WHERE deployment=%s AND round_id=%s', (namespace(), round_id)).fetchall()]
    return {'simulation': snapshot['simulation'], 'snapshot': snapshot, 'events': events, 'attestations': attestations, 'authority': 'Public chain state; indexer is a replaceable cache'}


def public_dossier(round_id,block=None,digest=None):
    if not re.fullmatch(r'[1-9][0-9]{0,19}',round_id):
        raise HTTPException(422,'Canonical round ID required')
    if block is not None and not re.fullmatch(r'(0|[1-9][0-9]{0,19})',block):
        raise HTTPException(422,'Canonical pinned block required')
    if digest is not None and (block is None or not re.fullmatch(r'0x[0-9a-f]{64}',digest)):
        raise HTTPException(422,'A valid payload digest requires its pinned block')
    try:
        packet=bridge('dossier',roundId=round_id,block=block)
        if digest is not None and packet['payloadSHA256']!=digest:
            raise HTTPException(409,'The dossier source build changed; refresh the evidence before downloading')
        return packet
    except ValueError:
        raise HTTPException(409,'A closed, independently reproducible public dossier is not available')


@app.get('/rounds/{round_id}/dossier.json')
def dossier_json(round_id:str,block:str|None=None,digest:str|None=None):
    return JSONResponse(public_dossier(round_id,block,digest),headers={'content-disposition':f'attachment; filename="SIMULATED_dossier_round_{int(round_id)}.json"'})


@app.get('/rounds/{round_id}/dossier.pdf')
def dossier_pdf(round_id:str,block:str|None=None,digest:str|None=None):
    from services.indexer.dossier import render_dossier
    packet=public_dossier(round_id,block,digest)
    return Response(render_dossier(packet),media_type='application/pdf',headers={'content-disposition':f'attachment; filename="SIMULATED_dossier_round_{int(round_id)}.pdf"'})


class Attestation(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    simulation: Literal[True]
    signer: str = Field(pattern=r'^0x[0-9a-fA-F]{40}$')
    publicKey: str = Field(pattern=r'^[0-9a-f]+$', max_length=6000)
    ecdsa: str = Field(pattern=r'^0x[0-9a-f]{130}$')
    pqSignature: str = Field(pattern=r'^[0-9a-f]+$', max_length=10000)
    pqSignatureHash: str = Field(pattern=r'^0x[0-9a-f]{64}$')
    pqLink: str = Field(pattern=r'^0x[0-9a-f]{130}$')
    verifierProof: list[str] = Field(max_length=32)


@app.post('/rounds/{round_id}/attestations/{installation_id}')
def store_attestation(round_id: str, installation_id: str, attestation: Attestation):
    payload = attestation.model_dump()
    try:
        result = bridge('verifyAttestation', roundId=round_id, installationId=installation_id, attestation=payload)
        if result['valid'] is not True:
            raise ValueError('InvalidCoSignature')
        with connection() as conn:
            conn.execute('INSERT INTO ortalama_attestations VALUES(%s,%s,%s,%s) ON CONFLICT(deployment,round_id,installation_id) DO UPDATE SET payload=excluded.payload', (namespace(), round_id, installation_id, Jsonb({'installationId': installation_id, **payload})))
        return {'simulation': True, 'ecdsa': 'verified', 'mlDsa65': 'verified', 'keyIdentity': 'on-chain allowlist root'}
    except ValueError:
        raise HTTPException(409, 'Co-signature does not match the committed statement and allowlist')
