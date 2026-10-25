/** Private host CLI; never expose the governor through an HTTP write route. */
import {keccak256,toHex,type Hex} from 'viem';
import {deployment,json,runtimePath,publicTestnet,assertSimulationContext,transact,stringify} from '../packages/protocol/src/runtime.js';
import {createSimulatedRound} from '../services/rounds.js';
const [command,idText]=process.argv.slice(2);
if(!command||command==='--help'){
 console.log('Private Monad SIMULATED operator: create | sharing ROUND | closing ROUND | close ROUND | abort ROUND. Set ORTALAMA_* from your private runtime endpoints. No keys or private inputs belong in command arguments.');process.exit(0);
}
const d=await deployment();await assertSimulationContext(d);
if(!publicTestnet)throw new Error('ExplicitPublicTestnetRequired');
if(command==='create'){
 const result=await createSimulatedRound();console.log(stringify(result));process.exit(0);
}
if(!/^[1-9][0-9]{0,19}$/.test(idText??''))throw new Error('CanonicalRoundIDRequired');
const operations:Record<string,string>={sharing:'startSharing',closing:'startClosing',close:'close',abort:'abort'};
const operation=operations[command];if(!operation)throw new Error('UnknownPrivateOperatorCommand');
const key=(await json(runtimePath('SIMULATED_governor_secret.json'))).signingKey as Hex,id=BigInt(idText!);
const args=operation==='abort'?[id,keccak256(toHex('SIMULATED private operator requested abort'))]:[id];
console.log(stringify(await transact(key,d.round,'OrtalamaRound',operation,args)));
