import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const h = JSON.parse(await readFile('packages/crypto-ts/H.json', 'utf8'));
await mkdir('circuits/build', { recursive: true });
await writeFile('circuits/lib/generators.circom', `// Generated from packages/crypto-ts/H.json; npm run derive:h and cross-language checks verify provenance.\npragma circom 2.1.6;\nfunction generatorG() { return [${h.G.join(',')}]; }\nfunction generatorH() { return [${h.H.join(',')}]; }\n`);
for (const circuit of ['below_threshold', 'commitment_validity']) {
  const r = spawnSync(process.execPath, ['node_modules/circom2/cli.js', `circuits/${circuit}.circom`, '--r1cs', '--wasm', '--sym', '--O2', '-l', 'node_modules', '-o', 'circuits/build'], { encoding: 'utf8' });
  console.log(r.stdout); if (r.status !== 0) { console.error(r.stderr); process.exit(r.status ?? 1); }
  await writeFile(`circuits/build/${circuit}_compile.log`, r.stdout + r.stderr);
}
