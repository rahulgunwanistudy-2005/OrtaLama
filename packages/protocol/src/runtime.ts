import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createPublicClient, createWalletClient, http, encodeFunctionData, type Hex, type Address, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil, monadTestnet } from 'viem/chains';
import {sendTestnetTransaction} from './testnet-transactions.js';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import { createCrypto, canonicalDecimal, type Point, type PlantOpening } from '../../crypto-ts/src/index.js';

export const stringify = (x: unknown) => JSON.stringify(x, (_, value) => typeof value === 'bigint' ? value.toString() : value);
export const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
export const runtimePath = (name: string) => `${process.env.ORTALAMA_RUNTIME ?? '.runtime'}/${name}`;
export async function readSeedStatus():Promise<string>{
  try{return (await json(runtimePath('SIMULATED_seed_state.json'))).status;}
  catch(error:any){if(error.code==='ENOENT')return 'READY';throw error;}
}
export async function assertSeedReady(){if(await readSeedStatus()!=='READY')throw new Error('SeedScenarioInProgress');}
export async function save(path: string, value: unknown, privateFile = false) {
  await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  await writeFile(path, stringify(value) + '\n', { mode: privateFile ? 0o600 : 0o644 });
}
export const rpc = process.env.ORTALAMA_RPC ?? 'http://127.0.0.1:8547';
export const publicTestnet = process.env.ORTALAMA_PUBLIC_TESTNET === '1';
export const selectedChain:Chain = publicTestnet ? monadTestnet : anvil;
export const client = createPublicClient({ chain: selectedChain, transport: http(rpc, { retryCount: publicTestnet?2:0, timeout:15_000 }) });
export const wallet = (privateKey: Hex) => {
  if(publicTestnet && BigInt(privateKey)<=111n)throw new Error('KnownFixtureKeysForbiddenOnPublicTestnet');
  return createWalletClient({ account: privateKeyToAccount(privateKey), chain: selectedChain, transport: http(rpc, { retryCount: 0 }) });
};
export async function assertSimulationContext(d:any){
  if(process.env.ORTALAMA_SIMULATION!=='1'||d.simulation!==true||d.chainId!==selectedChain.id||await client.getChainId()!==selectedChain.id)throw new Error('SimulationDeploymentMismatch');
  if(publicTestnet&&d.networkMode!=='PUBLIC_TESTNET_SIMULATION')throw new Error('ExplicitPublicTestnetDeploymentRequired');
}
export async function actorSigningKey(index:number):Promise<Hex>{
  if(!Number.isInteger(index)||index<0||index>11)throw new Error('UnknownActor');
  if(!publicTestnet)return ('0x'+BigInt(100+index).toString(16).padStart(64,'0')) as Hex;
  const d=await deployment();await assertSimulationContext(d);
  const secret=await json(runtimePath('SIMULATED_actor_'+index+'_secret.json'));
  const scenario=await json(runtimePath('SIMULATED_scenario.json'));
  if(secret.chainId!==10143||secret.deployment!==d.round||privateKeyToAccount(secret.signingKey).address!==scenario.plants[index].actor)throw new Error('ActorDeploymentMismatch');
  return secret.signingKey;
}
export const artifact = (name: string) => json(`contracts/out/${name}.sol/${name}.json`);
export const deployment = () => json(process.env.ORTALAMA_DEPLOYMENT ?? runtimePath('SIMULATED_deployment.json'));
export async function readRound(id: bigint, blockNumber?: bigint) {
  const d = await deployment(), a = await artifact('OrtalamaRound');
  return await client.readContract({ address: d.round, abi: a.abi, functionName: 'getRound', args: [id], blockNumber }) as any;
}
export async function readPlant(id: bigint, installationId: Hex, blockNumber?: bigint) {
  const d = await deployment(), a = await artifact('OrtalamaRound');
  return await client.readContract({ address: d.round, abi: a.abi, functionName: 'getPlant', args: [id, installationId], blockNumber }) as any;
}
export async function installations(id: bigint, blockNumber?: bigint) {
  const d = await deployment(), a = await artifact('OrtalamaRound');
  return await client.readContract({ address: d.round, abi: a.abi, functionName: 'getInstallations', args: [id], blockNumber }) as Hex[];
}
export async function transact(privateKey: Hex, address: Address, name: string, functionName: string, args: any[], expectedError?: string) {
  const a = await artifact(name), w = wallet(privateKey);
  // Explicit gas submits a real transaction even when estimation would reject it.
  let receipt,negativeGas=12_000_000n;
  if(publicTestnet){
    await assertSimulationContext(await deployment());
    // An expected rejection still has to be mined, with a bounded allowance.
    // Check the named error before spending; ordinary calls use RPC estimation.
    if(expectedError){
      const reasonAt=async(gas:bigint)=>{
        try{await client.simulateContract({address,abi:a.abi,functionName,args,account:w.account,gas});return '';}
        catch(error:any){for(let e=error;e;e=e.cause)if(e.data?.errorName)return e.data.errorName;return '';}
      };
      if(await reasonAt(12_000_000n)!==expectedError)throw new Error('UnexpectedPreflightRevert');
      // EstimateGas rejects reverting calls. Bound the allowance by measuring
      // the smallest read-only call that reaches the intended custom error.
      let low=21_000n,high=12_000_000n;
      while(high-low>50_000n){const mid=(low+high)/2n;if(await reasonAt(mid)===expectedError)high=mid;else low=mid;}
      negativeGas=(high*110n+99n)/100n;
    }
    receipt=await sendTestnetTransaction(client,w,{to:address,data:encodeFunctionData({abi:a.abi,functionName,args}),...(expectedError?{gas:negativeGas}:{})},`protocol:${functionName}:${expectedError??'success'}`);
  }else{
    const hash=await w.writeContract({address,abi:a.abi,functionName,args,gas:12_000_000n});
    receipt=await client.waitForTransactionReceipt({hash});
  }
  const hash=receipt.transactionHash;
  if (expectedError) {
    if (receipt.status !== 'reverted') throw new Error(`AttackUnexpectedlyAccepted:${expectedError}`);
    let reason = '', errorArgs: unknown;
    try { await client.simulateContract({ address, abi: a.abi, functionName, args, account: w.account, blockNumber: receipt.blockNumber, gas: negativeGas }); }
    catch (error: any) {
      for (let e = error; e; e = e.cause) if (e.data?.errorName) { reason = e.data.errorName; errorArgs = e.data.args; break; }
    }
    if (reason !== expectedError) throw new Error(`WrongRevert:${expectedError}:${reason}`);
    return { hash, blockNumber: receipt.blockNumber, status: receipt.status, gasUsed: receipt.gasUsed, error: reason, errorArgs };
  }
  if (receipt.status !== 'success') throw new Error(`TransactionReverted:${functionName}:${hash}`);
  return { hash, blockNumber: receipt.blockNumber, status: receipt.status, gasUsed: receipt.gasUsed };
}
export const pointObject = (p: Point) => ({ x: p[0], y: p[1] });
export const pointArray = (p: any): Point => [BigInt(p.x), BigInt(p.y)];
export function openingFromJSON(value: any): PlantOpening {
  return { E: canonicalDecimal(value.E), P: canonicalDecimal(value.P), r: canonicalDecimal(value.r), s: canonicalDecimal(value.s) };
}
let primitives: Promise<{ crypto: Awaited<ReturnType<typeof createCrypto>>; poseidon: any }> | undefined;
export function getPrimitives() { return primitives ??= Promise.all([createCrypto(), buildPoseidon()]).then(([crypto, poseidon]) => ({ crypto, poseidon })); }
export async function prove(circuit: string, input: any) {
  (globalThis as any).curve_bn128 ??= await snarkjs.curves.getCurveFromName('bn128', { singleThread: true });
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(JSON.parse(stringify(input)), `circuits/build/${circuit}_js/${circuit}.wasm`, `circuits/ceremony/${circuit}_final.zkey`, undefined, undefined, { singleThread: true });
  if (!await snarkjs.groth16.verify(await json(`circuits/ceremony/${circuit}_verification_key.json`), publicSignals, proof)) throw new Error('GeneratedProofInvalid');
  const call = JSON.parse(`[${await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)}]`);
  const big = (x: any): any => Array.isArray(x) ? x.map(big) : BigInt(x);
  return { a: big(call[0]), b: big(call[1]), c: big(call[2]), contextTag: BigInt(input.contextTag) };
}
export async function validityProof(opening: PlantOpening, sharing: any, roundId: bigint, installationId: Hex, address: Address) {
  const { poseidon } = await getPrimitives(), chainId = BigInt(await client.getChainId());
  const hi = BigInt(installationId) >> 128n, lo = BigInt(installationId) & ((1n << 128n) - 1n);
  const contextTag = poseidon.F.toObject(poseidon([1n, ...sharing.CE, ...sharing.CP, ...sharing.AE, ...sharing.AP, roundId, hi, lo, chainId, BigInt(address)]));
  return prove('commitment_validity', { ...opening, CE: sharing.CE, CP: sharing.CP, AE: sharing.AE, AP: sharing.AP, aE: sharing.slopes.E, ar: sharing.slopes.r, aP: sharing.slopes.P, as: sharing.slopes.s, roundId, installationHi: hi, installationLo: lo, chainId, contractAddress: BigInt(address), contextTag });
}
export async function badgeProof(opening: PlantOpening, roundId: bigint, installationId: Hex, numerator: bigint, denominator: bigint, thresholdId: bigint) {
  const d = await deployment(), { crypto, poseidon } = await getPrimitives();
  crypto.validateOpening(opening);
  const CE = crypto.commit(opening.E, opening.r), CP = crypto.commit(opening.P, opening.s);
  const hi = BigInt(installationId) >> 128n, lo = BigInt(installationId) & ((1n << 128n) - 1n), chainId = BigInt(await client.getChainId());
  const contextTag = poseidon.F.toObject(poseidon([2n, ...CE, ...CP, numerator, denominator, roundId, hi, lo, thresholdId, chainId, BigInt(d.badge)]));
  return prove('below_threshold', { ...opening, CE, CP, thresholdNum: numerator, thresholdDen: denominator, thresholdId, roundId, installationHi: hi, installationLo: lo, chainId, contractAddress: BigInt(d.badge), contextTag });
}
