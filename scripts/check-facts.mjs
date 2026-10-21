import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const { sources } = read('data/real/sources.json');
const registry = read('data/real/facts.json');
assert.equal(registry.simulation, false);
const ids = new Set(sources.map(s => s.id));
assert.equal(ids.size, sources.length, 'duplicate source ID');
const hashes = new Map(readFileSync(new URL('../data/real/evidence/SHA256SUMS', import.meta.url), 'utf8')
  .trim().split('\n').map(line => [line.slice(66), line.slice(0, 64)]));
let retrieved = 0;
for (const s of sources) {
  assert.equal(new URL(s.url).protocol, 'https:');
  assert.match(s.accessed_on, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(s.scope.length > 20);
  if (s.retrieved) {
    const path = new URL(`../data/real/evidence/${s.id}.json`, import.meta.url);
    const bytes = readFileSync(path);
    const evidence = JSON.parse(bytes);
    assert.equal(evidence.id, s.id);
    assert.equal(evidence.url, s.url);
    assert.equal(evidence.accessed_on, s.accessed_on);
    assert.ok(evidence.evidence.length > 20);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hashes.get(`${s.id}.json`), 'evidence changed');
    retrieved++;
  } else assert.equal(s.evidence_class, 'UNVERIFIED');
}
assert.equal(readdirSync(new URL('../data/real/evidence/', import.meta.url)).filter(x => x.endsWith('.json')).length, retrieved);
assert.equal(new Set(registry.facts.map(f => f.id)).size, registry.facts.length);
for (const f of registry.facts) {
  assert.ok(['VERIFIED', 'ATTRIBUTED', 'REPORTED', 'DERIVED', 'UNVERIFIED'].includes(f.status));
  assert.ok(f.source_ids.length > 0);
  f.source_ids.forEach(id => assert.ok(ids.has(id), `unknown source ${id}`));
  assert.ok(f.notes.length > 10);
  if (f.status === 'UNVERIFIED') assert.equal(f.value, null, 'unverified claim must not become an input');
  else assert.notEqual(f.value, null);
  if (f.status === 'VERIFIED') {
    assert.ok(f.source_ids.some(id => sources.find(s => s.id === id).evidence_class === 'PRIMARY'));
  }
}
const f = name => registry.facts.find(row => row.name === name).value;
assert.equal(BigInt(f('fallback_base_total').replace('.', '')) * 110n / 100n,
  BigInt(f('fallback_by_year')['2026'].replace('.', '')), 'mark-up counted incorrectly');
assert.equal((1551n - 880n) * 10000n / 880n, 7625n);
assert.equal(Date.parse(f('submission_deadline').publisher), Date.parse(f('submission_deadline').local));
console.log(`Fact provenance PASS: ${registry.facts.length} claims, ${sources.length} sources, ${retrieved} hashed access records; ${registry.facts.filter(f => f.status === 'UNVERIFIED').length} explicit unknowns.`);
console.log('This checks provenance structure and saved-file integrity; semantic source review is recorded in docs/BUILD_STATUS.md.');
