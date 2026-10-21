import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as snarkjs from 'snarkjs';
import { randomBytes, bytesToHex } from '@noble/hashes/utils.js';

const ptau = 'circuits/ceremony/powersOfTau28_hez_final_15.ptau';
const expected = '982372c867d229c236091f767e703253249a9b432c1710b4f326306bfa2428a17b06240359606cfe4d580b10a5a1f63fbed499527069c18ae17060472969ae6e';
const bytes = await readFile(ptau);
if (createHash('blake2b512').update(bytes).digest('hex') !== expected) throw new Error('PublishedPowersOfTauHashMismatch');
if (!(await readFile('circuits/ceremony/ptau-verification.log', 'utf8')).includes('FULL_TRANSCRIPT_VERIFICATION=PASS')) throw new Error('PublicCeremonyVerificationRequired');
const entries = [];
const serialCurve = await snarkjs.curves.getCurveFromName('bn128', { singleThread: true });
globalThis.curve_bn128 = serialCurve;
const logger = Object.fromEntries(['info', 'debug', 'warn', 'error'].map(level => [level, (...args) => {
  const line = `[${level}] ${args.map(String).join(' ')}`;
  entries.push(line);
  if (level !== 'debug') console.log(line);
}]));
await mkdir('contracts/src', { recursive: true });
try {
  for (const [name, contractName] of [['below_threshold', 'BelowThresholdVerifier'], ['commitment_validity', 'CommitmentValidityVerifier']]) {
    const r1cs = `circuits/build/${name}.r1cs`, initial = `circuits/ceremony/${name}_initial.zkey`, final = `circuits/ceremony/${name}_final.zkey`;
    console.log(`Creating ${name} setup from the checksum-verified public ptau.`);
    await snarkjs.zKey.newZKey(r1cs, ptau, initial, logger);
    // Secret contribution entropy is generated from the OS and never written to disk or logs.
    const entropy = randomBytes(64);
    await snarkjs.zKey.contribute(initial, final, 'Ortalama single-operator demonstration contribution', bytesToHex(entropy), logger);
    entropy.fill(0);
    if (!await snarkjs.zKey.verifyFromR1cs(r1cs, ptau, final, logger)) throw new Error(`InvalidPhase2Transcript:${name}`);
    const vk = await snarkjs.zKey.exportVerificationKey(final, logger);
    await writeFile(`circuits/ceremony/${name}_verification_key.json`, JSON.stringify(vk, null, 2) + '\n');
    const template = await readFile('node_modules/snarkjs/templates/verifier_groth16.sol.ejs', 'utf8');
    const solidity = await snarkjs.zKey.exportSolidityVerifier(final, { groth16: template }, logger);
    await writeFile(`contracts/src/${contractName}.sol`, solidity.replace('contract Groth16Verifier', `contract ${contractName}`));
    entries.push(`RESULT ${name}: contributed setup and R1CS-linked transcript verification PASS`);
    console.log(`Verified setup: ${name}`);
  }
} finally {
  await writeFile('circuits/ceremony/phase2-verification.log', entries.join('\n') + '\n');
  const curve = await snarkjs.curves.getCurveFromName('bn128'); await curve.terminate();
}
