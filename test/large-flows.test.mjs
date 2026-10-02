import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aggregateLargeTradeFlow} from '../public/large-flows.js';
import {normalizeTrades,collectRecent} from '../scripts/recent-flows.mjs';

const trade=(id,time,notional,side='buy',excluded=false)=>({id,time,notional,side,excluded,net:excluded?0:notional*(side==='buy'?1:-1)});
const venue=(name,trades)=>({name,status:'ok',recordUnit:'exchange-reported-trade',fetchedAt:610000,start:1,end:999999,trades});
const bounded=(rows=[])=>[trade('before',290000,1),...rows,trade('after',600000,90000)];
const snapshot=recent=>({fetchedAt:620000,tradeCutoff:600000,recent});
const calculate=(s,extra={})=>aggregateLargeTradeFlow({minutes:5,now:650000,snapshot:s,...extra});

test('net equals large buys minus large sells; threshold and end are exact',()=>{
  const s=snapshot([venue('Bybit',bounded([trade('small',300000,9999),trade('buy',300001,10000),trade('sell',599999,20000,'sell'),trade('block',500000,100000,'buy',true)]))]);
  const r=calculate(s);
  assert.equal(r.net,-10000);assert.equal(r.buy,10000);assert.equal(r.sell,20000);assert.equal(r.count,2);
  assert.equal(r.breakdown[0].total,39999);assert.equal(r.breakdown[0].share,30000/39999);
  assert.deepEqual(r.sources,['Bybit']);assert.equal(r.start,300000);assert.equal(r.end,600000);
  assert.equal(calculate(s,{threshold:50000}).net,0);
});
test('only same-window bounded feeds contribute, unsupported windows stay unknown',()=>{
  const s=snapshot([venue('Bybit',bounded([trade('buy',400000,25000)])),venue('Gate',bounded([trade('sell',400000,12000,'sell')])),venue('OKX',[trade('tooLate',350000,99000),trade('last',600000,1)])]);
  const r=calculate(s);assert.equal(r.net,13000);assert.deepEqual(r.sources,['Bybit','Gate']);
  assert.match(r.excluded.find(r=>r.name==='OKX').reason,/整个周期/);
  assert.equal(calculate(s,{minutes:60}).net,null);
});
test('all-volume data and legacy snapshots cannot masquerade as large trades',()=>{
  const s={fetchedAt:620000,tradeCutoff:600000,fiveMinute:[{time:300000,buy:1000000,sell:0}],recent:[{name:'Bybit',status:'ok',start:1,end:999999,trades:[{time:400000,net:1000000}]}]};
  const r=calculate(s);assert.equal(r.net,null);assert.equal(r.buy,null);assert.equal(r.count,null);assert.equal(r.excluded.length,5);
  delete s.tradeCutoff;assert.equal(calculate(s).net,null);
});
test('reject stale snapshots, stale feeds, future times, duplicates and invalid amounts',()=>{
  const original=snapshot([venue('Bybit',bounded([trade('buy',400000,25000)]))]);
  for(const mutate of [
    s=>{s.fetchedAt=-2000000},s=>{s.fetchedAt=800000},s=>{s.tradeCutoff=600001},
    s=>{s.recent[0].fetchedAt=500000},s=>{delete s.recent[0].fetchedAt},
    s=>{s.recent[0].trades.push(trade('future',800000,10000))},
    s=>{s.recent[0].trades.push({...s.recent[0].trades[1]})},
    s=>{s.recent[0].trades[1].notional=Infinity},
    s=>{s.recent[0].trades[1].net=-25000},
    s=>{s.recent[0].trades=s.recent[0].trades.slice(1)}
  ]){const s=structuredClone(original);mutate(s);assert.equal(calculate(s).net,null);}
  assert.equal(calculate(original,{now:2500000}).net,null);
});
test('normalization retains amounts, rejects conflicting duplicate IDs and Binance gaps',()=>{
  const raw=[{id:101,time:300000,qty:'10000',price:'2',isBuyerMaker:true},{id:102,time:600000,qty:'12000',price:'2',isBuyerMaker:false}];
  const b=normalizeTrades('Binance',raw);assert.equal(b.trades[0].net,-20000);assert.equal(b.trades[1].net,24000);
  assert.throws(()=>normalizeTrades('Binance',[raw[0],{...raw[1],id:103}]),/缺口/);
  assert.throws(()=>normalizeTrades('Binance',[{...raw[0],isBuyerMaker:undefined}]),/方向/);
  assert.throws(()=>normalizeTrades('Binance',[raw[0],{...raw[0],qty:'1'}]),/冲突/);
  assert.equal(normalizeTrades('Binance',[raw[0],raw[0]]).trades.length,1);
  const okx=normalizeTrades('OKX',[{tradeId:'1',ts:'300000',sz:'2000',px:'2',side:'buy'}],10);
  assert.equal(okx.trades[0].notional,40000);
  for(const size of ['','0','-1','bad'])assert.throws(()=>normalizeTrades('Bybit',[{execId:'a',time:1,size,price:'2',side:'Buy'}]));
});
test('collector uses raw Binance records and validated OKX contract value; failures isolate',async()=>{
  const original=globalThis.fetch,urls=[];
  globalThis.fetch=async url=>{
    urls.push(url);let data;
    if(url.includes('binance'))data=[{id:1,time:300000,qty:'10',price:'2',isBuyerMaker:false}];
    else if(url.includes('/instruments'))data={code:'0',data:[{instId:'APT-USDT-SWAP',ctType:'linear',ctValCcy:'APT',ctVal:'10'}]};
    else if(url.includes('okx'))data={code:'0',data:[{tradeId:'1',ts:'300000',sz:'10',px:'2',side:'sell'}]};
    else throw Error('fixture offline');
    return {ok:true,json:async()=>data};
  };
  try{
    const result=await collectRecent();assert.equal(result.length,5);
    assert.equal(result.find(r=>r.name==='Binance').trades[0].net,20);
    assert.equal(result.find(r=>r.name==='OKX').trades[0].net,-200);
    assert.equal(result.find(r=>r.name==='Gate').status,'error');
    assert.ok(urls.every(u=>!u.includes('aggTrades')));
    assert.ok(result.filter(r=>r.status==='ok').every(r=>r.fetchedAt>0));
  }finally{globalThis.fetch=original;}
});
test('invalid thresholds do not silently enable all-size trades',()=>{
  for(const threshold of [0,-1,NaN,Infinity,'10000'])assert.throws(()=>calculate(null,{threshold}));
});
