# Build status

Updated 2026-10-21. Only measured work is described as passing. External CI results
are separate from local results; no deployment or full-system demo is implied.

| Phase | Deliverable | Gate state |
| --- | --- | --- |
| 0 | Bible, sources, machine-readable facts, crypto specification | Local documentary/provenance PASS |
| 1 | TypeScript core, independent Python reference, reproducible H, co-signatures | Local tests and foundational CI PASS |
| 2 | Badge and commitment-validity circuits | Full local gate and expanded CI PASS |
| 3 | Contracts | Local gate PASS; expanded CI pending |
| 4–10 | Services through submission | NOT STARTED; require Phase 3 gate |

## Phase 0 report

Built BIBLE.md, CRYPTO_SPEC.md, SOURCES.md, 22 registered claims, 20 source records
and 18 saved, hashed access records. Seven registered claims are explicitly unknown;
the bible separately marks other unimplemented methodology details UNVERIFIED.
Manual review checked the numerical and legal statements against fetched source
content; the automated gate checks source references, evidence-file integrity,
status separation, mark-up arithmetic and deadline conversion.

Real: fetched laws, official announcements, price table and attributed industry
statements. Simulated: none in the research files. The reported 0.88 is not upgraded
to a verified observation. Next phase: implement and cross-check crypto.

## Phase 1 report

224 TS/Python vectors match, including zero, subgroup-order and 48-bit boundary
cases; 672 trustee-pair reconstructions per language; 16 bidirectional encryption
cases. Eleven local test groups cover random homomorphism, all trustee pairs,
VSS consistency, aggregate omission, canonical parsing, input bounds, AEAD field
tampering/context replay, and both verifier signatures. Type checking passes.
H and its derivation counter/digest are committed in packages/crypto-ts/H.json.

Real: arithmetic, encryption, signatures and independent cross-check execution.
Simulated: all fixture values and ephemeral test identities; no private fixture
keys are saved. Vector artifact is named SIMULATED and has simulation metadata.
The phase-specific raw counts are in PHASE1_RESULTS.json. [Foundational CI passed](https://github.com/rahulgunwanistudy-2005/OrtaLama/actions/runs/39610554366)
on commit 1468df7775c17c53d8f1f1b412b61cfe7bacc69a, including positive/negative circuit witnesses.
Next phase: constrain and test both circuits, verify their setup and measure proofs.

## Phase 2 working evidence

The compiler reports 3,742 constraints / 13 public inputs for below_threshold and
7,521 constraints / 14 public inputs for commitment_validity. Seven positive
witnesses and 27 rejection cases pass, including wrong openings, equality, zero
emissions, maximum values, scalar aliases, above-threshold values, zero production,
zero denominator, excessive values and replay-context changes.

The downloaded Hermez power-15 ptau matches the upstream BLAKE2b-512 checksum.
Full transcript verification passed all 55 public contributions and prepared
parameter checks. Its original ceremony power is 28; verification hashes a large
repeated-point initial transcript. The optional loader replaces only that streaming
BLAKE2b-512 implementation with native OpenSSL after cross-checking it against
Noble on boundary lengths. It removes no verification steps and records its use.
The single-thread curve cache avoids excessive worker memory use.

Both circuit-specific project contributions verified against their R1CS and the
public ptau. Both generated real Groth16 proofs verify in Node and Chrome; all
27 individual Node public-input mutations and both browser mutations fail.
Node proving took 1.698 s / 2.838 s; Chrome took 1.690 s / 3.330 s for badge /
commitment validity respectively, as individual local observations. See
[FOOTPRINT.md](FOOTPRINT.md) and [PHASE2_GATE.json](PHASE2_GATE.json).

Real: ceremony verification, actual proof generation/verification, constraint
failures and generated Solidity verifiers. Simulated: proving inputs and test
identity/context values. Earlier interrupted memory-pressure attempts are not
counted as passes. No on-chain badge claim is permitted. Expanded CI now adds real
proof generation using fresh test-only contributions. [Expanded CI passed](https://github.com/rahulgunwanistudy-2005/OrtaLama/actions/runs/39612175418)
on commit 17ead3fca26e85df796a564bce297e30688f60ac. Next phase:
round lifecycle, curve checks, registry and adversarial contract tests.

## Phase 3 local report

28 contract test groups passed, including three fuzz tests with 256 cases each,
a 64-run × 32-call stateful invariant and 224 independent Python arithmetic
vectors. All 31 application custom errors have executed selector assertions.
Every positive proof uses the actual generated Groth16 verifiers. Line coverage
is 456/464 (98.276%) across all five executable source files, including generated
verifiers; both raw compiler-mode reports and the combination method are saved.

Slither reports 135 findings, all individually classified with zero unreviewed.
The six raw high warnings are intentional early false returns in exact generated
snarkjs code, not accepted application high findings. The three medium warnings
ignore an ECDSA diagnostic argument while checking its error enum and signer.
The reviewed source hashes and maximum finding counts enforce re-review after
changes. This is not an independent security audit or a claim of zero raw findings.

Local optimized gas snapshots measured 912,888 for subgroup validation plus
scalar multiplication and 1,988,912 for the isolated 12-plant close. Real: proofs,
EVM arithmetic, signatures and verification. SIMULATED: all plant values,
identities, keys and round denominator. See [CONTRACTS.md](CONTRACTS.md) and
[PHASE3_GATE.json](PHASE3_GATE.json). Expanded CI must pass before Phase 4 begins.

## Dependencies and tools

Exact npm versions are locked; Python versions are pinned in requirements.txt.
The Phase 3 refreshed installation scan reported 15 low-severity and four
moderate-severity advisories, with zero high/critical advisories. The four moderate
package paths lead to uuid's optional-buffer bounds issue in v3/v5/v6, through the
development Merkle-tree tooling; project leaves use ABI encoding and Keccak,
not these UUID APIs. This is a reachability review, not removal of the advisory.
WebSocket and Underscore overrides apply patched
versions; npm may label the deliberately overridden upstream exact WebSocket pin
as invalid in `npm ls`. This is not an audit-clean claim. Remaining Elliptic-related
transitive advisories come through circomlibjs/Ethers; project signing uses viem
and Noble instead. Production reachability and audit scope remain to be reviewed.

engineering-workflow and project-quality-audit were searched for and not found in
the installed skill directories. The user authorised the documented test gates
and judge-panel review as the final audit substitute, with a reminder to supply
the proper skill source at that point. No substitute is misrepresented as those
skills. frontend-design has not been used because product UI work has not started.

## Protocol changes required by review

Blinded slope commitments and signed receipts are required for defensible trustee
fault attribution; input-validity proofs prevent modular-value abuse; constrained
context hashes bind proof replay domains. Installation IDs must use two 128-bit
limbs in circuits, preserving every bit of a bytes32 identity. Round/chain IDs are
64-bit and addresses 160-bit in the circuit interface; contracts must enforce the
same bounds. A revert and a persistent abort require distinct transactions.
