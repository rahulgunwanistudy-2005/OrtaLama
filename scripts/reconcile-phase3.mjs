import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const tests = await read('docs/PHASE3_CONTRACT_TESTS.json');
const coverage = await read('docs/PHASE3_COVERAGE.json');
const analysis = await read('docs/PHASE3_STATIC_ANALYSIS.json');
assert.equal(tests.status, 'PASS'); assert.equal(coverage.status, 'PASS');
assert.equal(analysis.status, 'PASS_WITH_DOCUMENTED_ACCEPTANCES');
assert.equal(analysis.unreviewed.length, 0);
assert.equal(tests.customErrors, 31);
for (const [file, hash] of Object.entries(tests.sha256)) assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), hash, `Tested source changed: ${file}`);
const gas = { subgroupValidationAndScalarMultiplication: Number((await read('docs/gas/BabyJubjub.json'))['validate-and-multiply']), closeTwelvePlants: Number((await read('docs/gas/OrtalamaRound.json'))['close-twelve-plants']) };
assert.ok(gas.subgroupValidationAndScalarMultiplication > 0 && gas.closeTwelvePlants > 0);
let ci = null;
try { ci = await read('docs/PHASE3_CI.json'); assert.equal(ci.status, 'success'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const result = { phase: 3, status: ci ? 'PASS' : 'LOCAL_PASS_AWAITING_CI', testInputs: 'SIMULATED', testGroups: tests.testGroups, customErrorsAsserted: tests.customErrors, independentPythonVectors: tests.independentPythonVectors, fuzzRunsPerTest: tests.fuzzRunsPerTest, invariantRuns: tests.invariantRuns, invariantDepth: tests.invariantDepth, lineCoveragePercent: coverage.lineCoveragePercent, executableSourceFiles: coverage.files.length, staticAnalysis: { rawFindings: analysis.rawFindingCount, unreviewed: 0, disposition: analysis.status }, gas, sha256: tests.sha256, ci, independentAudit: false, limitations: ['Local EVM tests, not a networked service demo or testnet deployment', 'Single-operator demonstration circuit contributions', 'Application curve code has no independent security audit', 'Static-analysis findings accepted only as documented; raw tool findings are not zero'] };
await writeFile('docs/PHASE3_GATE.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
