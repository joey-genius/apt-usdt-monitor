import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { renderReport } from '../public/report.js';
import { availableTopTrades } from '../public/top-trades.js';

test('every shipped browser script parses', () => {
  for (const file of readdirSync(new URL('../public/', import.meta.url)).filter(f => f.endsWith('.js'))) {
    execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../public/' + file, import.meta.url))]);
  }
});
function report(data) {
  class Element {
    constructor(tag) { this.tag=tag; }
    children = []; textContent = ''; className = '';
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute() {}
    set innerHTML(value) { throw Error('Report must render external data as text: '+value); }
    text() { return this.textContent + this.children.map(c => c.text()).join(' '); }
    find(tag) { return this.children.flatMap(c => [...(c.tag===tag?[c]:[]),...c.find(tag)]); }
  }
  const root = new Element('root');
  const original = globalThis.document;
  globalThis.document = { getElementById: () => root, createElement: tag => new Element(tag) };
  try { renderReport(data); return root; } finally { globalThis.document = original; }
}
const timestamp=Date.UTC(2026,9,3,12);
const ratios=[
  {key:'accounts',ratio:1.2345,long:.5524,short:.4475},
  {key:'positions',ratio:2.3456,long:.7011,short:.2988},
  {key:'global',ratio:.8765,long:.4671,short:.5328},
].map(r=>({...r,timestamp,sources:['Binance'],error:null,history:[{...r,timestamp}]}));

test('report preserves separate official ratios and both percentages regardless of OI weights',()=>{
  const input={mode:'live',price:1,funding:.0001,ratios,exchanges:[{name:'Binance',value:1},{name:'Bybit',value:99999999}],history:[{minutes:5,previous:900000,current:1000000,change:11.11,sources:['Binance']}]};
  const root=report(input),text=root.text();
  assert.match(text,/\$1\.00000000/);
  assert.match(text,/增减 \+\$100\.00K/);
  const section=root.children.find(c=>c.className.includes('binance-traders'));
  const groups=section.children.filter(c=>c.className.includes('report-ratio'));
  assert.equal(groups.length,3);
  assert.match(groups[0].text(),/ACCOUNT 1\.2345.*多 55\.24%.*空 44\.75%/);
  assert.match(groups[1].text(),/POSITION 2\.3456.*多 70\.11%.*空 29\.88%/);
  assert.match(groups[2].text(),/全账户多空人数比 · 非大户指标 0\.8765/);
  assert.ok(groups[2].className.includes('all-account-comparison'));
  assert.match(text,/来源：Binance 官方公开数据 · 最后更新/);
  const other=report({...input,exchanges:[{name:'Gate',value:500000000}]}).children.find(c=>c.className.includes('binance-traders'));
  assert.equal(section.text(),other.text());
  assert.doesNotMatch(section.text(),/\$|\bUSD\b|USDT 等值|净买入|净卖出/);
});

test('unavailable ratios never become zero or fall back to another exchange',()=>{
  for(const missing of [[],[{key:'accounts',ratio:null,long:null,short:null,sources:[],error:'Binance HTTP 451'}],[{...ratios[0],sources:['Gate','Bybit']}]] ){
    const text=report({ratios:missing}).text();
    assert.match(text,/Binance 数据不可用/);
    assert.doesNotMatch(text,/ACCOUNT 0\.0000|ACCOUNT 1\.2345|多 0\.00%/);
  }
  const zero=report({ratios:[{...ratios[0],ratio:0,long:0,short:1}]}).text();
  assert.match(zero,/ACCOUNT 0\.0000.*多 0\.00%.*空 100\.00%/);
  assert.match(report({ratios:[{...ratios[0],short:null}]}).text(),/空 不可用/);
});

