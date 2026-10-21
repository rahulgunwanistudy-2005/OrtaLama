import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCrypto, canonicalDecimal, IDENTITY, VALUE_LIMIT, SUM_LIMIT, seal, open, envelopeHash, trusteeKeygen, type ShareContext, type Point } from '../src/index.js';

const c = await createCrypto();
const context: ShareContext = { chainId: '31337', verifyingContract: `0x${'11'.repeat(20)}`, roundId: '1', installationId: `0x${'22'.repeat(32)}`, trusteeIndex: 1 };
const utf8 = new TextEncoder();

test('strict canonical scalars, points and decimal encodings', () => {
  for (const value of [-1n, c.l, c.l + 1n]) assert.throws(() => c.commit(1n, value), /NonCanonicalScalar/);
  for (const value of ['01', '+1', '-1', '1e3', ' 1', '', 1, null, '1'.repeat(1000)]) assert.throws(() => canonicalDecimal(value), /NonCanonicalInteger/);
  assert.equal(canonicalDecimal('0'), 0n);
  for (const p of [[-1n, 1n], [0n, c.q], [c.q, 1n]] as Point[]) assert.throws(() => c.point(p), /NonCanonicalPoint/);
  assert.throws(() => c.point([1n, 1n]), /NotOnCurve/);
  assert.throws(() => c.point([0n, c.q - 1n]), /NotInSubgroup/);
  assert.deepEqual(c.point(IDENTITY), IDENTITY);
  assert.throws(() => { (c.G as [bigint, bigint])[0] = 0n; }, TypeError);
  assert.throws(() => { (c.H as [bigint, bigint])[0] = 0n; }, TypeError);
});

test('H is reproducible, distinct, nonidentity and prime subgroup', async () => {
  const again = await createCrypto();
  assert.deepEqual(c.derivation, again.derivation);
  assert.notDeepEqual(c.H, c.G);
  assert.notDeepEqual(c.H, IDENTITY);
  assert.deepEqual(c.point(c.H), c.H);
});

test('Pedersen homomorphism and cancellation across 32 random cases', () => {
  for (let i = 0; i < 32; i++) {
    const a = c.randomScalar(), b = c.randomScalar(), r = c.randomScalar(), s = c.randomScalar();
    assert.deepEqual(c.add(c.commit(a, r), c.commit(b, s)), c.commit((a + b) % c.l, (r + s) % c.l));
  }
  assert.deepEqual(c.commit(0n, 0n), IDENTITY);
  assert.deepEqual(c.add(c.G, c.multiply(c.G, c.l - 1n)), IDENTITY);
});

test('all trustee pairs and full set reconstruct 96 random and boundary secrets', () => {
  const secrets = [0n, 1n, c.l - 1n, ...Array.from({ length: 93 }, () => c.randomScalar())];
  for (const secret of secrets) {
    const shares = c.split(secret);
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) assert.equal(c.reconstruct([shares[i!]!, shares[j!]!]), secret);
    assert.equal(c.reconstruct(shares), secret);
  }
});

test('reconstruction rejects duplicates, missing/invalid indices, noncanonical and inconsistent shares', () => {
  const shares = c.evaluate(8n, c.l - 1n);
  assert.throws(() => c.reconstruct([shares[0]!]));
  assert.throws(() => c.reconstruct([shares[0]!, shares[0]!]), /DuplicateTrusteeIndex/);
  assert.throws(() => c.reconstruct([{ index: 0, value: 1n }, shares[0]!]), /InvalidTrusteeIndex/);
  assert.throws(() => c.reconstruct([{ index: 4, value: 1n }, shares[0]!]), /InvalidTrusteeIndex/);
  assert.throws(() => c.reconstruct([{ index: 2, value: c.l }, shares[0]!]), /NonCanonicalScalar/);
  assert.throws(() => c.reconstruct([shares[0]!, shares[1]!, { index: 3, value: 4n }]), /InconsistentShares/);
});

test('VSS accepts all shares, rejects omitted/tampered values and foreign commitments', () => {
  const opening = { E: 880n, P: 1000n, r: c.randomScalar(), s: c.randomScalar() };
  const sharing = c.sharePlant(opening);
  for (const share of sharing.shares) {
    assert.equal(c.verifyShare(share, sharing), true);
    assert.equal(c.verifyShare({ ...share, E: (share.E + 1n) % c.l }, sharing), false);
    assert.equal(c.verifyShare({ ...share, P: (share.P + 1n) % c.l }, sharing), false);
  }
  assert.equal(c.verifyShare(sharing.shares[0]!, { ...sharing, CE: c.commit(881n, opening.r) }), false);
});

