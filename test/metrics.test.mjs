import {test} from 'node:test';
import assert from 'node:assert/strict';
import {change,historical,flow} from '../lib.mjs';
test('change handles missing history and zero denominators',()=>{assert.equal(change(110,100),10.000000000000009);assert.equal(change(100,0),null);assert.equal(change(null,100),null)});
test('history uses a prior snapshot and rejects stale data',()=>{const rows=[{timestamp:100,sumOpenInterestValue:'5'},{timestamp:200,sumOpenInterestValue:'8'}];assert.equal(historical(rows,190,100),5);assert.equal(historical(rows,500,100),null);assert.equal(historical(rows,50,100),null)});
test('flow counts only full candles and requires continuous coverage',()=>{const k=(t,q,b)=>[t,0,0,0,0,0,0,q,0,0,b];const rows=[k(0,100,70),k(300000,100,20),k(600000,100,100)];assert.equal(flow(rows,10,650000,300000),-20);assert.equal(flow(rows.slice(1),10,650000,300000),null);assert.equal(flow([rows[0],rows[0]],10,650000,300000),null);assert.equal(flow([],5,650000,300000),null)});