test('history stays separate per metric, newest first, at most twelve rows',()=>{
  const history=Array.from({length:15},(_,i)=>({timestamp:timestamp+i*300000,ratio:1+i/100,long:.6,short:.3999}));
  const root=report({ratios:ratios.map(r=>({...r,history}))});
  const tables=root.find('table');assert.equal(tables.length,3);
  for(const table of tables){
    const rows=table.find('tbody')[0].children;
    assert.equal(rows.length,12);
    assert.match(rows[0].text(),/60\.00% 39\.99% 1\.1400/);
    assert.match(rows.at(-1).text(),/1\.0300/);
  }
});

test('source errors are rendered literally as text and simulated values are labeled',()=>{
  const error='<img src=x onerror=alert(1)> <script>external</script>';
  const root=report({ratios:[{...ratios[0],ratio:null,long:null,short:null,sources:[],error}]});
  assert.ok(root.text().includes('来源错误：'+error));
  assert.equal(root.find('img').length,0);assert.equal(root.find('script').length,0);
  const demo=report({mode:'demo',ratios:ratios.map(r=>({...r,sources:[]}))}).text();
  assert.match(demo,/全部为模拟值/);assert.match(demo,/模拟数据 · 非 Binance 实际读数/);
  assert.match(demo,/ACCOUNT 1\.2345/);
});

test('old trade amounts and large-flow payloads do not appear in the report',()=>{
  const text=report({largeTradeThreshold:123456,history:[{minutes:5,flow:987654,largeFlow:{net:987654,buy:987654,sell:0}}]}).text();
  assert.doesNotMatch(text,/123456|987\.65K|大额成交|主动净买入/);
  assert.match(text,/无最低金额门槛/);
});

test('browser demo boots without removed controls and provides explicit short/history fields',async()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{value:'',textContent:'',innerHTML:'',style:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn}}]));
  elements.get('mode').value='demo';
  let rendered;
  const context={document:{getElementById:id=>elements.get(id)},location:{hostname:'example.com'},Date,console,setInterval(){},setTimeout,renderInsights(){},renderReport(d){rendered=d},collect(){throw Error('Demo must not fetch')}};
  const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  vm.runInNewContext(code,context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(rendered.mode,'demo');
  assert.equal(rendered.topTrades,null);
  assert.equal(rendered.ratios.length,3);
  for(const r of rendered.ratios){assert.equal(typeof r.short,'number');assert.equal(r.history.length,12);assert.equal(r.sources.length,0);}
  assert.match(elements.get('status').textContent,/所有数值均为模拟数据/);
  assert.doesNotMatch(code,/largeFlow|threshold|large-flows/);
});

const topTrades={
  schemaVersion:1,windowStart:timestamp-86400000,windowEnd:timestamp,fetchedAt:timestamp+60000,limit:100,
  rows:[
    {exchange:'Binance',id:'small',time:timestamp-3000,side:'buy',price:'0.12345678',quantity:'0.01',amount:.0012345678},
    {exchange:'Bybit',id:'largest',time:timestamp-2000,side:'sell',price:'5.00',quantity:'200',amount:1000},
    {exchange:'Binance',id:'middle',time:timestamp-1000,side:'buy',price:'5.00',quantity:'100',amount:500},
  ],
  sources:[{name:'Binance',status:'ok',records:102,pages:2},{name:'Bybit',status:'ok',records:100,pages:1},{name:'Gate',status:'error',records:7,pages:1,error:'Incomplete window'},{name:'OKX',status:'unsupported',records:0,pages:0}],
  totals:{buy:500.0012345678,sell:1000,net:-499.9987654322,netIn:0,netOut:499.9987654322,turnover:1500.0012345678,count:3},
  allTradesTotals:{buy:25000,sell:20000,net:5000,netIn:5000,netOut:0,turnover:45000,count:202},
};

