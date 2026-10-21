# Ortalama

Verifiable sector emissions averages from confidential, verifier-attested plant inputs.

**Engineering prototype in progress. No public demo, testnet deployment, real plant
measurement, regulatory acceptance or production security claim yet.**

For Türkiye grey clinker, the EU defaults annex lists **1.551 tCO₂e/t including the
2026 mark-up**, versus **0.88 tCO₂/t reported by TURKCIMENTO for member declarations**.
Their full accounting-boundary comparability is UNVERIFIED. The association's
approximately **€20/€80 per tonne** comparison is a historical estimate, not a current
liability calculated by this project.
[EU annex](https://eur-lex.europa.eu/eli/reg_impl/2025/2621/oj/eng),
[association statement](https://www.eqs-news.com/news/media/turkcimento-calls-for-eu-aligned-mrv-data-recognition-under-cbam/347f954a-8081-4308-b01a-445e526ef6da_en).

- The intended ledger checks that published sums open exactly the registered commitments.
- It cannot establish report truth, accreditation, complete coverage or regulatory acceptance.
- AI will propose cited report fields at the plant boundary; deterministic checks and humans authorise sealing.

## What runs today

The TypeScript crypto package implements Baby Jubjub Pedersen commitments,
reproducible independent generator derivation, threshold sharing with blinded
slope commitments, authenticated encryption and EIP-712/ML-DSA co-signatures.
The independent Python reference cross-checks **224** synthetic vectors and
**16** bidirectional encrypted messages. These are real computations, with
SIMULATED test data; no verifier or trustee organisation has joined the project.

Two real Circom circuits constrain commitment validity and an at-or-below-threshold
badge. Their contributed setups verify and real proofs pass locally in Node and
Chrome, with adversarial witness and public-input tests. Detailed gate status,
proof timings and deployment status must be read from the current
[build status](docs/BUILD_STATUS.md), not inferred from the presence of circuit files.

Contracts now execute a complete 12-plant synthetic round, authenticated trustee
receipts/publications, aggregate opening checks and non-transferable threshold
badges in real EVM tests. The local contract gate has 28 passing test groups,
31 custom errors asserted, 224 Python differential vectors and 98.28% line
coverage. Static-analysis acceptances and exact reproduction commands are in
[the contract gate notes](docs/CONTRACTS.md); CI status is tracked separately.

## Run the completed foundation

Prerequisites: Node.js 24+, npm 11+, Python 3.11+, Make and public registry access.

```sh
make bootstrap
make test-core
make circuits
```

The full implemented test target additionally requires the verified public ptau
file and locally generated contributed circuit keys:

```sh
make setup-circuits
make test
```

`make demo`, ledger services, the web application and testnet deployment are not
implemented. There is no substitute script pretending to be the complete demo.
Large public proving artifacts are ignored by Git; their source, hashes and setup
commands belong in `circuits/ceremony/README.md` as the ceremony gate completes.

## Read before making claims

[Project bible](docs/BIBLE.md) · [Crypto specification](docs/CRYPTO_SPEC.md) ·
[Sources](docs/SOURCES.md) · [Build status](docs/BUILD_STATUS.md)

Pedersen hiding does not make the whole stack post-quantum secure. Archived X25519
encrypted shares are a harvest-now/decrypt-later risk. Two trustees can reconstruct
individuals; aggregate subtraction and overlapping cohorts leak information.
The minimum cohort is a policy control, not a guarantee against these coalitions.

This code has not been independently audited. Python curve arithmetic is an
independent variable-time test oracle and must never process real plant secrets.
Current dependency advisories and pending gates are tracked in the build status.
