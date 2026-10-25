import hmac
import json
import os
import sqlite3
import threading
from pathlib import Path
from typing import Literal

import httpx
from Crypto.Cipher import ChaCha20_Poly1305
from Crypto.Random import get_random_bytes
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from services.common import bridge, read_json, log

config = read_json(os.environ['ORTALAMA_TRUSTEE_CONFIG'])
assert config['simulation'] is True
index = config['index']
folder = Path(os.getenv('ORTALAMA_TRUSTEE_STORAGE', f'.runtime/trustee-{index}'))
folder.mkdir(parents=True, exist_ok=True)
database = folder / f"SIMULATED_trustee_{index}_{config['instanceId']}.sqlite3"
lock = threading.Lock()
storage_key = bytes.fromhex(config['storageKey'])
assert len(storage_key) == 32
L = 2736030358979909402780800718157159386076813972158567259200215660948447373041
with sqlite3.connect(database) as connection:
    connection.execute('CREATE TABLE IF NOT EXISTS shares (round_id TEXT, installation_id TEXT, nonce BLOB NOT NULL, box BLOB NOT NULL, ciphertext_hash TEXT NOT NULL, ack_tx TEXT, PRIMARY KEY(round_id,installation_id))')
database.chmod(0o600)
app = FastAPI(title=f'Ortalama SIMULATED trustee {index}', version='2')


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class Envelope(StrictModel):
    version: Literal[1]
    ephemeralPublicKey: str = Field(pattern=r'^[0-9a-f]{64}$')
    salt: str = Field(pattern=r'^[0-9a-f]{64}$')
    nonce: str = Field(pattern=r'^[0-9a-f]{48}$')
    aad: str = Field(pattern=r'^(?:[0-9a-f]{2})+$', max_length=2048)
    ciphertext: str = Field(pattern=r'^(?:[0-9a-f]{2})+$', min_length=32, max_length=131104)


class Delivery(StrictModel):
    simulation: Literal[True]
    roundId: str = Field(pattern=r'^[1-9][0-9]{0,19}$')
    installationId: str = Field(pattern=r'^0x[0-9a-f]{64}$')
    envelope: Envelope


class Publication(StrictModel):
    simulation: Literal[True]
    omitInstallationId: str | None = Field(default=None, pattern=r'^0x[0-9a-f]{64}$')


def aad(round_id, installation_id):
    return json.dumps(['ORTALAMA_AT_REST_v1', config['chainId'], config['deployment'], index, round_id, installation_id], separators=(',', ':')).encode()


def encrypt_share(share, round_id, installation_id):
    nonce = get_random_bytes(24)
    cipher = ChaCha20_Poly1305.new(key=storage_key, nonce=nonce)
    cipher.update(aad(round_id, installation_id))
    payload, tag = cipher.encrypt_and_digest(json.dumps(share, separators=(',', ':')).encode())
    return nonce, payload + tag


def decrypt_share(nonce, box, round_id, installation_id):
    cipher = ChaCha20_Poly1305.new(key=storage_key, nonce=nonce)
    cipher.update(aad(round_id, installation_id))
    return json.loads(cipher.decrypt_and_verify(box[:-16], box[-16:]))


@app.get('/health')
def health():
    try:
        with sqlite3.connect(database) as connection:
            connection.execute('SELECT 1').fetchone()
        response = httpx.post(os.getenv('ORTALAMA_RPC', 'http://127.0.0.1:8547'), json={'jsonrpc': '2.0', 'id': 1, 'method': 'eth_chainId', 'params': []}, timeout=5).json()
        if int(response['result'], 16) != config['chainId']:
            raise ValueError('WrongChain')
        return {'status': 'ready', 'simulation': True, 'trusteeIndex': index, 'publicKey': config['publicKey'], 'storage': 'authenticated encryption; separate node key'}
    except Exception:
        raise HTTPException(503, 'Trustee dependencies unavailable')


