import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const [input, output = 'docs/PHASE3_STATIC_ANALYSIS.json'] = process.argv.slice(2);
assert.ok(input, 'Pass raw Slither JSON');
execFileSync(process.execPath, ['scripts/assert-generated-verifiers.mjs'], { stdio: 'inherit' });
const policy = JSON.parse(await readFile('docs/SLITHER_REVIEW_POLICY.json', 'utf8'));
for (const [file, hash] of Object.entries(policy.reviewedApplicationSha256)) {
  assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), hash, `Application changed: review findings again for ${file}`);
}
const raw = JSON.parse(await readFile(input, 'utf8'));
assert.equal(raw.success, true, raw.error);
const findings = raw.results.detectors ?? [];
const counts = {}, unreviewed = [], reviewed = [];
for (const finding of findings) {
  const files = [...new Set(finding.elements.map(x => x.source_mapping?.filename_relative).filter(Boolean))];
  const key = `${finding.impact}:${finding.check}`;
  // A structural-interface warning names both the generated implementation and
  // its reviewed interface declaration; it must not admit application contracts.
  const relevantFiles = key === 'Informational:missing-inheritance' ? files.filter(x => x !== 'contracts/src/ProtocolTypes.sol') : files;
  const generatedOnly = relevantFiles.length > 0 && relevantFiles.every(x => /contracts\/src\/(BelowThresholdVerifier|CommitmentValidityVerifier)\.sol$/.test(x));
  counts[key] = (counts[key] ?? 0) + 1;
  const rule = policy.rules[key];
  if (!rule || (rule.generatedOnly && !generatedOnly) || files.some(x => !x.startsWith('contracts/src/'))) {
    unreviewed.push({ key, files, description: finding.description });
  } else reviewed.push({ key, files, description: finding.description, disposition: rule.reason });
}
for (const [key, count] of Object.entries(counts)) {
  if (count > (policy.rules[key]?.maximumCount ?? 0)) unreviewed.push({ key, count, reason: 'New findings exceed reviewed count; explicit review required' });
}
const report = { tool: 'slither-analyzer 0.11.6', status: unreviewed.length ? 'FAIL' : 'PASS_WITH_DOCUMENTED_ACCEPTANCES', independentAudit: false, rawFindingCount: findings.length, counts, unreviewed, reviewed, policy: 'docs/SLITHER_REVIEW_POLICY.json', verifierIntegrity: 'Exact active proving-key / pinned snarkjs template comparison passed' };
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, counts, unreviewed: unreviewed.length }));
assert.equal(unreviewed.length, 0, 'Unreviewed Slither findings');
