/** Explicitly SIMULATED Anvil-only identities. Refuses every other chain. */
import assert from 'node:assert/strict';
import { keccak256, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { randomBytes, bytesToHex } from '@noble/hashes/utils.js';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { trusteeKeygen, pqKeygen, pqPublicKeyHash } from '../packages/crypto-ts/src/index.js';
import { client, wallet, artifact, save, runtimePath, json } from '../packages/protocol/src/runtime.js';

assert.equal(process.env.ORTALAMA_SIMULATION, '1', 'Explicit ORTALAMA_SIMULATION=1 required');
assert.equal(await client.getChainId(), 31337, 'Known synthetic keys are forbidden on other chains');
const key = (n: number) => toHex(BigInt(n), { size: 32 });
const governor = key(10), actors = [1, 2, 3, 4, 10, 99, ...Array.from({ length: 12 }, (_, i) => 100 + i)];
for (const n of actors) await (client as any).request({ method: 'anvil_setBalance', params: [privateKeyToAccount(key(n)).address, toHex(1000n * 10n ** 18n)] });
const w = wallet(governor);
const transactions: Record<string, unknown> = {};
async function deploy(name: string, args: any[] = []) {
  const a = await artifact(name);
  const hash = await w.deployContract({ abi: a.abi, bytecode: a.bytecode.object as Hex, args, gas: 12_000_000n });
  const receipt = await client.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, 'success'); assert.ok(receipt.contractAddress);
  transactions[name] = { hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed };
  return { address: receipt.contractAddress, blockNumber: receipt.blockNumber };
}
const validity = await deploy('CommitmentValidityVerifier'), below = await deploy('BelowThresholdVerifier');
const round = await deploy('OrtalamaRound', [w.account.address, validity.address]);
const badge = await deploy('BadgeRegistry', [round.address, below.address]);
const instanceId = bytesToHex(randomBytes(12));
const runtimeCodeHashes=Object.fromEntries(await Promise.all(Object.entries({round:round.address,badge:badge.address,validity:validity.address,below:below.address}).map(async([name,address])=>[name,keccak256((await client.getBytecode({address}))!)])));
await save(runtimePath('SIMULATED_deployment.json'), { simulation: true, instanceId, chainId: 31337, round: round.address, badge: badge.address, validity: validity.address, below: below.address, blockNumber: round.blockNumber, transactions, runtimeCodeHashes, custody: 'Single-host SIMULATED actors; not independent organisations' });
await save(runtimePath('SIMULATED_governor_secret.json'), { simulation: true, signingKey: governor, label: 'SIMULATED regulator' }, true);
const publicTrustees = [];
for (let i = 1; i <= 3; i++) {
  const encryption = trusteeKeygen(), signingKey = key(i + 1);
  const config = { simulation: true, instanceId, chainId: 31337, deployment: round.address, index: i, signingKey, secretKey: bytesToHex(encryption.secretKey), publicKey: bytesToHex(encryption.publicKey), storageKey: bytesToHex(randomBytes(32)), controlToken: bytesToHex(randomBytes(32)), enableSimulatedAttacks: true };
  await save(runtimePath(`SIMULATED_trustee_${i}_secret.json`), config, true);
  publicTrustees.push({ index: i, address: privateKeyToAccount(signingKey).address, publicKey: `0x${config.publicKey}` });
  encryption.secretKey.fill(0);
}
const pq = pqKeygen(), pqKeyHash = pqPublicKeyHash(pq.publicKey), verifierAddress = privateKeyToAccount(key(1)).address;
await save(runtimePath('SIMULATED_verifier_secret.json'), { simulation: true, signingKey: key(1), secretKey: bytesToHex(pq.secretKey), publicKey: bytesToHex(pq.publicKey), pqKeyHash }, true);
pq.secretKey.fill(0);
const verifierTree = StandardMerkleTree.of([[verifierAddress, pqKeyHash]], ['address', 'bytes32']);
const reports=await json('data/simulated/reports/SIMULATED_report_manifest.json');
assert.equal(reports.simulation,true);
const plants=reports.reports.slice(0,12).map((report:any,i:number)=>{
 assert.equal(report.simulation,true);
 assert.match(report.file,/^data\/simulated\/reports\/SIMULATED_TR_/);
 // Generated dataset values, never LLM proposals. This fixture-signing flow
 // does not assert that a human reviewed or verified the report.
 return {simulation:true,installationId:keccak256(toHex(`SIMULATED_INSTALLATION_${i}`)),label:`SIMULATED plant ${i+1}`,P:BigInt(report.rawValues.P),E:BigInt(report.rawValues.E),actor:privateKeyToAccount(key(100+i)).address};
});
assert.equal(plants.length,12);
const cohort = StandardMerkleTree.of(plants.map((p:{installationId:Hex}) => [p.installationId]), ['bytes32']);
await save(runtimePath('SIMULATED_scenario.json'), { simulation: true, chainId: 31337, plants, cohortRoot: cohort.root, verifierRoot: verifierTree.root, verifier: verifierAddress, pqKeyHash, trustees: publicTrustees, fixtureSource:'data/simulated/reports/SIMULATED_report_manifest.json, first twelve generated reports',note: 'Synthetic generated report dataset. Automated fixture signatures are not human approval, accreditation or verification of physical report truth.' });
process.stdout.write(JSON.stringify({ simulation: true, deployed: round.address, badge: badge.address, plants: plants.length }) + '\n', () => process.exit(0));
