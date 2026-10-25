# Monad testnet

Updated 2026-10-25 (Asia/Kolkata). The user selected Monad in place of the original
Arbitrum/Base choices and authorised reuse of the Batchelor testnet wallet.
Actual chain **10143** deployment, two closed cohorts, six mined attacks, a badge,
source verification and browser recomputation now pass. The read-only public
verification site is hosted at https://ortalama.onrender.com.

## Actual execution

The exact generated verifiers first passed read-only creation-call compatibility
checks. Actual deployment then exposed Monad's higher BN254 execution cost: the
original 1,000,000-gas inner verifier cap was insufficient. Both application caps
were raised to **2,000,000**, keeping the same generated verifiers, pinned code
hashes and state-derived proof inputs. The corrected round/badge were deployed;
the matching verifier deployments were reused. Fresh 10143-domain proofs passed.
[Gas evidence](SIMULATED_MONAD_PROOF_GAS_RESULTS.json),
[source matches](SIMULATED_MONAD_SOURCE_VERIFICATION.json),
[deployment handoff](DEPLOYMENT_HANDOFF.md).

Two five-plant cohorts closed, with round 2 intensity **848,636 ppm**. All six
required attacks reverted with their expected errors. Fault attribution and
undersized-cohort abort were separate successful transactions. The public
undersized cohort uses one plant; the exact four-versus-five boundary passed
locally. An earlier interrupted twelve-plant round expired and was aborted;
timestamps were never bypassed. Its transactions remain part of the cost record.
[Recorded results](SIMULATED_MONAD_ROUND_RESULTS.json).

Three random, separately keyed trustee processes used private durable storage
on the same host. PostgreSQL indexed actual chain events. Public RPC log queries
are paged into at most 100 blocks, with bounded catch-up and retries. Desktop and
mobile browser emulation independently checked the selected chain, code hashes,
frozen manifest, curve/VSS sums, aggregate openings and all five ECDSA/ML-DSA
co-signatures. A tampered signature cache failed closed.
[Browser evidence](SIMULATED_MONAD_BROWSER_RESULTS.json).

## Bounded transaction handling

The private shared transaction journal saves the exact signed bytes before
broadcast, serialises all role writes and recovers the same transaction after a
lost response. Chain, nonce, balance, fee and aggregate **16 test MON** bounds are
checked before signing. Six confirmations precede journal settlement. Monad
charges the signed gas limit: settlement uses that limit times confirmed effective
price, plus transferred value; unused execution gas is not assumed refundable.
The final journal reservation is **15.981939114 test MON**, including earlier
attempts and transfers to trustee accounts. Internal funding transfers therefore
make this a conservative project allocation, not just network gas expense.
No further transaction is necessary to package or host the evidence.

The public export includes only the approved credential-free RPC. It has no
signing service, wallet keys or private shares. Private lifecycle/participation
tools remain host-controlled. See [owner hosting instructions](HOSTING_GUIDE.md).

## References used for network behavior

- [Monad precompiles](https://docs.monad.xyz/developer-essentials/precompiles): BN254 pricing differs from Ethereum.
- [Deployment summary](https://docs.monad.xyz/developer-essentials/summary): gas-limit charging and network limits.
- [Reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance): undelegated account rules; no universal ten-MON minimum was assumed.
- [Historical data](https://docs.monad.xyz/developer-essentials/historical-data): archive/provider retention matters for pinned dossier reproduction.
- [eth_call](https://docs.monad.xyz/reference/json-rpc/api#eth-call): read-only execution is distinct from a mined transaction.

These references were checked on 2026-10-24. Passing this engineering simulation
does not establish institutional custody, physical report truth, physical-phone
operation, regulatory approval or physical emissions reductions.
