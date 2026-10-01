import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { renderReport } from '../public/report.js';

test('every shipped browser script parses', () => {
  for (const file of readdirSync(new URL('../public/', import.meta.url)).filter(f => f.endsWith('.js'))) {
    execFileSync(process.execPath, ['--check', new URL('../public/' + file, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')]);
  }
});
test('report renders actual values, ratios and flow without throwing', () => {
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
    renderReport({mode:'live',price:1,funding:.0001,fetchedAt:Date.now(),exchanges:[{name:'Binance',value:1000000}],ratios:[{key:'accounts',ratio:2,long:2/3,timestamp:Date.now(),sources:['Binance'],samples:[{name:'Binance',ratio:2,timestamp:Date.now()}]}],history:[{minutes:5,previous:900000,current:1000000,change:11.11,flow:-100,sources:['Binance']}]});
    assert.match(root.text(), /\$1\.00000000/);
    assert.match(root.text(), /实时大户多空比/);
    assert.match(root.text(), /增减 \+\$100\.00K/);
    assert.match(root.text(), /主力净流入参考/);
    assert.match(root.text(), /-\$100\.00/);
    renderReport({});
    assert.match(root.text(), /等待数据/);
  } finally { globalThis.document = original; }
});
