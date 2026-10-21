"""Independent, variable-time reference arithmetic; NEVER use for plant secrets.

Point arithmetic is intentionally independent of circomlibjs for differential
testing. Hash/KDF/cipher/RNG primitives are supplied by established libraries.
"""
import json
import sys
from Crypto.Hash import keccak, SHA256
from Crypto.Protocol.KDF import HKDF
from Crypto.Cipher import ChaCha20_Poly1305
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives import serialization

Q = 21888242871839275222246405745257275088548364400416034343698204186575808495617
L = 21888242871839275222246405745257275088614511777268538073601725287587578984328 // 8
A, D = 168700, 168696
G = (5299619240641551281634865583518297030282874472190772894086521144482721001553,
     16950150798460657717958625567821834550301663161624707787222815936182638968203)
IDENTITY = (0, 1)


def add_extended(p, r):
    x, y, z, t = p
    u, v, w, s = r
    aa, bb, cc, dd = x*u % Q, y*v % Q, D*t*s % Q, z*w % Q
    ee = ((x+y)*(u+v)-aa-bb) % Q
    ff, gg, hh = (dd-cc) % Q, (dd+cc) % Q, (bb-A*aa) % Q
    return ee*ff % Q, gg*hh % Q, ff*gg % Q, ee*hh % Q


def extended(p):
    return p[0], p[1], 1, p[0]*p[1] % Q


def affine(p):
    inv = pow(p[2], -1, Q)
    return p[0]*inv % Q, p[1]*inv % Q


def mul(p, n):
    assert n >= 0
    result, base = (0, 1, 1, 0), extended(p)
    while n:
        if n & 1:
            result = add_extended(result, base)
        base = add_extended(base, base)
        n >>= 1
    return affine(result)


def add(p, r):
    return affine(add_extended(extended(p), extended(r)))


def sqrt(n):
    """Tonelli-Shanks reference field arithmetic, not a cryptographic hash/RNG."""
    n %= Q
    if n == 0:
        return 0
    if pow(n, (Q-1)//2, Q) != 1:
        return None
    odd, s = Q-1, 0
    while odd % 2 == 0:
        odd //= 2
        s += 1
    z = 2
    while pow(z, (Q-1)//2, Q) != Q-1:
        z += 1
    c, x, t, m = pow(z, odd, Q), pow(n, (odd+1)//2, Q), pow(n, odd, Q), s
    while t != 1:
        i, tt = 1, t*t % Q
        while tt != 1:
            tt = tt*tt % Q
            i += 1
        b = pow(c, 1 << (m-i-1), Q)
        x, t, c, m = x*b % Q, t*b*b % Q, b*b % Q, i
    assert x*x % Q == n
    return min(x, Q-x)


def derive_h():
    for counter in range(2**32):
        message = b'ORTALAMA_PEDERSEN_H_v1' + counter.to_bytes(4, 'big')
        digest = keccak.new(digest_bits=256, data=message).digest()
        y = int.from_bytes(digest, 'big') % Q
        denominator = (A-D*y*y) % Q
        if denominator == 0:
            continue
        x = sqrt((1-y*y)*pow(denominator, -1, Q) % Q)
        if x is None:
            continue
        h = mul((x, y), 8)
        if h in (IDENTITY, G):
            continue
        assert (A*h[0]*h[0]+h[1]*h[1]-1-D*h[0]*h[0]*h[1]*h[1]) % Q == 0
        assert mul(h, L) == IDENTITY
        return h, counter, digest.hex(), message.hex()
    raise RuntimeError('generator not found')


H, COUNTER, DIGEST, INPUT = derive_h()


def commit(value, blinding):
    assert 0 <= value < L and 0 <= blinding < L
    return add(mul(G, value), mul(H, blinding))


def reconstruct(shares):
    assert len(shares) in (2, 3)
    assert len({i for i, _ in shares}) == len(shares)
    assert all(i in (1, 2, 3) and 0 <= y < L for i, y in shares)
    result = 0
    for x, y in shares:
        coefficient = 1
        for u, _ in shares:
            if x != u:
                coefficient = coefficient * (-u) * pow((x-u) % L, -1, L) % L
        result = (result + coefficient*y) % L
    if len(shares) == 3:
        assert result == reconstruct(shares[:2]) == reconstruct(shares[1:])
    return result


def context_bytes(c):
    return json.dumps(['ORTALAMA_SHARE_v1', c['chainId'], c['verifyingContract'], c['roundId'], c['installationId'], c['trusteeIndex']], separators=(',', ':')).encode()


def open_envelope(case):
    e, c = case['envelope'], case['context']
    sk = X25519PrivateKey.from_private_bytes(bytes.fromhex(case['SIMULATED_secretKey']))
    recipient = sk.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    epk, salt, nonce = (bytes.fromhex(e[k]) for k in ('ephemeralPublicKey', 'salt', 'nonce'))
    aad = context_bytes(c)
    assert e['version'] == 1 and aad.hex() == e['aad']
    shared = sk.exchange(X25519PublicKey.from_public_bytes(epk))
    info = b'ORTALAMA_SHARE_ECIES_v1' + epk + recipient + aad
    key = HKDF(shared, 32, salt, SHA256, context=info)
    cipher = ChaCha20_Poly1305.new(key=key, nonce=nonce)
    cipher.update(aad)
    encrypted = bytes.fromhex(e['ciphertext'])
    clear = cipher.decrypt_and_verify(encrypted[:-16], encrypted[-16:])
    # A separately generated deterministic fixture tests the other direction.
    ephem_sk = X25519PrivateKey.from_private_bytes(SHA256.new(b'SIMULATED_EPHEMERAL'+clear).digest())
    ephem_pk = ephem_sk.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    salt2 = SHA256.new(b'SIMULATED_SALT'+clear).digest()
    nonce2 = SHA256.new(b'SIMULATED_NONCE'+clear).digest()[:24]
    shared2 = ephem_sk.exchange(X25519PublicKey.from_public_bytes(recipient))
    key2 = HKDF(shared2, 32, salt2, SHA256, context=b'ORTALAMA_SHARE_ECIES_v1'+ephem_pk+recipient+aad)
    cipher2 = ChaCha20_Poly1305.new(key=key2, nonce=nonce2)
    cipher2.update(aad)
    encrypted2, tag2 = cipher2.encrypt_and_digest(clear)
    return {'plaintext': clear.hex(), 'envelope': {'version': 1, 'ephemeralPublicKey': ephem_pk.hex(), 'salt': salt2.hex(), 'nonce': nonce2.hex(), 'aad': aad.hex(), 'ciphertext': (encrypted2+tag2).hex()}}


def main():
    request = json.load(sys.stdin)
    assert request['simulation'] is True
    vectors = []
    for row in request['vectors']:
        value, blind, slope = (int(row[k]) for k in ('value', 'blinding', 'slope'))
        shares = [(i, (value+slope*i) % L) for i in (1, 2, 3)]
        reconstruction = [str(reconstruct([shares[a], shares[b]])) for a, b in ((0, 1), (0, 2), (1, 2))]
        vectors.append({'commitment': [str(x) for x in commit(value, blind)], 'shares': [{'index': i, 'value': str(v)} for i, v in shares], 'reconstructed': reconstruction})
    output = {'q': str(Q), 'l': str(L), 'G': [str(x) for x in G], 'H': [str(x) for x in H], 'counter': COUNTER, 'digest': DIGEST, 'input': INPUT, 'vectors': vectors, 'transport': [open_envelope(x) for x in request['transport']]}
    print(json.dumps(output, separators=(',', ':')))


if __name__ == '__main__':
    main()
