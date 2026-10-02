import { analysisCards } from './market-analysis.js';
import { interpretData } from './insights.js?v=20261003-binance-traders';
const $=id=>document.getElementById(id);
const date=t=>new Date(t).toLocaleString('zh-CN',{hour12:false});
function paragraph(label,text){const p=document.createElement('p'),b=document.createElement('b');b.textContent=label+' ';p.append(b,document.createTextNode(text));return p;}
function card(item){const el=document.createElement('article');el.className='insight-item';const h=document.createElement('h3');h.textContent=item.title;el.append(h,paragraph('判断',item.reading),paragraph('依据',item.fact),paragraph('验证与失效',item.watch));return el;}
export function renderInsights(d){
  $('analysis-mode').textContent=d.mode==='demo'?'演示数据解读 · 非真实行情':'规则解读 · '+(d.fetchedAt?date(d.fetchedAt):'等待数据');
  const items=interpretData(d);$('data-insights').replaceChildren(...items.map(card));
  if(!items.length)$('data-insights').textContent='暂无足够行情数据，恢复接口后自动生成解读。';
  $('position-mode').textContent=d.mode==='demo'?'演示数据解读 · 非真实行情':'价量仓联合分析 · 已闭合小时窗口';
  $('position-insights').replaceChildren(...analysisCards(d).map(card));
}
