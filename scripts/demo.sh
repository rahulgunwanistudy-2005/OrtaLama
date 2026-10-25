#!/usr/bin/env bash
set -euo pipefail
# Prefer the host runtime when its explicit prerequisites are available.
if command -v node >/dev/null && command -v python3 >/dev/null && python3 scripts/bootstrap-demo.py --check; then
  exec make demo-host
fi
if command -v docker >/dev/null && docker compose version >/dev/null; then
  echo 'Starting the isolated local demo container; first build and model download take time.'
  exec docker compose -p ortalama-v2-local up --build
fi
echo 'Install the prerequisites in docs/LOCAL_DEMO.md or Docker with Compose, then run make demo.' >&2
exit 1
