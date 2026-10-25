# Measured proof footprint

Measured locally on 2026-10-21 using real Groth16 proofs on explicitly SIMULATED
fixtures. These are single observations on the development machine, not a
controlled benchmark, median, production SLA, phone measurement or energy estimate.

| Circuit | Constraints | Public inputs | Node prove | Chrome prove |
| --- | ---: | ---: | ---: | ---: |
| below_threshold | 3,742 | 13 | 1.698 s | 1.690 s |
| commitment_validity | 7,521 | 14 | 2.838 s | 3.329 s |

Compiler: Circom 2.2.3 via circom2 0.2.23, optimisation O2; circomlib 2.0.5;
snarkjs 0.7.6. Browser version: 155.0.8059.85. Proving includes witness
generation. Chrome fullProve includes loopback retrieval of WASM/key files;
Node reads them locally. Both use the library's single-thread prover. No
verification or proof-generation step was replaced by a mock.

Raw measurements: [Node](PHASE2_RESULTS.json), [browser](SIMULATED_BROWSER_PROOF_RESULTS.json).
The [gate record](PHASE2_GATE.json) records passed/rejected cases and exact artifact
hashes; [ceremony records](../circuits/ceremony/README.md) document provenance and
its single-operator project contribution. A proof being valid does not mean its
underlying report is true or that the system has been independently audited.

Energy, service resource use and CO₂e footprint have **not been measured**.
Proof times, model tokens and selected transaction gas observations are recorded separately. No environmental reduction figure
is inferred from execution time. Those fields must be populated only when the
corresponding services, models, chain execution and measurement methods exist.

## Local model observation (2026-10-22)

Twenty actual Qwen2.5 1.5B Q4_K_M calls on SIMULATED PDFs used 28,990 prompt
tokens and 7,175 output tokens. Recorded call times sum to 524.016 seconds;
the original evaluation wall time was 525.246 seconds. The model blob bundle
reported by the local runtime is 986,061,892 bytes. Calibration and integration
calls are additional and are not included in those dataset totals. See
[the AI card](AI_CARD.md) for the model digest, settings, raw evidence and limits.
Cached re-scoring is not a new inference benchmark. Energy, power draw, service
carbon intensity and lifecycle CO2e remain unmeasured; tokens and time are not
converted into an environmental benefit claim.

## Actual Monad observations (2026-10-24)

The completed public testnet gate records actual transaction receipts in
[SIMULATED_MONAD_ROUND_RESULTS.json](SIMULATED_MONAD_ROUND_RESULTS.json).
For round 2, the gas limits were 2,913,262 and 2,914,674 for the honest trustee publications,
1,943,962 for closing, and 1,625,024 for the qualifying badge. These are selected
observations under the recorded bytecode and network, not production estimates.
Monad charges the signed gas limit. Ethereum execution-gas refund assumptions
were not used in project fee settlement.

The full session's conservative allocation is 15.981939114 test MON, including
superseded deployments, the interrupted cohort and internal role-funding
transfers. It is not the marginal gas cost of a single round or a fiat expense.
The two closed public cohorts have five plants each; the twelve-plant local
results must not be presented as a completed twelve-plant Monad cohort.
Test MON allocation, gas and execution time do not measure energy or CO₂e.
