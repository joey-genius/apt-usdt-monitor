import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeWindow,buildAnalysis,analysisCards} from '../public/market-analysis.js';
const base={hours:1,sources:['A'],priceChange:1,quantityChange:2,imbalance:10,volumeRatio:1.4,low:1,high:2};
test('classifies joint price and quantity regimes and contradictions',()=>{
 assert.match(analyzeWindow(base).title,/增仓上涨/);
 assert.match(analyzeWindow({...base,quantityChange:-2}).title,/回补/);
 assert.match(analyzeWindow({...base,priceChange:-1}).title,/增仓下跌/);
 assert.match(analyzeWindow({...base,priceChange:-1,quantityChange:-2}).title,/去杠杆/);
 assert.match(analyzeWindow({...base,imbalance:-10}).reading,/背离/);
 assert.match(analyzeWindow({...base,quantityChange:null}).title,/暂不判断/);
});
test('uses exact closed boundaries and excludes unpaired exchanges',()=>{
 const end=7200000;
 const k=(t,p,q)=>[t,p,p,p,p,0,0,q,0,0,q*.6];
 const windows=buildAnalysis({now:end+1000,binHistory:[{timestamp:3600000,sumOpenInterest:100},{timestamp:end,sumOpenInterest:110}],byHistory:[],byMarks:[],binCandles:[k(0,1,100),k(3600000,1,200),k(end,999,999)],funding:0});
 assert.equal(windows[0].quantityChange,10.000000000000009);assert.equal(windows[0].priceChange,0);assert.equal(windows[0].volumeRatio,2);assert.equal(windows[0].high,1);assert.deepEqual(windows[0].sources,['Binance']);assert.equal(windows[1].priceChange,null);
});
test('short rally against weak daily regime remains repair',()=>{
 const c=analysisCards({analysis:[{...base,end:1},{...base,hours:4,end:1},{...base,hours:24,priceChange:-1,end:1}]});assert.match(c[0].reading,/弱势中的修复/);
});
