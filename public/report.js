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
 const es=(d.exchanges||[]).filter(e=>valid(e.value)).sort((a,b)=>b.value-a.value),total=es.reduce((s,e)=>s+e.value,0);
 const dist=section('交易所持仓分布（小于 1% 不显示）');for(const e of es.filter(e=>total>0&&e.value/total>=.01))row(dist,[e.name,money(e.value),`(${(e.value/total*100).toFixed(2)}%)`],'report-exchange');
 if(!es.length)note(dist,'等待交易所数据…');note(dist,`覆盖 ${es.length}/${d.exchanges?.length||6} 家 · 占已获取单边持仓比例，非全市场`);
 const history=section('持仓变化（实际价值 / USD）');row(history,['已接入总持仓：',es.length?money(total):'—'],'report-quote');note(history,'实际价值指美元折算的合约名义价值，不是保证金。每行主金额为历史价值，附同组当前价值和增减金额；Bybit历史价值为标记价格估算，Gate双边历史除以2统一单边；Bitget/Hyperliquid按后台实存快照参与，未积累的周期不纳入。');
 for(const h of d.history||[]){const line=row(history,[period(h.minutes),money(h.previous),valid(h.change)?`(${h.change.toFixed(4)}%)`:'(—)'],'report-history');line.title=`来源：${h.sources?.join(' / ')||'演示或暂无数据'}；同组当前：${money(h.current)}`;const delta=valid(h.current)&&valid(h.previous)?h.current-h.previous:null;note(history,`${h.sources?.join(' / ')||'演示或暂无数据'} · 同组当前 ${money(h.current)} · 增减 ${valid(delta)?(delta>=0?'+':'-')+money(Math.abs(delta)):'—'}`);}
}
