import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const [applicationPath, verifierPath, output = 'docs/PHASE3_COVERAGE.json'] = process.argv.slice(2);
assert.ok(applicationPath && verifierPath, 'Pass the via-IR application LCOV and legacy verifier LCOV paths');
function records(text) {
  return new Map(text.split('end_of_record').map(record => {
    const source = record.match(/^SF:(contracts\/src\/.*)/m)?.[1];
    if (!source) return null;
    const lines = [...record.matchAll(/^DA:(\d+),(\d+)/mg)].map(m => ({ line: Number(m[1]), hits: Number(m[2]) }));
    return [source, { record: record.trim() + '\nend_of_record\n', lines }];
  }).filter(Boolean));
}
const application = records(await readFile(applicationPath, 'utf8'));
const verifier = records(await readFile(verifierPath, 'utf8'));
const files = []; let combined = ''; let total = 0; let covered = 0;
for (const [file, appRecord] of application) {
  const generated = /\/(BelowThresholdVerifier|CommitmentValidityVerifier)\.sol$/.test(file);
  const selected = generated ? verifier.get(file) : appRecord;
  assert.ok(selected, `Missing coverage for ${file}`);
  if (selected.lines.length === 0) continue;
  const hit = selected.lines.filter(x => x.hits > 0).length;
  const percent = 100 * hit / selected.lines.length;
  files.push({ file, compilerMode: generated ? 'legacy, optimizer disabled' : 'via-IR minimum optimization', covered: hit, total: selected.lines.length, lineCoveragePercent: Number(percent.toFixed(3)) });
  covered += hit; total += selected.lines.length; combined += selected.record;
}
for (const file of ['BabyJubjub.sol', 'BadgeRegistry.sol', 'BelowThresholdVerifier.sol', 'CommitmentValidityVerifier.sol', 'OrtalamaRound.sol']) assert.ok(files.some(x => x.file.endsWith('/' + file)), `Source omitted: ${file}`);
const percent = 100 * covered / total;
const result = { metric: 'line coverage', scope: 'all executable contracts/src files; no generated-verifier exclusion', method: 'Application source maps use via-IR minimum optimization to avoid stack-depth errors. Generated Yul verifier source maps use legacy compilation because via-IR drops their assembly anchors. Both are real execution runs against the same sources and proving keys.', covered, total, lineCoveragePercent: Number(percent.toFixed(3)), requiredPercent: 90, files, status: percent >= 90 ? 'PASS' : 'FAIL' };
await mkdir('docs/coverage', { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
await writeFile('docs/coverage/combined.lcov', combined);
console.log(JSON.stringify(result));
if (percent < 90) process.exitCode = 1;
