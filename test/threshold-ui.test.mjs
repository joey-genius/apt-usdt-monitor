import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {aggregateLargeTradeFlow,LARGE_TRADE_THRESHOLD,parseLargeTradeThreshold} from '../public/large-flows.js';

test('custom amount applies locally; invalid drafts and automatic refresh preserve applied value',async()=>{
  const elements=new Map();
  const get=id=>{
    if(!elements.has(id))elements.set(id,{
      value:'',textContent:'',innerHTML:'',style:{},listeners:{},attrs:{},
      addEventListener(type,fn){this.listeners[type]=fn},
      setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},
    });
    return elements.get(id);
  };
  get('mode').value='live';get('large-threshold').value='10000';
  const end=Math.floor(Date.now()/300000)*300000;
  const t=(id,time,amount)=>({id,time,notional:amount,side:'buy',excluded:false,net:amount});
  const data={mode:'live',fetchedAt:Date.now(),exchanges:[],ratios:[],chart:[],errors:[],history:[{minutes:5}],tradeSnapshot:{fetchedAt:Date.now(),tradeCutoff:end,recent:[{name:'Bitget',status:'ok',recordUnit:'exchange-reported-trade',fetchedAt:Date.now(),trades:[t('a',end-310000,1),t('b',end-1000,500),t('c',end,1)]}]}};
  let calls=0,last;
  const context={document:{getElementById:get},location:{hostname:'example.com'},Date,console,setInterval(){},setTimeout,aggregateLargeTradeFlow,LARGE_TRADE_THRESHOLD,parseLargeTradeThreshold,renderInsights(){},renderReport(d){last=d},async collect(){calls++;return structuredClone(data)}};
  const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  vm.runInNewContext(code,context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,1);assert.equal(last.largeTradeThreshold,10000);assert.equal(last.history[0].largeFlow.net,0);
  const apply=()=>get('large-threshold-form').listeners.submit({preventDefault(){}});
  get('large-threshold').value='123.45';apply();
  assert.equal(calls,1);assert.equal(last.largeTradeThreshold,123.45);assert.equal(last.history[0].largeFlow.net,500);
  for(const draft of ['','-1','0','not-a-number']){
    get('large-threshold').value=draft;apply();
    assert.equal(get('large-threshold').attrs['aria-invalid'],'true');
    await get('refresh').listeners.click();
    assert.equal(last.largeTradeThreshold,123.45);assert.equal(last.history[0].largeFlow.net,500);
  }
  get('large-threshold').value='500.01';apply();
  assert.equal(last.history[0].largeFlow.net,0);assert.equal(get('large-threshold').attrs['aria-invalid'],undefined);
  assert.match(get('large-threshold-status').textContent,/500\.01/);
});
