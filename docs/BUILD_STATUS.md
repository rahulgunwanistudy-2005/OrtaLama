# Build status

Updated 2026-10-21. Only measured work is described as passing. External CI results
are separate from local results; no deployment or full-system demo is implied.

| Phase | Deliverable | Gate state |
| --- | --- | --- |
| 0 | Bible, sources, machine-readable facts, crypto specification | Local documentary/provenance PASS |
| 1 | TypeScript core, independent Python reference, reproducible H, co-signatures | Local tests and foundational CI PASS |
| 2 | Badge and commitment-validity circuits | Local full gate PASS; expanded CI pending |
| 3–10 | Contracts through submission | NOT STARTED; do not advance across the Phase 2 gate |

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
proof generation using fresh test-only contributions. Next phase after CI passes:
round lifecycle, curve checks, registry and adversarial contract tests.

## Dependencies and tools

Exact npm versions are locked; Python versions are pinned in requirements.txt.
The latest refreshed installation scan reported 15 low-severity advisories and
zero high/moderate advisories. WebSocket and Underscore overrides apply patched
versions; npm may label the deliberately overridden upstream exact WebSocket pin
as invalid in `npm ls`. This is not an audit-clean claim. Remaining Elliptic-related
transitive advisories come through circomlibjs/Ethers; project signing uses viem
and Noble instead. Production reachability and audit scope remain to be reviewed.

engineering-workflow and project-quality-audit were searched for and not found in
the installed skill directories. No substitute audit is misrepresented as those
skills. frontend-design has not been used because product UI work has not started.

## Protocol changes required by review

Blinded slope commitments and signed receipts are required for defensible trustee
fault attribution; input-validity proofs prevent modular-value abuse; constrained
context hashes bind proof replay domains. Installation IDs must use two 128-bit
limbs in circuits, preserving every bit of a bytes32 identity. Round/chain IDs are
64-bit and addresses 160-bit in the circuit interface; contracts must enforce the
same bounds. A revert and a persistent abort require distinct transactions.