test('12-plant aggregate commitments and every trustee pair agree; omission fails', () => {
  const plants = Array.from({ length: 12 }, (_, i) => c.sharePlant({ E: BigInt(600 + 100 * i), P: 1000n, r: c.randomScalar(), s: c.randomScalar() }));
  const fields = ['E', 'r', 'P', 's'] as const;
  const sums = [0, 1, 2].map(i => Object.fromEntries(fields.map(f => [f, plants.reduce((sum, p) => (sum + p.shares[i]![f]) % c.l, 0n)])) as Record<typeof fields[number], bigint>);
  const CE = plants.reduce((p, x) => c.add(p, x.CE), IDENTITY);
  const CP = plants.reduce((p, x) => c.add(p, x.CP), IDENTITY);
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
    const totals = Object.fromEntries(fields.map(f => [f, c.reconstruct([{ index: a! + 1, value: sums[a!]![f] }, { index: b! + 1, value: sums[b!]![f] }])])) as Record<typeof fields[number], bigint>;
    assert.deepEqual(c.commit(totals.E, totals.r), CE);
    assert.deepEqual(c.commit(totals.P, totals.s), CP);
    assert.equal(totals.E, 13800n);
    assert.equal(totals.P, 12000n);
  }
  const dropped = plants.slice(1).reduce((p, x) => c.add(p, x.CE), IDENTITY);
  assert.notDeepEqual(dropped, CE);
});

test('plant and aggregate integer bounds include zero emissions, exclude zero production and wrap', () => {
  assert.doesNotThrow(() => c.validateOpening({ E: 0n, P: VALUE_LIMIT - 1n, r: 0n, s: c.l - 1n }));
  assert.throws(() => c.validateOpening({ E: VALUE_LIMIT, P: 1n, r: 0n, s: 0n }), /EmissionsOutOfRange/);
  assert.throws(() => c.validateOpening({ E: 0n, P: 0n, r: 0n, s: 0n }), /ProductionOutOfRange/);
  assert.deepEqual(c.publicResult(880n, 1000n, 1250n, 5), { intensity: 880000n, coveragePpm: 800000n, representative: true });
  assert.equal(c.publicResult(880n, 999n, 1250n, 5).representative, false);
  assert.throws(() => c.publicResult(SUM_LIMIT, 1000n, 1250n, 5), /AggregateOutOfRange/);
  assert.throws(() => c.publicResult(1n, 0n, 1n, 5), /AggregateOutOfRange/);
  assert.throws(() => c.publicResult(1n, 2n, 1n, 5), /InvalidSectorProduction/);
  assert.throws(() => c.publicResult(1n, 1n, 0n, 5), /InvalidSectorProduction/);
  assert.throws(() => c.publicResult(1n, 1n, 1n, 4), /CohortTooSmall/);
});

test('ECIES roundtrip, randomisation and full-envelope hash', () => {
  const trustee = trusteeKeygen();
  const plaintext = utf8.encode('SIMULATED secret share');
  const a = seal(trustee.publicKey, plaintext, context), b = seal(trustee.publicKey, plaintext, context);
  assert.deepEqual(open(trustee.secretKey, a, context), plaintext);
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.notEqual(a.ephemeralPublicKey, b.ephemeralPublicKey);
  assert.notEqual(envelopeHash(a), envelopeHash(b));
  assert.notEqual(envelopeHash(a), envelopeHash({ ...a, nonce: '00'.repeat(24) }));
});

test('ECIES rejects tampering of every envelope field, wrong key and every replay context', () => {
  const trustee = trusteeKeygen(), stranger = trusteeKeygen();
  const e = seal(trustee.publicKey, utf8.encode('SIMULATED'), context);
  for (const field of ['ephemeralPublicKey', 'salt', 'nonce', 'ciphertext', 'aad'] as const) {
    const v = e[field];
    assert.throws(() => open(trustee.secretKey, { ...e, [field]: (v[0] === '0' ? '1' : '0') + v.slice(1) }, context));
  }
  assert.throws(() => open(stranger.secretKey, e, context));
  for (const replacement of [{ roundId: '2' }, { chainId: '1' }, { installationId: `0x${'33'.repeat(32)}` }, { verifyingContract: `0x${'33'.repeat(20)}` }, { trusteeIndex: 2 }]) assert.throws(() => open(trustee.secretKey, e, { ...context, ...replacement }), /WrongShareContext/);
  assert.throws(() => seal(new Uint8Array(32), utf8.encode('SIMULATED'), context));
  assert.throws(() => open(trustee.secretKey, { ...e, version: 2 } as never, context), /UnsupportedEnvelope/);
  assert.throws(() => open(trustee.secretKey, { ...e, unexpected: 1 } as never, context), /UnsupportedEnvelope/);
  assert.throws(() => seal(trustee.publicKey, utf8.encode('SIMULATED'), { ...context, chainId: '01' }), /InvalidContextInteger/);
  assert.throws(() => seal(trustee.publicKey, utf8.encode('SIMULATED'), { ...context, chainId: 31337 } as never), /InvalidContextInteger/);
  assert.throws(() => open(trustee.secretKey, { ...e, nonce: 'AA'.repeat(24) }, context), /NonCanonicalHex/);
});
