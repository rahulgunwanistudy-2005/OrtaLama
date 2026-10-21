SHELL := /bin/bash
.PHONY: bootstrap facts lint test test-core circuits setup-circuits test-circuits

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

test: test-core circuits test-circuits
