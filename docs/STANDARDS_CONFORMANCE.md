# Standards scope alignment and gaps

This is a public-scope mapping, not a clause-level conformance assessment,
certification or accreditation claim. Only the official public scope pages were
read; licensed standard text was not retrieved. The correct designation is
**ISO 14065:2020**, not "ISO/IEC 14065". Its public scope identifies it as a sector
application of ISO/IEC 17029:2019.

| Official scope | Pipeline relevance | Present evidence | Gap before a real pilot |
| --- | --- | --- | --- |
| [ISO 14064-1:2018](https://www.iso.org/standard/66453.html), S32: organisation-level GHG inventories, quantification and reporting | Report provenance, units, boundaries and inventory management | Source PDF hash, cited tokens, versioned constants and disclosed corrections | No audited organisation inventory, boundary reconciliation, completeness assessment or real measurement evidence |
| [ISO 14064-3:2019](https://www.iso.org/standard/66455.html), S33: validation and verification of GHG statements | Officer review and verifier statement before sealing | EIP-712 report/review binding plus ECDSA/ML-DSA co-signatures | No assurance engagement, materiality decision, evidence plan, independent review or accredited verification opinion |
| [ISO 14065:2020](https://www.iso.org/standard/74257.html), S34: bodies validating/verifying environmental information | Identity, competence, impartiality and authorisation of verifier role holders | Synthetic address and PQ-key hash authenticated by the round allowlist | No accreditation credential, validity/scope lookup, conflict-of-interest process or institutional key custody |

All three scope pages were accessed on 2026-10-22. The first two explicitly leave
additional GHG-programme requirements applicable. Our CBAM and TR-ETS mapping
therefore remains separate in [REGULATORY_MAP.md](REGULATORY_MAP.md).

For an actual verifier identity record, the pilot would require a legal entity,
accreditation body and reference, relevant scope, validity dates, source record,
checked-by role and key-rotation/revocation procedure. Those are proposed fields,
not credentials silently attached to the current public key. The current dossier
must identify all actors as SIMULATED and unaccredited.

Before any conformance claim, obtain the licensed texts through an authorised
channel, perform a competent clause-level gap assessment, agree the applicable
programme and assurance process, resolve identified gaps and retain independent
evidence. Sponsor logos or a standards reference do not constitute approval,
partnership, certification or an API integration.
