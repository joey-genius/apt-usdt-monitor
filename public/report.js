const valid=n=>typeof n==='number'&&Number.isFinite(n);
const money=n=>!valid(n)?'—':'$'+(Math.abs(n)>=1e9?(n/1e9).toFixed(2)+'B':Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(2)+'K':n.toFixed(2));
const period=m=>m<60?m+'分钟':m/60+'小时';
export function renderReport(d){
 const root=document.getElementById('contract-report');root.replaceChildren();
 const section=(title)=>{const s=document.createElement('section');s.className='report-section';if(title){const h=document.createElement('h2');h.textContent=title;s.append(h)}root.append(s);return s;};
 const row=(s,values,cls='')=>{const line=document.createElement('div');line.className='report-row '+cls;for(const value of values){const cell=document.createElement('span');cell.textContent=value;line.append(cell)}s.append(line);return line;};
 const note=(s,text)=>{const p=document.createElement('p');p.className='report-note';p.textContent=text;s.append(p);};
 const top=section();row(top,['加权交易价：',valid(d.price)?'$'+d.price.toFixed(8):'—'],'report-quote');row(top,['加权资金费率：',valid(d.funding)?(d.funding*100).toFixed(4)+'%':'—'],'report-quote');note(top,'费率统一为8小时等效 · '+(d.mode==='demo'?'演示数据，不代表实际行情':d.fetchedAt?'更新于 '+new Date(d.fetchedAt).toLocaleString('zh-CN',{hour12:false}):'等待数据'));
 const es=(d.exchanges||[]).filter(e=>valid(e.value)).sort((a,b)=>b.value-a.value),total=es.reduce((s,e)=>s+e.value,0);
 const dist=section('交易所持仓分布（小于 1% 不显示）');for(const e of es.filter(e=>total>0&&e.value/total>=.01))row(dist,[e.name,money(e.value),`(${(e.value/total*100).toFixed(2)}%)`],'report-exchange');
 if(!es.length)note(dist,'等待交易所数据…');note(dist,`覆盖 ${es.length}/${d.exchanges?.length||6} 家 · 占已获取单边持仓比例，非全市场`);
 const ratios=section();const names={accounts:'大户多空比（账户数）',positions:'大户多空比（持仓量）',global:'多空持仓人数比'};
 for(const r of d.ratios||[]){const group=document.createElement('div');group.className='report-ratio';const title=document.createElement('div');title.textContent=`${names[r.key]}：${valid(r.ratio)?r.ratio.toFixed(2):'—'}`;group.append(title);const bar=document.createElement('div');bar.className='report-balance';const l=document.createElement('span'),rr=document.createElement('span'),blocks=document.createElement('span');l.textContent=valid(r.long)?`多 ${(r.long*100).toFixed(1)}%`:'多 —';rr.textContent=valid(r.long)?`${((1-r.long)*100).toFixed(1)}% 空`:'— 空';blocks.className='report-blocks';blocks.setAttribute('aria-hidden','true');for(let i=0;i<16;i++){const block=document.createElement('i');if(valid(r.long)&&i<Math.round(Math.max(0,Math.min(1,r.long))*16))block.className='filled';blocks.append(block)}bar.append(l,blocks,rr);group.append(bar);ratios.append(group)}note(ratios,'多空比例为持仓加权代理指标；方块按比例四舍五入。');
 const history=section('持仓变化（名义价值）');row(history,['已接入总持仓：',es.length?money(total):'—'],'report-quote');note(history,'以下每行仅比较该周期可用的同组交易所；金额为历史持仓。');
 for(const h of d.history||[]){const line=row(history,[period(h.minutes),money(h.previous),valid(h.change)?`(${h.change.toFixed(4)}%)`:'(—)'],'report-history');line.title=`来源：${h.sources?.join(' / ')||'演示或暂无数据'}；同组当前：${money(h.current)}`;}
 const flow=section('主动买卖净额 $');for(const h of d.history||[])row(flow,[period(h.minutes),valid(h.flow)?(h.flow<0?'-':'')+money(Math.abs(h.flow)):'—'],'report-flow');note(flow,'仅 Binance 完整K线 · 主动买入减主动卖出，并非可识别的主力净流入。');
}
