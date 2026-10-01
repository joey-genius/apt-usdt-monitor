import { interpretData, normalizeReleases } from './insights.js';
const $=id=>document.getElementById(id);
const date=t=>new Date(t).toLocaleString('zh-CN',{hour12:false});
let news=[], loading=false, fetchedAt=0, lastSnapshot=null;
function paragraph(label,text){const p=document.createElement('p'),b=document.createElement('b');b.textContent=label+' ';p.append(b,document.createTextNode(text));return p;}
function card(item){const el=document.createElement('article');el.className='insight-item';const h=document.createElement('h3');h.textContent=item.title;el.append(h,paragraph('观察',item.fact),paragraph('解读',item.reading),paragraph('关注',item.watch));return el;}
export function renderInsights(d){
  lastSnapshot=d;
  $('analysis-mode').textContent=d.mode==='demo'?'演示数据解读 · 非真实行情':'规则解读 · '+(d.fetchedAt?date(d.fetchedAt):'等待数据');
  const items=interpretData(d);$('data-insights').replaceChildren(...items.map(card));
  if(!items.length)$('data-insights').textContent='暂无足够行情数据，恢复接口后自动生成解读。';
  renderEvents();
}
function renderEvents(){
  const items=[];
  const h=lastSnapshot?.history?.find(h=>h.minutes===60);
  if(typeof h?.change==='number'&&Math.abs(h.change)>=3)items.push({title:'指标异动 · 1小时持仓变化达到3%阈值',fact:`${lastSnapshot.mode==='demo'?'模拟数据：':''}同组持仓变化 ${h.change.toFixed(2)}%，来源 ${h.sources?.join(' / ')||'演示样本'}。`,reading:'这是本站规则触发的指标提示，不是已确认的外部新闻事件，也不能据此确定涨跌原因。',watch:'阈值为固定观察规则；结合成交、价格及交易所公告核对。'});
  if(news.length){const r=news[0];items.push({title:'官方动态 · '+r.kind,fact:`${date(r.published)} 发布 ${r.tag}。`,reading:r.reading,watch:r.watch});}
  $('event-insights').replaceChildren(...items.map(card));
  if(!items.length)$('event-insights').textContent='尚无已读取的官方事件或达到阈值的指标异动。未接入解锁日历，不推算未确认的解锁、上币或政策日期。';
  $('event-source').textContent=news.length?'官方事件来自下方 Aptos GitHub 公告；发布时间不等于主网上线时间。':'官方事件等待公告源；指标异动不等于外部事件。';
}
function drawNews(){
  $('news-list').replaceChildren(...news.map(r=>{const item=card(r), meta=document.createElement('div'),a=document.createElement('a');meta.className='news-meta';meta.textContent=`${r.kind} · Aptos 官方 GitHub · 发布于 ${date(r.published)}`;a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='查看原文与变更清单 ↗';item.prepend(meta);item.append(a);return item;}));
  renderEvents();
}
export async function refreshNews(force=false){
  if(loading||!force&&Date.now()-fetchedAt<900000)return;
  loading=true;$('news-refresh').disabled=true;$('news-status').textContent='正在读取 Aptos 官方发布公告…';
  try{
    const response=await fetch('https://api.github.com/repos/aptos-labs/aptos-core/releases?per_page=12',{signal:AbortSignal.timeout(12000),headers:{Accept:'application/vnd.github+json'}});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    news=normalizeReleases(await response.json());fetchedAt=Date.now();drawNews();
    $('news-status').textContent=`已检查 ${date(fetchedAt)} · 每15分钟检查 · ${news.length} 条官方公告 · 元数据规则解读，非全文摘要`;
    if(!news.length)$('news-list').textContent='公告源本次未返回可用记录，不代表市场没有相关新闻。';
  }catch(e){$('news-status').textContent=`公告源暂不可用（${e.message}）。${news.length?'保留上次结果，检查于 '+date(fetchedAt):'可使用下方官网及媒体检索入口，不以模拟新闻填充。'}`;}
  finally{loading=false;$('news-refresh').disabled=false;}
}
export function initInsights(){ $('news-refresh').addEventListener('click',()=>refreshNews(true));refreshNews();setInterval(()=>refreshNews(),900000); }
