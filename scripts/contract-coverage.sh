#!/usr/bin/env bash
set -euo pipefail
if [[ -x .tools/foundry/bin/forge ]]; then export PATH="$PWD/.tools/foundry/bin:$PATH"; fi
mkdir -p docs/coverage
FOUNDRY_FUZZ_RUNS=64 FOUNDRY_INVARIANT_RUNS=32 forge coverage --ir-minimum --exclude-tests --report lcov --report-file docs/coverage/application.lcov
forge coverage --skip Round.t.sol --skip RoundInvariant.t.sol --skip OrtalamaRound.sol --skip BadgeRegistry.sol --skip DeployPublicTestnet.s.sol --match-contract VerifierTest --report lcov --report-file docs/coverage/verifiers.lcov
node scripts/coverage-gate.mjs docs/coverage/application.lcov docs/coverage/verifiers.lcov
