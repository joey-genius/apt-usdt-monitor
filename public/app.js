import { renderReport } from './report.js?v=20261004-page-scan';
import { renderInsights } from './insight-ui.js?v=20261003-binance-traders';
import { collect } from './market.js?v=20261004-page-scan';
import { collectBinanceAggregates } from './binance-agg.js?v=20261004-page-scan';
import { collectTopTrades } from './top-trades-scan.js?v=20261004-page-scan';
import { availableTopTrades } from './top-trades.js?v=20261004-page-scan';
const $ = id => document.getElementById(id);
const hosted = !['localhost','127.0.0.1'].includes(location.hostname);
const windows = [5,15,30,60,240,480,720,1440,2880,4320,10080];
let current = null, busy = false, requestId = 0;
let aggregateController = null, localAggregate = null;
let rawController = null, localRaw = null, rawAutoStarted = false;
const RAW_EXCLUDED = ['Binance','Bybit','Gate','OKX'];
const expirySeen = new Set();
function rawData(d) {
  if(d.mode==='demo')return {...d,topTrades:null,topTradesError:null,topTradesProgress:null};
  const snapshot=localRaw?localRaw.snapshot:null;
  let error=localRaw?localRaw.error:null;
  let available=null;
  if(snapshot){
    if(snapshot.recordType||!Array.isArray(snapshot.rows)||!Array.isArray(snapshot.sources)||!snapshot.sources.length||snapshot.rows.some(r=>!r||RAW_EXCLUDED.includes(r.exchange))||snapshot.sources.some(s=>!s||typeof s.name!=='string'||(s.status==='ok'&&RAW_EXCLUDED.includes(s.name))))error='原始逐笔成交快照类型或来源无效，不接受聚合成交或未完整覆盖平台的记录。';
    else {const checked=availableTopTrades(snapshot);available=checked.topTrades;error=checked.topTradesError;}
  }
  if(localRaw&&snapshot&&!available)localRaw={snapshot:null,error,message:error};
  return {...d,topTrades:available,topTradesError:error,topTradesProgress:localRaw?null:d.topTradesProgress};
}
function aggregateData(d) {
  if(d.mode==='demo')return {...d,binanceAggregates:null,binanceAggregatesError:null,binanceAggregatesProgress:null};
  const snapshot=localAggregate?localAggregate.snapshot:d.binanceAggregates;
  let error=localAggregate?localAggregate.error:d.binanceAggregatesError;
  let available=null;
  if(snapshot){
    if(snapshot.recordType!=='binance-aggregate'||!Array.isArray(snapshot.rows)||!Array.isArray(snapshot.sources)||snapshot.rows.some(r=>!r||r.exchange!=='Binance')||snapshot.sources.some(s=>!s||s.name!=='Binance'))error='币安聚合成交快照类型或来源无效';
    else {const checked=availableTopTrades(snapshot);available=checked.topTrades;error=checked.topTradesError;}
  }
  if(localAggregate&&snapshot&&!available)localAggregate={snapshot:null,error,message:error};
  return {...d,binanceAggregates:available,binanceAggregatesError:error,binanceAggregatesProgress:localAggregate?null:d.binanceAggregatesProgress};
}
function aggregateControls() {
  const isDemo=$('mode').value==='demo';
  $('binance-aggregate-scan').disabled=isDemo||!!aggregateController;
  $('binance-aggregate-cancel').disabled=!aggregateController;
  $('binance-aggregate-status').textContent=isDemo?'演示模式不采集或展示真实聚合成交。':localAggregate?.message||current?.binanceAggregatesProgress||'仅手动启动浏览器采集，不随行情自动刷新。';
}
function rawControls() {
  const isDemo=$('mode').value==='demo';
  $('top-trades-scan').disabled=isDemo||!!rawController;
  $('top-trades-cancel').disabled=!rawController;
  $('top-trades-status').textContent=isDemo?'演示模式不采集或展示真实逐笔成交。':localRaw?.message||'打开页面即开始浏览器采集，约需半分钟；不随每30秒行情刷新重复采集。';
}
function renderPanels() {
  if(current){current=rawData(aggregateData(current));renderReport(current);}
  else renderReport(rawData(aggregateData({mode:$('mode').value})));
  aggregateControls();
  rawControls();
}
function cancelAggregate() {
  if(!aggregateController)return;
  const controller=aggregateController;aggregateController=null;
  localAggregate={snapshot:null,error:'浏览器采集已取消；不展示部分结果或回退旧快照。',message:'浏览器采集已取消。'};
  controller.abort();renderPanels();
}
async function scanAggregate() {
  if($('mode').value==='demo'||aggregateController)return;
  const controller=new AbortController();aggregateController=controller;
  localAggregate={snapshot:null,error:'浏览器正在完整采集，完成前不展示部分结果。',message:'正在采集：0 页 / 0 条记录，可能需要数分钟，请保持页面打开。'};
  renderPanels();
  try {
    const snapshot=await collectBinanceAggregates({signal:controller.signal,onProgress({pages,records}){
      if(aggregateController!==controller)return;
      localAggregate.message=`正在采集：${pages} 页 / ${records} 条记录，尚未完成，不展示部分结果。`;
      aggregateControls();
    }});
    if(aggregateController!==controller||controller.signal.aborted)return;
    localAggregate={snapshot,error:null,message:'浏览器24小时采集完成。'};
    const checked=aggregateData({mode:'live'});
    if(!checked.binanceAggregates)throw Error(checked.binanceAggregatesError||'采集快照无效');
  }catch(error){
    if(aggregateController!==controller)return;
    const message='币安聚合成交不可用：'+(error?.message||String(error));
    localAggregate={snapshot:null,error:message,message};
  }finally{
    if(aggregateController===controller){aggregateController=null;renderPanels();}
  }
}
function cancelRaw() {
  if(!rawController)return;
  const controller=rawController;rawController=null;
  localRaw={snapshot:null,error:'浏览器采集已取消；不展示部分结果或回退旧快照。',message:'浏览器采集已取消。'};
  controller.abort();renderPanels();
}
async function scanRaw() {
  if($('mode').value==='demo'||rawController)return;
  const controller=new AbortController();rawController=controller;
  localRaw={snapshot:null,error:'浏览器正在完整采集，完成前不展示部分结果。',message:'正在采集：0 页 / 0 条记录，约需半分钟，请保持页面打开。'};
  renderPanels();
  try {
    const snapshot=await collectTopTrades({signal:controller.signal,onProgress({name,pages,records}){
      if(rawController!==controller)return;
      localRaw.message=`正在采集 ${name||'Bitget'}：${pages} 页 / ${records} 条记录，尚未完成，不展示部分结果。`;
      rawControls();
    }});
    if(rawController!==controller||controller.signal.aborted)return;
    localRaw={snapshot,error:null,message:'浏览器24小时采集完成。'};
    const checked=rawData({mode:'live'});
    if(!checked.topTrades)throw Error(checked.topTradesError||'采集快照无效');
  }catch(error){
    if(rawController!==controller)return;
    const message='原始逐笔成交不可用：'+(error?.message||String(error));
    localRaw={snapshot:null,error:message,message};
  }finally{
    if(rawController===controller){rawController=null;renderPanels();}
  }
}
const valid = n => typeof n === 'number' && Number.isFinite(n);
const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => !valid(n) ? '—' : '$' + (Math.abs(n)>=1e9 ? (n/1e9).toFixed(2)+'B' : Math.abs(n)>=1e6 ? (n/1e6).toFixed(2)+'M' : Math.abs(n)>=1e3 ? (n/1e3).toFixed(2)+'K' : n.toFixed(2));
const cls = n => !valid(n) ? 'muted' : n >= 0 ? 'positive' : 'negative';
const period = n => n < 60 ? n+'分钟' : n/60+'小时';
const time = n => n ? new Date(n).toLocaleString('zh-CN',{hour12:false}) : '—';
function demo() {
  const now = Date.now();
  const ratios=[['accounts',.653,.347],['positions',.666,.334],['global',.649,.351]].map(([key,long,short])=>({key,ratio:long/short,long,short,timestamp:now,sources:[],error:null,history:Array.from({length:12},(_,i)=>({ratio:long/short,long,short,timestamp:now-i*300000}))}));
  return {mode:'demo',topTrades:null,fetchedAt:now,price:4.826,mark:4.825,priceChange:2.84,volume:186420000,funding:.0001,nextFunding:Math.ceil(now/28800000)*28800000,oi:92840000,exchanges:[{name:'Binance',value:92840000},{name:'Bybit',value:41620000},{name:'OKX',value:28540000}],ratios,history:windows.map((minutes,i)=>{const previous=[93420000,94630000,95700000,97350000,89670000,87920000,86400000,84200000,78910000,75640000,68750000][i];return {minutes,previous,change:(92840000/previous-1)*100}}),chart:Array.from({length:48},(_,i)=>({time:now-(47-i)*3600000,price:4.48+i*.0074+Math.sin(i*.57)*.055+Math.cos(i*1.8)*.02})),errors:[]};
}
function render(d) {
  d=rawData(aggregateData(d));
  current=d;
  renderReport(d);
  aggregateControls();
  rawControls();
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
  $('exchanges').innerHTML=visible.map((e,i)=>{const p=valid(e.value)&&total>0?e.value/total*100:0;return `<div class="exchange"><b>${escape(e.name)}</b><div class="track"><i style="width:${p}%;background:${colors[i]||colors[2]}"></i></div><div class="exchange-value">${money(e.value)}<small>${valid(e.value)?p.toFixed(2)+'%':'接口不可用'}</small></div></div>`}).join('');
  $('source-table').innerHTML=d.exchanges.map(e=>`<tr><td>${escape(e.name)}<small class="source-note">${escape(e.contract||'演示数据')}</small></td><td>${valid(e.price)?'$'+e.price.toFixed(4):'—'}</td><td>${valid(e.value)&&total>0?(e.value/total*100).toFixed(2)+'%':'—'}</td><td class="${cls(e.funding)}">${valid(e.funding)?(e.funding*100).toFixed(4)+'%':'—'}</td><td>${money(e.volume)}</td></tr>`).join('');
  $('history').innerHTML=d.history.map(h=>`<tr><td>${escape(period(h.minutes))}<small class="source-note">${escape(h.sources?.join(' / ')||'演示 / 无覆盖')}</small></td><td>${money(h.previous)}<small class="source-note">同组当前 ${money(h.current)}</small></td><td class="${cls(h.change)}">${valid(h.change)?(h.change>=0?'+':'')+h.change.toFixed(2)+'%':'—'}</td></tr>`).join('');
  drawChart(d.chart);
  const isDemo=d.mode==='demo', failed=d.errors.length;
  $('status').textContent=isDemo?'演示模式 · 所有数值均为模拟数据':!available.length?'连接失败 · 暂无可用持仓':failed?'部分接口可用 · 按实际覆盖范围汇总':'已连接 · Binance 多空比 / 多交易所行情';
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
  if($('mode').value==='demo'){cancelAggregate();cancelRaw();rawAutoStarted=false;busy=false;$('refresh').disabled=false;render(demo());return;}
  if(!rawAutoStarted){rawAutoStarted=true;scanRaw();}
  if(current?.mode==='demo') {
    render({mode:'live',fetchedAt:null,price:null,funding:null,oi:null,exchanges:['Binance','Bybit','OKX'].map(name=>({name,value:null})),ratios:['accounts','positions','global'].map(key=>({key,ratio:null,long:null,short:null,timestamp:null,sources:[],history:[],error:null})),history:windows.map(minutes=>({minutes,previous:null,change:null})),chart:[],errors:[]});
    $('updated').textContent='等待实时数据';
  }
  busy=true;$('refresh').disabled=true;$('status').textContent='正在刷新公开行情…';
  try {
    let d;
    if(hosted) d=await collect();
    else {const response=await fetch('./api/market',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('服务异常');d=await response.json();}
    if(id===requestId)render(d);
  }
  catch(e){
    if(id!==requestId)return;
    if(current){current={...current,binanceAggregates:null,binanceAggregatesError:'本次行情请求失败，币安聚合成交快照不可用。'};renderPanels();}
    $('status').textContent='连接失败';$('status-dot').style.background='#d16b70';$('notice').hidden=false;$('notice').textContent=(hosted?'无法获取公开行情。':'无法连接本地行情服务。')+(current?'其余行情保留上次快照，请注意底部时间；发布来源的币安聚合成交已标记不可用，浏览器现场采集的原始 Top 100 不受影响。':hosted?'请检查网络并刷新页面。':'请双击“启动监测台.cmd”，再刷新页面。');
  }
  finally{if(id===requestId){busy=false;$('refresh').disabled=false;}}
}
$('mode').addEventListener('change',refresh);
$('binance-aggregate-scan').addEventListener('click',scanAggregate);
$('binance-aggregate-cancel').addEventListener('click',cancelAggregate);
$('top-trades-scan').addEventListener('click',scanRaw);
$('top-trades-cancel').addEventListener('click',cancelRaw);
$('refresh').addEventListener('click',refresh);
$('export').addEventListener('click',()=>{if(!current)return;const blob=new Blob([JSON.stringify(current,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`APTUSDT-${current.mode}-${current.fetchedAt}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
function tick(){
  $('clock').textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false});
  if($('mode').value==='demo')return;
  let stale=false;
  for(const [key,state,fallback] of [['aggregate',localAggregate,current?.binanceAggregates],['raw',localRaw,null]]){
    const snapshot=state?.snapshot||fallback;
    if(!state||!snapshot||Date.now()-snapshot.windowEnd<=3600000)continue;
    const mark=key+':'+snapshot.windowEnd;
    if(!expirySeen.has(mark)){expirySeen.add(mark);stale=true;}
  }
  if(stale)renderPanels();
}
tick();setInterval(tick,1000);setInterval(()=>{if($('auto').checked&&!busy)refresh()},30000);refresh();


$('report-date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric'});
$('copy-report').addEventListener('click',async()=>{try{await navigator.clipboard.writeText('APT/USDT 合约\n'+$('contract-report').innerText);$('copy-report').textContent='已复制';}catch{$('copy-report').textContent='复制失败，请选中文本复制';}setTimeout(()=>$('copy-report').textContent='▢ 复制数据报告',2500)});
