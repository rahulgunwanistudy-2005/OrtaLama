/** Actual isolated Anvil reorg plus unchanged-head cache gate. */
import assert from 'node:assert/strict';
import {client,deployment,save,stringify} from '../packages/protocol/src/runtime.js';
import {createSimulatedRound} from './rounds.js';
import {json,runtimePath} from '../packages/protocol/src/runtime.js';
import {preparePlant,commitPlantRecoverable} from './plant-agent/agent.js';
import {toHex} from 'viem';
const d=await deployment();assert.equal(d.chainId,31337);assert.equal(await client.getChainId(),31337);
const base=process.env.ORTALAMA_INDEXER!;
async function sync(){const r=await fetch(base+'/sync',{method:'POST'});assert.equal(r.status,200);return r.json();}
await sync();const idle=await sync();assert.equal(idle.unchangedHead,true);assert.equal(idle.roundsRead,0);
const scenario=await json(runtimePath('SIMULATED_scenario.json'));
async function committedRound(){
 const round=await createSimulatedRound('live',6250n),seed=scenario.plants[0];
 const plant=await preparePlant(round.id,seed.installationId,700n,1000n);
 await commitPlantRecoverable(plant,toHex(100n,{size:32}));
 const response=await fetch(`${base}/rounds/${round.id}/attestations/${seed.installationId}`,{method:'POST',headers:{'content-type':'application/json'},body:stringify(plant.attestation)});
 assert.equal(response.status,200);await sync();return {id:round.id,plant};
}
const survivor=await committedRound();
const snapshot=await (client as any).request({method:'evm_snapshot',params:[]});
const created=await committedRound();await sync();
assert.equal((await fetch(base+'/rounds/'+created.id)).status,200);
assert.equal(await (client as any).request({method:'evm_revert',params:[snapshot]}),true);
const recovered=await sync();
assert.equal((await fetch(base+'/rounds/'+created.id)).status,404);
const evidence=await (await fetch(base+`/rounds/${survivor.id}/evidence`)).json() as any;
assert.equal(evidence.attestations.length,1,'Surviving valid signature sidecar was lost during reorg');
assert.equal(evidence.attestations[0].pqSignatureHash,survivor.plant.attestation.pqSignatureHash);
assert.ok(recovered.reorgRebuildCount>idle.reorgRebuildCount);
const stable=await sync();assert.equal(stable.unchangedHead,true);
const result={simulation:true,status:'LOCAL_PASS',unchangedHeadSkipsSnapshots:true,actualAnvilReorgRemovedOrphan:true,survivingSignatureSidecarRevalidatedAndPreserved:true,orphanRoundAndItsSidecarRemoved:true,reorgRebuildCount:recovered.reorgRebuildCount,postRecoveryIdle:true,scope:'Isolated real PostgreSQL/indexer/RPC, real validity proofs and co-signatures; no request or bridge mocks'};
await save('docs/SIMULATED_INDEXER_RECOVERY_RESULTS.json',result);
process.stdout.write(stringify(result)+'\n',()=>process.exit(0));
