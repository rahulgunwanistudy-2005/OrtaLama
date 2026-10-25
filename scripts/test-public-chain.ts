import test from 'node:test';
import assert from 'node:assert/strict';
import {getPagedContractEvents} from '../packages/protocol/src/public-chain.js';

test('event pagination pins one head, covers each block once and limits concurrency',async()=>{
 const ranges:bigint[][]=[];let active=0,maximum=0,heads=0;
 const client={getBlockNumber:async()=>{heads++;return 650n;},getContractEvents:async(x:any)=>{
  ranges.push([x.fromBlock,x.toBlock]);active++;maximum=Math.max(maximum,active);
  await new Promise(resolve=>setTimeout(resolve,1));active--;return [{blockNumber:x.fromBlock}];
 }};
 const events=await getPagedContractEvents(client,{address:'0x123',fromBlock:101n,toBlock:'latest'});
 assert.deepEqual(ranges,[[101n,200n],[201n,300n],[301n,400n],[401n,500n],[501n,600n],[601n,650n]]);
 assert.equal(heads,1);assert.equal(maximum,4);assert.equal(events.length,6);
 assert.deepEqual(await getPagedContractEvents(client,{fromBlock:700n,toBlock:650n}),[]);
});
