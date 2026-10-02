import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scanTrades,assembleTopTrades} from '../scripts/top-trades.mjs';
import {availableTopTrades,DAY_MS} from '../public/top-trades.js';
const end=1790979000000,start=end-DAY_MS;
const row=(id,ts,price='1',size='10',side='Buy')=>({tradeId:String(id),ts:String(ts),price,size,side});

test('paginates beyond24h, includes exact start, excludes end, ranks and sums only eligible records',async()=>{
  const pages=[[row(6,end,'1','1000'),row(5,end-1,'0.1','0.2'),row(4,start+1,'2','10','Sell')],[row(3,start,'1','100'),row(2,start-1,'100','100')]];
  const cursors=[];
  const r=await scanTrades({name:'Bitget',start,end,page:async c=>{cursors.push(c);return pages.shift()}});
  assert.deepEqual(cursors,[null,'4']);assert.equal(r.records,3);assert.equal(r.pages,2);
  const s=assembleTopTrades([r],start,end,end+1);
  assert.deepEqual(s.rows.map(r=>r.id),['3','4','5']);
  assert.equal(s.totals.buy,100.02);assert.equal(s.totals.sell,20);assert.equal(s.totals.net,80.02);
  assert.equal(s.totals.netOut,0);assert.equal(s.allTradesTotals.turnover,120.02);
});
test('top100 is merged across complete sources; daily totals are not top100 totals',async()=>{
  const rows=Array.from({length:150},(_,i)=>row(200-i,end-1-i,'1',String(i+1),i%2?'Sell':'Buy'));
  rows.push(row(1,start-1));
  const bitget=await scanTrades({name:'Bitget',start,end,page:async()=>rows});
  const okx=await scanTrades({name:'OKX',start,end,multiplier:'10',page:async()=>[{tradeId:'2',ts:String(end-1),px:'2',sz:'100',side:'buy'},{tradeId:'1',ts:String(start-1),px:'2',sz:'1',side:'sell'}]});
  const s=assembleTopTrades([bitget,okx,{name:'Gate',status:'error',records:0,pages:0,error:'incomplete'}],start,end,end+1);
  assert.equal(s.rows.length,100);assert.equal(s.rows[0].exchange,'OKX');assert.equal(s.rows[0].amount,2000);assert.equal(s.rows[0].quantity,'1000');
  assert.equal(s.allTradesTotals.count,151);assert.equal(s.totals.count,100);assert.ok(s.allTradesTotals.turnover>s.totals.turnover);
  assert.ok(s.rows.every((r,i)=>!i||s.rows[i-1].amount>=r.amount));
});
test('incomplete, repeated and stalled cursors fail closed; never publish partial day',async()=>{
  await assert.rejects(scanTrades({name:'Bitget',start,end,maxPages:1,page:async()=>[row(2,end-1)]}),/分页上限/);
  await assert.rejects(scanTrades({name:'Bitget',start,end,page:async()=>[row(2,end-1)]}),/游标/);
  await assert.rejects(scanTrades({name:'Bitget',start,end,page:async()=>[]}),/提前结束/);
  await assert.rejects(scanTrades({name:'Bitget',start,end,deadline:1,page:async()=>[]}),/超时/);
  await assert.rejects(scanTrades({name:'Bitget',start,end,page:async()=>[row(2,end-1),row(2,end-1)]}),/顺序/);
  await assert.rejects(scanTrades({name:'Bitget',start,end,page:async()=>[row(2,end-1,'bad')]}),/precision/);
  assert.equal(assembleTopTrades([{name:'Bitget',status:'error',error:'offline'}],start,end).totals,null);
});
test('same timestamp pages keep distinct executions without numeric ID rounding',async()=>{
  const ids=['1490035064378757122','1490035064378757121','1490035064378757120'];
  const pages=[[row(ids[0],end-1),row(ids[1],end-1)],[row(ids[2],end-1),row('1',start-1)]];
  const s=assembleTopTrades([await scanTrades({name:'Bitget',start,end,page:async()=>pages.shift()})],start,end,end+1);
  assert.equal(s.totals.count,3);assert.equal(new Set(s.rows.map(r=>r.id)).size,3);
});
test('empty valid day differs from unavailable snapshot and stale snapshots are rejected',async()=>{
  const r=await scanTrades({name:'Bitget',start,end,page:async()=>[row(1,start-1)]});
  const s=assembleTopTrades([r],start,end,end+1);
  assert.equal(s.rows.length,0);assert.equal(s.totals.net,0);
  assert.equal(availableTopTrades(s,end+1000).topTrades,s);
  assert.equal(availableTopTrades(s,end+3600001).topTrades,null);
  assert.equal(availableTopTrades({...s,windowStart:start+1},end+1000).topTrades,null);
  assert.equal(availableTopTrades(null,end).topTrades,null);
});
test('snapshot validation fails closed without breaking market rendering',async()=>{
  const source=await scanTrades({name:'Bitget',start,end,page:async()=>[row(2,end-1),row(1,start-1)]});
  const valid=assembleTopTrades([source],start,end,end+1);
  for(const mutate of [s=>{s.sources={}},s=>{s.sources=[null]},s=>{s.rows=[null]},s=>{s.rows=[]},s=>{s.totals.buy=999},s=>{s.rows[0].amount=999},s=>{s.allTradesTotals.count=99}]){
    const broken=structuredClone(valid);mutate(broken);
    assert.equal(availableTopTrades(broken,end+1000).topTrades,null);
  }
  assert.equal(availableTopTrades(valid,end+1000).topTrades,valid);
});
test('unsafe numeric IDs cannot become pagination cursors',async()=>{
  await assert.rejects(scanTrades({name:'Bitget',start,end,page:async()=>[{...row(2,end-1),tradeId:1490035064378757122}]}),/字符串/);
});
test('decimal products retain precision through ranking and summation',async()=>{
  const r=await scanTrades({name:'Bitget',start,end,page:async()=>[row(3,end-1,'0.000000000001','1.1'),row(2,end-2,'0.000000000001','1.9'),row(1,start-1)]});
  const s=assembleTopTrades([r],start,end,end+1);
  assert.deepEqual(s.rows.map(r=>r.id),['2','3']);
  assert.equal(s.totals.buy,0.000000000003);
});
test('crossing boundary after deadline is not a complete scan',async()=>{
  await assert.rejects(scanTrades({name:'Bitget',start,end,deadline:Date.now()+20,page:async()=>{await new Promise(r=>setTimeout(r,40));return [row(1,start-1)]}}),/超时/);
});