test('Top 100 follows Binance ratios, sorts across venues without an amount floor, and preserves source data',()=>{
  const before=structuredClone(topTrades);
  const root=report({ratios,topTrades});
  const section=root.children.find(c=>c.className.includes('top-trades'));
  assert.ok(root.children[root.children.indexOf(section)-1].className.includes('binance-traders'));
  const table=section.find('table')[0],rows=table.find('tbody')[0].children;
  assert.deepEqual(rows.map(r=>r.children.at(-1).text()),['largest','middle','small']);
  assert.deepEqual(rows.map(r=>r.children[0].text()),['1','2','3']);
  assert.deepEqual(rows.map(r=>r.children[3].text()),['主动卖出','主动买入','主动买入']);
  assert.equal(rows[2].children[4].text(),'0.12345678');
  assert.equal(rows[2].children[5].text(),'0.01');
  assert.equal(table.find('th').length,8);
  assert.match(table.text(),/价格（APTUSDT）.*数量（APT）.*成交金额（USDT）.*交易 ID/);
  assert.match(section.text(),/已返回 3 \/ 100 笔（不足 100 笔/);
  assert.match(section.text(),/窗口（本地）/);
  assert.match(section.text(),/窗口（UTC）：2026-10-02T12:00:00\.000Z 至 2026-10-03T12:00:00\.000Z（截止）/);
  assert.match(section.text(),/采集完成：本地 .* UTC 2026-10-03T12:01:00\.000Z/);
  assert.equal(rows[0].children[1].text(),new Date(topTrades.rows[1].time).toLocaleString('zh-CN',{hour12:false}));
  assert.deepEqual(topTrades,before);
});

test('Top 100 and full-window summaries label their distinct coverage and signed net',()=>{
  const section=report({topTrades}).children.find(c=>c.className.includes('top-trades'));
  const text=section.text(),full=section.find('details')[0];
  assert.match(text,/最近一次完成采集.*非实时逐笔行情/);
  assert.match(text,/完整覆盖平台：Binance \/ Bybit；失败或不支持的平台不纳入排行及汇总/);
  assert.match(text,/Binance · 完整采集 · 102 条记录 \/ 2 页/);
  assert.match(text,/Gate · 采集失败（未纳入） · 7 条记录 \/ 1 页 · Incomplete window/);
  assert.match(text,/OKX · 不支持（未纳入）/);
  assert.match(text,/主动买入不等于实际充值入金/);
  assert.match(text,/Top 100 有符号净额仅为入选成交的买卖差，不是完整 24 小时净额/);
  assert.match(text,/Top 100 主动买入 500\.00123457 USDT/);
  assert.match(text,/Top 100 主动卖出 1,000\.00 USDT/);
  assert.match(text,/Top 100 有符号净额（买 - 卖） -499\.99876543 USDT/);
  assert.match(full.find('summary')[0].text(),/完整 24 小时汇总 · 仅完整覆盖平台 · 非 Top 100/);
  assert.match(full.text(),/同一截止窗口内全部已采集成交，不限于 Top 100；不是全市场/);
  assert.match(full.text(),/完整 24 小时 有符号净额（买 - 卖） \+5,000\.00 USDT/);
  assert.match(full.text(),/汇总记录数：202 笔/);
});

test('missing or expired snapshots are distinct from a fully collected empty window',()=>{
  const missing=report({topTrades:null,topTradesError:'快照已过期，请等待下一次采集'});
  assert.match(missing.text(),/Top 100 快照不可用（缺失或已过期）：快照已过期/);
  const status=missing.children.find(c=>c.className.includes('top-trades')).children.find(c=>c.className.includes('top-trades-status'));
  assert.ok(status.className.includes('unavailable'));
  assert.doesNotMatch(missing.text(),/无成交记录|Top 100 主动买入 0/);
  assert.equal(missing.find('table').length,0);
  const zero={buy:0,sell:0,net:0,netIn:0,netOut:0,turnover:0,count:0};
  const empty=report({topTrades:{...topTrades,rows:[],sources:[{name:'Binance',status:'ok',records:0,pages:1}],totals:zero,allTradesTotals:zero}});
  assert.match(empty.text(),/无成交记录（0 \/ 100 笔），不是数据缺失/);
  assert.match(empty.text(),/Top 100 主动买入 0\.00 USDT/);
  assert.doesNotMatch(empty.children.find(c=>c.className.includes('top-trades')).text(),/Top 100 快照不可用/);
  assert.equal(empty.find('table').length,0);
  const uncovered=report({topTrades:{...topTrades,rows:[],sources:topTrades.sources.filter(s=>s.status!=='ok'),totals:null,allTradesTotals:null}}).text();
  assert.match(uncovered,/无完整覆盖平台，数据不可用，不代表零成交/);
  assert.match(uncovered,/Top 100 汇总不可用，不以零替代/);
  assert.match(uncovered,/完整 24 小时 汇总不可用，不以零替代/);
});

