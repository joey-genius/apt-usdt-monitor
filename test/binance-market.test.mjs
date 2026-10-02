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
