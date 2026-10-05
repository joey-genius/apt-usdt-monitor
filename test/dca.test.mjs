import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateDca} from '../public/dca.js';
const now=Date.UTC(2026,9,5),DAY=86400000;
const rows=Array.from({length:365},(_,i)=>[now-(365-i)*DAY,0,0,0,2]);
test('flat prices produce unit index and identical means',()=>{const d=calculateDca(rows,2,now);assert.ok(Math.abs(d.index-1)<1e-10);assert.equal(d.harmonic,2);});
test('fits exponential time trend and ignores incomplete current day',()=>{const r=rows.map((k,i)=>[k[0],0,0,0,Math.exp(i*.001)]);r.push([now,0,0,0,99999]);const d=calculateDca(r,2,now);assert.ok(Math.abs(d.fitted-Math.exp(.365))<1e-10);});
test('rejects missing days, stale history and nonpositive prices',()=>{assert.throws(()=>calculateDca(rows.slice(1),2,now));assert.throws(()=>calculateDca(rows,2,now+DAY));assert.throws(()=>calculateDca(rows,0,now));});
