# Ortalama v2 — project bible

Status: sourced foundation; current implementation gates are in BUILD_STATUS.md. No deployed system, real plant
data, accreditation, partnership, regulatory acceptance or measured climate impact
is claimed. Research accessed **2026-10-21**. Source IDs resolve in [SOURCES.md](SOURCES.md).

## The problem

Producers need credible aggregate emissions evidence without distributing their
individual emissions and production to competitors. Türkiye grey clinker is the
initial case; product, geography and reporting boundary must be round parameters.

The EU defaults annex lists Türkiye's grey clinker entry as unavailable, directing
users to Other Countries and Territories. For CN **2523 10 00**, that table gives
**1.410 tCO₂e/t before mark-up**, and **1.551 in 2026 including the 10% mark-up**.
The later columns are **1.692 in 2027 (20%)** and **1.833 from 2028 (30%)**.
These are published table values; do not add a second mark-up. The annex reports
direct **1.370**, indirect **0.050**, and total **1.410**; retain the published total
rather than silently replacing it with the sum of displayed rounded components.
[S01]

TURKCIMENTO's statement reports **0.88 tCO₂/t** for declarations by members
exporting to the EU. This is an association-reported figure, not an independently
verified sector average. Comparing 1.551 with 0.88 gives a **76.25%** arithmetic
difference relative to the reported figure. Whether their emissions boundaries
are fully comparable remains **UNVERIFIED**. Never say that Türkiye's cement is
proven to be this much cleaner. [S02; calculation F04 in the fact register]

The association estimated costs of approximately **€20 versus €80 per tonne of
clinker**, in its **24 March 2026** statement. These are attributed historical
estimates with an unreproduced calculation, not current liabilities or calculator
outputs. [S02] CemNet separately reports member clinker production of **75 Mt
for January–November 2025**, not annual national production and not the denominator
for a demonstration round. [S03]

The Commission's latest populated certificate price row at access is **Q3 2026:
€82.32/tCO₂**, published **5 October 2026**. The Q4 row has no price. A calculator
must show the applicable quarter; multiplying intensity by price alone is a gross
exposure illustration, not a CBAM payable calculation. [S04]

## The legal hook and its limits

Regulation (EU) **2023/956**, Annex IV **point 7**, permits region-specific default
adaptations supported by reliable data. Regulation (EU) **2025/2083**, Annex I,
amends that paragraph. Point **4.1** concerns the default determination method;
it is not the location of the regional adaptation clause. A cryptographic average
can form part of an evidence dossier. It does not by itself establish reliability,
representativeness, matching calculation boundaries or official acceptance. [S05, S06]

Whether a regional adaptation itself carries a mark-up is **UNVERIFIED**. Any
calculator must present both assumptions and label them. The mapping of the
full monitoring methodology in Implementing Regulation (EU) **2025/2547** is
**UNVERIFIED pending Phase 7 primary-text review**; its identity and subject are
linked by the defaults regulation. [S01, S15]

The DoCC's **3 September 2026** announcement says the TR-ETS pilot covers
**2026–2027** emissions, with reporting-only obligations in **2026**, **100%**
free allocation under the benchmark method, and an all-installation weighted
average for sectors other than electricity. It references the regulation published
**27 August 2026**, Official Gazette **33353**. These statements are verified
against the official announcement and corroborated by ICAP; the underlying Gazette
text and the reported **1 October 2026** procedures remain **UNVERIFIED** until
retrieved directly. A voluntary cohort does not automatically meet an all-covered-
installation benchmark requirement. [S07, S08, S16]

## Intended solution

Compute production-weighted intensity **ΣE/ΣP** from verifier-signed plant
commitments and encrypted threshold shares. Publish the totals, contributing
commitment set, reproducible checks and coverage denominator provenance.
Plant values remain local except for disclosure to the reviewing officer/verifier
and the explicitly documented trustee-collusion and transport threats.

After a round closes, a plant may prove **E·ΣP ≤ ΣE·P**, opening its registered
commitments without revealing its individual intensity. The accurate badge label
is **“at or below the sector average”** because equality is accepted. Badges are
non-transferable attestation records, with no token, marketplace or NFT.

## Why a ledger and AI

