# Public demonstration proving parameters

These two Groth16 proving keys are **public**, not wallet keys, plant openings,
trustee keys, phase-2 entropy or a toxic-waste backup. They match the generated
Solidity verifiers and hashes in `../ARTIFACT_HASHES.json`. They are included in
the reviewable local project so a clean checkout can reproduce the demo without
an unpublished release upload or a newly generated, incompatible setup.

Run `node scripts/restore-public-keys.mjs` from the repository root, build the
circuits, then run `node scripts/assert-generated-verifiers.mjs`. The browser
checks SHA-256 before using a proving asset. See the parent ceremony README for
the public powers-of-tau provenance, contribution transcripts, verification logs
and the limitation of a single project contribution. This is not an independently
audited or production multi-party phase-2 ceremony.

Licensing follows the repository's GPL-3.0 licence and recorded circomlib/snarkjs
toolchain provenance. No secret runtime files belong in this directory.
