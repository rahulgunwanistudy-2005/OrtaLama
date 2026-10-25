# Do we need a blockchain?

Conditionally. The arithmetic can be reproduced from a signed file; a blockchain
is a shared ordering and enforcement choice. If participants accept a single
operator or a jointly governed signed transparency log, that simpler design may
be preferable. The local Anvil and actual Monad runs demonstrate implementation behaviour.
The application roles still share one host; institutional governance is untested.

This analysis follows Section III and Figure 1 of [Wüst and Gervais](https://eprint.iacr.org/2017/375.pdf)
(S35, accessed 2026-10-22). Their framework does not establish that an existing
public chain is the only acceptable architecture.

| Decision | Project-specific answer | Consequence |
| --- | --- | --- |
| Must state be stored? | Round parameters, commitments, receipts, the frozen cohort and result need a durable record. | A stateful evidence system is needed. |
| Multiple writers? | Plants submit statements; verifiers authorise them; trustees acknowledge and publish; a regulator controls lifecycle. | Multiple application roles change state. |
| Acceptable always-online trusted party? | Not established. The motivating hypothesis is that competitors and cross-border observers will not accept one operator's unilateral changes. | Validate this hypothesis with a pilot; do not present distrust as a measured finding. |
| Are writers known? | Intended role holders are identified and allowlisted. | A permissioned application, and potentially a public permissioned consortium, fits the problem. |
| Do all writers trust each other? | The protocol assumes they may omit, duplicate, equivocate or submit incorrect sums. | Authenticated transitions and independently checked arithmetic are useful. |
| Public verifiability needed? | A buyer or outside observer should check the same frozen evidence without a privileged database account. | Public readability and reproducible checks are useful. |

The paper's consensus-writer terminology is not identical to a plant submitting
a transaction. On a public EVM network, its validators and chain-specific sequencing provide
the underlying ordering, while this application restricts its own roles. Choosing a public EVM
settlement layer is our implementation choice, not a conclusion forced by the
decision tree. Network availability, RPC trust, settlement/finality and chain
governance become additional dependencies.

The contracts make a submitted round's transition rules executable: one accepted
commitment per installation, immutable round parameters, a frozen ordered
manifest, matching receipts, validated share sums and bounded badge thresholds.
Removing that enforcement requires another mechanism to prevent or expose
conflicting histories and to distribute the authoritative signed state. It does
not make the underlying maths unverifiable.

Alternatives for the pilot must include a signed append-only log with independent
witnesses, a jointly operated permissioned ledger, and a public-chain anchor of
an otherwise off-chain protocol. Compare operational independence, recovery,
publication latency, costs, censorship and governance. No token, marketplace,
asset custody or upgradeable proxy is needed. An immutable contract reduces an
administrator's ability to change old rules; defects require a new deployment
and an explicit migration decision.

Neither architecture solves the oracle problem. See [ORACLE.md](ORACLE.md) and
[THREAT_MODEL.md](THREAT_MODEL.md). No pilot partner has agreed to this governance
model, and no institutional node currently participates.