test('trade IDs, venues, source errors and snapshot errors are rendered as literal text',()=>{
  const malicious='<img src=x onerror=alert(1)><script>alert(1)</script>';
  const root=report({topTrades:{...topTrades,rows:[{...topTrades.rows[0],id:malicious,exchange:malicious}],sources:[{...topTrades.sources[0],name:malicious,error:malicious}]}});
  const cells=root.find('tbody')[0].children[0].children;
  assert.equal(cells[7].text(),malicious);assert.equal(cells[2].text(),malicious);
  assert.ok(root.find('li')[0].text().includes(malicious));
  assert.equal(root.find('img').length,0);assert.equal(root.find('script').length,0);
  const missing=report({topTrades:null,topTradesError:malicious});
  assert.ok(missing.text().includes(malicious));assert.equal(missing.find('img').length,0);
});

test('demo never displays actual Top 100 records even if a snapshot is supplied',()=>{
  const root=report({mode:'demo',topTrades});
  assert.match(root.text(),/演示模式：没有实际 Top 100 成交记录，不生成模拟成交/);
  assert.equal(root.find('table').length,0);
  assert.doesNotMatch(root.text(),/largest|完整覆盖平台：Binance/);
});

test('Top 100 keeps at most one hundred rows in descending amount order',()=>{
  const rows=Array.from({length:105},(_,i)=>({...topTrades.rows[0],id:String(i),amount:i}));
  const root=report({topTrades:{...topTrades,rows,totals:null}});
  const rendered=root.find('tbody')[0].children;
  assert.equal(rendered.length,100);
  assert.equal(rendered[0].children[7].text(),'104');
  assert.equal(rendered.at(-1).children[7].text(),'5');
  assert.match(root.text(),/已返回 100 \/ 100 笔/);
  assert.doesNotMatch(root.text(),/不足 100 笔/);
});

test('page links formulas and preserves ratio source and unchanged insights cache version',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const boot=readFileSync(new URL('../public/boot.js',import.meta.url),'utf8');
  assert.match(html,/href="#top-trades-method"/);assert.match(html,/id="top-trades-method"/);
  assert.match(html,/netIn = max\(B - S, 0\)/);assert.match(html,/netOut = max\(S - B, 0\)/);
  assert.match(html,/binance\.com\/zh-CN\/futures\/funding-history\/perpetual\/trading-data/);
  for(const name of ['style.css','boot.js'])assert.ok(html.includes(name+'?v=20261003-binance-agg'));
  for(const name of ['report.js','market.js','binance-agg.js'])assert.ok(app.includes(name+'?v=20261003-binance-agg'));
  assert.match(boot,/app\.js\?v=20261003-binance-agg/);
  assert.match(app,/insight-ui\.js\?v=20261003-binance-traders/);
  assert.doesNotMatch(app,/fetch\([^\n]*top-trades/);
});

test('failed market refresh removes previous Top 100 while retaining other market context',async()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{value:'',textContent:'',innerHTML:'',style:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn}}]));
  elements.get('mode').value='live';
  let rendered,requests=0;
  const data={mode:'live',price:5,topTrades,fetchedAt:timestamp,exchanges:[],history:[],chart:[],errors:[]};
  const context={document:{getElementById:id=>elements.get(id)},location:{hostname:'example.com'},Date,console,setInterval(){},setTimeout,renderInsights(){},renderReport(d){rendered=d},async collect(){if(++requests>1)throw Error('Offline');return data;}};
  const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  vm.runInNewContext(code,context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(rendered.topTrades,topTrades);
  await elements.get('refresh').listeners.click();
  assert.equal(requests,2);
  assert.equal(rendered.topTrades,null);
  assert.match(rendered.topTradesError,/本次行情请求失败/);
  assert.equal(rendered.price,5);
  assert.match(elements.get('notice').textContent,/Top 100 已标记不可用/);
  assert.equal(elements.get('refresh').disabled,false);
});

