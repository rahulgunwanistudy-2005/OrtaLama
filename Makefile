SHELL := /bin/bash
.PHONY: bootstrap facts lint test test-core circuits setup-circuits test-circuits bootstrap-contracts test-contracts coverage-contracts analyze-contracts
export PATH := $(CURDIR)/.tools/foundry/bin:$(PATH)

bootstrap:
	npm ci --ignore-scripts
	python3 -m venv .venv
	.venv/bin/python -m pip install -r packages/crypto-py/requirements.txt

facts:
	npm run check:facts

lint:
	npm run typecheck
	.venv/bin/python -m py_compile packages/crypto-py/reference.py

test-core:
	npm run test:phase1

circuits:
	node scripts/build-circuits.mjs

setup-circuits: circuits
	node scripts/fetch-ptau.mjs
	node --import ./scripts/native-blake2-loader.mjs scripts/verify-ptau.mjs
	node scripts/setup-circuits.mjs

test-circuits: public-keys
	node --import tsx --test circuits/test/circuits.test.mjs

bootstrap-contracts:
	bash scripts/bootstrap-contracts.sh

test-contracts: public-keys
	node scripts/assert-generated-verifiers.mjs
	mkdir -p .tools/reports
	forge test --json > .tools/reports/contracts.json
	node scripts/contract-results.mjs .tools/reports/contracts.json

coverage-contracts:
	bash scripts/contract-coverage.sh

analyze-contracts:
	bash scripts/analyze-contracts.sh

test: test-core circuits public-keys test-circuits test-contracts

bootstrap-services:
	python3 -m venv .tools/service-venv
	.tools/service-venv/bin/python -m pip install -r services/requirements.txt

e2e-cli:
	.tools/service-venv/bin/python scripts/run-services.py

reports:
	PYTHONPATH=. .tools/service-venv/bin/python scripts/generate-reports.py

test-agent:
	node --import tsx scripts/test-agent.ts

evaluate-ai:
	PYTHONPATH=. .tools/service-venv/bin/python scripts/evaluate-ai.py

.PHONY: public-keys bootstrap-demo build-web web demo demo-host e2e
public-keys:
	node scripts/restore-public-keys.mjs

bootstrap-demo:
	python3 scripts/bootstrap-demo.py

build-web:
	node scripts/prepare-web.mjs
	npm exec tsc -- -p apps/web/tsconfig.json --noEmit
	VITE_PUBLIC_EVIDENCE=0 npm run build -w @ortalama/web

web: build-web
	.tools/service-venv/bin/python scripts/run-services.py --scenario cli --web --keep

demo:
	bash scripts/demo.sh

demo-host: bootstrap-demo
	.tools/service-venv/bin/python scripts/run-services.py --scenario cli --web --model --keep

e2e: e2e-cli

.PHONY: deploy-testnet test-product
deploy-testnet:
	node --import tsx scripts/deploy-testnet.ts $(ARGS)

test-product:
	.venv/bin/python scripts/run-local-gates.py $(if $(CHROME_PATH),--chrome "$(CHROME_PATH)",)

.PHONY: test-testnet run-testnet package-testnet preview-testnet
test-testnet:
	node --import tsx --test scripts/test-testnet-transactions.ts scripts/test-public-chain.ts

run-testnet:
	python3 scripts/run-testnet.py $(ARGS)

package-testnet:
	node --import tsx scripts/package-testnet.ts $(ARGS)

preview-testnet:
	python3 scripts/serve-testnet.py $(ARGS)
