import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectBinanceAggregates} from '../public/binance-agg.js';
import {availableTopTrades} from '../public/top-trades.js';

const now=1790979065432,end=1790979000000,start=end-86400000,hour=3600000;
const row=(a,T=start,fields={})=>({a,T,p:'1',q:'1',f:'100',l:'102',m:false,...fields});
const zero={buy:0,sell:0,net:0,netIn:0,netOut:0,turnover:0,count:0};
function scan(pages,options={}){
  let index=0;
  return collectBinanceAggregates({now:()=>now,pause:async()=>{},fetchPage:async()=>{
    assert.ok(index<pages.length,'unexpected extra request');
    return pages[index++];
  },...options});
}

test('minute-fixed 24h window includes start, excludes end, and preserves direction and trade IDs',async()=>{
  const id=9007199254740993n,queries=[],progress=[];
  let pauses=0;
  const pages=[[
    row(String(id),start,{p:'0.1',q:'0.2',f:'9007199254740995',l:'9007199254740999'}),
    row(String(id+1n),start+hour-1,{p:'2',q:'3',m:true})
  ],[row(String(id+2n),end-1,{q:'4'}),row(String(id+3n),end,{q:'999999'})]];
  const result=await scan([],{
    fetchPage:async params=>{queries.push(params);assert.ok(pages.length);return pages.shift();},
    pause:async()=>{pauses++;},onProgress:p=>progress.push(p)
  });
  assert.deepEqual(queries,[{startTime:start,endTime:start+hour-1},{fromId:String(id+2n)}]);
  assert.equal(pauses,1);
  assert.deepEqual(progress,[{pages:1,records:2},{pages:2,records:3}]);
  assert.equal(result.schemaVersion,1);assert.equal(result.recordType,'binance-aggregate');
  assert.equal(result.windowStart,start);assert.equal(result.windowEnd,end);
  assert.equal(result.windowEnd-result.windowStart,86400000);
  assert.equal(result.fetchedAt,now);assert.equal(result.limit,100);
  assert.deepEqual(result.sources,[{name:'Binance',status:'ok',records:3,pages:2}]);
  assert.deepEqual(result.rows.map(r=>[r.id,r.side,r.amount]),[
    [String(id+1n),'sell',6],[String(id+2n),'buy',4],[String(id),'buy',0.02]
  ]);
  assert.deepEqual(result.rows[2],{exchange:'Binance',id:String(id),time:start,side:'buy',
    price:'0.1',quantity:'0.2',amount:0.02,firstTradeId:'9007199254740995',lastTradeId:'9007199254740999'});
  assert.deepEqual(result.totals,{buy:4.02,sell:6,net:-1.98,netIn:0,netOut:1.98,turnover:10.02,count:3});
  assert.deepEqual(result.allTradesTotals,result.totals);
});

test('empty seed hours advance by at most one hour, then switch to fromId only',async()=>{
  const queries=[],pages=[[],[row(7,start+hour)],[row(8,end)]];
  const result=await scan([],{fetchPage:async params=>{
    queries.push(params);assert.ok(pages.length);return pages.shift();
  }});
  assert.deepEqual(queries,[{startTime:start,endTime:start+hour-1},
    {startTime:start+hour,endTime:start+2*hour-1},{fromId:'8'}]);
  assert.equal(result.allTradesTotals.count,1);
});

test('24 empty hourly seed queries constitute a complete empty day',async()=>{
  const queries=[];let pauses=0;
  const result=await scan([],{fetchPage:async params=>{queries.push(params);return [];},pause:async()=>{pauses++;}});
  assert.deepEqual(queries,Array.from({length:24},(_,i)=>({startTime:start+i*hour,endTime:start+(i+1)*hour-1})));
  assert.equal(pauses,23);assert.deepEqual(result.rows,[]);
  assert.deepEqual(result.sources,[{name:'Binance',status:'ok',records:0,pages:24}]);
  assert.deepEqual(result.totals,zero);assert.deepEqual(result.allTradesTotals,zero);
});

test('top100 ranks across pages while full totals retain all 150 aggregates',async()=>{
  const rows=Array.from({length:150},(_,i)=>row(i+1,start+i,{p:'0.1',q:String(i+1),m:i%2===1}));
  const result=await scan([rows.slice(0,75),rows.slice(75),[row(151,end)]]);
  assert.deepEqual(result.rows.map(r=>r.id),Array.from({length:100},(_,i)=>String(150-i)));
  assert.deepEqual(result.totals,{buy:500,sell:505,net:-5,netIn:0,netOut:5,turnover:1005,count:100});
  assert.deepEqual(result.allTradesTotals,{buy:562.5,sell:570,net:-7.5,netIn:0,netOut:7.5,turnover:1132.5,count:150});
  assert.deepEqual(result.sources,[{name:'Binance',status:'ok',records:150,pages:3}]);
});

