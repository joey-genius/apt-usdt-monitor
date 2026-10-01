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
export function classifyRelease(r) {
  const label=`${r.name||''} ${r.tag_name||''}`;
  const candidate=r.prerelease||/(?:^|[-_\s])(?:rc\d*|alpha\d*|beta\d*|testnet|devnet)(?:$|[-_\s])/i.test(label);
  const hotfix=/hotfix|patch/i.test(label);
  return {title:label.trim()?r.name||r.tag_name:'官方版本公告',kind:candidate?'候选 / 测试版本':hotfix?'维护版本公告':'版本发布公告',fact:`Aptos 官方仓库发布 ${r.tag_name||'新版本'}。${candidate?'名称或标记显示为候选/测试版本。':'发布记录本身不证明主网已采用该版本。'}`,reading:hotfix?'维护公告值得核对修复范围、影响组件和运营要求；仅凭“hotfix”字样不能认定发生安全事故。':'版本发布可能影响节点运维或开发者功能；需阅读发布说明并核对是否适用于主网。',watch:'关注主网部署确认、节点采用情况及链上运行状态。技术公告不能直接解释价格涨跌。'};
}
export function safeLink(value) {try {const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
export function normalizeReleases(data) {
  if(!Array.isArray(data))throw Error('公告格式异常');
  return data.filter(r=>!r.draft&&safeLink(r.html_url)&&Number.isFinite(Date.parse(r.published_at)))
    .sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)).slice(0,6)
    .map(r=>({...classifyRelease(r),url:safeLink(r.html_url),published:r.published_at,tag:r.tag_name}));
}
