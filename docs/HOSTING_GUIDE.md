# Hosting

The read-only public verification site is hosted on Render at https://ortalama.onrender.com
(free web service, configuration in [`render.yaml`](../render.yaml)). Render runs
`npm ci --ignore-scripts --include=dev && node scripts/build-public-site.mjs`,
which builds the web app with `VITE_PUBLIC_EVIDENCE=1` and overlays the committed
[`deploy/public-snapshot`](../deploy/public-snapshot) (round snapshots, signature
sidecars, dossiers and public configuration), then starts
`node scripts/serve-public-site.mjs`, which applies the rewrites listed below.
Environment: `NODE_VERSION=24.19.0` and `VITE_PUBLIC_EVIDENCE=1`; no secret is
required because no signing, trustee or operator service is deployed.
To refresh the snapshot after a new round, regenerate the bundle with
`make package-testnet` and copy its `api/`, `operator/` and
`SIMULATED_hosting_manifest.json` into `deploy/public-snapshot`.

The funded Monad testnet wallet is held only in owner-only ignored runtime files.
Never upload `.runtime`, `.env*`, private key files or trustee storage to a static
website. Contract source verification is separate and has exact Sourcify matches.

## Public verification website

The final bundle is `output/SIMULATED_monad_site`; the ready-to-upload archive is
`output/SIMULATED_monad_hosting.zip`. A corresponding working-source archive is
included at `source/SIMULATED_source_handoff.zip` inside the site. It contains the application,
public contract identities/ABIs, actual round snapshots, signature sidecars,
attack receipts, and matching JSON/PDF dossiers. Its deployment manifest records
the selected chain and round. It contains no signing or share-receiving service.

Publish this directory as the site root. With Vercel, run `vercel` from inside
that directory after signing in; use its included `vercel.json` and no additional
build command. This uploads an existing build and does not require a Git push.
Use `vercel --prod` when ready for the production alias. The owner performs these
hosting actions; this build session does not execute them.

For other static hosts, map `/operator/config` to `/operator/config.json`,
`/api/rounds` to `/api/rounds.json`, `/api/rounds/:id` to its `.json` file and
`/api/rounds/:id/evidence` to `evidence.json` in that round's directory. Serve
existing JSON/PDF/assets as files. Rewrite application routes such as `/verify/1`,
`/round/1`, `/badge/:id`, `/dossier/1`, `/attack`, `/calculator` and `/methodology`
to `index.html`. Do not return `index.html` for unknown API or asset requests.

The static index is a published snapshot. The verification worker independently
fetches the selected Monad RPC and checks code hashes, the frozen manifest,
curve arithmetic, threshold reconstruction and every ECDSA/ML-DSA co-signature.
The public attack page can independently fetch all six reverting receipts.
The badge page reads the deployed registry. A stale signature cache for a new
round fails verification rather than acquiring authority from a “verified” label.

Only the approved credential-free public Monad endpoint enters this bundle.
An operational authenticated RPC is never copied into browser configuration.
For a different provider, first review its public exposure and archive/CORS
support, then update the explicit public endpoint allowlist and repackage.

## Private participation and future rounds

The existing `make demo` includes the complete local participant/report-review,
trustee, verifier and attack workspaces. Their known local fixture accounts are
restricted to Anvil. Public testnet participation uses separate random keys and
deployment-bound configuration; it never imports those known keys.

The actual Monad round is driven by the private host tools and three separately
keyed trustee processes. The public build deliberately exposes read-only evidence.
The governor is not available through public HTTP write routes. Private lifecycle
commands are in `scripts/testnet-operator.ts`; plant preparation/sharing/badge
commands are in `services/plant-agent/cli.ts`. Independent plant submitters need
their own funded testnet signing account. The recorded synthetic test suite uses
the authorised operator as a transaction relayer.

The current private runtime is `.runtime/monad_20261024`. Its endpoints file
selects chain 10143, deployed addresses and the localhost services. Keep all secret
files and trustee databases on private persistent storage with owner-only access.
The three trustee processes currently share one host; this is not independent
institutional custody. Moving them to different services needs separate custody
owners and private provisioning of each role's own key/configuration.

For backend hosting, use the supplied service dependencies and Docker/service
entry points with PostgreSQL and persistent trustee storage. Supply secrets
privately through the host; keep the governor and plant-job interfaces private.
Expose only public read routes and cryptographically checked sidecar ingestion.
Keep `/sync` private or rate-limited, and use one indexing writer. Trustee
publication requires its bearer control token. Share ingestion verifies the
committed ciphertext, full associated-data domain and VSS before spending an ACK.
Deploy behind TLS and request limits. Do not enable synthetic omission controls
on a public production service.

Regenerate the snapshot bundle after a new completed round:

```sh
make package-testnet ARGS='--runtime .runtime/monad_20261024'
```

Public demo deadlines are 24/48/72 hours for commit/sharing/closing; local fixtures retain their short windows. Expired rounds are aborted and preserved rather than having their timestamps bypassed.

The transaction journal stores signed transactions before sending. After a lost
response, retry the same saved operation; never delete the journal and blindly
redeploy. An unexplained lock/nonce conflict needs inspection of the saved hash
and receipt first. The full-session cap is 16 **test MON**, including earlier
attempts and role funding. Reconciliation uses the charged gas limit and the
confirmed effective price after a six-confirmation wait, including recovered receipts; it does not assume an Ethereum-style unused-gas refund.

The completed session reserved 15.981939114 of its 16 test MON allocation,
including earlier attempts and internal trustee funding. Hosting and read-only
verification require no new transactions. Another private testnet round needs
an owner-approved allocation and funded role accounts; keep the completed
journal and its existing cap intact.

## Checks after the owner publishes

Open the manifest’s `/verify/<mainRoundId>` link on a physical phone and let all checks finish. The QR uses the
published origin automatically. Test the actual badge link, six receipt checks,
JSON/PDF downloads and English/Turkish layouts. Save the public URL, date, device,
browser and outcome in the final deployment record. Desktop mobile emulation is
reported separately and cannot stand in for this measurement.

Public hosting, a physical-phone result, independently governed custody and an
institution's acceptance cannot be established by local build automation. The
public-site URL must be added to the README/submission draft after publication.
