# Plant agent AI card

The model proposes report tokens and citations. Deterministic code reads the
number from the cited PDF text, checks units and physical consistency, and blocks
unmatched or impossible input. An officer must explicitly sign before the verifier
co-signs and the plant commits. No model output is directly a commitment input.

## Model and data handling

The measured model is local **Qwen2.5 1.5B Q4_K_M**, run through Ollama 0.40.7,
with an 8,192-token requested context, temperature 0 and seed 42. The actual model
digest is `65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b`.
The model is advertised under Apache 2.0; the runtime archive was checked against
the upstream SHA-256 release digest. [Model source](https://ollama.com/library/qwen2.5:1.5b),
[structured-output API](https://docs.ollama.com/capabilities/structured-outputs),
[runtime release](https://github.com/ollama/ollama/releases/tag/v0.40.7).

The local runtime binds loopback, stores models in the project's ignored tools
directory and runs with cloud features disabled. The provider abstraction also
implements a JSON-schema chat adapter, but hosted/remote inference is restricted
to hashes of the project's generated SIMULATED dataset. It is never allowed on
an arbitrary uploaded or real report. The current demo API accepts only explicitly
SIMULATED PDFs; this is not a production document-ingestion service.

Reports, jobs, corrections, review packets and opening values stay in private
ignored runtime files. Plant job access requires a random capability token.
Private job capabilities and report content must never enter a public dossier.
The public ledger receives commitments, report/metadata hashes, verifier signatures
and public protocol data. Hashes can still support document-guessing attacks.

## Intended and prohibited use

Intended: assist an officer in transcribing supported Turkish grey-clinker reports
within an explicitly declared direct fossil/process CO2 boundary. This prototype
supports text PDFs with a narrow field vocabulary and stated NCV fuel-energy
quantities. It does not OCR scanned PDFs or establish report authenticity.

Prohibited: automatic regulatory submission, autonomous approval, accreditation
claims, unsupported production/accounting boundaries, hosted real-report inference,
or presenting test identities as institutional verifiers. Passing plausibility
checks does not establish truthful, complete or legally compliant measurement.

## Measured evaluation

The test set contains **20 generated, one-page Turkish SIMULATED PDFs**, 12 valid
cases and eight planted errors. Every document has a watermark, simulation
metadata and a hash in the dataset manifest. The valid cohort's calculated
intensity is 0.882153612653 kg CO2/kg clinker. This is synthetic data, not a national
observation or confirmation of the association's reported figure.

| Measurement | Actual result |
| --- | ---: |
| Schema-valid model responses | 20/20 |
| Numerically correct proposed field values | 189/200 (94.5%) |
| Verbatim numeric tokens, including comma/trailing zeros | 88/200 (44%) |
| Correct original model page/line citations | 79/200 (39.5%) |
| Reports fully grounded after bounded alignment | 17/20 |
| Disclosed field-format/citation repairs | 119 |
| Planted errors caught by physics with oracle transcription | 8/8 |
| Valid oracle transcriptions incorrectly blocked by physics | 0/12 |
| Impossible reports blocked by the full model pipeline | 8/8 |
| Valid reports blocked by the full model pipeline | 1/12 |

Of the eight end-to-end blocked errors, **six reached physics and two were rejected
earlier by source grounding**. A grounding rejection is not counted as a physics
catch. Original failures remain in the denominators. A numerically correct model
token is not necessarily a correct citation or a verbatim transcription.

The planted errors are a 1,000-fold emissions slip, zero production, an impossible
oxide fraction, emissions below calcination/fuel balance, a thermal-energy slip,
negative fuel, swapped totals and a fuel-energy slip. The engine rejects every
planted case under the declared simplified boundary.

The model often changes decimal commas into dots or invents line numbers. A
bounded alignment accepts a repair only if a **unique labelled source field has
the identical numeric value and exact allowed unit**. It reads the number from
that source line, records both the original proposal and corrected citation, and
adds review flag R00. Different values, ambiguous matches and unsupported units
remain blocked. An officer can correct extraction against source text; its history
is hashed, invalidates an earlier review and requires a new signature.

Raw responses, per-report scores and PDF hashes are in
`data/simulated/ai_eval/` and `data/simulated/reports/`.
The machine-readable summary is [SIMULATED_AI_EVAL.json](SIMULATED_AI_EVAL.json).
`make evaluate-ai` re-scores matching saved responses; removing those response
files forces actual new inference. Cached scoring is not represented as new model
execution. The initial inference run took 525.246 seconds wall time; recorded
per-call model time sums to 524.016 seconds. Later re-scoring is much faster.

These layouts share wording and are not representative of real annual reports.
No accuracy on real reports, general Turkish documents, scanned tables or unseen
layouts is claimed. The model is not reliable enough for autonomous sealing.

## Deterministic rules and human accountability

- R01 enforces integer kg, positive production and the circuit's range. These
  cryptographic bounds cannot be overridden.
- R02 checks oxide mass fractions and nonnegative CKD correction.
- R03 checks nonnegative NCV fuel quantities and positive kiln energy.
- R04 reconciles fuel quantities with reported kiln energy.
- R05 computes carbonate CO2 using 44.01/56.08 and 44.01/40.30, applies the stated
  CKD correction and combines fuel factors and uncertainty intervals.
- R06 flags the scoped BAT energy reference; R07 flags year-on-year movement.
  R00 and R08 flag alignment or officer transcription corrections.

Fuel factors come from **IPCC 2006 Vol. 2 Table 2.3**, manufacturing industries,
in kg CO2/TJ NCV. Stoichiometry and clinker/CKD caveats are documented in IPCC
mineral-industry guidance and NIST molecular weights. The **2% reconciliation
tolerance and 15% year-on-year flag are explicit application review policies**,
not regulations or verified measurement uncertainty. Sources and rounded constants
are recorded in [physics.json](../data/real/physics.json) and [SOURCES.md](SOURCES.md),
entries S23-S29.

The 2,900-3,300 MJ/t BAT range applies to specified new/upgraded dry-process kilns.
It is **advisory here**, not a universal physical feasibility band. E/P's interval
is derived from the report's own chemistry and fuel quantities; no invented
universal cement intensity band is used. Non-carbonate inputs, biomass, CCS,
different CKD treatment or other boundaries require a different reviewed method.

Every physical failure requires a written, per-rule override; every review flag
requires acknowledgement. A named officer signs an EIP-712 review binding the
report hash, source-derived values, analysis/constants hashes, corrections,
overrides, installation, chain, contract and round. A random private review nonce
limits guessing of the review hash. The simulated verifier then produces actual
ECDSA, ML-DSA-65 and PQLink co-signatures. A name is self-declared in this prototype,
not an identity or accreditation credential.

Two cross-language review digests, two actual officer test signatures, 18
tampering/replay negatives, unacknowledged flags, unjustified overrides, ambiguous
citations and circuit-bound overrides pass the local test. The API integration
also executes actual model extraction, review signing, real input proof and
co-signatures, a mined commitment and three encrypted share deliveries/ACKs.
Its metadata explicitly says **AUTOMATED_TEST_SIGNATURE; humanApprovalPerformed=false**.
It does not pretend a person approved these fixtures. The one-plant integration
round is explicitly aborted; the separate service gate closes full cohorts.

## Footprint and remaining work

The evaluated 20 calls used 28,990 prompt tokens and 7,175 output tokens. Extra
calibration and API integration calls are outside those evaluation totals.
The downloaded model is 986,061,892 bytes. Time and tokens are observations,
not energy or CO2e measurements. No avoided-emissions figure is inferred.
Real-report validation, native Turkish review, identity/accreditation integration,
independent model/physics review and production security remain pilot work.

## Report/round context guard

The sealing adapter accepts only the generated TR clinker fixture hashes with
their exact source reporting year and matching public round country/product/year.
It rejects a cement report selected for another product, country or period, and
rechecks the context before proof generation. Other clearly simulated text PDFs
can be analysed locally, but require a reviewed context adapter before sealing.
This restriction is an application boundary, not an inference that Turkish text
proves a report's country or legal identity. Manual global-sector live inputs
remain explicitly unreviewed demonstrations.
