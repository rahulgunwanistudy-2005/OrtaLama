/** Fresh private identities for the explicitly selected Monad simulation. */
import assert from 'node:assert/strict';
import {readFile,stat,access} from 'node:fs/promises';
import {keccak256,toHex,type Hex} from 'viem';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {randomBytes,bytesToHex} from '@noble/hashes/utils.js';
import {StandardMerkleTree} from '@openzeppelin/merkle-tree';
import {trusteeKeygen,pqKeygen,pqPublicKeyHash} from '../packages/crypto-ts/src/index.js';
import {client,deployment,save,runtimePath,json,stringify,assertSimulationContext,publicTestnet} from '../packages/protocol/src/runtime.js';
const d=await deployment();
assert.equal(publicTestnet,true);await assertSimulationContext(d);
try{await access(runtimePath('SIMULATED_scenario.json'));throw new Error('PublicRolesAlreadyExist');}catch(e:any){if(e.code!=='ENOENT')throw e;}
const keyFile=process.env.ORTALAMA_TESTNET_KEY_FILE;
if(!keyFile||(await stat(keyFile)).mode&0o077)throw new Error('OwnerOnlyKeyFileRequired');
const governor=(await readFile(keyFile,'utf8')).trim() as Hex;
assert.equal(privateKeyToAccount(governor).address.toLowerCase(),d.governor.toLowerCase());
const round={address:d.round},instanceId=d.instanceId;
const reuse=process.env.ORTALAMA_REUSE_ROLE_RUNTIME;
if(reuse){
 const old=await json(reuse+'/SIMULATED_monad_deployment.json');
 const scenario=await json(reuse+'/SIMULATED_scenario.json');
 if(old.chainId!==10143||scenario.chainId!==10143)throw new Error('RoleReuseChainMismatch');
 for(const name of ['SIMULATED_verifier_secret.json',...Array.from({length:12},(_,i)=>`SIMULATED_actor_${i}_secret.json`),...Array.from({length:3},(_,i)=>`SIMULATED_trustee_${i+1}_secret.json`)]){
  const path=reuse+'/'+name;if((await stat(path)).mode&0o077)throw new Error('OwnerOnlyRoleFileRequired');
  const cfg=await json(path);
  if(BigInt(cfg.signingKey)<=111n)throw new Error('KnownFixtureKeysForbidden');
  if(cfg.deployment&&cfg.deployment!==old.round)throw new Error('RoleReuseDeploymentMismatch');
  await save(runtimePath(name),{...cfg,chainId:10143,...(cfg.deployment?{deployment:d.round}:{}),...(cfg.instanceId?{instanceId:d.instanceId}:{})},true);
 }
 await save(runtimePath('SIMULATED_scenario.json'),scenario);
 await save(runtimePath('SIMULATED_governor_secret.json'),{simulation:true,chainId:10143,signingKey:governor,label:'Authorised testnet operator'},true);
 await save(runtimePath('SIMULATED_seed_state.json'),{simulation:true,status:'READY'});
 console.log(stringify({simulation:true,status:'EXISTING_RANDOM_ROLES_REBOUND',chainId:10143,round:d.round}));process.exit(0);
}
const publicTrustees = [];
for (let i = 1; i <= 3; i++) {
  const encryption = trusteeKeygen(), signingKey = generatePrivateKey();
  const config = { simulation: true, instanceId, chainId: 10143, deployment: round.address, index: i, signingKey, secretKey: bytesToHex(encryption.secretKey), publicKey: bytesToHex(encryption.publicKey), storageKey: bytesToHex(randomBytes(32)), controlToken: bytesToHex(randomBytes(32)), enableSimulatedAttacks: true };
  await save(runtimePath(`SIMULATED_trustee_${i}_secret.json`), config, true);
  publicTrustees.push({ index: i, address: privateKeyToAccount(signingKey).address, publicKey: `0x${config.publicKey}` });
  encryption.secretKey.fill(0);
}
const verifierKey=generatePrivateKey();
const pq = pqKeygen(), pqKeyHash = pqPublicKeyHash(pq.publicKey), verifierAddress = privateKeyToAccount(verifierKey).address;
await save(runtimePath('SIMULATED_verifier_secret.json'), { simulation: true, signingKey: verifierKey, secretKey: bytesToHex(pq.secretKey), publicKey: bytesToHex(pq.publicKey), pqKeyHash }, true);
pq.secretKey.fill(0);
const verifierTree = StandardMerkleTree.of([[verifierAddress, pqKeyHash]], ['address', 'bytes32']);
const reports=await json('data/simulated/reports/SIMULATED_report_manifest.json');
assert.equal(reports.simulation,true);
const actorKeys=Array.from({length:12},()=>generatePrivateKey());
const plants=reports.reports.slice(0,12).map((report:any,i:number)=>{
 assert.equal(report.simulation,true);
 assert.match(report.file,/^data\/simulated\/reports\/SIMULATED_TR_/);
 // Generated dataset values, never LLM proposals. This fixture-signing flow
 // does not assert that a human reviewed or verified the report.
 return {simulation:true,installationId:keccak256(toHex(`SIMULATED_INSTALLATION_${i}`)),label:`SIMULATED plant ${i+1}`,P:BigInt(report.rawValues.P),E:BigInt(report.rawValues.E),actor:privateKeyToAccount(actorKeys[i]!).address};
});
assert.equal(plants.length,12);
const cohort = StandardMerkleTree.of(plants.map((p:{installationId:Hex}) => [p.installationId]), ['bytes32']);
await save(runtimePath('SIMULATED_scenario.json'), { simulation: true, chainId: 10143, plants, cohortRoot: cohort.root, verifierRoot: verifierTree.root, verifier: verifierAddress, pqKeyHash, trustees: publicTrustees, fixtureSource:'data/simulated/reports/SIMULATED_report_manifest.json, first twelve generated reports',note: 'Synthetic generated report dataset. Automated fixture signatures are not human approval, accreditation or verification of physical report truth.' });

for(let i=0;i<12;i++)await save(runtimePath(`SIMULATED_actor_${i}_secret.json`),{simulation:true,chainId:10143,deployment:round.address,signingKey:actorKeys[i]},true);
await save(runtimePath('SIMULATED_governor_secret.json'),{simulation:true,chainId:10143,signingKey:governor,label:'User-authorised testnet operator; same-host simulation'},true);
await save(runtimePath('SIMULATED_seed_state.json'),{simulation:true,status:'READY'});
console.log(stringify({simulation:true,status:'PUBLIC_TESTNET_ROLES_PREPARED',round:round.address,trustees:publicTrustees.map(x=>x.address),custody:'Three separate process/storage keys on one host; not independent organisations'}));
