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

Energy, AI inference consumption, deployment gas, service resource use and
CO₂e footprint have **not been measured**. No environmental reduction figure
is inferred from execution time. Those fields must be populated only when the
corresponding services, models, chain execution and measurement methods exist.
