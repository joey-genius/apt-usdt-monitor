import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderReport } from '../public/report.js';

test('every shipped browser script parses', () => {
  for (const file of readdirSync(new URL('../public/', import.meta.url)).filter(f => f.endsWith('.js'))) {
    execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../public/' + file, import.meta.url))]);
  }
});
function reportText(data) {
  class Element {
    children = []; textContent = '';
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute() {}
    text() { return this.textContent + this.children.map(c => c.text()).join(' '); }
  }
  const root = new Element();
  const original = globalThis.document;
  globalThis.document = { getElementById: () => root, createElement: () => new Element() };
  try {
    renderReport(data);
    return root.text();
  } finally { globalThis.document = original; }
}
const start=Date.UTC(2026,9,2,12),end=start+300000;
const largeFlow={net:20000,buy:50000,sell:30000,count:4,threshold:10000,start,end,sources:['Binance'],breakdown:[{name:'Binance',buy:50000,sell:30000,net:20000,count:4,total:80000,share:1}],excluded:[{name:'OKX',reason:'近期记录未覆盖完整窗口'}],snapshotAt:end+1000,quality:'recent-records'};

test('report renders large-record net, components, coverage and exact window', () => {
  const text=reportText({mode:'live',price:1,funding:.0001,fetchedAt:end,exchanges:[{name:'Binance',value:1000000}],ratios:[{key:'accounts',ratio:2,long:2/3,timestamp:end,sources:['Binance'],samples:[{name:'Binance',ratio:2,timestamp:end}]}],history:[{minutes:5,previous:900000,current:1000000,change:11.11,flow:-987654,sources:['Binance'],largeFlow}]});
  assert.match(text, /\$1\.00000000/);
  assert.match(text, /实时大户多空比/);
  assert.match(text, /增减 \+\$100\.00K/);
  assert.match(text, /大额成交买卖净额/);
  assert.match(text, /\+\$20\.00K · 主动净买入/);
  assert.match(text, /主动买入 \$50\.00K · 主动卖出 \$30\.00K · 成交记录数 4/);
  assert.match(text, /最低单条上报成交金额 ≥ \$10\.00K/);
  assert.ok(text.includes(new Date(start).toISOString()));
  assert.ok(text.includes(new Date(end).toISOString()));
  assert.match(text, /纳入来源：Binance/);
  assert.match(text, /合计 \$80\.00K.*100\.00%/);
  assert.match(text, /OKX（近期记录未覆盖完整窗口）/);
  assert.match(text, /recent-records/);
  assert.match(text, /强平数据：未接入 · 订单簿追踪：未接入 · 地址追踪：未接入/);
  assert.doesNotMatch(text, /主力净流入参考|987\.65K/);
  assert.match(reportText({}), /等待数据/);
});

test('unknown never falls back to all-market flow and zero is balanced', () => {
  for(const missing of [undefined,{...largeFlow,net:null,buy:null,sell:null,count:null,sources:[],breakdown:[]}]){
    const text=reportText({history:[{minutes:5,flow:987654,largeFlow:missing}]});
    assert.match(text, /未知（无有效覆盖）/);
    assert.doesNotMatch(text, /987\.65K|\$0\.00 · 买卖持平/);
  }
  const balanced=reportText({history:[{minutes:5,flow:987654,largeFlow:{...largeFlow,net:0,buy:30000,sell:30000,count:2,breakdown:[{name:'Binance',buy:30000,sell:30000,net:0,count:2,total:60000,share:1}]}}]});
  assert.match(balanced, /\$0\.00 · 买卖持平/);
  assert.doesNotMatch(balanced, /未知（无有效覆盖）|987\.65K/);
  const negative=reportText({history:[{minutes:5,largeFlow:{...largeFlow,net:-20000,buy:30000,sell:50000,breakdown:[]}}]});
  assert.match(negative, /-\$20\.00K · 主动净卖出/);
});

test('price and OI evidence requires exact start and end, not just duration', () => {
  const history=[{minutes:5,largeFlow}];
  const analysis=[{start,end,priceChange:1.23,quantityChange:-4.56,sources:['Binance']}];
  const matched=reportText({history,analysis});
  assert.match(matched, /同窗辅助背景：价格 \+1\.23% · OI 持仓币数 -4\.56%/);
  assert.doesNotMatch(matched, /价格\/OI分析窗口不同/);
  for(const window of [{start:start+1,end},{start,end:end+1},{start:start+300000,end:end+300000}]){
    const text=reportText({history,analysis:[{...analysis[0],...window}]});
    assert.match(text, /价格\/OI分析窗口不同或缺失/);
    assert.doesNotMatch(text, /同窗辅助背景|1\.23%|-4\.56%/);
  }
});

test('demo does not present simulated all-volume or supplied large flow as records', () => {
  const text=reportText({mode:'demo',largeTradeThreshold:50000,history:[{minutes:5,flow:987654,largeFlow}]});
  assert.match(text, /demo-not-provided/);
  assert.match(text, /未知（无有效覆盖）/);
  assert.match(text, /最低单条上报成交金额 ≥ \$50\.00K/);
  assert.doesNotMatch(text, /987\.65K|\+\$20\.00K/);
});

test('external source names and exclusion reasons are rendered as text', () => {
  const name='<img src=x onerror=alert(1)>';
  const text=reportText({history:[{minutes:5,largeFlow:{...largeFlow,sources:[name],excluded:[{name,reason:'<script>external</script>'}]}}]});
  assert.ok(text.includes(name));
  assert.ok(text.includes('<script>external</script>'));
});
