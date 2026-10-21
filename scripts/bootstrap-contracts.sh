#!/usr/bin/env bash
set -euo pipefail
if [[ -x .tools/foundry/bin/forge ]]; then export PATH="$PWD/.tools/foundry/bin:$PATH"; fi
forge --version | head -1 | grep -F '1.8.5' >/dev/null || { echo 'Install official Foundry v1.8.5; see docs/CONTRACTS.md' >&2; exit 1; }
if [[ ! -f lib/forge-std/src/Test.sol ]]; then
  forge install foundry-rs/forge-std@b013eff2ac4fce26f34d789e6f5c49021c5ee817 --no-git
fi
