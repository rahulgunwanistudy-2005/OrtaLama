# Contract gate and reproducibility

The contracts execute real Groth16 verification and Baby Jubjub checks. Test inputs,
plant identities, verifier identities and trustees are **SIMULATED**. No mock
verifier is accepted: each protocol constructor checks the generated verifier's
runtime code hash. This is an engineering review, not an independent audit.

Toolchain: Foundry **v1.8.5** (commit
`51a52c59cffd940f76eddd0b4bb1791aa4b5ac7f`), Solidity **0.8.30**, Cancun,
optimizer 200 runs, via-IR. Forge standard library is pinned to
`b013eff2ac4fce26f34d789e6f5c49021c5ee817`; dependencies are downloaded without
creating nested Git repositories. OpenZeppelin 5.6.1 is locked by npm.
Install Foundry using its [official installation instructions](https://getfoundry.sh/introduction/installation/),
selecting v1.8.5. The installed release attestations were checked by foundryup.

After `make bootstrap` and `make setup-circuits`:

```sh
make bootstrap-contracts
make test-contracts
make coverage-contracts
python3 -m venv .tools/audit-venv
.tools/audit-venv/bin/python -m pip install -r requirements-audit.txt
make analyze-contracts
```

The audit environment is separate because its Web3 dependency pins differ from
the independent Python cryptography oracle. Never install it over `.venv`.
The [official CI action](https://github.com/foundry-rs/foundry-toolchain/tree/v1)
installs the exact Foundry release; CI generates fresh demonstration contributions
and verifier sources together before running proofs and contract tests.

`PHASE3_CONTRACT_TESTS.json` records executed test groups, custom-error selector
assertions and source hashes. Arithmetic is compared against 224 independent
Python vectors. Randomized tests cover homomorphism, inverses and cohort/pair
choices; a stateful invariant handler tracks actual committed plants and rejects
incorrect publications before accepting a close. Three trustee pairs are tested.

Coverage uses two real execution passes on the same sources: via-IR minimum
optimization for application contracts, and legacy compilation for generated
verifiers. Via-IR loses assembly source-map anchors in the generated Yul, while
legacy compilation cannot compile the application without stack-depth errors.
`scripts/coverage-gate.mjs` combines those records, includes every executable
`contracts/src` file, and requires at least 90% overall line coverage. Both raw
LCOV files and the per-file calculation are retained under `docs/coverage`.
Coverage instrumentation disables production optimization; gas budgets apply in
ordinary tests and are deliberately skipped only in the coverage context.

Slither's raw findings are **not zero**. `PHASE3_STATIC_ANALYSIS.json` retains
each finding and its accepted rationale. `SLITHER_REVIEW_POLICY.json` pins reviewed
application hashes, allowed finding classes and maximum counts. New application
changes or unreviewed findings fail the analysis gate. In particular, the six
high-severity `incorrect-return` warnings are the unmodified snarkjs verifier's
intentional early ABI-false returns. Actual positive/negative verifier tests and
an exact comparison with the active proving keys and pinned snarkjs template are
mandatory; this acceptance is not applied to application high-severity findings.
The three medium warnings discard only ECDSA recovery's diagnostic argument,
while checking both the error enum and signer. Timestamp deadlines accept coarse
block-time tolerance. Other informational findings and residual maintenance
risks are explained individually in the machine-readable review.

Gas observations are local EVM execution on synthetic inputs, not currency costs
or testnet deployment measurements. The optimized ordinary run measured
**912,888 gas** for subgroup validation plus scalar multiplication and
**1,988,912 gas** for closing a 12-plant round. The latter snapshot surrounds only
`close`, after commitments, receipts and publications. The former includes an
external harness call and subgroup validation. Named raw snapshots are in
`docs/gas`; neither value is represented as a bare curve operation or full round
transaction total. Production chain gas schedules and limits must be checked
before deployment.

Every publication is checked against the aggregate blinded slope commitments.
An invalid sum reverts with its trustee index and cannot persist a fault flag.
A separate successful `recordFault` transaction authenticates the trustee's
signed bad sum and stores blame. Small-cohort failure similarly needs a separate
`abort` transaction. Badge equality is permitted, so the correct label is
**at or below**, rather than strictly below. Badges are records without transfer
functions; no token standard, asset custody, proxy or upgrade authority exists.

Remaining stages include networked trustee custody, event indexing, report
validation, the browser verifier and testnet operations. Same-host synthetic
tests do not establish independent trustee custody or report truth.
