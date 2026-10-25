# Reproducing a public evidence dossier

The current format is explicitly SIMULATED and supports Anvil 31337 and Monad
testnet 10143.
It is an engineering evidence attachment, not a verification opinion or official
submission. JSON Schema: [dossier.schema.json](../schemas/dossier.schema.json).
The schema is generated from the actual contract ABIs with
`node scripts/build-dossier-schema.mjs`.

The packet contains a pinned public snapshot, ordered commitments, aggregate
trustee shares, ECDSA/ML-DSA sidecars, successful public events, deployment code
hashes, source/build hashes, provenance classes and mandatory limits. It excludes
reports, individual openings, slopes, share plaintexts, signing/storage keys and
job capabilities. The PDF is a readable summary of the companion JSON. Its
metadata uses a fixed reproducibility epoch; the actual pinned block time is
printed in the document. It is not a signed PDF or a PDF/UA conformance claim.

From the matching source build, after installing dependencies and compiling the
contracts, select the correct deployment anchor **independently**. A deployment
file provided by the exporter is not by itself an independent trust root. Check the intended chain, source matches, addresses and governance decision.
The actual Monad deployment anchor is recorded in DEPLOYMENT_HANDOFF.md; a file
supplied by an exporter still does not establish that it is the intended anchor.

```sh
node --import tsx scripts/verify-dossier.ts \
  --dossier output/pdf/SIMULATED_monad_dossier_round_2.json \
  --deployment output/SIMULATED_monad_deployment.json \
  --rpc https://testnet-rpc.monad.xyz
```

Online reproduction validates the schema, canonical payload SHA-256, mandatory
limits and source hashes. It recomputes the manifest, point/VSS sums, threshold
interpolation, aggregate openings, intensity, declared-denominator coverage and
every co-signature. It then independently fetches the pinned snapshot and events,
checks all four deployment code hashes, compares the complete record and checks
each successful transaction receipt. The selected RPC and deployment anchor are
trust inputs; this is not a light client or a finality proof.

For offline arithmetic/signature reproduction, add `--offline` and omit `--rpc`.
The output explicitly states that the chain was not queried. A checksum alone
does not authenticate the author or chain history. Local URLs work only while the
originating machine's chain is available; no portable public phone link is implied.

To export another closed local round:

```sh
node --import tsx scripts/export-dossier.ts \
  --deployment PATH_TO_PUBLIC_DEPLOYMENT.json \
  --rpc http://127.0.0.1:RPC_PORT \
  --indexer http://127.0.0.1:INDEXER_PORT \
  --round ROUND_ID --output output/pdf/SIMULATED_dossier_round_ROUND_ID
```

The exporter reads chain state directly and takes only public signature sidecars
from the indexer. It verifies the packet online before rendering. It does not
export the RPC URL, so an API credential embedded in a selected provider URL is
not copied into the dossier. `--block BLOCK_NUMBER` reproduces a specific retained
block. The live public-read indexer exposes `/rounds/:id/dossier.json` and `.pdf`; the web
dossier page first pins one snapshot and digest, then links to both with the
same `?block=BLOCK&digest=PAYLOAD_SHA256` pair. A changed source build or evidence
packet produces a 409 response instead of silently downloading mismatched files.

The [local test record](SIMULATED_DOSSIER_RESULTS.json) reproduces the actual
12-report seeded round, checks 57 successful transaction records, verifies stable
JSON/PDF output under the recorded toolchain and rejects 14 tampering/anchor/privacy
cases. The cases include changes with a newly computed checksum, so checksum
checking is not being substituted for arithmetic or signature verification.
The local browser sample is historical; its originating chain must be running
for online reproduction. Current Monad dossiers for rounds 2 and 3 independently
reproduced 29 and 27 successful transaction records. Their JSON/PDF pairs were
visually inspected. The public export serves immutable matching files rather
than the live indexer's preparation/query mechanism; its dossier links need no
block/digest query. Required historical reads may need an archive-capable RPC
after the public provider's retention window. Browser verification of a closed
round fetches current state instead. See SIMULATED_MONAD_BUNDLE_RESULTS.json.

See [ORACLE.md](ORACLE.md), [THREAT_MODEL.md](THREAT_MODEL.md),
[REGULATORY_MAP.md](REGULATORY_MAP.md) and [LIMITATIONS.md](LIMITATIONS.md).