function aggregateSnapshot(now=Date.now()) {
  const rows=[
    {exchange:'Binance',id:'1001',time:now-3000,side:'buy',price:'5',quantity:'1',amount:5,firstTradeId:'101',lastTradeId:'103'},
    {exchange:'Binance',id:'1002',time:now-2000,side:'sell',price:'5',quantity:'10',amount:50,firstTradeId:'104',lastTradeId:'109'},
  ];
  const totals={buy:5,sell:50,net:-45,netIn:0,netOut:45,turnover:55,count:2};
  return {schemaVersion:1,recordType:'binance-aggregate',windowStart:now-86400000,windowEnd:now,fetchedAt:now,rows,sources:[{name:'Binance',status:'ok',records:2,pages:1}],totals,allTradesTotals:{...totals}};
}
const aggregatePanel=root=>root.children.find(c=>c.className.includes('binance-aggregates'));

test('Binance aggregates have independent sorting, IDs, counts and totals without changing the original panel',()=>{
  const binanceAggregates=aggregateSnapshot(),before=structuredClone(binanceAggregates);
  const raw={...topTrades,rows:topTrades.rows.map(r=>({...r,exchange:'Bitget'})),sources:[{name:'Bitget',status:'ok',records:202,pages:3}]};
  const baseline=report({topTrades:raw}).children.find(c=>c.className.includes('top-trades'));
  const root=report({topTrades:raw,binanceAggregates}),panel=aggregatePanel(root);
  assert.equal(root.children.find(c=>c.className.includes('top-trades')).text(),baseline.text());
  assert.match(panel.text(),/币安聚合成交 Top 100 · 近24小时/);
  assert.match(panel.text(),/不是原始委托订单.*不能识别大户.*不与 Bitget/);
  assert.match(panel.text(),/已返回 2 \/ 100 笔/);
  assert.match(panel.text(),/Top 100 主动买入 5\.00 USDT/);
  assert.match(panel.text(),/完整 24 小时 主动卖出 50\.00 USDT/);
  const table=panel.find('table')[0],rows=table.find('tbody')[0].children;
  assert.equal(table.find('th').length,10);
  assert.match(table.text(),/agg ID.*首笔原始成交 ID.*末笔原始成交 ID/);
  assert.deepEqual(rows.map(r=>r.children[7].text()),['1002','1001']);
  assert.deepEqual(rows[1].children.slice(8).map(c=>c.text()),['101','103']);
  assert.deepEqual(rows[0].children.slice(8).map(c=>c.text()),['104','109']);
  assert.doesNotMatch(table.text(),/Bitget|largest|middle/);
  assert.deepEqual(binanceAggregates,before);
});

test('Binance aggregate panel rejects raw, mixed, stale, incomplete and unavailable snapshots independently',()=>{
  const snapshot=aggregateSnapshot();
  for(const binanceAggregates of [
    {...snapshot,recordType:undefined}, {...snapshot,recordType:'raw-trade'},
    {...snapshot,rows:[{...snapshot.rows[0],exchange:'Bitget'},snapshot.rows[1]]},
    {...snapshot,sources:[{...snapshot.sources[0],name:'Bitget'}]},
    {...snapshot,rows:[snapshot.rows[0]]}, aggregateSnapshot(Date.now()-3600001),
    {...snapshot,rows:[{...snapshot.rows[0],firstTradeId:undefined},snapshot.rows[1]]},
    {...snapshot,rows:[{...snapshot.rows[0],lastTradeId:'100'},snapshot.rows[1]]},
    {...snapshot,sources:[{name:'Binance',status:'error',records:0,pages:0,error:'Binance HTTP 451'}]},
  ]){
    const root=report({topTrades,binanceAggregates}),panel=aggregatePanel(root);
    assert.equal(panel.find('table').length,0);
    assert.match(panel.text(),/不可用/);
    assert.doesNotMatch(panel.text(),/1001|1002|主动买入 0/);
    assert.equal(root.children.find(c=>c.className.includes('top-trades')).find('tbody')[0].children.length,3);
  }
  for(const error of ['Binance HTTP 451','Binance HTTP 403','<img src=x onerror=alert(1)>']){
    const root=report({topTrades,binanceAggregatesError:error});
    assert.ok(aggregatePanel(root).text().includes(error));
    assert.equal(root.find('img').length,0);
    assert.doesNotMatch(root.children.find(c=>c.className.includes('top-trades')).text(),/HTTP 451|HTTP 403|onerror/);
  }
  assert.equal(aggregatePanel(report({mode:'demo',binanceAggregates:snapshot})).find('table').length,0);
});

