import {test} from 'node:test';
import assert from 'node:assert/strict';
import {binanceTraderRatios} from '../public/binance-traders.js';

const now=1790973600000;
const row=(timestamp=now-300000)=>({symbol:'APTUSDT',longAccount:'0.7685',shortAccount:'0.2315',longShortRatio:'3.3194',timestamp});
test('keeps original Binance ratios, sorts timestamps, and ignores other venues',()=>{
  const [accounts,positions,global]=binanceTraderRatios({accounts:[row(now-600000),row()],positions:[{...row(),longShortRatio:'2.0656',longAccount:'0.6738',shortAccount:'0.3262'}],global:[row()],gateratio:[{top_lsr_account:100}]},now);
  assert.equal(accounts.ratio,3.3194);assert.notEqual(accounts.ratio,accounts.long/accounts.short);
  assert.equal(accounts.timestamp,now-300000);assert.equal(accounts.history.length,2);
  assert.deepEqual(accounts.sources,['Binance']);assert.equal(positions.ratio,2.0656);assert.equal(global.key,'global');
});
test('missing and failed Binance data never use Gate or Bybit as substitutes',()=>{
  for(const r of binanceTraderRatios({gateratio:[{top_lsr_account:100}],byratio:{result:{list:[{buyRatio:0.8}]}}},now))assert.equal(r.ratio,null);
  const r=binanceTraderRatios({accounts:[row()]},now,[{key:'accounts',message:'HTTP 451'}])[0];
  assert.equal(r.ratio,null);assert.match(r.error,/451/);assert.deepEqual(r.sources,[]);
});
test('rejects stale, future, wrong market and malformed latest samples',()=>{
  for(const bad of [{...row(now-900001)},{...row(now+60001)},{...row(),symbol:'BTCUSDT'},{...row(),timestamp:null},{...row(),longAccount:''},{...row(),shortAccount:2},{...row(),longShortRatio:-1},{...row(),shortAccount:'0.5'}]){
    const result=binanceTraderRatios({accounts:[bad]},now)[0];assert.equal(result.ratio,null);assert.ok(result.error);
  }
  assert.equal(binanceTraderRatios({accounts:[row(now-600000),{...row(),longAccount:'invalid'}]},now)[0].ratio,null);
});
test('zero ratio is real data, deduplicates samples and rejects conflicting duplicates',()=>{
  const zero={...row(),longAccount:'0',shortAccount:'1',longShortRatio:'0'};
  assert.equal(binanceTraderRatios({accounts:[zero,zero]},now)[0].ratio,0);
  assert.equal(binanceTraderRatios({accounts:[zero,zero]},now)[0].history.length,1);
  assert.equal(binanceTraderRatios({accounts:[zero,row()]},now)[0].ratio,null);
});
test('history capped to latest hour without filling sampling gaps',()=>{
  const rows=Array.from({length:20},(_,i)=>row(now-i*300000));
  assert.equal(binanceTraderRatios({positions:rows},now)[1].history.length,12);
  const sparse=binanceTraderRatios({positions:[rows[0],rows[3],rows[15]]},now)[1];
  assert.equal(sparse.history.length,2);
});
