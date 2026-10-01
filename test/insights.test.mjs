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