@app.get('/rounds/{round_id}/receipts/{installation_id}')
def stored_receipt(round_id: str, installation_id: str):
    # Public hashes/receipts only; no share, ciphertext or storage key leaves.
    with sqlite3.connect(database) as connection:
        row = connection.execute('SELECT ciphertext_hash,ack_tx FROM shares WHERE round_id=? AND installation_id=?', (round_id, installation_id)).fetchone()
    return {'simulation': True, 'stored': row is not None, 'acknowledged': bool(row and row[1]), 'ciphertextHash': row[0] if row else None, 'transactionHash': row[1] if row else None}


@app.post('/shares')
def receive(delivery: Delivery):
    with lock:
        try:
            validated = bridge('validateShare', config=config, **delivery.model_dump())
            nonce, box = encrypt_share(validated['share'], delivery.roundId, delivery.installationId)
            with sqlite3.connect(database) as connection:
                old = connection.execute('SELECT ciphertext_hash FROM shares WHERE round_id=? AND installation_id=?', (delivery.roundId, delivery.installationId)).fetchone()
                if old and old[0] != validated['ciphertextHash']:
                    raise ValueError('ConflictingDelivery')
                connection.execute('INSERT INTO shares(round_id,installation_id,nonce,box,ciphertext_hash) VALUES(?,?,?,?,?) ON CONFLICT(round_id,installation_id) DO UPDATE SET nonce=excluded.nonce,box=excluded.box', (delivery.roundId, delivery.installationId, nonce, box, validated['ciphertextHash']))
            receipt = bridge('acknowledge', config=config, roundId=delivery.roundId, installationId=delivery.installationId, ciphertextHash=validated['ciphertextHash'])
            with sqlite3.connect(database) as connection:
                connection.execute('UPDATE shares SET ack_tx=? WHERE round_id=? AND installation_id=?', (receipt['hash'], delivery.roundId, delivery.installationId))
            log('share_acknowledged', simulation=True, trusteeIndex=index, roundId=delivery.roundId, installationId=delivery.installationId, transactionHash=receipt['hash'])
            return {'simulation': True, 'trusteeIndex': index, 'ciphertextHash': validated['ciphertextHash'], 'receipt': receipt}
        except ValueError as error:
            raise HTTPException(409, str(error))


@app.post('/rounds/{round_id}/publish')
def publish(round_id: str, options: Publication, authorization: str = Header(default='')):
    if not hmac.compare_digest(authorization, 'Bearer ' + config['controlToken']):
        raise HTTPException(403, 'Trustee controller authorization required')
    with lock:
        try:
            snapshot = bridge('snapshot', roundId=round_id)
            if snapshot['round']['state'] != 3 or not snapshot['simulation']:
                raise ValueError('RoundNotClosing')
            if options.omitInstallationId and not config.get('enableSimulatedAttacks'):
                raise ValueError('AttackModeDisabled')
            if options.omitInstallationId and options.omitInstallationId not in [p['installationId'] for p in snapshot['plants']]:
                raise ValueError('UnknownOmittedInstallation')
            totals = dict.fromkeys(['E', 'r', 'P', 's'], 0)
            with sqlite3.connect(database) as connection:
                for plant in snapshot['plants']:
                    installation_id = plant['installationId']
                    row = connection.execute('SELECT nonce,box,ciphertext_hash,ack_tx FROM shares WHERE round_id=? AND installation_id=?', (round_id, installation_id)).fetchone()
                    if not row or not row[3] or row[2] != plant['ciphertextHashes'][index - 1]:
                        raise ValueError('IncompleteFrozenManifest')
                    share = decrypt_share(row[0], row[1], round_id, installation_id)
                    if installation_id != options.omitInstallationId:
                        for field in totals:
                            totals[field] = (totals[field] + int(share[field])) % L
            result = bridge('publish', config=config, roundId=round_id, sums={k: str(v) for k, v in totals.items()}, expectedError='AggregateMismatch' if options.omitInstallationId else None)
            log('sum_publication', simulation=True, trusteeIndex=index, roundId=round_id, transactionHash=result['receipt']['hash'], status=result['receipt']['status'])
            return result
        except (ValueError, KeyError) as error:
            raise HTTPException(409, str(error) if isinstance(error, ValueError) else 'IncompleteStoredShare')
