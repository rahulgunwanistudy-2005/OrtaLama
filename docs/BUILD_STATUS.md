# Build status

Updated 2026-10-26 (Asia/Kolkata). The full local system and actual Monad
protocol gate pass. The read-only public verification site is hosted on Render
at https://ortalama.onrender.com and the workflow runs in GitHub Actions.

Actual Monad chain 10143: all four contracts have exact source matches, two
five-plant rounds closed, a qualifying badge issued, and all six required attacks
mined as reverted. Desktop/mobile browser recomputation and corrupted-sidecar
rejection passed. See [MONAD_TESTNET.md](MONAD_TESTNET.md) and
[DEPLOYMENT_HANDOFF.md](DEPLOYMENT_HANDOFF.md). Physical-phone measurement and
the final public-phone video remain owner delivery steps.

| Phase | Deliverable | Gate state |
| --- | --- | --- |
| 0 | Bible, sources, machine-readable facts, crypto specification | Local documentary/provenance PASS |
| 1 | TypeScript core, independent Python reference, reproducible H, co-signatures | Local tests and foundational CI PASS |
| 2 | Badge and commitment-validity circuits | Full local gate and expanded CI PASS |
| 3 | Contracts | Full local and expanded CI PASS |
| 4 | Services and CLI round | Local PASS; remote CI in GitHub Actions |
| 5 | Report extraction, deterministic physics and review | Local PASS; new remote CI pending |
| 6 | Product UI and browser live round | Local PASS; new remote CI pending |
| 7 | Alignment and reproducible dossier | Local PASS |
| 8 | Public testnet, hosting, explorer and physical phone | Actual Monad protocol/source/browser PASS; Render hosting live; physical phone pending |
| 9 | Six cold reviewer clusters and hardening | Local review PASS; Monad transaction/recovery changes rechecked; full hosted-system audit pending |
| 10 | Submission materials | Actual Monad 20s GIF, narrated/subtitled 3:50 engineering walkthrough, screenshots, dossier and submission draft ready; owner public-phone recording/publication pending |

## Phase 0 report

