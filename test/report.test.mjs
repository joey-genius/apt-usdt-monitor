import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { renderReport } from '../public/report.js';

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
  assert.doesNotMatch(text,/123456|987\.65K|大额成交|最低.*金额|主动净买入/);
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
  assert.equal(rendered.ratios.length,3);
  for(const r of rendered.ratios){assert.equal(typeof r.short,'number');assert.equal(r.history.length,12);assert.equal(r.sources.length,0);}
  assert.match(elements.get('status').textContent,/所有数值均为模拟数据/);
  assert.doesNotMatch(code,/largeFlow|threshold|large-flows/);
});
