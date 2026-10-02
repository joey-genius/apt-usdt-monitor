import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretData, interpretPositions } from '../public/insights.js';
test('missing market data does not manufacture interpretations',()=>assert.deepEqual(interpretData({}),[]));
test('funding direction and source coverage are preserved',()=>{
 const cards=interpretData({funding:-.0001,coverage:{funding:['A','B']}});
 assert.match(cards[0].fact,/2 家/);assert.match(cards[0].reading,/空头向多头/);
});
test('missing position windows do not invent a direction',()=>{
 const items=interpretPositions({history:[]});assert.equal(items.length,3);assert.ok(items.every(x=>x.reading.includes('数据不足')));
});
test('mixed directions and coverage are explicitly qualified',()=>{
 const items=interpretPositions({history:[{minutes:5,change:3,sources:['A']},{minutes:15,change:-2,sources:['A','B']}]});
 assert.match(items[0].reading,/方向分化/);assert.match(items[0].reading,/覆盖不同/);assert.match(items[0].watch,/2\/4/);
});
test('account interpretation uses Binance global percentages, separately from top traders',()=>{
 const cards=interpretData({ratios:[{key:'accounts',long:.9,short:.1,sources:['Binance']},{key:'global',long:.4012,short:.5987,sources:['Binance']}]});
 assert.equal(cards.length,1);assert.match(cards[0].title,/Binance 全账户.*非大户/);
 assert.match(cards[0].fact,/多头占比 40\.12%，空头占比 59\.87%/);
 assert.match(cards[0].reading,/偏空/);assert.doesNotMatch(cards[0].fact,/加权|90\.00%/);
 assert.match(cards[0].watch,/不按持仓加权/);
});
test('unavailable or other-exchange account data cannot replace Binance',()=>{
 for(const r of [{key:'global',long:null,short:null,sources:[]},{key:'global',long:.6,short:.4,sources:['Gate']},{key:'global',long:.6,short:null,sources:['Binance']}])assert.deepEqual(interpretData({ratios:[r]}),[]);
 const demo=interpretData({mode:'demo',ratios:[{key:'global',long:0,short:1,sources:[]}]});
 assert.match(demo[0].fact,/模拟数据，非实际行情.*多头占比 0\.00%，空头占比 100\.00%/);
});
