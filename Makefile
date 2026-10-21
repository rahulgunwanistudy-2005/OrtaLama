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

test-circuits:
	node --import tsx --test circuits/test/circuits.test.mjs

bootstrap-contracts:
	bash scripts/bootstrap-contracts.sh

test-contracts:
	node scripts/assert-generated-verifiers.mjs
	mkdir -p .tools/reports
	forge test --json > .tools/reports/contracts.json
	node scripts/contract-results.mjs .tools/reports/contracts.json

coverage-contracts:
	bash scripts/contract-coverage.sh

analyze-contracts:
	bash scripts/analyze-contracts.sh

test: test-core circuits test-circuits test-contracts