test('18-decimal amounts rank exactly before Number conversion, including the top100 cutoff',async()=>{
  const rows=Array.from({length:101},(_,i)=>row(i+1,start+i,{p:`1.${String(101-i).padStart(18,'0')}`}));
  const result=await scan([rows.slice(0,50),rows.slice(50),[row(102,end)]]);
  assert.ok(result.rows.every(r=>r.amount===1));
  assert.deepEqual(result.rows.map(r=>r.id),Array.from({length:100},(_,i)=>String(i+1)));
  assert.equal(result.totals.buy,100);assert.equal(result.allTradesTotals.buy,101);
  assert.equal(result.totals.count,100);assert.equal(result.allTradesTotals.count,101);
});

test('tiny positive high-decimal products survive ranking and summation',async()=>{
  const result=await scan([[row(1,start,{p:'0.000000000000000001',q:'0.000000000000000001'}),
    row(2,start,{p:'0.000000000000000001',q:'0.000000000000000002',m:true})],[row(3,end)]]);
  assert.deepEqual(result.rows.map(r=>[r.id,r.amount]),[['2',2e-36],['1',1e-36]]);
  assert.ok(result.rows.every(r=>r.amount>0));
  assert.deepEqual(result.totals,{buy:1e-36,sell:2e-36,net:-1e-36,netIn:0,netOut:1e-36,turnover:3e-36,count:2});
  assert.deepEqual(result.allTradesTotals,result.totals);
});

test('scanner exact net survives validation of large nearly balanced rounded totals',async()=>{
  const result=await scan([[row(1,start,{p:'134252875.02'}),row(2,start,{p:'134251875',m:true})],[row(3,end)]]);
  assert.equal(result.allTradesTotals.net,1000.02);
  assert.notEqual(result.allTradesTotals.buy-result.allTradesTotals.sell,result.allTradesTotals.net);
  assert.equal(availableTopTrades(result,now).topTrades,result);
  const bad=structuredClone(result);
  bad.allTradesTotals.net+=0.01;bad.allTradesTotals.netIn+=0.01;
  assert.equal(availableTopTrades(bad,now).topTrades,null);
});

test('empty fromId page is incomplete, even after a valid short seed page',async()=>{
  await assert.rejects(scan([[row(1)],[]]),{name:'Error'});
});

for(const [name,pages] of [
  ['gap within a page',[[row(1),row(3)],[row(4,end)]]],
  ['repeat within a page',[[row(1),row(1)],[row(2,end)]]],
  ['gap across pages',[[row(1)],[row(3),row(4,end)]]],
  ['repeat across pages',[[row(1)],[row(1),row(2,end)]]],
  ['gap at end boundary',[[row(1)],[row(3,end)]]],
  ['time regression within a page',[[row(1,start+1),row(2,start)],[row(3,end)]]],
  ['time regression across pages',[[row(1,start+1)],[row(2,start),row(3,end)]]]
])test(`rejects ${name}`,async()=>{
  await assert.rejects(scan(pages),{name:'Error'});
});

for(const [name,pages] of [
  ['before window start',[[row(1,start-1)],[row(2,end)]]],
  ['before advanced seed', [[],[row(1,start+hour-1)],[row(2,end)]]],
  ['at exclusive seed end',[[row(1,start+hour)],[row(2,end)]]],
  ['later row outside seed query',[[row(1),row(2,start+hour)],[row(3,end)]]],
  ['window end in initial seed',[[row(1,end)]]],
  ['beyond window end in initial seed',[[row(1,end+1)]]]
])test(`rejects seed records ${name}`,async()=>{
  await assert.rejects(scan(pages),{name:'Error'});
});

for(const [name,fields] of [
  ['unsafe aggregate ID',{a:Number.MAX_SAFE_INTEGER+1}],['negative aggregate ID',{a:-1}],
  ['fractional aggregate ID',{a:1.5}],['malformed aggregate ID',{a:'1x'}],
  ['unsafe first trade ID',{f:Number.MAX_SAFE_INTEGER+1}],['malformed first trade ID',{f:'x'}],
  ['negative last trade ID',{l:-1}],['unsafe last trade ID',{l:Number.MAX_SAFE_INTEGER+1}],
  ['reversed trade range',{f:'103',l:'102'}],['nonboolean direction',{m:'false'}],
  ['string timestamp',{T:String(start)}],['fractional timestamp',{T:start+0.5}],
  ['nonfinite timestamp',{T:Infinity}],['unsafe timestamp',{T:Number.MAX_SAFE_INTEGER+1}],
  ['zero price',{p:'0'}],['zero quantity',{q:'0'}],['negative price',{p:'-1'}],
  ['negative quantity',{q:'-1'}],['malformed price',{p:'bad'}],['malformed quantity',{q:'bad'}],
  ['nonfinite price',{p:Infinity}],['nonfinite quantity',{q:NaN}],
  ['excess price precision',{p:'0.0000000000000000001'}],['excess quantity precision',{q:'0.0000000000000000001'}]
])test(`rejects ${name}`,async()=>{
  await assert.rejects(scan([[row(1,start,fields)],[row(2,end)]]),{name:'Error'});
});

