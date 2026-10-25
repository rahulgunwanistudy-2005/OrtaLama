/** Fixed claims for the current explicitly SIMULATED dossier format. */
export const DOSSIER_LIMITS=[
 'SIMULATED reports, inputs, actors, keys, trustees and sector denominator; same-host operation.',
 'Arithmetic and signatures do not establish report truth, accreditation or regulatory acceptance.',
 'Two colluding trustees can reconstruct individual plants; endpoint compromise can expose openings.',
 'Aggregate subtraction by other plants and overlapping/repeated cohorts can disclose individual information.',
 'Each issued threshold badge reveals a comparison bit; the bound is per round, not a global query budget.',
 'ECDSA, Groth16, commitment binding and X25519 transport have classical assumptions; this is not a fully post-quantum system.',
 'ML-DSA co-signatures are checked off-chain. The single project setup contribution has no independent production audit.',
 'Coverage uses a simulated declared denominator. The representative flag is a protocol policy, not official population assurance.',
 'The generic aggregate is not a complete CBAM or TR-ETS monitoring, attribution, assurance or allocation methodology.',
 'Online reproduction trusts the independently selected deployment anchor, frontend/source build and RPC; it is not a light-client finality proof.',
 'Offline reproduction checks arithmetic and signatures only; it does not authenticate chain history.',
 'A local or testnet deployment does not establish institutional participation, physical-phone measurement or real emissions reduction.'
] as const;
export const DOSSIER_SOURCE_FILES=[
 'packages/protocol/src/verify.ts','packages/protocol/src/public-chain.ts',
 'packages/crypto-ts/src/index.ts','packages/crypto-ts/H.json',
 'contracts/src/OrtalamaRound.sol','contracts/src/BadgeRegistry.sol',
 'contracts/src/BelowThresholdVerifier.sol','contracts/src/CommitmentValidityVerifier.sol',
 'circuits/ceremony/ARTIFACT_HASHES.json',
 'data/real/sources.json','data/real/facts.json','schemas/dossier.schema.json',
 'packages/protocol/src/dossier-policy.ts','packages/protocol/src/dossier.ts',
 'services/indexer/dossier.py','assets/fonts/NotoSans-Regular.ttf',
 'scripts/export-dossier.ts','scripts/verify-dossier.ts','package-lock.json','services/requirements.txt'
] as const;
