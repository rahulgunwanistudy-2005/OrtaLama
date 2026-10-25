"""Service boundaries deliberately avoid logging plaintext shares or keys."""
import json
import os
import subprocess
from pathlib import Path


def read_json(path):
    return json.loads(Path(path).read_text())


def bridge(action, **arguments):
    result = subprocess.run(
        ['node', '--import', 'tsx', 'services/bridge.ts'],
        input=json.dumps({'action': action, **arguments}),
        capture_output=True, text=True, timeout=120, check=False,
    )
    if result.returncode:
        # The bridge emits only a bounded error code, never RPC/private payloads.
        code = result.stderr.strip()
        raise ValueError(code if code.isidentifier() else 'BridgeOperationFailed')
    return json.loads(result.stdout)


def log(event, **public_fields):
    print(json.dumps({'event': event, **public_fields}), flush=True)


def deployment():
    return read_json(os.getenv('ORTALAMA_DEPLOYMENT', '.runtime/SIMULATED_deployment.json'))
