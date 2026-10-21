#!/usr/bin/env bash
set -euo pipefail
if [[ -x .tools/foundry/bin/forge ]]; then export PATH="$PWD/.tools/foundry/bin:$PATH"; fi
source .tools/audit-venv/bin/activate
mkdir -p .tools/reports
rm -f .tools/reports/slither.json
python -m slither . --compile-force-framework foundry --exclude-dependencies --filter-paths 'lib/|node_modules/' --fail-none --json .tools/reports/slither.json
node scripts/review-slither.mjs .tools/reports/slither.json
