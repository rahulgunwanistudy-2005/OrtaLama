/** SIMULATED local round parameters; regulatory thresholds retain their sources. */
import { keccak256, toHex, type Hex } from 'viem';
import { deployment, json, runtimePath, readRound, client, artifact, transact, stringify, assertSimulationContext, publicTestnet } from '../packages/protocol/src/runtime.js';

export async function createSimulatedRound(mode: 'cli' | 'report' | 'live' = 'cli', declaredSectorProduction?: bigint, parameters: {country?:string;productCN?:string;period?:number} = {}) {
  const d = await deployment(), scenario = await json(runtimePath('SIMULATED_scenario.json'));
  await assertSimulationContext(d);
  const governor = (await json(runtimePath('SIMULATED_governor_secret.json'))).signingKey as Hex;
  const a = await artifact('OrtalamaRound');
  // Anvil may sit idle for hours without producing a block. Mine a fresh local
  // block before choosing deadlines; the next transaction otherwise advances
  // the clock past deadlines computed from the old head. Simulation guard above
  // ensures this RPC is never sent to a public chain.
  if(!publicTestnet)await (client as any).request({method:'evm_mine',params:[]});
  const id = (await client.readContract({ address: d.round, abi: a.abi, functionName: 'roundCount' }) as bigint) + 1n;
  const now = (await client.getBlock()).timestamp;
  const window=publicTestnet?86400n:3600n;
  let P = scenario.plants.reduce((s: bigint, p: any) => s + BigInt(p.P), 0n);
  if (mode === 'report') {
    const manifest = await json('data/simulated/reports/SIMULATED_report_manifest.json');
    P = manifest.reports.slice(0,12).reduce((s: bigint, p: any) => s + BigInt(p.rawValues.P), 0n);
  }
  const sector = declaredSectorProduction ?? (5n * P + 3n) / 4n;
  const facts = await json('data/real/facts.json'), f = facts.facts.find((x: any) => x.name === 'fallback_by_year');
  if (f.status !== 'VERIFIED') throw new Error('UnverifiedThreshold');
  const country=parameters.country??'TR',productCN=parameters.productCN??'25231000',period=parameters.period??2025;
  if(!/^[A-Z]{2}$/.test(country)||!/^\d{8}$/.test(productCN)||!Number.isInteger(period)||period<2000||period>9999)throw new Error('InvalidRoundParameters');
  const cementCase=country==='TR'&&productCN==='25231000';
  const cfg = { productCN: toHex(productCN, { size: 8 }), country: toHex(country, { size: 2 }), period, cohortRoot: scenario.cohortRoot, verifierRoot: scenario.verifierRoot, trustees: scenario.trustees.map((x: any) => x.address), encryptionKeys: scenario.trustees.map((x: any) => x.publicKey), commitDeadline: now + window, sharingDeadline: now + 2n*window, closingDeadline: now + 3n*window, minimumPlants: 5, sectorProduction: sector, sectorAttestationHash: keccak256(toHex(stringify({ simulation: true, sectorProductionKg: sector, source: 'SIMULATED declared denominator; not national statistics', mode }))), metadataHash: keccak256(toHex(stringify({ simulation: true, mode, country, productCN, period, fixedThresholdSource: cementCase?'S01/F03 2026 fallback including mark-up; boundary comparability UNVERIFIED':'No sourced fixed threshold for this user-selected sector; sector average only' }))), thresholdNumerators: [cementCase?BigInt(f.value['2026'].replace('.', '')):0n, 0n, 0n], thresholdDenominators: [cementCase?1000n:0n, 0n, 0n], fixedThresholdCount: cementCase?1:0, simulated: true };
  const receipts = [await transact(governor,d.round,'OrtalamaRound','createRound',[cfg]),await transact(governor,d.round,'OrtalamaRound','open',[id])];
  return { simulation: true, id, receipts, round: await readRound(id) };
}
