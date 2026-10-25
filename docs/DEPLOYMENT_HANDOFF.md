# Monad deployment handoff

Updated 2026-10-25 (Asia/Kolkata). The actual Monad testnet protocol gate passed.
The read-only public verification site is hosted on Render at https://ortalama.onrender.com;
see [HOSTING_GUIDE.md](HOSTING_GUIDE.md). No paid resource was created.

## Completed and reproducible

Chain **10143** uses the user's authorised Batchelor testnet wallet. No mainnet
configuration was imported and no Batchelor source file was modified. Keys,
encrypted shares, signed transaction journals and control tokens remain private
under ignored owner-only runtime files.

| Contract | Actual deployed address |
| --- | --- |
| OrtalamaRound | `0x9ea9702324c53dcfb3c179acfed122dbf52f9cfc` |
| BadgeRegistry | `0x8c0befc317e1896fda2fe6a1ffa04599f6a35e08` |
| CommitmentValidityVerifier | `0x4760d62a410a2efa415029e6630db240a3f65dca` |
| BelowThresholdVerifier | `0x09a2a39b839a7509e69db572f2136a96f62c3de0` |

All four have exact Sourcify source matches. Compiler settings, creation
transactions and verified URLs are recorded in
[source verification](SIMULATED_MONAD_SOURCE_VERIFICATION.json) and
[deployment identity](../output/SIMULATED_monad_deployment.json).
[Round explorer](https://testnet.monadexplorer.com/address/0x9ea9702324c53dcfb3c179acfed122dbf52f9cfc).
Source matching does not establish a security audit.

Rounds **2 and 3** each closed with five committed plants. Round 2 published
2,079,159,525 kg CO₂ / 2,450,000,000 kg production, **848,636 ppm**. Its declared
denominator coverage is 266,666 ppm, with the representative policy flag false.
The qualifying plant's real badge was issued; the above-average witness failed.
All six required attacks mined as reverted with checked error names. Trustee
fault attribution and undersized round 4's abort each used separate successful
transactions. Interrupted twelve-plant round 1 expired and was explicitly aborted;
it is preserved as a superseded attempt, not a completed cohort.
See [actual testnet gate](SIMULATED_MONAD_ROUND_RESULTS.json).

The browser independently recomputed the actual round from RPC in desktop and
mobile emulation and rejected a corrupted ML-DSA sidecar. Three separately keyed
trustee processes and PostgreSQL ran locally against Monad. The same-host custody
model and synthetic identities remain explicit.

## Owner delivery

The public, read-only website is live at https://ortalama.onrender.com. It has public round
snapshots, co-signature sidecars, attack receipts and matching JSON/PDF dossiers;
browser verification and badge checks read the actual chain. Private participation
and report-review workspaces remain available in the complete local application.

See [HOSTING_GUIDE.md](HOSTING_GUIDE.md). Verify `/verify/2`, the badge and
attack receipts, and dossier downloads on a physical phone. Save
the public URL and device/browser/date/outcome. Emulation does not pass that gate.
Independent institutional custody, real report validation and formal acceptance
require real participants; no institution has agreed to take a role.

Remote CI runs in GitHub Actions; the historical foundation CI is not a result
for this build. Linux arm64 source bootstrap, actual service/storage/recovery gates and
independent browser verification passed in the owned Docker container. Public
runtime archives were cached and interrupted installs resumed; the tested
filesystem includes source refreshed during retry. The earlier failed attempt
is not counted as a pass. See SIMULATED_CONTAINER_RESULTS.json.

Physical-phone verification, submission publication and a final
recording containing that public phone demonstration remain owner delivery steps.
Do not describe the full original definition of done as met before those steps.