async function browser(scanner,market) {
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{value:'',textContent:'',innerHTML:'',style:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn}}]));
  elements.get('mode').value='live';
  const renders=[],intervals=[];
  let now=Date.now();
  class Clock extends Date {static now(){return now;}}
  const data={mode:'live',price:5,topTrades,exchanges:[],history:[],chart:[],errors:[]};
  const context={document:{getElementById:id=>elements.get(id)},location:{hostname:'example.com'},Date:Clock,AbortController,console,setInterval(fn){intervals.push(fn)},setTimeout,availableTopTrades:(snapshot)=>availableTopTrades(snapshot,now),collectBinanceAggregates:scanner,renderInsights(){},renderReport(d){renders.push(d)},collect:market||async function(){return data}};
  const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  vm.runInNewContext(code,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {elements,renders,intervals,latest:()=>renders.at(-1),click:id=>elements.get(id).listeners.click(),async mode(value){elements.get('mode').value=value;await elements.get('mode').listeners.change()},advance(ms){now+=ms;intervals[0]()}};
}

test('browser scan is manual, progress does not rebuild report, and success survives refresh until expiry',async()=>{
  let calls=0,finish,progress;
  const app=await browser(({onProgress})=>{calls++;progress=onProgress;return new Promise(resolve=>finish=resolve)});
  assert.equal(calls,0);
  assert.equal(app.elements.get('binance-aggregate-cancel').disabled,true);
  const scan=app.click('binance-aggregate-scan');
  assert.equal(calls,1);
  assert.equal(app.elements.get('binance-aggregate-scan').disabled,true);
  assert.equal(app.elements.get('binance-aggregate-cancel').disabled,false);
  const count=app.renders.length;
  progress({pages:12,records:12000});
  assert.equal(app.renders.length,count);
  assert.match(app.elements.get('binance-aggregate-status').textContent,/12 页 \/ 12000 条/);
  assert.equal(app.latest().binanceAggregates,null);
  const snapshot=aggregateSnapshot();finish(snapshot);await scan;
  assert.equal(app.latest().binanceAggregates,snapshot);
  await app.click('refresh');
  assert.equal(calls,1);
  assert.equal(app.latest().binanceAggregates,snapshot);
  assert.equal(app.latest().topTrades,topTrades);
  app.advance(3601000);
  assert.equal(app.latest().binanceAggregates,null);
  assert.match(app.latest().binanceAggregatesError,/过期/);
  await app.click('refresh');
  assert.equal(app.latest().binanceAggregates,null);
});

