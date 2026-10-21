# Cryptographic specification — v2 draft 1

Written before implementation. Status: design, **not an audit or a working
protocol claim**. Source IDs refer to [SOURCES.md](SOURCES.md). Changes from the
requested sketch below close correctness and privacy gaps; they must have negative
tests before any gate passes. All numeric protocol bounds are engineering choices.

## Fields, points and values

Use circomlibjs Baby Jubjub over the BN254 scalar field `q`, not Ethereum BN254's
base field. Pin `q`, subgroup order `l`, `A=168700`, `D=168696` and `G=Base8` to
the installed upstream implementation and verify them independently in Python.
Curve equation: `A*x² + y² = 1 + D*x²*y² (mod q)`. Identity `(0,1)`.
The exact constants come from S12; generated vectors must include them. Values
are bigint integers; no JavaScript floating-point arithmetic in the protocol.

Incoming points require canonical `0 <= x,y < q`, on-curve and prime-subgroup
checks. Identity is a valid arithmetic result and can be a valid zero commitment;
reject identity generators and transport public keys, not every identity sum.
Incoming scalars must be canonical `0 <= scalar < l`; never silently reduce an
untrusted serialized scalar. All external scalars/coordinates are decimal strings
without signs, exponent notation, whitespace or leading zeros (except `0`).

E is kg CO₂e and P is kg of the precisely defined product, using the same emissions
boundary for every plant. `0 <= E < 2^48`, `0 < P < 2^48`; aggregate E and P must
be below `2^56`, with positive aggregate P. Configure a bounded cohort so these
integer sums cannot wrap modulo l. Scale published intensity as
`floor(SE * 1_000_000 / SP)`; compare badges by exact cross-products, not rounded
display intensity. Coverage is a rational comparison `5*SP >= 4*P_sector`,
requiring `P_sector > 0`, `SP <= P_sector`, matching periods and proven provenance.
The 80%/minimum-5 policy alone does not prove statistical representativeness.

## Nothing-up-my-sleeve H

For counter `c=0,1,...`, hash ASCII `ORTALAMA_PEDERSEN_H_v1` concatenated with
**uint32 big-endian** c using audited Keccak-256. Interpret the digest big-endian,
reduce modulo q as candidate y, and solve
`x² = (1-y²)/(A-D*y²)` with the library field square root. Skip zero denominator
or nonsquare. Pick the smaller canonical x root. Multiply `(x,y)` by cofactor 8.
Reject identity or points outside the prime subgroup. Publish the first accepted
counter, H, digest, input bytes and a re-derivation script. Do not compute H as
`hash(domain)*G`: that would expose its discrete log and break binding.

This deterministic try-and-increment mapping is project protocol composition,
not an RFC hash-to-curve or independently audited construction. The hash, field
square root, and curve arithmetic must use the named libraries. H was derived and
independently cross-checked in Phase 1; coordinates, counter and input/digest bytes
are recorded in `packages/crypto-ts/H.json`.

## Commitments and secret sharing

`C_E = E*G + r*H`, `C_P = P*G + s*H`. Independent r,s uniform over `[0,l)` using
CSPRNG bytes and rejection sampling (not modulo-biased random bytes). Scalar
addition/multiplication/interpolation uses `F_l`, while point coordinates use `F_q`.

For each secret, sample an independent uniform slope, evaluate degree-one
polynomials at trustee indices 1,2,3. Reconstruct only from distinct supported
indices using Lagrange coefficients at zero. One share hides the secret; two
reconstruct it. Aggregate shares componentwise only for the same frozen manifest.

**Required VSS correction:** publish blinded slope commitments
`A_E=a_E*G+a_r*H` and `A_P=a_P*G+a_s*H`, included in the verifier-signed payload.
A trustee checks received `(e_j,r_j,p_j,s_j)` against
`e_j*G+r_j*H == C_E+j*A_E` and the corresponding P equation before signing its
receipt. Invalid plant shares must not be misreported as trustee faults. Public
aggregate share validation against summed slope commitments distinguishes invalid
trustee publications; a matching commitment does not validate physical emissions.
Without this extension the original sketch cannot guarantee fair trustee blame.

All aggregate publications bind to a manifest hash containing round parameters,
ordered installation/commitment set, coefficient commitments and acknowledged
ciphertext hashes. No adaptive cohort changes, partial sum API, or second result
for the same cohort/period. Signed receipts prove acceptance; a plant-posted hash
alone cannot establish delivery. Receipt all-or-nothing policy must freeze before
Closing; missing shares cause an explicit abort rather than silently dropped plants.

## Encryption and payload encoding

X25519 ephemeral-static ECDH, HKDF-SHA256 and XChaCha20-Poly1305 using Noble
(S14, S17, S18). Fresh ephemeral key, random 32-byte salt and 24-byte nonce per
message. Reject low-order/all-zero shared secrets through library checks. HKDF
info binds domain/version, ephemeral public key, recipient public key and AAD;
never reuse raw ECDH bytes as a cipher key. AAD contains chainId, contract address,
roundId, installationId, trustee index and manifest/context version. These must
be unambiguous canonical encodings, with a fixed-length identifier or length prefix.

Versioned JSON payloads use fixed field order, decimal strings for integers and
lowercase fixed-length hex for byte values. AEAD authenticates exact AAD bytes;
decrypt compares the expected context, not an attacker-supplied context alone.
The encrypted inner payload also contains the context and share index. Include
ephemeral key, salt, nonce, AAD and ciphertext/tag in the ciphertext hash. Retained
keys and ciphertexts require authenticated encryption at rest and retention policy.

