# Submission draft — Monad prototype, publication pending

Actual Monad testnet contracts and protocol execution are complete. The website
bundle is prepared for the owner to host. Replace pending public-site and phone
links only after those measurements exist.
No affiliation, accreditation, regulator approval or partner commitment is claimed.

## Project name

Ortalama — sealed inputs, checkable emissions averages

## Tagline

Compute a production-weighted emissions average from sealed, verifier-signed
plant inputs; let observers check the arithmetic and plants prove a threshold
relationship without publishing their individual figures.

## Track

Carbon Markets & Emissions Transparency. Track designation and entry eligibility
must be checked in the final submission account; documentary unknowns remain in
the source register.

## Inspiration

Türkiye's grey-clinker case makes the evidence problem concrete. The EU annex
lists 1.551 tCO2e/t including the 2026 mark-up; TURKCIMENTO reports 0.88 tCO2/t from
member declarations. Their accounting-boundary comparability is unverified.
The gap motivates collecting reliable evidence; it does not establish actual
overcharging or a guaranteed saving. Annex IV point 7 provides a route to
region-specific adaptations, subject to the applicable evidentiary process.
Sources: [EU defaults](https://eur-lex.europa.eu/eli/reg_impl/2025/2621/oj/eng),
[industry statement](https://www.eqs-news.com/news/media/turkcimento-calls-for-eu-aligned-mrv-data-recognition-under-cbam/347f954a-8081-4308-b01a-445e526ef6da_en),
[amendment](https://eur-lex.europa.eu/eli/reg/2025/2083/oj/eng).

## What it does

Ortalama seals plant emissions and production in hiding commitments, distributes
encrypted shares to three separately keyed trustees, and checks their exact
common-cohort aggregate on an EVM chain. An observer browser independently fetches
the chain record and recomputes the manifest, commitment algebra, result and
verifier co-signatures. A qualifying plant can issue a non-transferable proof
record showing it is at or below the **participating cohort average** or a
round-published fixed threshold. The result and evidence export as JSON/PDF.

The local report agent proposes cited fields from generated Turkish PDFs. Source
grounding, deterministic physics checks and an officer-signed review control
acceptance; physics overrides require written justification. Automated test
signatures are clearly distinguished from human review.

## How we built it

TypeScript and an independent Python reference cross-check the Baby Jubjub
commitment and threshold-sharing mathematics. Circom/Groth16 prove bounded input
validity and exact threshold inequalities. Solidity contracts enforce lifecycle,
allowlists, frozen cohort, authenticated trustee publications and badge records.
Noble primitives supply X25519/HKDF/XChaCha20-Poly1305 and ML-DSA-65; ECDSA remains
the on-chain identity layer. FastAPI/PostgreSQL support private role services and
a replaceable public cache. React/Vite workers perform actual browser proof
generation and independent verification.

## Measured accomplishments

- Actual Monad chain 10143: two five-plant cohorts closed at 848,636 ppm; all six
  required attacks mined as reverted with named error checks, a real qualifying
  badge issued, and all four contract sources matched exactly in Sourcify.
- Desktop/mobile browser recomputation of the actual testnet result passed;
  a tampered ML-DSA sidecar was rejected. Matching current JSON/PDF dossiers
  independently reproduced 29 and 27 successful transaction records.

- 224 cross-language vectors; seven positive and 27 negative circuit cases.
- 28 contract groups, all 31 application custom errors triggered, 98.276% line
  coverage, plus fuzz, invariant and Python differential checks.
- A real 12-plant local round at 882,153 ppm; six mined reverting attacks, 52
  encrypted records checked and database outage/recovery tested.
- Five isolated participant browsers, an independent mobile-sized verifier,
  clean-plant badge and above-average witness rejection. Connection-loss recovery
  and retry evidence are recorded in the current browser gate when it passes.
- 20 actual local-model calls on synthetic reports: 189/200 numeric fields and
  79/200 original citations correct. All eight planted impossible cases blocked
  without an officer override; one valid report also blocked. Repairs are
  disclosed separately and do not improve the stated original-model accuracy.
- A public-only, schema-constrained dossier with arithmetic/signature reproduction,
  pinned chain reads and 14 tampering/anchor/privacy rejection cases.

All inputs, identities, verifier accreditation claims, sector denominator and
trustee organisations are **SIMULATED**. Cryptography, transactions, negative
tests and verification computations are real.

## Challenges and what we learned

The ledger cannot establish physical report truth or a complete sector population.
Small-model citations were much weaker than numeric extraction, so accepting
plausible-looking model JSON would be unsafe. Deterministic source checks,
disclosed repairs and accountable review are essential. Losing a response after
mining also requires recovery of the exact saved commitment, rather than a fresh
opening. A coverage flag cannot turn a participating sample into the full sector.

## Limits and next steps

Two colluding trustees can recover individual plants; aggregate subtraction,
overlapping cohorts and badge bits leak information. Archived X25519 traffic is
a future-decryption risk. Off-chain ML-DSA does not make the whole protocol
post-quantum secure. The current custody model is one host, and the application
has no independent production security audit. No actual emissions reductions,
energy/CO2e benchmark, official acceptance or launched pilot is claimed.

Next: physical-phone verification, followed by an independently
governed pilot, genuine report and
population validation, native Turkish review, independent security review,
measured energy use and a physical-phone deployment gate. The proposed pilot
partners, site, financing and start date are uncommitted.

## Links and files to fill after verification

Repository: https://github.com/rahulgunwanistudy-2005/OrtaLama.
Public website: https://ortalama.onrender.com (verify: https://ortalama.onrender.com/verify/2).
[Verified round source](https://repo.sourcify.dev/10143/0x9ea9702324c53dcfb3c179acfed122dbf52f9cfc).
[Round explorer](https://testnet.monadexplorer.com/address/0x9ea9702324c53dcfb3c179acfed122dbf52f9cfc).
Physical-phone result: **PENDING**.
[Recorded 3:50 engineering walkthrough](media/SIMULATED_monad_walkthrough_3m50s.mp4)
uses the real Monad contracts through a localhost site. The final public-phone
recording remains **PENDING**. See
[DEPLOYMENT_HANDOFF.md](DEPLOYMENT_HANDOFF.md), [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md),
[BUILD_STATUS.md](BUILD_STATUS.md) and [PILOT_PLAN.md](PILOT_PLAN.md).

## Built with

Solidity, Foundry, Circom, snarkjs/Groth16, circomlib, OpenZeppelin, Noble,
TypeScript, Python, FastAPI, PostgreSQL, React, Vite, viem, Ollama and
Qwen2.5-1.5B. These are implementation dependencies, not sponsor integrations.
