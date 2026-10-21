import { buildBabyjub } from 'circomlibjs';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { Field } from '@noble/curves/abstract/modular.js';
export * from './transport.js';
export * from './signatures.js';

export type Point = readonly [bigint, bigint];
export type Share = { index: number; value: bigint };
export type PlantOpening = { E: bigint; r: bigint; P: bigint; s: bigint };
export type PlantShare = PlantOpening & { index: number };
export const VALUE_LIMIT = 1n << 48n;
export const SUM_LIMIT = 1n << 56n;
export const IDENTITY: Point = [0n, 1n];

export function canonicalDecimal(value: unknown): bigint {
  if (typeof value !== 'string' || value.length > 78 || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('NonCanonicalInteger');
  return BigInt(value);
}

/** Arithmetic core; no claims about report truth, authentication or ledger state. */
export async function createCrypto() {
  const baby = await buildBabyjub();
  const q: bigint = baby.p;
  const l: bigint = baby.subOrder;
  const F = baby.F;
  const Fl = Field(l);
  const G: Point = Object.freeze(baby.Base8.map((x: unknown) => F.toObject(x)) as [bigint, bigint]);
  const raw = (p: Point) => p.map(x => F.e(x));
  const unraw = (p: any): Point => [F.toObject(p[0]), F.toObject(p[1])];
  const addRaw = (a: Point, b: Point): Point => unraw(baby.addPoint(raw(a), raw(b)));
  const mulRaw = (p: Point, s: bigint): Point => unraw(baby.mulPointEscalar(raw(p), s));
  const equal = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
  function scalar(s: bigint): bigint {
    if (typeof s !== 'bigint' || s < 0n || s >= l) throw new Error('NonCanonicalScalar');
    return s;
  }
  function point(p: Point): Point {
    if (!Array.isArray(p) || p.length !== 2 || p.some(x => typeof x !== 'bigint' || x < 0n || x >= q)) throw new Error('NonCanonicalPoint');
    if (!baby.inCurve(raw(p))) throw new Error('NotOnCurve');
    if (!baby.inSubgroup(raw(p))) throw new Error('NotInSubgroup');
    return p;
  }
  const toBig = (bytes: Uint8Array) => BigInt(`0x${Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('')}`);
  function randomScalar(): bigint {
    for (;;) {
      const bytes = randomBytes(32);
      bytes[0] = bytes[0]! & 7;
      const n = toBig(bytes);
      if (n < l) return n;
    }
  }
  function deriveH() {
    const domain = new TextEncoder().encode('ORTALAMA_PEDERSEN_H_v1');
    for (let counter = 0; counter <= 0xffff_ffff; counter++) {
      const input = new Uint8Array(domain.length + 4);
      input.set(domain);
      new DataView(input.buffer).setUint32(domain.length, counter, false);
      const digest = keccak_256(input);
      const y = toBig(digest) % q;
      const y2 = F.square(F.e(y));
      const denominator = F.sub(baby.A, F.mul(baby.D, y2));
      if (F.isZero(denominator)) continue;
      const root = F.sqrt(F.div(F.sub(F.one, y2), denominator));
      if (root === null || root === undefined) continue;
      let x: bigint = F.toObject(root);
      if (q - x < x) x = q - x;
      const H = mulRaw([x, y], 8n);
      if (equal(H, IDENTITY) || equal(H, G)) continue;
      point(H);
      return { H, counter, digest: Array.from(digest, x => x.toString(16).padStart(2, '0')).join(''), input: Array.from(input, x => x.toString(16).padStart(2, '0')).join('') };
    }
    throw new Error('GeneratorDerivationFailed');
  }
  point(G);
  const derivation = deriveH();
  const H = Object.freeze(derivation.H);
  Object.freeze(derivation);
  function commit(value: bigint, blinding: bigint): Point {
    return addRaw(mulRaw(G, scalar(value)), mulRaw(H, scalar(blinding)));
  }
  function add(a: Point, b: Point): Point { return addRaw(point(a), point(b)); }
  function multiply(p: Point, n: bigint): Point { return mulRaw(point(p), scalar(n)); }
  function validateOpening(o: PlantOpening): PlantOpening {
    if (typeof o.E !== 'bigint' || o.E < 0n || o.E >= VALUE_LIMIT) throw new Error('EmissionsOutOfRange');
    if (typeof o.P !== 'bigint' || o.P <= 0n || o.P >= VALUE_LIMIT) throw new Error('ProductionOutOfRange');
    scalar(o.r); scalar(o.s);
    return o;
  }
  function index(i: number): number {
    if (!Number.isInteger(i) || i < 1 || i > 3) throw new Error('InvalidTrusteeIndex');
    return i;
  }
  /** Deterministic polynomial evaluation for reference vectors; production uses split. */
  function evaluate(secret: bigint, slope: bigint): Share[] {
    scalar(secret); scalar(slope);
    return [1, 2, 3].map(index => ({ index, value: Fl.add(secret, Fl.mul(slope, BigInt(index))) }));
  }
  function split(secret: bigint): Share[] { return evaluate(secret, randomScalar()); }
  function reconstruct(shares: readonly Share[]): bigint {
    if (shares.length < 2 || shares.length > 3) throw new Error('InsufficientOrExcessShares');
    const seen = new Set<number>();
    for (const s of shares) {
      index(s.index); scalar(s.value);
      if (seen.has(s.index)) throw new Error('DuplicateTrusteeIndex');
      seen.add(s.index);
    }
    let result = 0n;
    for (const s of shares) {
      const x = BigInt(s.index);
      let coefficient = 1n;
      for (const t of shares) if (t.index !== s.index) {
        const y = BigInt(t.index);
        coefficient = Fl.mul(coefficient, Fl.div(Fl.neg(y), Fl.sub(x, y)));
      }
      result = Fl.add(result, Fl.mul(coefficient, s.value));
    }
    // Three shares must also lie on the same degree-one polynomial.
    if (shares.length === 3 && (result !== reconstruct(shares.slice(0, 2)) || result !== reconstruct(shares.slice(1)))) throw new Error('InconsistentShares');
    return result;
  }
  function sharePlant(opening: PlantOpening) {
    validateOpening(opening);
    const slopes = { E: randomScalar(), r: randomScalar(), P: randomScalar(), s: randomScalar() };
    const columns = { E: evaluate(opening.E, slopes.E), r: evaluate(opening.r, slopes.r), P: evaluate(opening.P, slopes.P), s: evaluate(opening.s, slopes.s) };
    const shares: PlantShare[] = [0, 1, 2].map(i => ({ index: i + 1, E: columns.E[i]!.value, r: columns.r[i]!.value, P: columns.P[i]!.value, s: columns.s[i]!.value }));
    return { shares, CE: commit(opening.E, opening.r), CP: commit(opening.P, opening.s), AE: commit(slopes.E, slopes.r), AP: commit(slopes.P, slopes.s) };
  }
  function verifyShare(share: PlantShare, commitments: { CE: Point; CP: Point; AE: Point; AP: Point }): boolean {
    const j = BigInt(index(share.index));
    return equal(commit(share.E, share.r), add(commitments.CE, multiply(commitments.AE, j))) && equal(commit(share.P, share.s), add(commitments.CP, multiply(commitments.AP, j)));
  }
  function publicResult(SE: bigint, SP: bigint, sectorProduction: bigint, n: number) {
    if (typeof SE !== 'bigint' || typeof SP !== 'bigint' || SE < 0n || SE >= SUM_LIMIT || SP <= 0n || SP >= SUM_LIMIT) throw new Error('AggregateOutOfRange');
    if (typeof sectorProduction !== 'bigint' || sectorProduction <= 0n || SP > sectorProduction) throw new Error('InvalidSectorProduction');
    if (!Number.isSafeInteger(n) || n < 5) throw new Error('CohortTooSmall');
    return { intensity: SE * 1_000_000n / SP, coveragePpm: SP * 1_000_000n / sectorProduction, representative: 5n * SP >= 4n * sectorProduction };
  }
  return { q, l, G, H, derivation, equal, point, scalar, randomScalar, commit, add, multiply, validateOpening, split, evaluate, reconstruct, sharePlant, verifyShare, publicResult };
}
