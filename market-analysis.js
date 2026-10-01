import { change, numeric, weighted } from './metrics.js';
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
export function buildAnalysis({now,binHistory,byHistory,binCandles,byMarks,funding}) {
  const end=Math.floor(now/3600000)*3600000;
  const at=(rows,t)=>rows.find(r=>Number(r.timestamp)===t);
  return [1,4,24].map(hours=>{
    const start=end-hours*3600000, sources=[];
    const binStart=at(binHistory,start),binEnd=at(binHistory,end);
    const byStart=at(byHistory,start),byEnd=at(byHistory,end);
    const startC=binCandles.find(k=>Number(k[0])===start),endC=binCandles.find(k=>Number(k[0])===end-3600000);
    const add=(name,q0,q1,p0,p1)=>{if([q0,q1,p0,p1].every(numeric)&&q0>0&&p0>0&&p1>0)sources.push({name,value:q0*p0,priceChange:change(p1,p0),quantityChange:change(q1,q0)});};
    add('Binance',num(binStart?.sumOpenInterest),num(binEnd?.sumOpenInterest),num(startC?.[1]),num(endC?.[4]));
    const m0=byMarks.find(k=>Number(k[0])===start),m1=byMarks.find(k=>Number(k[0])===end);
    add('Bybit',num(byStart?.singleOpenInterest),num(byEnd?.singleOpenInterest),num(m0?.[1]),num(m1?.[1]));
    const candles=(a,b)=>binCandles.filter(k=>Number(k[0])>=a&&Number(k[0])<b);
    const cur=candles(start,end),prev=candles(start-hours*3600000,start);
    const complete=(rows,count)=>rows.length===count&&new Set(rows.map(k=>Number(k[0]))).size===count;
    const quote=rows=>rows.reduce((s,k)=>s+Number(k[7]),0);
    const volume=complete(cur,hours)?quote(cur):null;
    const imbalance=volume>0?cur.reduce((s,k)=>s+2*Number(k[10])-Number(k[7]),0)/volume*100:null;
    return {hours,start,end,sources:sources.map(r=>r.name),priceChange:weighted(sources,'priceChange').value,quantityChange:weighted(sources,'quantityChange').value,imbalance,volumeRatio:volume!==null&&complete(prev,hours)&&quote(prev)>0?volume/quote(prev):null,funding,
      low:complete(cur,hours)?Math.min(...cur.map(k=>Number(k[3]))):null,high:complete(cur,hours)?Math.max(...cur.map(k=>Number(k[2]))):null};
  });
}
const fmt=n=>`${n>=0?'+':''}${n.toFixed(2)}%`;
export function analyzeWindow(w) {
  if(!numeric(w.priceChange)||!numeric(w.quantityChange))return {title:`${w.hours}小时 · 暂不判断`,fact:'缺少同一时段的价格与持仓币数配对。',reading:'当前数据不足以区分增仓推动、回补或去杠杆。',watch:'等待配对数据恢复。',bias:0};
  const p=w.priceChange,q=w.quantityChange;
  const up=p>.3,down=p<-.3,expand=q>.5,shrink=q<-.5;
  let title,reading,bias=0;
  if(up&&expand){title='偏强 · 增仓上涨';reading='价格上涨且持仓币数增加，方向与资金参与同步，较单纯回补更支持上行延续。';bias=1;}
  else if(up&&shrink){title='反弹 · 回补特征';reading='价格上涨但持仓币数减少，更接近空头回补或去杠杆中的反弹，新增仓位对上涨的支撑不足。';bias=1;}
  else if(down&&expand){title='偏弱 · 增仓下跌';reading='价格下跌且持仓币数增加，新增仓位伴随下行，偏向空方主动压制的结构。';bias=-1;}
  else if(down&&shrink){title='偏弱 · 去杠杆下跌';reading='价格与持仓币数一起下降，更接近平仓主导的下跌。抛压释放不等于已经见底，也不能直接认定爆仓。';bias=-1;}
  else if(up){title='偏强 · 持仓未确认';reading='价格已上行，但持仓币数未显著扩张，趋势的新增资金确认仍不足。';bias=1;}
  else if(down){title='偏弱 · 持仓未确认';reading='价格已下行，但持仓币数未明显变化，暂不能区分新空入场或存量仓位调整。';bias=-1;}
  else{title=expand?'盘整 · 仓位积累':shrink?'盘整 · 仓位退出':'震荡 · 方向不清';reading=expand?'价格变化有限但持仓增加，仓位在区间内积累，突破方向尚未确认。':shrink?'价格变化有限而持仓下降，参与度在收缩，暂缺趋势推动。':'价格和持仓变化均未超过观察阈值，暂按震荡结构看待。';}
  if(numeric(w.imbalance))reading+=Math.abs(w.imbalance)<3?' Binance主动买卖相对均衡，未给出额外方向确认。':(w.imbalance>0?' Binance主动买入占优':' Binance主动卖出占优')+(bias&&Math.sign(w.imbalance)!==bias?'，与价格方向背离，降低延续判断的把握。':'，'+(bias?'与价格方向一致，提供局部确认。':'但价格尚未明确响应。'));
  if(numeric(w.volumeRatio))reading+=w.volumeRatio>=1.2?' 相比前一等长时段放量，当前方向的参与度增强。':w.volumeRatio<=.8?' 相比前一等长时段缩量，延续性需要更谨慎看待。':' 成交量较前一等长时段未明显变化。';
  if(numeric(w.funding)&&Math.abs(w.funding)>=.0003)reading+=w.funding>0?' 当前加权费率偏高，多头持仓成本较重，需防拥挤后的回撤。':' 当前加权费率明显为负，空头持仓成本较重，需防反向回补。';
  const level=n=>numeric(n)?n.toFixed(4):'待获取';
  const watch=`参考本时段 Binance 区间 $${level(w.low)}–$${level(w.high)}。${bias>0?'若后续突破区间上沿、持仓币数扩张且主动买入持续，上行判断增强；若跌回区间下沿或卖出占优，则偏强判断失效。':bias<0?'若后续跌破区间下沿、主动卖出持续，弱势更可能延续；若收复上沿并出现买入与增仓配合，则需撤销偏弱判断。':'等待价格突破区间并由持仓增加、同向主动成交共同确认；只有价格突破而未获资金配合，仍可能回到区间。'}`;
  const fact=`价格 ${fmt(p)} · 持仓币数 ${fmt(q)}（${w.sources.join(' / ')}，起点持仓价值固定加权）；Binance主动净额/成交额 ${numeric(w.imbalance)?fmt(w.imbalance):'缺失'}；量比 ${numeric(w.volumeRatio)?w.volumeRatio.toFixed(2)+'×':'缺失'}。`;
  return {title:`${w.hours}小时 · ${title}`,fact,reading,watch,bias};
}
export function analysisCards(d){
  const windows=d.analysis||[];
  if(!windows.length)return [{title:'等待行情分析',fact:d.mode==='demo'?'演示快照未包含配对分析数据。':'等待价格、持仓币数和成交数据。',reading:'不会用单独的持仓变化生成行情方向结论。',watch:'实时数据完成后自动更新。'}];
  const cards=windows.map(analyzeWindow),valid=cards.filter(c=>c.bias!==undefined&&numeric(windows[cards.indexOf(c)]?.priceChange));
  const short=cards[0],day=cards[2];
  let reading='各周期方向尚未形成一致性，以区间震荡和信号分化看待。';
  if(valid.length===3&&valid.every(c=>c.bias===1))reading='1小时、4小时、24小时价格方向均偏强，存在跨周期上行共振；再用各周期增减仓和主动买卖确认上涨质量。';
  else if(valid.length===3&&valid.every(c=>c.bias===-1))reading='1小时、4小时、24小时价格方向均偏弱，短线与日内趋势同向，尚未出现明确止跌结构。';
  else if(short?.bias===1&&day?.bias===-1)reading='短线在反弹，但24小时结构仍偏弱，当前更像弱势中的修复，不能仅凭短线上涨认定趋势反转。';
  else if(short?.bias===-1&&day?.bias===1)reading='短线转弱，而24小时方向仍偏强，当前更像上行过程中的回撤；是否转为趋势下跌，需要观察更长周期及资金确认。';
  return [{title:'综合判断 · 多周期行情',fact:`采用已结束的1/4/24小时窗口，结束于 ${new Date(windows[0].end).toLocaleString('zh-CN',{hour12:false})}。`,reading,watch:'下面分别给出方向判断、成交确认和失效条件。规则推断不是已识别的账户开平仓行为；当前资金费率只作为背景。'},...cards];
}
