import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as snarkjs from 'snarkjs';
const template = await readFile('node_modules/snarkjs/templates/verifier_groth16.sol.ejs', 'utf8');
globalThis.curve_bn128 = await snarkjs.curves.getCurveFromName('bn128', { singleThread: true });
try {
  for (const [circuit, contract] of [['below_threshold', 'BelowThresholdVerifier'], ['commitment_validity', 'CommitmentValidityVerifier']]) {
    const expected = (await snarkjs.zKey.exportSolidityVerifier(`circuits/ceremony/${circuit}_final.zkey`, { groth16: template })).replace('contract Groth16Verifier', `contract ${contract}`);
    assert.equal(await readFile(`contracts/src/${contract}.sol`, 'utf8'), expected, `${contract} differs from the pinned generator and matching proving key`);
  }
  console.log('Both verifier sources exactly match snarkjs and the active contributed proving keys.');
} finally { const curve = await snarkjs.curves.getCurveFromName('bn128'); await curve.terminate(); }
