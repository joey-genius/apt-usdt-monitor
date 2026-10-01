import { renderReport } from './report.js?v=20261001-oi4';
import { renderInsights } from './insight-ui.js';
import { collect } from './market.js?v=20261001-oi4';
const $ = id => document.getElementById(id);
const hosted = !['localhost','127.0.0.1'].includes(location.hostname);
const windows = [5,15,30,60,240,480,720,1440,2880,4320,10080];
let current = null, busy = false, requestId = 0;
const valid = n => typeof n === 'number' && Number.isFinite(n);
const money = n => !valid(n) ? '—' : '$' + (Math.abs(n)>=1e9 ? (n/1e9).toFixed(2)+'B' : Math.abs(n)>=1e6 ? (n/1e6).toFixed(2)+'M' : Math.abs(n)>=1e3 ? (n/1e3).toFixed(2)+'K' : n.toFixed(2));
const signed = n => !valid(n) ? '—' : (n>=0?'+':'−')+money(Math.abs(n));
const cls = n => !valid(n) ? 'muted' : n >= 0 ? 'positive' : 'negative';
const period = n => n < 60 ? n+'分钟' : n/60+'小时';
const time = n => n ? new Date(n).toLocaleString('zh-CN',{hour12:false}) : '—';
function demo() {
  const now = Date.now();
  return {mode:'demo',fetchedAt:now,price:4.826,mark:4.825,priceChange:2.84,volume:186420000,funding:.0001,nextFunding:Math.ceil(now/28800000)*28800000,oi:92840000,exchanges:[{name:'Binance',value:92840000},{name:'Bybit',value:41620000},{name:'OKX',value:28540000}],ratios:[{key:'accounts',ratio:1.89,long:.653,timestamp:now},{key:'positions',ratio:1.99,long:.666,timestamp:now},{key:'global',ratio:1.85,long:.649,timestamp:now}],history:windows.map((minutes,i)=>{const previous=[93420000,94630000,95700000,97350000,89670000,87920000,86400000,84200000,78910000,75640000,68750000][i];return {minutes,previous,change:(92840000/previous-1)*100,flow:[-184000,-420000,-738000,-1260000,2430000,3620000,2840000,5920000,8160000,12480000,18960000][i]}}),chart:Array.from({length:48},(_,i)=>({time:now-(47-i)*3600000,price:4.48+i*.0074+Math.sin(i*.57)*.055+Math.cos(i*1.8)*.02})),errors:[]};
}
function render(d) {
  current=d;
  renderReport(d);
  renderInsights(d);
  $('price').textContent=valid(d.price)?'$'+d.price.toFixed(4):'—';
  $('price-sub').innerHTML=`<span class="${cls(d.priceChange)}">${valid(d.priceChange)?(d.priceChange>=0?'+':'')+d.priceChange.toFixed(2)+'%':'—'}</span> <span class="muted">过去 24 小时</span>`;
  $('funding').textContent=valid(d.funding)?(d.funding*100).toFixed(4)+'%':'—';
  $('funding-sub').textContent='8小时等效 · '+(d.coverage?.funding?.join(' / ')||'演示 / 暂无来源');
  const available=d.exchanges.filter(e=>valid(e.value));
  const total=available.reduce((s,e)=>s+e.value,0);
  $('total').textContent=available.length?money(total):'—';
  $('coverage').textContent=`${available.length} / ${d.exchanges.length} 家交易所已获取 · 非全市场`;
  $('volume-sources').textContent=d.coverage?.volume?.join(' / ')||'演示 / 暂无来源';
  $('chart-sources').textContent=d.coverage?.chart?.join(' / ')||'演示 / 暂无来源';
  $('chart-caption').textContent='现价加权来源：'+(d.coverage?.price?.join(' / ')||'演示 / 暂无来源');
  $('volume').textContent=money(d.volume);
  $('current-oi').textContent=money(d.oi);
  const colors=['#148f82','#77b4ae','#b5d3cf'];
  const visible=d.exchanges.filter(e=>!valid(e.value)||total<=0||e.value/total>=.01);
  const other=d.exchanges.filter(e=>valid(e.value)&&total>0&&e.value/total<.01).reduce((s,e)=>s+e.value,0);
  if(other>0) visible.push({name:'其他',value:other});
  $('exchanges').innerHTML=visible.map((e,i)=>{const p=valid(e.value)&&total>0?e.value/total*100:0;return `<div class="exchange"><b>${e.name}</b><div class="track"><i style="width:${p}%;background:${colors[i]||colors[2]}"></i></div><div class="exchange-value">${money(e.value)}<small>${valid(e.value)?p.toFixed(2)+'%':'接口不可用'}</small></div></div>`}).join('');
  $('source-table').innerHTML=d.exchanges.map(e=>`<tr><td>${e.name}<small class="source-note">${e.contract||'演示数据'}</small></td><td>${valid(e.price)?'$'+e.price.toFixed(4):'—'}</td><td>${valid(e.value)&&total>0?(e.value/total*100).toFixed(2)+'%':'—'}</td><td class="${cls(e.funding)}">${valid(e.funding)?(e.funding*100).toFixed(4)+'%':'—'}</td><td>${money(e.volume)}</td></tr>`).join('');
  const names={accounts:'大户多空比 · 账户数',positions:'大户多空比 · 持仓量',global:'多空持仓人数比'};
  $('ratios').innerHTML=d.ratios.map(r=>`<div class="ratio"><div class="ratio-title"><span>${names[r.key]}</span><strong>${valid(r.ratio)?r.ratio.toFixed(2):'—'}</strong></div><div class="ratio-bar">${valid(r.long)?`<div class="buy" style="width:${r.long*100}%"></div><div class="sell" style="width:${(1-r.long)*100}%"></div>`:''}</div><div class="ratio-labels"><span class="long">多 ${valid(r.long)?(r.long*100).toFixed(1)+'%':'—'}</span><span class="short">${valid(r.long)?((1-r.long)*100).toFixed(1)+'%':'—'} 空</span></div><div class="ratio-time">${r.sources?.join(" / ")||"演示 / 无覆盖"}<br>最早快照 ${time(r.timestamp)}</div></div>`).join('');
  $('history').innerHTML=d.history.map(h=>`<tr><td>${period(h.minutes)}<small class="source-note">${h.sources?.join(' / ')||'演示 / 无覆盖'}</small></td><td>${money(h.previous)}<small class="source-note">同组当前 ${money(h.current)}</small></td><td class="${cls(h.change)}">${valid(h.change)?(h.change>=0?'+':'')+h.change.toFixed(2)+'%':'—'}</td></tr>`).join('');
  const max=Math.max(...d.history.map(h=>Math.abs(h.flow||0)),1);
  $('flows').innerHTML=d.history.map(h=>`<tr><td>${period(h.minutes)}</td><td><div class="flow-cell"><i class="flow-line" style="width:${Math.abs(h.flow||0)/max*95}px;background:${h.flow>=0?'#40ad96':'#d99599'}"></i><span class="${cls(h.flow)}">${!valid(h.flow)?'—':h.flow>=0?'净买入':'净卖出'}</span></div></td><td class="${cls(h.flow)}">${signed(h.flow)}</td></tr>`).join('');
  drawChart(d.chart);
  const isDemo=d.mode==='demo', failed=d.errors.length;
  $('status').textContent=isDemo?'演示模式 · 所有数值均为模拟数据':!available.length?'连接失败 · 暂无可用持仓':failed?'部分接口可用 · 按实际覆盖范围汇总':'已连接 · 多交易所加权汇总';
  $('status-dot').style.background=isDemo||failed?'#d4a14f':'#079d7a';
  $('notice').hidden=!isDemo&&!failed;
  $('notice').textContent=isDemo?'当前为演示数据，仅用于预览界面与功能，不代表 APT 实际行情。切换“实时接口”获取公开市场数据。':failed?`有 ${failed} 个接口未能返回数据（${d.errors.map(e=>e.key).join('、')}）。${hosted?'当前由浏览器直连交易所，可能受地区、网络或跨域策略限制。':'请检查网络或稍后刷新。'}此处未用模拟值填充缺失数据。`:'';
  $('updated').textContent=(isDemo?'演示生成于 ':'请求完成于 ')+time(d.fetchedAt);
}
function drawChart(rows) {
  if(rows.length<2){$('chart').innerHTML='<div class="empty">暂无价格走势数据</div>';$('chart-start').textContent='—';$('chart-end').textContent='—';return;}
  const values=rows.map(r=>r.price), min=Math.min(...values), max=Math.max(...values), range=max-min||1;
  const coords=values.map((p,i)=>[i/(values.length-1)*560,135-(p-min)/range*115]);
  const line=coords.map(p=>p.join(',')).join(' ');
  $('chart').innerHTML=`<svg viewBox="0 0 625 160" role="img" aria-label="最近48小时价格走势"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#148f82" stop-opacity=".14"/><stop offset="100%" stop-color="#148f82" stop-opacity="0"/></linearGradient></defs>${[20,77,135].map((y,i)=>`<line x1="0" y1="${y}" x2="560" y2="${y}" stroke="#eaf0f2" stroke-dasharray="3 5"/><text x="574" y="${y+4}" font-size="10" fill="#97a4ae">${(max-i*range/2).toFixed(3)}</text>`).join('')}<polygon points="0,155 ${line} 560,155" fill="url(#fill)"/><polyline points="${line}" stroke="#148f82" stroke-width="2.5" fill="none" stroke-linejoin="round"/><circle cx="560" cy="${coords.at(-1)[1]}" r="4" fill="#148f82" stroke="white" stroke-width="2"/></svg>`;
  $('chart-start').textContent=new Date(rows[0].time).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit'});
  $('chart-end').textContent=new Date(rows.at(-1).time).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit'});
}
async function refresh() {
  const id=++requestId;
  if($('mode').value==='demo'){busy=false;$('refresh').disabled=false;render(demo());return;}
  if(current?.mode==='demo') {
    render({mode:'live',fetchedAt:null,price:null,funding:null,oi:null,exchanges:['Binance','Bybit','OKX'].map(name=>({name,value:null})),ratios:['accounts','positions','global'].map(key=>({key,ratio:null,long:null})),history:windows.map(minutes=>({minutes,previous:null,change:null,flow:null})),chart:[],errors:[]});
    current=null;
    $('updated').textContent='等待实时数据';
  }
  busy=true;$('refresh').disabled=true;$('status').textContent='正在刷新公开行情…';
  try {
    let d;
    if(hosted) d=await collect();
    else {const response=await fetch('./api/market',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('服务异常');d=await response.json();}
    if(id===requestId)render(d);
  }
  catch(e){if(id!==requestId)return;$('status').textContent='连接失败';$('status-dot').style.background='#d16b70';$('notice').hidden=false;$('notice').textContent=(hosted?'无法获取公开行情。':'无法连接本地行情服务。')+(current?'当前保留上次快照，请注意底部时间。':hosted?'请检查网络并刷新页面。':'请双击“启动监测台.cmd”，再刷新页面。');}
  finally{if(id===requestId){busy=false;$('refresh').disabled=false;}}
}
$('mode').addEventListener('change',refresh);
$('refresh').addEventListener('click',refresh);
$('export').addEventListener('click',()=>{if(!current)return;const blob=new Blob([JSON.stringify(current,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`APTUSDT-${current.mode}-${current.fetchedAt}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
function tick(){$('clock').textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false});}
tick();setInterval(tick,1000);setInterval(()=>{if($('auto').checked&&!busy)refresh()},30000);refresh();


$('report-date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric'});
$('copy-report').addEventListener('click',async()=>{try{await navigator.clipboard.writeText('APT/USDT 合约\n'+$('contract-report').innerText);$('copy-report').textContent='已复制';}catch{$('copy-report').textContent='复制失败，请选中文本复制';}setTimeout(()=>$('copy-report').textContent='▢ 复制数据报告',2500)});
