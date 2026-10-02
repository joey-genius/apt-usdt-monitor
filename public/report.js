const valid=n=>typeof n==='number'&&Number.isFinite(n);
const money=n=>!valid(n)?'—':'$'+(Math.abs(n)>=1e9?(n/1e9).toFixed(2)+'B':Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(2)+'K':n.toFixed(2));
const period=m=>m<60?m+'分钟':m/60+'小时';
const stamp=n=>valid(n)&&!Number.isNaN(new Date(n).getTime())?new Date(n).toISOString():'未知';
const net=n=>!valid(n)?'未知（无有效覆盖）':n===0?'$0.00 · 买卖持平':(n>0?'+':'-')+money(Math.abs(n))+' · '+(n>0?'主动净买入':'主动净卖出');
export function renderReport(d){
 const root=document.getElementById('contract-report');root.replaceChildren();
 const section=(title)=>{const s=document.createElement('section');s.className='report-section';if(title){const h=document.createElement('h2');h.textContent=title;s.append(h)}root.append(s);return s;};
 const row=(s,values,cls='')=>{const line=document.createElement('div');line.className='report-row '+cls;for(const value of values){const cell=document.createElement('span');cell.textContent=value;line.append(cell)}s.append(line);return line;};
 const note=(s,text)=>{const p=document.createElement('p');p.className='report-note';p.textContent=text;s.append(p);};
 const top=section();row(top,['加权交易价：',valid(d.price)?'$'+d.price.toFixed(8):'—'],'report-quote');row(top,['加权资金费率：',valid(d.funding)?(d.funding*100).toFixed(4)+'%':'—'],'report-quote');note(top,'费率统一为8小时等效 · '+(d.mode==='demo'?'演示数据，不代表实际行情':d.fetchedAt?'更新于 '+new Date(d.fetchedAt).toLocaleString('zh-CN',{hour12:false}):'等待数据'));
 const es=(d.exchanges||[]).filter(e=>valid(e.value)).sort((a,b)=>b.value-a.value),total=es.reduce((s,e)=>s+e.value,0);
 const dist=section('交易所持仓分布（小于 1% 不显示）');for(const e of es.filter(e=>total>0&&e.value/total>=.01))row(dist,[e.name,money(e.value),`(${(e.value/total*100).toFixed(2)}%)`],'report-exchange');
 if(!es.length)note(dist,'等待交易所数据…');note(dist,`覆盖 ${es.length}/${d.exchanges?.length||6} 家 · 占已获取单边持仓比例，非全市场`);
 const ratios=section();const names={accounts:'实时大户多空比（账户数）',positions:'实时大户多空比（持仓量）',global:'多空持仓人数比'};
 for(const r of d.ratios||[]){const group=document.createElement('div');group.className='report-ratio';const title=document.createElement('div');title.textContent=`${names[r.key]}：${valid(r.ratio)?r.ratio.toFixed(2):'—'}`;group.append(title);const bar=document.createElement('div');bar.className='report-balance';const l=document.createElement('span'),rr=document.createElement('span'),blocks=document.createElement('span');l.textContent=valid(r.long)?`多 ${(r.long*100).toFixed(1)}%`:'多 —';rr.textContent=valid(r.long)?`${((1-r.long)*100).toFixed(1)}% 空`:'— 空';blocks.className='report-blocks';blocks.setAttribute('aria-hidden','true');for(let i=0;i<16;i++){const block=document.createElement('i');if(valid(r.long)&&i<Math.round(Math.max(0,Math.min(1,r.long))*16))block.className='filled';blocks.append(block)}bar.append(l,blocks,rr);group.append(bar);note(group,d.mode==='demo'?'演示样本':r.timestamp?'最新可用快照 '+new Date(r.timestamp).toLocaleString('zh-CN',{hour12:false})+' · '+(r.sources?.join(' / ')||'无来源'):'暂无有效快照');if(r.samples?.length)note(group,r.samples.map(x=>x.name+' '+(valid(x.ratio)?x.ratio.toFixed(2):'—')+'（'+new Date(x.timestamp).toLocaleTimeString('zh-CN',{hour12:false})+'）').join(' · '));ratios.append(group)}note(ratios,'实时读取最新可用5分钟快照，页面每30秒刷新；超15分钟样本不参与。汇总为持仓加权代理指标，非逐笔实时；上方附各交易所原始比值。');
 const history=section('持仓变化（实际价值 / USD）');row(history,['已接入总持仓：',es.length?money(total):'—'],'report-quote');note(history,'实际价值指美元折算的合约名义价值，不是保证金。每行主金额为历史价值，附同组当前价值和增减金额；Bybit历史价值为标记价格估算，Gate双边历史除以2统一单边；Bitget/Hyperliquid按后台实存快照参与，未积累的周期不纳入。');
 for(const h of d.history||[]){const line=row(history,[period(h.minutes),money(h.previous),valid(h.change)?`(${h.change.toFixed(4)}%)`:'(—)'],'report-history');line.title=`来源：${h.sources?.join(' / ')||'演示或暂无数据'}；同组当前：${money(h.current)}`;const delta=valid(h.current)&&valid(h.previous)?h.current-h.previous:null;note(history,`${h.sources?.join(' / ')||'演示或暂无数据'} · 同组当前 ${money(h.current)} · 增减 ${valid(delta)?(delta>=0?'+':'-')+money(Math.abs(delta)):'—'}`);}
  const flow=section('大额成交买卖净额');
  for(const h of d.history||[]){
    const f=d.mode==='demo'?null:h.largeFlow;
    row(flow,[period(h.minutes),net(f?.net)],'report-flow');
    note(flow,`主动买入 ${money(f?.buy)} · 主动卖出 ${money(f?.sell)} · 成交记录数 ${valid(f?.count)?f.count:'未知'} · 金额单位：USD 等值`);
    if(f?.count===0&&valid(f?.net))note(flow,'已覆盖窗口内没有达到当前金额门槛的成交，可降低自定义额度查看。');
    note(flow,`最低单条上报成交金额 ≥ ${money(f?.threshold??d.largeTradeThreshold??10000)} · 已闭合窗口起点 ${stamp(f?.start)} / 终点 ${stamp(f?.end)}（UTC）`);
    note(flow,'纳入来源：'+(f?.sources?.join(' / ')||'无可用来源')+' · 快照时间 '+stamp(f?.snapshotAt));
    for(const x of f?.breakdown||[])note(flow,`${x.name}：买入 ${money(x.buy)} / 卖出 ${money(x.sell)} / 净额 ${net(x.net)} / ${valid(x.count)?x.count:'未知'} 条 / 合计 ${money(x.total)} / 已纳入大额成交占比 ${valid(x.share)?(x.share*100).toFixed(2)+'%':'未知'}`);
    note(flow,'未纳入来源及原因：'+(d.mode==='demo'?'演示未提供大额成交记录（demo-not-provided）':f?.excluded?.length?f.excluded.map(x=>x.name+'（'+x.reason+'）').join('；'):f?.sources?.length?'无额外排除记录':'未提供有效大额成交快照'));
    const evidence=valid(f?.start)&&valid(f?.end)?d.analysis?.find(a=>a.start===f.start&&a.end===f.end):null;
    if(evidence){
      const pct=n=>valid(n)?(n>=0?'+':'')+n.toFixed(2)+'%':'未知';
      note(flow,`同窗辅助背景：价格 ${pct(evidence.priceChange)} · OI 持仓币数 ${pct(evidence.quantityChange)} · 来源 ${evidence.sources?.join(' / ')||'未知'}。仅说明同期变化，不能识别账户或确认大额成交者的开平仓方向。`);
    }else note(flow,'价格/OI分析窗口不同或缺失，不能用于确认该大额成交窗口的方向。');
  }
  note(flow,'净额 = 主动买入 − 主动卖出；仅统计达到阈值的交易所上报成交记录，不是原始委托订单。同窗口有效来源直接求和，不按持仓加权；未知不等于零，买卖持平也不表示没有成交。');
  note(flow,'数据质量：近期有限条数成交记录（recent-records），覆盖结论受接口条数上限、记录连续性与新鲜度约束，不保证全市场完整。最低金额仅为观察阈值，不是官方巨鲸边界，不能据此识别主力或大户账户。');
  note(flow,'价格、OI、当前资金费率及大户多空比仅作多维市场背景，不能识别账户，也不能据此断言吸筹、出货或资金进出。下方行情分析为全成交量背景，与大额成交统计分开，不作为缺失值替代。');
  note(flow,'强平数据：未接入 · 订单簿追踪：未接入 · 地址追踪：未接入。');
}
