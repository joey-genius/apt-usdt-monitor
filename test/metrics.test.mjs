import {test} from 'node:test';
import assert from 'node:assert/strict';
import {change,historical,flow,weighted,normalizeFunding,aggregateHistory} from '../lib.mjs';
test('weight only valid participating exchanges, never treat missing as zero',()=>{
  const result=weighted([{name:'A',value:30,price:2},{name:'B',value:10,price:4},{name:'C',value:100,price:null}],'price');
  assert.equal(result.value,2.5);assert.deepEqual(result.sources,['A','B']);assert.equal(weighted([],'price').value,null);
});
test('funding rates compare on the same eight-hour basis',()=>{
  assert.equal(normalizeFunding(.0000125,1),.0001);assert.equal(normalizeFunding(.0001,8),.0001);assert.equal(normalizeFunding(.001,null),null);
});
test('historical change excludes exchanges missing either side',()=>{
  const result=aggregateHistory([{name:'A',current:110,previous:100},{name:'B',current:200,previous:null},{name:'C',current:null,previous:500}]);
  assert.equal(result.current,110);assert.equal(result.previous,100);assert.deepEqual(result.sources,['A']);assert.ok(Math.abs(result.change-10)<1e-9);
});
test('change handles missing history and zero denominators',()=>{assert.equal(change(110,100),10.000000000000009);assert.equal(change(100,0),null);assert.equal(change(null,100),null)});
test('history uses a prior snapshot and rejects stale data',()=>{const rows=[{timestamp:100,sumOpenInterestValue:'5'},{timestamp:200,sumOpenInterestValue:'8'}];assert.equal(historical(rows,190,100),5);assert.equal(historical(rows,500,100),null);assert.equal(historical(rows,50,100),null)});
test('flow counts only full candles and requires continuous coverage',()=>{const k=(t,q,b)=>[t,0,0,0,0,0,0,q,0,0,b];const rows=[k(0,100,70),k(300000,100,20),k(600000,100,100)];assert.equal(flow(rows,10,650000,300000),-20);assert.equal(flow(rows.slice(1),10,650000,300000),null);assert.equal(flow([rows[0],rows[0]],10,650000,300000),null);assert.equal(flow([],5,650000,300000),null)});
