# Local service round

`make e2e-cli` owns an isolated PostgreSQL cluster, an Anvil chain, three separately
keyed FastAPI trustee processes and one FastAPI indexer. It chooses unused loopback
ports and shuts down only processes it created. Node 24, Python 3.11+, PostgreSQL
client/server binaries, installed service requirements, compiled contracts and the
verified local circuit artifacts are prerequisites. This is a local integration
test, not an external deployment or independent custody demonstration.

Run `make bootstrap-services` to install the pinned Python environment. Run
`.tools/service-venv/bin/python scripts/run-services.py --keep` to retain the
isolated stack after the test for local inspection. Its endpoint configuration,
logs, private keys, plant openings and encrypted trustee stores remain in an
ignored, private `.runtime/SIMULATED_run_*` directory. Never publish that directory.
The checked-in evidence contains public results and transaction receipts only.

For individual plant operations, run
`node --import tsx services/plant-agent/cli.ts --help`. Its `prepare` command reads
canonical decimal E/P from a private input file; `commit`, `share` and `badge`
consume the resulting private artifact. It refuses every chain except the local
synthetic Anvil chain and explicitly makes no human report-review claim.

The runner uses loopback-only PostgreSQL trust authentication for synthetic local
data. Network deployments require authenticated database connections and TLS;
this setting must not be copied to a public service.

Each plant creates fresh commitment blindings and Shamir slopes, generates a real
input-validity proof, encrypts three shares with their full chain/contract/round/
installation/trustee context, and obtains real ECDSA, ML-DSA-65 and PQLink
signatures. The automated CLI fixture explicitly records that no human review or
physical report validation has happened at this stage.

Trustees reject shares outside Sharing, after the on-chain deadline, with a wrong
ciphertext hash, wrong context, noncanonical scalar or invalid VSS opening. They
store shares under separate authenticated storage keys and acknowledge only
after durable storage. An acknowledgement is an actual trustee transaction;
duplicate delivery retrieves its original event receipt. Python calls the Node
crypto bridge through private standard input, with no secret command arguments.
Bridge errors and structured logs exclude share values and private payloads.

Publication requires the local controller token and the exact common frozen
manifest. Each trustee independently sums all stored acknowledged members. The
explicit SIMULATED omission fixture must be enabled in private configuration;
the chain rejects the bad sum and a separate authenticated fault transaction
records it. The other two trustees can still close the cohort. The controller
token is an operational control, not a replacement for on-chain trustee identity.

The PostgreSQL indexer is a replaceable public cache, namespaced by chain and
contract. It pins snapshots to a block, stores event identities idempotently and
checks the previous cursor's block hash. A reorganisation rebuilds that namespace
and removes its attestations, which must be revalidated and supplied again. Its
health endpoint checks the actual database and deployed contract. Database
failure produces a bounded 503 response, without exposing credentials or SQL.

Public verification recomputes the ordered manifest, all four aggregate point
sums, every published VSS sum, threshold interpolation, aggregate openings,
intensity and declared-denominator coverage. Co-signature verification separately
checks every committed statement against its allowlisted ECDSA and ML-DSA key.
The indexer's response is not itself evidence of chain authenticity: an observer
must re-fetch from their selected RPC and check the selected contract and chain.

All actors, reports, keys, sector production and plant values here are SIMULATED.
Real cryptography and mined receipts establish protocol execution, not report
truth, accreditation, institutional participation or regulatory acceptance.
