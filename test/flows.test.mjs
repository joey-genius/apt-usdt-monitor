import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aggregateFlow} from '../public/flows.js';
import {normalizeTrades} from '../scripts/recent-flows.mjs';
test('trade amounts use taker direction, contract multiplier and unique IDs',()=>{
 const g=normalizeTrades('Gate',[{id:1,create_time:100,size:-10,price:'2'},{id:1,create_time:100,size:-10,price:'2'},{id:2,create_time:101,size:20,price:'2',is_internal:true}],.1);
 assert.equal(g.trades.length,2);assert.equal(g.trades[0].net,-2);assert.equal(g.trades[1].net,0);
 const b=normalizeTrades('Bybit',[{execId:'a',time:100000,size:'3',price:'2',side:'Buy'}]);assert.equal(b.trades[0].net,6);
});
test('recent trades contribute only to fully covered periods',()=>{
 const snapshot={fetchedAt:610000,fiveMinute:[{time:300000,buy:10,sell:30}],recent:[{name:'Bybit',status:'ok',start:290000,end:605000,trades:[{time:310000,net:8}]},{name:'Bitget',status:'ok',start:350000,end:605000,trades:[{time:360000,net:999}]}]};
 const r=aggregateFlow({minutes:5,now:650000,binance:[],okxSnapshot:snapshot});assert.equal(r.flow,-12);assert.deepEqual(r.flowSources,['OKX','Bybit']);assert.match(r.flowExcluded.find(r=>r.name==='Bitget').reason,/完整周期/);
});
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