for(const field of ['a','T','p','q','f','l','m'])test(`rejects missing ${field}`,async()=>{
  const bad=row(1);delete bad[field];
  await assert.rejects(scan([[bad],[row(2,end)]]),{name:'Error'});
});

test('rejects non-array injected pages',async()=>{
  for(const page of [null,{},'invalid'])await assert.rejects(scan([page]),{name:'Error'});
});

test('rejects a nonfinite amount even when both decimal operands are finite',async()=>{
  const large='1'+'0'.repeat(200);
  assert.ok(Number.isFinite(Number(large)));
  await assert.rejects(scan([[row(1,start,{p:large,q:large})],[row(2,end)]]),{name:'Error'});
});

test('maxPages rejects partial results without another request but permits completion at the limit',async()=>{
  let requests=0;
  await assert.rejects(scan([],{maxPages:2,fetchPage:async()=>[row(++requests)]}),{name:'Error'});
  assert.equal(requests,2);
  const result=await scan([[row(1)],[row(2,end)]],{maxPages:2});
  assert.equal(result.allTradesTotals.count,1);
});

test('abort before scanning makes no request or pause',async()=>{
  const controller=new AbortController(),reason=new Error('cancelled before request');
  controller.abort(reason);let requests=0,pauses=0;
  await assert.rejects(scan([],{signal:controller.signal,fetchPage:async()=>{requests++;return [];},pause:async()=>{pauses++;}}),e=>e===reason);
  assert.equal(requests,0);assert.equal(pauses,0);
});

test('abort during an injected pause prevents the next request',async()=>{
  const controller=new AbortController(),reason=new Error('cancelled during pause');
  let requests=0,pauses=0;
  await assert.rejects(scan([],{signal:controller.signal,fetchPage:async()=>{requests++;return [row(1)];},
    pause:async()=>{pauses++;controller.abort(reason);}}),e=>e===reason);
  assert.equal(requests,1);assert.equal(pauses,1);
});

test('abort while fetching discards even a completing page',async()=>{
  const controller=new AbortController(),reason=new Error('cancelled during request');let requests=0;
  await assert.rejects(scan([],{signal:controller.signal,fetchPage:async()=>{
    if(++requests===1)return [row(1)];
    controller.abort(reason);return [row(2,end)];
  }}),e=>e===reason);
  assert.equal(requests,2);
});

for(const complete of [false,true])test(`onProgress cancellation ${complete?'at completion':'before pause'} is honored`,async()=>{
  const controller=new AbortController(),reason=new Error('cancelled from progress');let requests=0,pauses=0;
  await assert.rejects(scan([],{signal:controller.signal,
    fetchPage:async()=>{requests++;return complete?[]:[row(1)];},
    onProgress:({pages})=>{if(!complete||pages===24)controller.abort(reason);},
    pause:async()=>{assert.equal(controller.signal.aborted,false);pauses++;}
  }),e=>e===reason);
  assert.equal(requests,complete?24:1);assert.equal(pauses,complete?23:0);
});

test('deadline expiring during pause prevents another request',async()=>{
  let clock=now,requests=0;
  await assert.rejects(scan([],{now:()=>clock,fetchPage:async()=>{requests++;return [row(1)];},
    pause:async()=>{clock=now+18*60000+1;}}),{name:'Error'});
  assert.equal(requests,1);
});

test('deadline expiring while fetching rejects a completing page',async()=>{
  let clock=now,requests=0;
  await assert.rejects(scan([],{now:()=>clock,fetchPage:async()=>{
    if(++requests===1)return [row(1)];
    clock=now+18*60000+1;return [row(2,end)];
  }}),{name:'Error'});
  assert.equal(requests,2);
});

for(const status of [451,429])test(`HTTP ${status} fails without retry or fallback`,async t=>{
  const requests=[];let pauses=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    requests.push({url:new URL(url),options});
    return new Response('blocked',{status});
  });
  await assert.rejects(collectBinanceAggregates({now:()=>now,pause:async()=>{pauses++;}}),new RegExp(`Binance HTTP ${status}`));
  assert.equal(requests.length,1);assert.equal(pauses,0);
  const {url,options}=requests[0];
  assert.equal(url.origin,'https://fapi.binance.com');assert.equal(url.pathname,'/fapi/v1/aggTrades');
  assert.deepEqual(Object.fromEntries(url.searchParams),{symbol:'APTUSDT',limit:'1000',startTime:String(start),endTime:String(start+hour-1)});
  assert.ok(options.signal instanceof AbortSignal);assert.equal(options.signal.aborted,false);
});