The ledger is intended as a shared ordering and evidence layer for independently
governed plants, verifiers, trustees and observers. It verifies commitment algebra
and proof validity, not atmospheric emissions or accreditation. A signed public
transparency log is a viable alternative where governance accepts its operator;
the blockchain choice must be justified against that alternative, not against an
unsigned spreadsheet alone. This is a design argument, not an empirical finding.

AI proposes cited fields at the plant boundary. Deterministic validation accepts
or rejects them and a named human authorises sealing. No model output directly
sets a committed value. Hosted extraction is allowed only for SIMULATED reports;
production privacy requires local processing or separately authorised handling.

## Actors and simulation policy

Plant officers review reports; verifiers co-sign commitments; trustees receive and
validate shares; regulators establish cohorts and production-denominator evidence;
observers independently verify public records. Proposed organisations are not
partners and have not approved this project.

**Design parameters, not sourced regulatory requirements:** 3 trustees with a
2-of-3 threshold; minimum cohort 5; coverage threshold 80%; 48-bit individual
values; 56-bit aggregate bound; fixed-point scale 1,000,000; a 12-plant seeded
scenario; a 5-plant live scenario; 20 generated evaluation reports. Any future
artifact containing synthetic reports, identities, keys, denominators or results
must carry SIMULATED in its filename, metadata and visible UI. No such inputs
exist yet. Source-derived facts are real references, not measurements by Ortalama.

## Competition evidence

The official Devpost page lists 12 judges. Cluster assignment and anticipated
questions below are our planning inferences, not statements about individual judges.
[S09]

| Planning cluster | Listed judges | Question to test |
| --- | --- | --- |
| Cryptography | Sedat Akleylek; Kübra Seyhan | Why this protocol? What leaks? Which parts resist quantum attacks? |
| Security | Şeref Sağıroğlu | Who can collude, frame a trustee or compromise keys? |
| Interoperability | Gora Datta; Pradyumna Kodgi | Which schema, calculation boundary and official workflow? |
| AI and ethics | Revanth Reddy Airre; Güven Fidan | How are misreads blocked and humans accountable? |
| Türkiye and regulation | Güven Fidan; Elvan Duman; Ahmet Soran; Saadin Oyucu | What constitutes reliable, representative data? |
| Practicality | Venkatesh Mohanram; Mubashar Iqbal | Why a ledger and who operates it? |

The five published criteria are Climate Impact, Innovation & Creativity, Technical
Execution, Practical Usefulness, and Presentation & Communication (rules page uses
Presentation & Storytelling). **No numeric weights are published.** The requested
25/20/20/20/15 allocation is an internal planning assumption only. The Carbon
Markets & Emissions Transparency track is verified. The rules require a **3–5
minute** video; the requested **3:30–4:00** is our target. The displayed deadline is
**25 October 2026, 10:00 EDT = 19:30 Asia/Kolkata**. Winner announcements at COP31
in Antalya remain **UNVERIFIED** from the accessed competition pages. [S09, S10]

Devpost's eligibility summary says students only and excludes companies, while
the full rules describe broader eligibility. This inconsistency is unresolved;
do not represent eligibility as confirmed for this team. [S09, S10]

The sponsor images identify Istanbul Chambers of Commerce, AI Ecosystem
Association and an “ISO” logo, alongside IEEE groups. **Which organisation the
ISO logo denotes is UNVERIFIED**; do not equate a logo with the International
Organization for Standardization or claim its endorsement. No sponsor API/SDK
requirement was found on the accessed overview/rules; that is a bounded observation,
not proof that none exists elsewhere. Standards mapping remains useful independently.
[S09, S10]

## Pilot and execution boundaries

The COP31 AI-Enabled Cleantech concept note defines launched pilots through a
challenge owner, technology provider, implementation site, agreed workplan,
baseline, impact measurement plan, financing pathway and implementation start
date. Its Pillar 3 covers responsible AI, footprint and data governance. Any future
pilot plan is a proposal until these conditions and partners are agreed. [S11]

Build in the requested phase order, with hard gates in [BUILD_STATUS.md](BUILD_STATUS.md).
The cryptographic design and necessary corrections are in [CRYPTO_SPEC.md](CRYPTO_SPEC.md).
No performance, audit, coverage, deployment or extraction-accuracy claims may be
made before their corresponding measurements exist.
