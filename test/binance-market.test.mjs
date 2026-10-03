import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collect} from '../public/market.js';

test('market requests Binance history directly and exposes latest ratios without OI weights',async()=>{
  const original=globalThis.fetch,urls=[];
  const now=Math.floor(Date.now()/300000)*300000;
  globalThis.fetch=async url=>{
    urls.push(url);
    const type=url.includes('topLongShortAccountRatio')?'accounts':url.includes('topLongShortPositionRatio')?'positions':url.includes('globalLongShortAccountRatio')?'global':null;
    if(!type)return {ok:false,status:503};
    const ratio={accounts:'2.0656',positions:'3.3194',global:'1.4540'}[type];
    return {ok:true,json:async()=>[now-300000,now].map(timestamp=>({symbol:'APTUSDT',timestamp,longAccount:'0.6738',shortAccount:'0.3262',longShortRatio:ratio}))};
  };
  try{
    const result=await collect();
    assert.equal(result.oi,null);
    assert.deepEqual(result.ratios.map(r=>r.ratio),[2.0656,3.3194,1.4540]);
    for(const r of result.ratios){assert.equal(r.timestamp,now);assert.deepEqual(r.sources,['Binance']);assert.equal(r.history.length,2);}
    assert.ok(urls.filter(u=>/LongShort.*Ratio/.test(u)).every(u=>u.includes('symbol=APTUSDT&period=5m&limit=12')));
    assert.equal('tradeSnapshot' in result,false);assert.ok(result.history.every(h=>!('largeFlow' in h)));
  }finally{globalThis.fetch=original;}
});

test('market loads the published Binance aggregate only; raw rankings come from the browser scanner',async t=>{
  const now=1790979065432,end=1790979000000,urls=[];
  t.mock.method(Date,'now',()=>now);
  const totals={buy:20,sell:0,net:20,netIn:20,netOut:0,turnover:20,count:1};
  const aggregate={schemaVersion:1,recordType:'binance-aggregate',windowStart:end-86400000,windowEnd:end,fetchedAt:now,limit:100,
    sources:[{name:'Binance',status:'ok',records:1,pages:2}],
    rows:[{exchange:'Binance',id:'9007199254740993',firstTradeId:'9007199254740995',lastTradeId:'9007199254740999',time:end-1,side:'buy',price:'2',quantity:'10',amount:20}],
    totals,allTradesTotals:{...totals}};
  const browserLocation={href:'https://monitor.example/dashboard/index.html'};
  const aggregateUrl=`https://monitor.example/dashboard/data/binance-agg.json?t=${Math.floor(now/300000)}`;
  const rawUrl=`https://monitor.example/dashboard/data/top-trades.json?t=${Math.floor(now/300000)}`;
  let snapshot=aggregate;
  t.mock.method(globalThis,'fetch',async url=>{
    urls.push(url);
    if(url===aggregateUrl)return {ok:true,json:async()=>snapshot};
    return {ok:false,status:503};
  });
  const originalLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
  const canMockLocation=typeof t.mock.property==='function'&&originalLocation;
  try{
    if(canMockLocation)t.mock.property(globalThis,'location',browserLocation);
    else Object.defineProperty(globalThis,'location',{configurable:true,writable:true,value:browserLocation});
    for(const [name,mutate,error] of [
      ['valid',()=>{},null],
      ['HTTP 451 source error',s=>{s.sources=[{name:'Binance',status:'error',records:0,pages:0,error:'HTTP 451'}];s.rows=[];s.totals=s.allTradesTotals=null;},/Binance HTTP 451/],
      ['stale',s=>{s.windowStart-=3600001;s.windowEnd-=3600001;},/./],
      ['malformed aggregate ID',s=>{s.rows[0].id='invalid';},/./],
      ['malformed first trade ID',s=>{s.rows[0].firstTradeId='invalid';},/./],
      ['malformed last trade ID',s=>{s.rows[0].lastTradeId='invalid';},/./]
    ])await t.test(name,async()=>{
      snapshot=structuredClone(aggregate);mutate(snapshot);urls.length=0;
      const result=await collect();
      assert.equal(urls.filter(url=>url===aggregateUrl).length,1);
      assert.equal(urls.includes(rawUrl),false);
      assert.equal('topTrades' in result,false);assert.equal('topTradesError' in result,false);
      if(error){assert.equal(result.binanceAggregates,null);assert.match(result.binanceAggregatesError,error);}
      else{assert.deepEqual(result.binanceAggregates,aggregate);assert.equal(result.binanceAggregatesError,null);}
      assert.ok(!result.errors.some(e=>e.key==='binanceAggregates'));
    });
  }finally{
    if(!canMockLocation){
      if(originalLocation)Object.defineProperty(globalThis,'location',originalLocation);
      else delete globalThis.location;
    }
  }
});
