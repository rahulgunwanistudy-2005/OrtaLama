# Threat model

Scope: the implemented local protocol, report agent and browser verifier. All
current identities and data are SIMULATED. This is an engineering analysis, not
an independent audit. Executable details and source references are in
[CRYPTO_SPEC.md](CRYPTO_SPEC.md), [CONTRACTS.md](CONTRACTS.md) and
[SOURCES.md](SOURCES.md).

## Assumptions and assets

Protect individual report contents, E/P openings, blindings, polynomial slopes,
share plaintexts and signing/storage keys. Preserve the integrity of the exact
frozen cohort, public result and issued comparison records. Availability matters,
but the protocol prefers an explicit abort over an unchecked average.

The intended privacy model assumes fewer than two colluding trustees and secure
plant endpoints. The integrity model additionally relies on commitment binding,
sound circuits and Groth16 setup, authorised verifier decisions, chain execution
and the selected chain's history. Current same-host processes do not satisfy
independent institutional custody. The reviewing verifier/officer may already
know a plant report; privacy is not claimed against that authorised disclosure.

| Adversary/action | Implemented control | Residual risk |
| --- | --- | --- |
| Plant duplicates an installation or changes a round | Cohort membership, one commitment per installation, signed domains and constrained proof context | A dishonest authorised verifier can attest a different false report before commitment. |
| Plant uses modular/out-of-range inputs | Real validity proof, scalar/point checks and aggregate bounds | Soundness depends on circuit correctness and the setup. Physical truth is outside the proof. |
| Plant encrypts invalid shares | Ciphertext hashes, full-context AEAD and trustee VSS checks before acknowledgement | Missing valid shares can force abort; rejection must not falsely blame an honest trustee. |
| Trustee omits or alters a member | Frozen ordered manifest, common receipts and VSS-bound publication checks | It can withhold publication. Two complete honest publications are required for liveness. |
| Trustee signs an inconsistent sum | Actual publication reverts; a separate authenticated fault transaction records its identity | A revert cannot itself persist a fault flag. Governance still handles consequences. |
| Two trustees collude | No cryptographic prevention under a (2,3) reconstruction threshold | They reconstruct each plant. Separate organisations, key custody and oversight are prerequisites for a real pilot, not implemented guarantees. |
| Verifier or officer key compromised | Signed report/review/context bindings and allowlist | Current synthetic actors provide no real identity assurance. Production revocation, incident response and replacement-round policy must be agreed. |
| Regulator selects a biased cohort/denominator | Public parameter hashes, contributing set and declared coverage | These declarations can be incomplete or false. Coverage is not independent population evidence. |
| Indexer lies or reorganises | Replaceable PostgreSQL cache, cursor/hash reorg rebuild, direct-chain browser recomputation | Users must still trust the chosen frontend, deployment anchor and RPC. No light-client finality proof is supplied. |
| Host, browser origin or dependency compromised | Separate stores/keys, no analytics, source/asset hashes and explicit private storage | A compromised host can read keys and stores; a compromised origin can read its browser opening. Hashes served by the same compromised origin are not an independent trust root. |
| Model/prompt/report is malicious or wrong | Untrusted-text prompt boundary, strict schema, exact source grounding, deterministic checks and signed review | Source fraud and missed physical cases remain possible. See the measured failures in AI_CARD.md. |

## Leakage and composition

The aggregate discloses totals and their ratio. A coalition of the other n-1
plants can subtract its own values and recover the remaining plant's E and P.
The minimum of five is a protocol policy, not a solution to that coalition.
Comparable overlapping cohorts or repeated rounds can expose differences.
Population design, release scheduling, participant consent and review of repeat
queries are proposed governance mitigations; no global query budget is enforced.

Each issued badge reveals one bit about an exact threshold inequality; an absent
badge need not mean failure. The comparison uses exact SE/SP rather than the
rounded displayed intensity. One issue per threshold per installation per round
prevents repeated queries against that same threshold. The contract allows up to
three fixed thresholds plus the participating-cohort-average threshold (the
internal `sector_avg` identifier does not establish full-sector coverage); the current cement
round configures one fixed threshold. Thus there may be two issued comparison
bits in a current round, and up to four under the contract's configured maximum.
This is a per-round bound, not protection against cross-round binary search.

Public report hashes enable candidate-file guessing. The manual browser flow
uses a fresh private random nonce in its synthetic input digest, but that does
not make an ordinary report hash immune to guessing. Ciphertext size, timing,
installation membership, signer identity and transaction activity also leak.
Private backups deliberately contain openings. Session storage supports refresh
recovery and must be cleared when no longer needed; secure erasure is not proven.

## Classical and post-quantum position

With independent uniform blindings, Pedersen hiding and threshold-sharing secrecy
are information-theoretic under their stated disclosure model. Binding, ECDSA,
Groth16 and the underlying EVM chain are classical. Archived X25519-encrypted
shares can be decrypted by a sufficiently capable future adversary; this can
expose the share plaintexts and defeat plant privacy. Perfectly hiding public
commitments do not remove that transport risk.

An actual ML-DSA-65 co-signature is checked off-chain and its hash is authenticated
by PQLink on-chain. It does not provide on-chain ML-DSA enforcement, a post-quantum
chain, post-quantum proof soundness or post-quantum encryption. A hybrid/PQ
transport migration and retention policy need separate implementation and review.
Primitive APIs and their scope are sourced in S12–S20; using those libraries is
not an audit of application composition or every installed dependency version.

## Why this construction, and readiness limits

The chosen function is linear aggregation followed by a limited comparison.
Threshold sharing and commitments implement that function under explicit trustee
assumptions. We did not benchmark FHE and make no claim that this is categorically
faster, cheaper or more private than a threshold-FHE design. Such an alternative
would require its own key management, integrity proofs and operational analysis.

The public powers-of-tau provenance and project-specific phase-2 verification are
recorded in `circuits/ceremony/`. The project contribution was operated by one
party. If trapdoor material was retained, proof soundness can fail; there is no
independent evidence that turns this into a production multi-party ceremony.
Before real data: independent circuit/contract/composition audit, a reviewed
multi-party setup or justified alternative, independent trustee custody, endpoint
hardening, real identity/accreditation checks, recovery/rotation policy, abuse and
availability testing, privacy release policy and programme-specific MRV review.
