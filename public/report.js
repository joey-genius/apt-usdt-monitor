const valid=n=>typeof n==='number'&&Number.isFinite(n);
const money=n=>!valid(n)?'—':'$'+(Math.abs(n)>=1e9?(n/1e9).toFixed(2)+'B':Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(2)+'K':n.toFixed(2));
const period=m=>m<60?m+'分钟':m/60+'小时';
const stamp=n=>valid(n)&&!Number.isNaN(new Date(n).getTime())?new Date(n).toLocaleString('zh-CN',{hour12:false}):'未知';
const percent=n=>valid(n)?(n*100).toFixed(2)+'%':'不可用';
export function renderReport(d){
 const root=document.getElementById('contract-report');root.replaceChildren();
 const section=(title)=>{const s=document.createElement('section');s.className='report-section';if(title){const h=document.createElement('h2');h.textContent=title;s.append(h)}root.append(s);return s;};
 const row=(s,values,cls='')=>{const line=document.createElement('div');line.className='report-row '+cls;for(const value of values){const cell=document.createElement('span');cell.textContent=value;line.append(cell)}s.append(line);return line;};
 const note=(s,text)=>{const p=document.createElement('p');p.className='report-note';p.textContent=text;s.append(p);};
 const top=section();row(top,['加权交易价：',valid(d.price)?'$'+d.price.toFixed(8):'—'],'report-quote');row(top,['加权资金费率：',valid(d.funding)?(d.funding*100).toFixed(4)+'%':'—'],'report-quote');note(top,'费率统一为8小时等效 · '+(d.mode==='demo'?'演示数据，全部为模拟值，不代表实际行情':d.fetchedAt?'更新于 '+stamp(d.fetchedAt):'等待数据'));
 const ratios=section('Binance APTUSDT · 大户多空比');
 ratios.className+=' binance-traders';
 const metrics=[['accounts','大户账户数比 · ACCOUNT'],['positions','大户持仓量比 · POSITION'],['global','全账户多空人数比 · 非大户指标']];
 const recent=document.createElement('details');recent.className='trader-history';
 const summary=document.createElement('summary');summary.textContent='最近 12 个 5 分钟快照 · 按指标查看';recent.append(summary);
 for(const [key,label] of metrics){
   const r=d.ratios?.find(r=>r.key===key);
   const available=d.mode==='demo'||r?.sources?.includes('Binance');
   const group=document.createElement('div');group.className='report-ratio'+(key==='global'?' all-account-comparison':'');
   row(group,[label,available&&valid(r?.ratio)?r.ratio.toFixed(4):'不可用'],'trader-ratio-title');
   row(group,['多 '+percent(available?r?.long:null),'空 '+percent(available?r?.short:null)],'trader-percentages');
   note(group,d.mode==='demo'?'模拟数据 · 非 Binance 实际读数 · 生成时间 '+stamp(r?.timestamp):available?'来源：Binance 官方公开数据 · 最后更新 '+stamp(r?.timestamp):'Binance 数据不可用；不使用 Gate / Bybit 替代。');
   if(r?.error)note(group,'来源错误：'+r.error);
   ratios.append(group);
   const heading=document.createElement('h3');heading.textContent=label;recent.append(heading);
   const snapshots=available?(r?.history||[]).slice().sort((a,b)=>(b.timestamp??0)-(a.timestamp??0)).slice(0,12):[];
   if(!snapshots.length){note(recent,d.mode==='demo'?'暂无模拟历史':'Binance 历史不可用');continue;}
   const scroll=document.createElement('div');scroll.className='source-scroll';
   const table=document.createElement('table');
   const caption=document.createElement('caption');caption.textContent=(d.mode==='demo'?'模拟数据':'Binance APTUSDT')+' · '+label;table.append(caption);
   const head=document.createElement('thead'),tr=document.createElement('tr');
   for(const text of ['快照时间（本地）','多头占比','空头占比','多空比']){const th=document.createElement('th');th.textContent=text;th.setAttribute('scope','col');tr.append(th)}head.append(tr);table.append(head);
   const body=document.createElement('tbody');
   for(const snapshot of snapshots){const tr=document.createElement('tr');for(const text of [stamp(snapshot.timestamp),percent(snapshot.long),percent(snapshot.short),valid(snapshot.ratio)?snapshot.ratio.toFixed(4):'不可用']){const td=document.createElement('td');td.textContent=text;tr.append(td)}body.append(tr)}
   table.append(body);scroll.append(table);recent.append(scroll);
 }
 note(ratios,'ACCOUNT 按大户账户数量统计；POSITION 按大户持仓量统计。大户为 Binance 保证金余额排名前 20% 的用户；全账户指标单独对照，不代表大户。');
 note(ratios,'直接展示 Binance 官方公开接口原值，不按 OI 加权，不从比例推算资金金额。5 分钟快照，页面每 30 秒刷新；超过 15 分钟的当前样本不参与，历史仅供回看。');
  ratios.append(recent);
  const trades=section('近24小时成交金额 Top 100');trades.className+=' top-trades';
  note(trades,'最近一次完成采集的覆盖快照，非实时逐笔行情。仅纳入完整采集该 24 小时窗口的平台，跨平台按成交金额降序取前 100 笔，无最低金额门槛；不代表全市场。');
  note(trades,'主动买入不等于实际充值入金，主动卖出不等于提现出金；每笔成交都有买卖双方，主动方向不代表账户资金进出。Top 100 有符号净额仅为入选成交的买卖差，不是完整 24 小时净额。');
  const snapshot=d.mode==='demo'?null:d.topTrades;
  const status=document.createElement('p');status.className='top-trades-status';status.setAttribute('role','status');trades.append(status);
  if(!snapshot){
    status.className+=' unavailable';
    status.textContent=d.mode==='demo'?'演示模式：没有实际 Top 100 成交记录，不生成模拟成交。':'Top 100 快照不可用（缺失或已过期）：'+(d.topTradesError||'尚无可用的已完成采集快照；不以零成交替代。');
  }else{
    const rows=snapshot.rows.slice().sort((a,b)=>b.amount-a.amount).slice(0,100);
    const covered=snapshot.sources.filter(source=>source.status==='ok');
    status.textContent=!covered.length?'Top 100 快照无完整覆盖平台，数据不可用，不代表零成交。':!rows.length?'已完整采集的覆盖平台在该窗口内无成交记录（0 / 100 笔），不是数据缺失。':`已返回 ${rows.length} / 100 笔${rows.length<100?'（不足 100 笔，按实际记录展示）':''} · 最近完成覆盖快照，非实时`;
    if(!covered.length)status.className+=' unavailable';
    const utc=n=>valid(n)&&!Number.isNaN(new Date(n).getTime())?new Date(n).toISOString():'未知';
    note(trades,`窗口（本地）：${stamp(snapshot.windowStart)} 至 ${stamp(snapshot.windowEnd)}（截止）`);
    note(trades,`窗口（UTC）：${utc(snapshot.windowStart)} 至 ${utc(snapshot.windowEnd)}（截止）`);
    note(trades,`采集完成：本地 ${stamp(snapshot.fetchedAt)} / UTC ${utc(snapshot.fetchedAt)}`);
    const scope='完整覆盖平台：'+(covered.map(source=>source.name).join(' / ')||'无');
    note(trades,scope+'；失败或不支持的平台不纳入排行及汇总，不作外推。');
    const sources=document.createElement('ul');sources.className='top-trades-sources';
    for(const source of snapshot.sources){const item=document.createElement('li');item.textContent=`${source.name} · ${{ok:'完整采集',error:'采集失败（未纳入）',unsupported:'不支持（未纳入）'}[source.status]||'未知状态'} · ${source.records} 条记录 / ${source.pages} 页${source.error?' · '+source.error:''}`;sources.append(item)}
    trades.append(sources);
    const amount=n=>valid(n)?n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:8})+' USDT':'不可用';
    const totals=(parent,value,prefix)=>{
      if(!value){note(parent,prefix+'汇总不可用，不以零替代。');return;}
      row(parent,[prefix+'主动买入',amount(value.buy)],'top-trades-total');
      row(parent,[prefix+'主动卖出',amount(value.sell)],'top-trades-total');
       row(parent,[prefix+'有符号净额（买 - 卖）',valid(value.net)?(value.net>=0?'+':'-')+amount(Math.abs(value.net)):'不可用'],'top-trades-total');
       note(parent,prefix+'净买入 '+amount(value.netIn)+' / 净卖出 '+amount(value.netOut)+'（二者为净额的正负部分，不是充值或提现）');
      row(parent,[prefix+'成交金额合计',amount(value.turnover)],'top-trades-total');
      note(parent,prefix+'汇总记录数：'+value.count+' 笔');
    };
    totals(trades,snapshot.totals,'Top 100 ');
    const full=document.createElement('details');full.className='top-trades-full';
    const fullSummary=document.createElement('summary');fullSummary.textContent='展开完整 24 小时汇总 · 仅完整覆盖平台 · 非 Top 100';full.append(fullSummary);
    note(full,scope+'。同一截止窗口内全部已采集成交，不限于 Top 100；不是全市场，也不是实际充值 / 提现资金流。');
    totals(full,snapshot.allTradesTotals,'完整 24 小时 ');trades.append(full);
    if(rows.length){
      const scroll=document.createElement('div');scroll.className='source-scroll top-trades-scroll';scroll.setAttribute('tabindex','0');scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Top 100 成交明细，可横向滚动');
      const table=document.createElement('table');
      const caption=document.createElement('caption');caption.textContent=`Top 100 入选成交 · ${rows.length} 笔 · 金额降序 · 时间为本地时区`;table.append(caption);
      const head=document.createElement('thead'),heading=document.createElement('tr');
      for(const text of ['排名','成交时间（本地）','交易所','主动方向','价格（APTUSDT）','数量（APT）','成交金额（USDT）','交易 ID']){const th=document.createElement('th');th.textContent=text;th.setAttribute('scope','col');heading.append(th)}head.append(heading);table.append(head);
      const body=document.createElement('tbody');
      rows.forEach((trade,index)=>{const line=document.createElement('tr');for(const [column,text] of [index+1,stamp(trade.time),trade.exchange,trade.side==='buy'?'主动买入':'主动卖出',trade.price,trade.quantity,amount(trade.amount),trade.id].entries()){const cell=document.createElement('td');cell.textContent=String(text);if(column===3)cell.className=trade.side==='buy'?'top-trade-buy':'top-trade-sell';line.append(cell)}body.append(line)});
      table.append(body);scroll.append(table);trades.append(scroll);
    }
  }
  const es=(d.exchanges||[]).filter(e=>valid(e.value)).sort((a,b)=>b.value-a.value),total=es.reduce((s,e)=>s+e.value,0);
 const dist=section('交易所持仓分布（小于 1% 不显示）');for(const e of es.filter(e=>total>0&&e.value/total>=.01))row(dist,[e.name,money(e.value),`(${(e.value/total*100).toFixed(2)}%)`],'report-exchange');
 if(!es.length)note(dist,'等待交易所数据…');note(dist,`覆盖 ${es.length}/${d.exchanges?.length||6} 家 · 占已获取单边持仓比例，非全市场`);
 const history=section('持仓变化（实际价值 / USD）');row(history,['已接入总持仓：',es.length?money(total):'—'],'report-quote');note(history,'实际价值指美元折算的合约名义价值，不是保证金。每行主金额为历史价值，附同组当前价值和增减金额；Bybit历史价值为标记价格估算，Gate双边历史除以2统一单边；Bitget/Hyperliquid按后台实存快照参与，未积累的周期不纳入。');
 for(const h of d.history||[]){const line=row(history,[period(h.minutes),money(h.previous),valid(h.change)?`(${h.change.toFixed(4)}%)`:'(—)'],'report-history');line.title=`来源：${h.sources?.join(' / ')||'演示或暂无数据'}；同组当前：${money(h.current)}`;const delta=valid(h.current)&&valid(h.previous)?h.current-h.previous:null;note(history,`${h.sources?.join(' / ')||'演示或暂无数据'} · 同组当前 ${money(h.current)} · 增减 ${valid(delta)?(delta>=0?'+':'-')+money(Math.abs(delta)):'—'}`);}
}
