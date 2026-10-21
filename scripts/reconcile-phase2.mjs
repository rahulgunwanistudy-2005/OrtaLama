import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const node = JSON.parse(await readFile('docs/PHASE2_RESULTS.json', 'utf8'));
const browser = JSON.parse(await readFile('docs/SIMULATED_BROWSER_PROOF_RESULTS.json', 'utf8'));
const publicLog = await readFile('circuits/ceremony/ptau-verification.log', 'utf8');
const phase2Log = await readFile('circuits/ceremony/phase2-verification.log', 'utf8');
assert.ok(publicLog.trimEnd().endsWith('FULL_TRANSCRIPT_VERIFICATION=PASS'));
assert.equal(node.witnessPositiveCases, 7); assert.equal(node.witnessNegativeCases, 27);
assert.equal(node.publicInputMutationsRejected, 27);
assert.equal(browser.simulation, true);
const artifacts = {};
const measurements = [];
for (const [name, contract] of [['below_threshold', 'BelowThresholdVerifier'], ['commitment_validity', 'CommitmentValidityVerifier']]) {
  assert.ok(phase2Log.includes(`RESULT ${name}: contributed setup and R1CS-linked transcript verification PASS`));
  const n = node.measurements.find(x => x.name === name), b = browser.measurements.find(x => x.name === name);
  assert.ok(n.nodeProvingMs > 0 && b.browserProvingMs > 0);
  assert.equal(b.verified, true); assert.equal(b.mutationRejected, true);
  const compile = await readFile(`circuits/build/${name}_compile.log`, 'utf8');
  const constraints = Number(compile.match(/^non-linear constraints: (\d+)/m)[1]) + Number(compile.match(/^linear constraints: (\d+)/m)[1]);
  measurements.push({ name, constraints, publicInputs: n.publicInputs, nodeProvingMs: n.nodeProvingMs, browserProvingMs: b.browserProvingMs });
  for (const file of [`circuits/${name}.circom`, `circuits/build/${name}.r1cs`, `circuits/build/${name}_js/${name}.wasm`, `circuits/ceremony/${name}_final.zkey`, `circuits/ceremony/${name}_verification_key.json`, `contracts/src/${contract}.sol`]) {
    artifacts[file] = createHash('sha256').update(await readFile(file)).digest('hex');
  }
}
for (const file of ['circuits/lib/opening.circom', 'circuits/lib/generators.circom', 'circuits/ceremony/ptau-verification.log', 'circuits/ceremony/phase2-verification.log']) artifacts[file] = createHash('sha256').update(await readFile(file)).digest('hex');
const gate = { phase: 2, status: 'LOCAL_PASS', evaluatedOn: '2026-10-21', testInputs: 'SIMULATED', publicCeremonyContributionsChecked: 55, projectCeremony: 'single-operator demonstration only', nodeProofsVerified: 2, browserProofsVerified: 2, witnessPositiveCases: 7, witnessNegativeCases: 27, nodePublicInputMutationsRejected: 27, browserPublicInputMutationsRejected: 2, measurements, browser: browser.browser, sha256: artifacts, ci: 'PENDING_FULL_PROOF_JOB' };
await writeFile('docs/PHASE2_GATE.json', JSON.stringify(gate, null, 2) + '\n');
await writeFile('circuits/ceremony/ARTIFACT_HASHES.json', JSON.stringify({ algorithm: 'SHA-256', purpose: 'Exact matching demonstration proving bundle; public keys and parameters, no signing secrets', sha256: artifacts }, null, 2) + '\n');
const rows = measurements.map(x => `| ${x.name} | ${x.constraints.toLocaleString('en-US')} | ${x.publicInputs} | ${(x.nodeProvingMs/1000).toFixed(3)} s | ${(x.browserProvingMs/1000).toFixed(3)} s |`).join('\n');
await writeFile('docs/FOOTPRINT.md', `# Measured proof footprint\n\nMeasured locally on 2026-10-21 using real Groth16 proofs on explicitly SIMULATED\nfixtures. These are single observations on the development machine, not a\ncontrolled benchmark, median, production SLA, phone measurement or energy estimate.\n\n| Circuit | Constraints | Public inputs | Node prove | Chrome prove |\n| --- | ---: | ---: | ---: | ---: |\n${rows}\n\nCompiler: Circom 2.2.3 via circom2 0.2.23, optimisation O2; circomlib 2.0.5;\nsnarkjs 0.7.6. Browser version: ${browser.browser}. Proving includes witness\ngeneration. Chrome fullProve includes loopback retrieval of WASM/key files;\nNode reads them locally. Both use the library's single-thread prover. No\nverification or proof-generation step was replaced by a mock.\n\nRaw measurements: [Node](PHASE2_RESULTS.json), [browser](SIMULATED_BROWSER_PROOF_RESULTS.json).\nThe [gate record](PHASE2_GATE.json) records passed/rejected cases and exact artifact\nhashes; [ceremony records](../circuits/ceremony/README.md) document provenance and\nits single-operator project contribution. A proof being valid does not mean its\nunderlying report is true or that the system has been independently audited.\n\nEnergy, AI inference consumption, deployment gas, service resource use and\nCO₂e footprint have **not been measured**. No environmental reduction figure\nis inferred from execution time. Those fields must be populated only when the\ncorresponding services, models, chain execution and measurement methods exist.\n`);
console.log(JSON.stringify({ status: gate.status, measurements, ci: gate.ci }));
