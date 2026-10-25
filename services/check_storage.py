"""Inspect real local trustee stores without exporting any secret share values."""
import json
import os
import sqlite3
from pathlib import Path
from Crypto.Cipher import ChaCha20_Poly1305

root = Path(os.getenv('ORTALAMA_RUNTIME', '.runtime'))
configs = [json.loads((root / f'SIMULATED_trustee_{i}_secret.json').read_text()) for i in [1, 2, 3]]
assert len({c['storageKey'] for c in configs}) == 3
assert len({c['secretKey'] for c in configs}) == 3
assert len({c['signingKey'] for c in configs}) == 3
rows_checked = 0
tamper_rejections = 0
cross_node_rejections = 0
for cfg in configs:
    path = root / f"trustee-{cfg['index']}" / f"SIMULATED_trustee_{cfg['index']}_{cfg['instanceId']}.sqlite3"
    with sqlite3.connect(path) as connection:
        rows = connection.execute('SELECT round_id,installation_id,nonce,box,ack_tx FROM shares').fetchall()
    for round_id, installation_id, nonce, box, ack_tx in rows:
        assert ack_tx and len(ack_tx) == 66
        aad = json.dumps(['ORTALAMA_AT_REST_v1', cfg['chainId'], cfg['deployment'], cfg['index'], round_id, installation_id], separators=(',', ':')).encode()

        def open_box(key, payload):
            cipher = ChaCha20_Poly1305.new(key=bytes.fromhex(key), nonce=nonce)
            cipher.update(aad)
            return cipher.decrypt_and_verify(payload[:-16], payload[-16:])

        clear = open_box(cfg['storageKey'], box)
        share = json.loads(clear)
        assert share['index'] == cfg['index']
        assert clear not in path.read_bytes()
        altered = bytearray(box)
        altered[-1] ^= 1
        try:
            open_box(cfg['storageKey'], bytes(altered))
            raise AssertionError('Stored-share tampering accepted')
        except ValueError:
            tamper_rejections += 1
        other_key = configs[cfg['index'] % 3]['storageKey']
        try:
            open_box(other_key, box)
            raise AssertionError('Another node storage key decrypted this share')
        except ValueError:
            cross_node_rejections += 1
        rows_checked += 1
assert rows_checked >= 36
result = {'simulation': True, 'status': 'PASS', 'separateSigningKeys': 3, 'separateEncryptionKeys': 3, 'separateStorageKeys': 3, 'encryptedRowsChecked': rows_checked, 'modifiedCiphertextsRejected': tamper_rejections, 'crossNodeStorageKeysRejected': cross_node_rejections, 'plaintextRecordsPersisted': 0}
(root / 'SIMULATED_storage_check.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
