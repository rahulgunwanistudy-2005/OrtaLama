# Local demonstration

All reports, plant actors, signing keys, trustees and the sector denominator are
SIMULATED. Proofs, signatures, EVM execution, encrypted delivery and browser
verification are real. This is same-host custody and not a public deployment.

On macOS or Linux, install Node.js 24+, npm 11+, Python 3.11+, Make, Git and
PostgreSQL server binaries. PostgreSQL need not already be running: the runner
creates its own isolated cluster, database, ports and private directory. Set
`ORTALAMA_PG_BIN` to the `pg_ctl` executable if it is not on PATH. Linux extraction
of the official Ollama archive also requires a tar implementation with zstd
support. Use an ordinary user account; PostgreSQL refuses to initialise as root.

```sh
make demo
```

The bootstrap installs tools into this project, checks SHA-256 against the exact
[official release records](../scripts/toolchain-releases.json), installs locked
dependencies, builds the circuits/contracts, restores the included **public**
proving parameters and builds the web application. It never creates a commit,
pushes, uploads a release or publishes a service. The first run downloads a local
model bundle of about 986 MB plus the runtime and dependencies. Model usage and
evaluation boundaries are in [AI_CARD.md](AI_CARD.md).

The runner starts its own loopback-only model service with cloud access disabled,
checks the pinned model digest, and starts Anvil, an isolated PostgreSQL cluster,
the indexer, three independently keyed trustee processes, the plant agent,
operator adapter and production web preview. It seeds a real 12-plant round and
six actual reverting attack transactions, checks encrypted storage and database
outage recovery, then keeps the app running. Follow the printed browser URL.
Proof generation and transaction execution take several minutes; this is not a
recorded or hard-coded result. Wait for the seeded scenario to finish before
opening a new live round. `Ctrl-C` stops only processes and the database cluster
owned by this invocation. Private files remain under ignored `.runtime/` for
recovery; do not share them.

For an already prepared development environment, `make web` rebuilds the UI and
starts the services using a local model endpoint at `ORTALAMA_LLM_URL` (default
`http://127.0.0.1:11441`). `scripts/serve-web.py --runtime PATH` attaches updated
web/operator processes to an existing private runtime without reseeding its chain.
Stop attached processes before stopping their underlying stack.

Open `/live`, choose public round parameters and a simulated denominator, then
open the five participant links in **separate browser contexts or devices**.
Each participant supplies secret integer kilograms, seals and commits, and keeps
the tab open. Open Sharing, wait for common-cohort trustee receipts, then close.
The QR link recomputes from the selected chain in another browser. Loopback URLs
are accessible on this computer only; they are not public phone-verification
links. Actual Monad protocol operation passed separately; public hosting and physical
phone testing remain owner gates. See MONAD_TESTNET.md.

Private input backups contain openings and encrypted envelopes. The local app
uses known synthetic accounts and an unauthenticated loopback operator adapter;
that adapter explicitly refuses any chain other than Anvil 31337. It must not be
exposed as a production or public testnet service.

The source/dependency clean-start gate passed on this macOS host: a separate
public-source copy without project tools, dependencies or private runtime data
downloaded the pinned runtimes and local model, built the system and completed
the seeded CLI/storage/database-recovery gates. Node, Python and PostgreSQL host
prerequisites were already installed; this is not a bare-machine OS test. The
same `make demo` entrypoint also completed in the current checkout with the
realistic 12-report dataset (882,153 ppm, six rejected attacks, 52 encrypted rows
checked). A later Linux arm64 container bootstrap completed the actual seeded CLI,
storage and database-recovery gates, then passed independent host-browser
verification. Public tool archives were cached and interrupted installs resumed;
application source was refreshed during retry and fourteen critical hashes
matched. See [SIMULATED_CONTAINER_RESULTS.json](SIMULATED_CONTAINER_RESULTS.json).
The earlier failed attempt remains a failure, not a passed measurement.

The prepared CI product job uses `scripts/run-local-gates.py` to own and clean up
its stack, then run the browser recovery, six UI attacks, accessibility,
performance, dossier and report-agent gates. Public evidence is separate
from ignored private runtime files.