Built BIBLE.md, CRYPTO_SPEC.md, SOURCES.md and 22 registered claims. The current
expanded registry has 37 source records and 37 saved, hashed access records.
Six registered claims remain explicitly unknown;
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
counted as passes. At that phase no badge had been issued; the later Monad gate records an actual
issued badge. Expanded foundation CI added real
proof generation using fresh test-only contributions. [Expanded CI passed](https://github.com/rahulgunwanistudy-2005/OrtaLama/actions/runs/39612175418)
on commit 17ead3fca26e85df796a564bce297e30688f60ac. Next phase:
round lifecycle, curve checks, registry and adversarial contract tests.

## Phase 3 local report

28 contract test groups passed, including three fuzz tests with 256 cases each,
a 64-run × 32-call stateful invariant and 224 independent Python arithmetic
vectors freshly recomputed through Foundry FFI. All 31 application custom errors have executed selector assertions.
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
[PHASE3_GATE.json](PHASE3_GATE.json). [Expanded CI passed](https://github.com/rahulgunwanistudy-2005/OrtaLama/actions/runs/39644421007)
on eb1bf2bfe42502473cd6a034e10e9f0c8a7d399f, including the exact published
verifier bundle. Next phase: independently keyed FastAPI trustees, PostgreSQL event
indexer, plant CLI and six mined reverting attack transactions.

## Dependencies and tools

The current provenance gate checks 22 claims, 37 source records and 37 hashed
access records, with six explicit unknowns. The additional sources support
deterministic validation: IPCC manufacturing fuel factors, clinker-methodology
caveats, scoped EU BAT energy levels, NIST molecular weights and local model
documentation. Actual synthetic-report evaluation is separately recorded in AI_CARD.md.

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
skills. The local frontend-design skill and the installed Anthropic frontend-design skill have now guided the product UI; see apps/web/DESIGN.md.

## Protocol changes required by review

Blinded slope commitments and signed receipts are required for defensible trustee
fault attribution; input-validity proofs prevent modular-value abuse; constrained
context hashes bind proof replay domains. Installation IDs must use two 128-bit
limbs in circuits, preserving every bit of a bytes32 identity. Round/chain IDs are
64-bit and addresses 160-bit in the circuit interface; contracts must enforce the
same bounds. A revert and a persistent abort require distinct transactions.

## Phase 6 local report

Five separate browser contexts generated real proofs and committed private inputs.
The round closed with aggregate E=4,500 kg and P=5,000 kg, intensity 900,000 ppm
and declared-denominator coverage 800,000 ppm. Another mobile-sized context fetched
chain data and independently checked the frozen manifest, curve/VSS sums, aggregate
openings, result and all five ECDSA/ML-DSA co-signatures. A qualifying plant issued
a real badge; the above-average witness failed. Public request-body inspection
found no private opening, E/P, blinding, slope or share plaintext fields.

All six attack-console buttons submitted fresh transactions that mined as reverted
with the exact expected errors. Fault attribution and small-cohort abort were
separate successful transactions. The actual issued badge, round and all role
pages passed 56 English/Turkish desktop/mobile WCAG checks with no recorded
violations or overflow. Mobile Lighthouse observations were 98 performance / 100
accessibility on the landing page and 99 / 100 on the real verify page. These are
headless local observations, not physical-phone or production measurements.

The final round-8 browser run also recovered three deliberately lost responses:
broadcast after mining, public co-signature upload and trustee acknowledgement.
It finished in 247.64 seconds with no page errors or private fields on public
requests. A separate report-agent API integration recovered a mined commitment
whose response had not been saved in the job, then delivered all three shares.
Mismatched country, product and reporting year were rejected. Final mobile
Lighthouse observations remain 98/100 and 99/100 for performance/accessibility.

See PHASE6_GATE.json and its linked raw evidence. A source/dependency clean copy
completed bootstrap, model download and the full seeded service/storage/database
gate on this host. Host OS prerequisites were preinstalled; this is not a
bare-machine test. The current checkout's literal `make demo` entrypoint also
passed with the realistic 12-report dataset at 882,153 ppm. The later Linux arm64 Docker retry also completed the real CLI/storage/recovery
gates and independent host-browser verification; public runtime archives were
cached and source refreshed during retry. See SIMULATED_CONTAINER_RESULTS.json
for tested source hashes and scope. The initial failed attempt is not counted
as a pass. No new code has been committed or pushed.

## Phase 7 local report

Alignment documents now distinguish scope mapping from ISO conformance, correct
the ISO 14065 designation and TR-ETS decision/announcement/approval dates, and
describe the CBAM/TR-ETS methodology gaps. The pilot plan follows all eight
concept-note fields and explicitly has no agreed partners, financing or start.

The final 12-report public dossier independently reproduces 57 successful
transaction records. Its JSON and PDF match one pinned block/digest, reproduce
deterministically under the recorded build and reject 14 tampering/anchor/privacy
cases. Actual HTTP downloads reject a changed digest and invalid block/round IDs.
The six-page PDF and architecture diagram were visually inspected. Source hashes,
public-only export scope, trust inputs and offline-vs-online status are explicit.
See PHASE7_GATE.json, DOSSIER.md and SIMULATED_DOSSIER_RESULTS.json.

## Hardening and delivery

Six separate cold reviewer agents covered cryptography, security, standards,
AI/ethics, Türkiye/regulation and practicality/blockchain risk. They are simulated
review roles, not actual judges or independent professional auditors. Serious
findings were fixed and rechecked, including response recovery and cohort badge
wording. The Monad adapter additionally serialises role writes, journals exact
signed bytes before sending, enforces a project test-fund cap, and settles only
after six confirmations. Gas-limit charging, credential-free public RPC export,
log paging and cached-receipt recovery were rechecked. Current transaction and
pagination unit tests, root/web type checks, 28 contract groups, the reviewed
135-finding Slither baseline and real indexer recovery regression passed.

Actual Monad round 2 uses five plants, E=2,079,159,525 kg and P=2,450,000,000 kg,
intensity 848,636 ppm. Coverage against the synthetic declared denominator is
266,666 ppm; the representative policy flag is false. Round 3 independently
closed with five plants for the distinct-round replay test. Round 4's one-plant
cohort failed the five-plant minimum and was separately aborted. The earlier
interrupted twelve-plant round 1 expired and was aborted rather than bypassing
its deadline. Public minimum-cohort testing is one-versus-five; the four-plant
boundary remains covered by local tests. All six public attacks reverted with
checked named errors; fault attribution was a separate successful transaction.

The original local dossiers/coverage/performance records remain historical
observations under their recorded build. The matching Monad dossiers and public
hosting bundle are the current delivery artifacts. Public hosting and physical
phone testing are owner tasks. New remote CI is not claimed. The later Docker source-bootstrap and browser
verification passed within the documented cached-download/retry scope. Same-host simulated custody is not institutional custody.

The requested project-quality-audit skill is still unavailable. The user approved
documented gates plus the six-cluster review as a substitute. Supply the proper
skill source before a future audit; this record does not claim that skill ran.

The exact read-only export passed 36 EN/TR desktop/mobile accessibility checks,
actual browser verification, badge, six RPC receipt checks and matching dossier
downloads, with no page errors or horizontal overflow. Its isolated tampered
signature case failed as required. Mobile Lighthouse observations are 96/100
and 99/100 for performance/accessibility in the refreshed public bundle. A labelled 230-second engineering
walkthrough with computer-generated narration and subtitles, plus a 20-second
actual-close/receipt-recheck preview, accompanies the handoff. These are localhost
website captures of deployed Monad evidence, not physical-phone/public-host results.


## Fresh full functional re-audit

See [FUNCTIONAL_REAUDIT.md](FUNCTIONAL_REAUDIT.md) and
[FINAL_FUNCTIONAL_AUDIT.json](FINAL_FUNCTIONAL_AUDIT.json). Fresh core and full
product gates passed, followed by targeted fixes and separate real report-editor,
reorganization, populated accessibility and public-export checks. The original
full product run and later targeted runs have distinct scopes and build hashes;
no single all-in-one rerun is inferred. The final security re-review reported no
unresolved serious findings in its scoped changes. No additional Monad
transactions were sent. Physical-phone checks and submission remain outstanding.