test('failed and cancelled scans never fall back or resurrect stale successes, and leave raw ranking intact',async()=>{
  const pending=[];
  const snapshot=aggregateSnapshot();
  const app=await browser(options=>new Promise((resolve,reject)=>pending.push({options,resolve,reject})),async()=>({mode:'live',topTrades,binanceAggregates:snapshot,exchanges:[],history:[],chart:[],errors:[]}));
  const first=app.click('binance-aggregate-scan');
  pending[0].resolve(snapshot);await first;
  const second=app.click('binance-aggregate-scan');
  assert.equal(app.latest().binanceAggregates,null);
  pending[1].reject(Error('Binance HTTP 451'));await second;
  assert.match(app.latest().binanceAggregatesError,/HTTP 451/);
  await app.click('refresh');
  assert.equal(app.latest().binanceAggregates,null);
  assert.equal(app.latest().topTrades,topTrades);
  const cancelled=app.click('binance-aggregate-scan');
  await app.click('binance-aggregate-cancel');
  assert.equal(pending[2].options.signal.aborted,true);
  const newer=app.click('binance-aggregate-scan');
  pending[2].options.onProgress({pages:999,records:999});
  assert.doesNotMatch(app.elements.get('binance-aggregate-status').textContent,/999/);
  pending[2].resolve(snapshot);await cancelled;
  assert.equal(app.latest().binanceAggregates,null);
  pending[3].reject(Error('Binance HTTP 403'));await newer;
  assert.match(app.latest().binanceAggregatesError,/HTTP 403/);
  assert.equal(app.latest().topTrades,topTrades);
  const demoCancelled=app.click('binance-aggregate-scan');
  await app.mode('demo');
  assert.equal(pending[4].options.signal.aborted,true);
  assert.equal(app.latest().binanceAggregates,null);
  assert.equal(app.elements.get('binance-aggregate-scan').disabled,true);
  await app.click('binance-aggregate-scan');
  assert.equal(pending.length,5);
  pending[4].resolve(snapshot);await demoCancelled;
  assert.equal(app.latest().mode,'demo');
  await app.mode('live');
  assert.equal(app.latest().binanceAggregates,null);
  assert.match(app.latest().binanceAggregatesError,/取消/);
});

test('completed browser snapshot stays independent of failed market requests and is hidden throughout demo',async()=>{
  const snapshot=aggregateSnapshot();
  let requests=0,calls=0;
  const app=await browser(async()=>{calls++;return snapshot},async()=>{
    if(++requests>1)throw Error('Market offline');
    return {mode:'live',topTrades,exchanges:[],history:[],chart:[],errors:[]};
  });
  await app.click('binance-aggregate-scan');
  await app.click('refresh');
  assert.equal(app.latest().binanceAggregates,snapshot);
  assert.equal(app.latest().topTrades,null);
  await app.mode('demo');
  assert.equal(app.latest().binanceAggregates,null);
  await app.click('binance-aggregate-scan');
  assert.equal(calls,1);
  await app.mode('live');
  assert.equal(app.latest().binanceAggregates,snapshot);
  app.advance(3601000);
  assert.equal(app.latest().binanceAggregates,null);
  assert.match(app.elements.get('binance-aggregate-status').textContent,/过期/);
});

test('browser rejects a raw snapshot returned by scanner instead of relabeling it as aggregates',async()=>{
  const raw={...aggregateSnapshot(),recordType:'raw-trade'};
  const app=await browser(async()=>raw);
  await app.click('binance-aggregate-scan');
  assert.equal(app.latest().binanceAggregates,null);
  assert.match(app.latest().binanceAggregatesError,/类型或来源无效/);
  assert.equal(app.latest().topTrades,topTrades);
  assert.equal(app.elements.get('binance-aggregate-scan').disabled,false);
  assert.equal(app.elements.get('binance-aggregate-cancel').disabled,true);
});

test('completed empty aggregate window is zero while unavailable aggregate data stays missing',()=>{
  const zero={buy:0,sell:0,net:0,netIn:0,netOut:0,turnover:0,count:0};
  const snapshot={...aggregateSnapshot(),rows:[],sources:[{name:'Binance',status:'ok',records:0,pages:1}],totals:zero,allTradesTotals:zero};
  const panel=aggregatePanel(report({binanceAggregates:snapshot}));
  assert.match(panel.text(),/无成交记录（0 \/ 100 笔），不是数据缺失/);
  assert.match(panel.text(),/Top 100 主动买入 0\.00 USDT/);
  assert.equal(panel.find('table').length,0);
});