## Signatures and accountability

EIP-712 domain: name `Ortalama`, version `2`, chainId, verifyingContract. Typed
statement binds round, installation, both commitments, slope commitments,
reportHash, validation/override metadataHash and ML-DSA public-key identity.
Avoid circular signing: sign the same canonical statement digest with ECDSA and
ML-DSA-65; store the PQ signature hash separately. The authenticated verifier
allowlist binds BOTH ECDSA address and PQ public-key hash. A self-supplied PQ key
does not establish the verifier's identity. Human identities/roles are recorded
in the report-review metadata; no fake accreditation.

ML-DSA verification is off-chain, including browser/CLI; on-chain hash storage
alone does not verify it. Negative tests must reject wrong key, signature, statement
and context. Real co-signatures and negative tests were implemented in Phase 1;
the authenticated PQ link was added during Phase 3 integration.

Implementation correction: the verifier additionally EIP-712-signs
`PQLink(statementDigest, pqSignatureHash)`. This authenticates the stored hash
without circular signing; the main ECDSA and ML-DSA signatures still cover the
same statement digest. Without that link, a front-running relayer could replace
the hash and poison later off-chain PQ verification. The round contract must
check the link signer against the same allowlisted verifier.

## Circuits and replay binding

Badge proof opens C_E and C_P with bounded E,P,r,s, requires `P>0`, and checks
`E*thresholdDen <= thresholdNum*P`. Sector threshold is SE/SP; fixed thresholds
are frozen rationals at round opening. Limit each installation to one badge per
published threshold. Use 48-bit individual ranges, 56-bit aggregate ranges,
canonical subgroup scalar constraints and `LessEqThan(128)`. Products are at most
104 bits for 48-by-56 operands (112 is a conservative upper bound).

The public context includes commitment coordinates, threshold numerator and
denominator, roundId, installationId, thresholdId, chainId and registry/round
contract domain. **Merely declaring roundId a public input does not prevent replay.**
Constrain a Poseidon context tag over all public context fields. The prover supplies
the tag and proves its correct derivation; the registry need not recompute Poseidon
on-chain. The registry checks each non-derived public field against stored round/installation state and the
selected immutable threshold. IDs are field-canonical; use bounded integers or
an explicit hash encoding rather than silently reducing 256-bit identifiers.

**Required range-proof correction:** a separate mandatory commitment-validity
proof at submission opens both commitments and bounds E/P/r/s for every plant,
not only voluntary badge applicants. Otherwise a malicious signer can seal a
field element outside the promised range and make the aggregate check mean
modular arithmetic rather than the advertised integer sum. Its public context
also binds slope commitments/knowledge or their proof-of-knowledge equivalent.
Verifier review remains necessary to connect a bounded opening to the report.

Use circomlib fixed-base multiplication/BabyAdd and vetted comparisons; trusted
setup must verify public ptau provenance/hash plus an independently contributed
phase-2 transcript. A one-operator ceremony is a demo trust assumption, not a
production multiparty ceremony. Never substitute an always-true verifier.

## Closing, fault handling and EVM semantics

Lifecycle: Draft → Open → Sharing → Closing → Closed or Aborted. Only authorised
roles advance it; params/thresholds are immutable once Open. Commit once per
installation with cohort membership and verifier allowlist checks.

Public trustee sums must refer to the identical frozen manifest. Check their
aggregate VSS equations; reconstruct from a consistent pair; validate both sum
commitment openings; enforce aggregate integer bounds and positive P. If no pair
validates, abort with an evidence record. A validated pair and conflicting third
publication identifies an inconsistent publication under the stated VSS/receipt
assumptions; do not claim who caused an unavailable or malformed original share
without evidence. Trustees must not publish running sums.

**Revert correction:** an EVM revert rolls back state and events. A transaction
cannot both revert `CohortTooSmall` and persist Aborted. Expose a check/close
attempt that reverts and a separate successful abort transition that records
the reason. Likewise, a bad-publication attack revert and a fault-recording /
valid-pair close are distinct transactions. Report both receipts honestly.

## Security claims allowed

Pedersen hiding is information-theoretic for uniform blindings; binding relies
on discrete log. One Shamir share hides each individual secret. Public aggregate
shares reveal aggregate secrets, not an individual under those assumptions.

**The complete system is not post-quantum secure.** X25519 ciphertexts captured
today may be decrypted by a future quantum attacker; two trustees' archived shares
then reconstruct individuals. ML-DSA co-signatures do not repair transport,
ECDSA, Groth16 or ledger authentication. A future discrete-log break also permits
new equivocations/proofs; the ledger's own finality assumptions remain relevant.
Do not claim binding only matters until close as a general archival guarantee.

Aggregates enable subtraction by an n−1 coalition. Minimum cohort is not protection
against that coalition; overlapping cohorts and time-series release amplify it.
Each successful threshold predicate exposes a bit, while nonissuance is ambiguous;
multiple published thresholds compound leakage. Metadata, report hashes,
installation IDs, production denominator and traffic also leak. Report hashes
may be guessable and must not be described as hiding arbitrary documents.
Trustee/verifier access, endpoint compromise and human override fraud remain risks.

## Required phase evidence

Phase 1: at least 200 independent TS/Python vectors; derived H; homomorphism,
all-pair reconstruction, malformed input and AEAD tamper/replay tests.
Phase 2: both circuits, real proofs and all negative constraints; verified setup,
constraint counts and measured proof times. Phase 3: real on-chain verification,
fuzz/invariants/differential checks, all custom errors, Slither and coverage ≥90%.
No later phase may consume an unpassed earlier gate.
