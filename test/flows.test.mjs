import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aggregateFlow} from '../public/flows.js';
const k=(t,q,b)=>[t,0,0,0,0,0,0,q,0,0,b];
test('adds matching dollar windows and excludes incomplete current candles',()=>{
 const result=aggregateFlow({minutes:5,now:650000,binance:[k(300000,100,70),k(600000,100,100)],okxSnapshot:{fetchedAt:610000,fiveMinute:[{time:300000,buy:10,sell:30},{time:600000,buy:999,sell:0}]}});
 assert.equal(result.flow,20);assert.deepEqual(result.flowSources,['Binance','OKX']);assert.equal(result.flowEnd,600000);
});
test('missing, duplicate or stale OKX samples never turn into zero inflow',()=>{
 for(const snapshot of [{fetchedAt:610000,fiveMinute:[]},{fetchedAt:610000,fiveMinute:[{time:300000,buy:10,sell:30},{time:300000,buy:10,sell:30}]},{fetchedAt:-2000000,fiveMinute:[{time:300000,buy:10,sell:30}]}]){
  const r=aggregateFlow({minutes:5,now:650000,binance:[k(300000,100,70)],okxSnapshot:snapshot});assert.equal(r.flow,40);assert.deepEqual(r.flowSources,['Binance']);
 }
});
test('OKX remains usable if Binance is unavailable',()=>{
 const r=aggregateFlow({minutes:5,now:650000,binance:[],okxSnapshot:{fetchedAt:610000,fiveMinute:[{time:300000,buy:10,sell:30}]}});assert.equal(r.flow,-20);assert.deepEqual(r.flowSources,['OKX']);
});
