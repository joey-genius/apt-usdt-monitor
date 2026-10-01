import { numeric } from './metrics.js';
const pct = n => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
export function interpretData(d) {
  const cards = [];
  if (numeric(d.funding)) {
    const f = d.funding * 100;
    cards.push({title:'持仓成本与多空倾向',fact:`持仓加权8小时等效费率 ${pct(f)}；覆盖 ${d.coverage?.funding?.length || 0} 家。`,reading:f>0?'费率为正，相关合约中通常由多头向空头支付资金费。它反映持仓成本，并不单独证明后续上涨。':f<0?'费率为负，相关合约中通常由空头向多头支付资金费。它反映持仓成本，并不单独证明后续下跌。':'费率接近零，当前资金费成本方向不明显。',watch:'观察费率是否持续偏离，以及持仓是否同步扩张；加权值不是单一交易所的结算费率。'});
  }
  const h=d.history?.find(r=>r.minutes===1440);
  if(numeric(h?.change)) cards.push({title:'24小时持仓结构',fact:`${h.sources?.join(' / ')||'样本市场'} 同组名义持仓变化 ${pct(h.change)}。`,reading:h.change>0?'名义持仓扩大，可能来自新增头寸或币价变动，不能仅凭这一项判断新增多头还是空头。':h.change<0?'名义持仓缩小，可能来自平仓或币价变动，不能据此认定发生了大规模爆仓。':'名义持仓基本持平，尚无明显扩张或收缩。',watch:'核对价格、持仓币数与清算数据。价格涨跌与持仓覆盖交易所可能不同，不作机械因果配对。'});
  const r=d.ratios?.find(r=>r.key==='global');
  if(numeric(r?.long))cards.push({title:'账户情绪',fact:`加权多头占比 ${(r.long*100).toFixed(1)}%，覆盖 ${r.sources?.join(' / ')||'演示样本'}。`,reading:r.long>.5?'样本账户情绪偏多，但账户数量不等于投入资金规模。':r.long<.5?'样本账户情绪偏空，但账户数量不等于投入资金规模。':'样本多空占比较均衡。',watch:'该数值是持仓加权代理指标，不是全市场真实人数比例，也不是反向交易信号。'});
  const es=(d.exchanges||[]).filter(e=>numeric(e.value)&&e.value>0).sort((a,b)=>b.value-a.value), total=es.reduce((s,e)=>s+e.value,0);
  if(es.length)cards.push({title:'市场覆盖与集中度',fact:`${es.length} 家有持仓数据；${es[0].name} 占已覆盖持仓 ${(es[0].value/total*100).toFixed(1)}%。`,reading:'权重较大的交易所对加权价格与费率影响更大；缺失交易所会改变样本构成。',watch:'对比聚合来源表，避免把覆盖范围变化误读为资金迁移。'});
  return cards;
}
export function interpretPositions(d) {
  const groups=[{title:'短线持仓 · 5分钟至1小时',minutes:[5,15,30,60]},{title:'日内持仓 · 4至24小时',minutes:[240,480,720,1440]},{title:'多日持仓 · 48至168小时',minutes:[2880,4320,10080]}];
  return groups.map(group=>{
    const rows=group.minutes.map(m=>d.history?.find(h=>h.minutes===m)).filter(h=>numeric(h?.change));
    if(!rows.length)return {title:group.title,fact:'该组周期暂无有效历史数据。',reading:'数据不足，暂不判断持仓扩张或收缩。',watch:'等待历史接口恢复；不使用其他周期的数据填补。'};
    const label=m=>m<60?m+'分钟':m/60+'小时';
    const fact=rows.map(h=>label(h.minutes)+' '+pct(h.change)+'（'+(h.sources?.join(' / ')||'演示样本')+'）').join('；');
    const up=rows.filter(h=>h.change>0).length,down=rows.filter(h=>h.change<0).length;
    let reading=up===rows.length?'有效周期相对各自历史起点均呈名义持仓扩张。':down===rows.length?'有效周期相对各自历史起点均呈名义持仓收缩。':up&&down?'各周期方向分化，当前持仓相对不同历史起点有增有减，不等于已确认趋势反转。':'部分或全部周期持仓基本持平。';
    const cohorts=new Set(rows.map(h=>(h.sources||[]).slice().sort().join('|')));
    if(cohorts.size>1)reading+=' 这些周期的交易所覆盖不同，不能直接比较变化幅度。';
    return {title:group.title,fact,reading,watch:'先核对同组当前/历史持仓，再结合价格和持仓币数。当前可用 '+rows.length+'/'+group.minutes.length+' 个周期；不能单凭名义持仓识别新增多头、空头或爆仓。'};
  });
}
