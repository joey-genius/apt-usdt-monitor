export const DAY_MS=86400000;
export function availableTopTrades(snapshot,now=Date.now()) {
  if(!snapshot||snapshot.schemaVersion!==1||!Number.isFinite(snapshot.windowEnd)||snapshot.windowEnd-snapshot.windowStart!==DAY_MS||!Number.isFinite(snapshot.fetchedAt))return {topTrades:null,topTradesError:'24小时历史成交快照尚未生成或格式无效'};
  if(now-snapshot.windowEnd>3600000||snapshot.windowEnd>now+60000||snapshot.fetchedAt<snapshot.windowEnd||snapshot.fetchedAt>now+60000)return {topTrades:null,topTradesError:'24小时成交快照已过期，等待重新采集'};
  if(!Array.isArray(snapshot.sources)||!snapshot.sources.every(s=>s&&typeof s.name==='string'&&['ok','error','unsupported'].includes(s.status)&&Number.isInteger(s.records)&&s.records>=0&&Number.isInteger(s.pages)&&s.pages>=0))return {topTrades:null,topTradesError:'24小时成交来源状态无效'};
  const sources=snapshot.sources.filter(s=>s.status==='ok');
  if(!sources.length)return {topTrades:null,topTradesError:'没有交易所完成24小时历史扫描：'+(snapshot.sources||[]).map(s=>s.name+' '+(s.error||s.status)).join('；')};
  if(!Array.isArray(snapshot.rows)||snapshot.rows.length>100||!snapshot.totals||!snapshot.allTradesTotals)return {topTrades:null,topTradesError:'24小时排名或汇总字段无效'};
  const expectedRows=Math.min(100,sources.reduce((sum,s)=>sum+s.records,0));
  if(snapshot.rows.length!==expectedRows||snapshot.totals.count!==snapshot.rows.length||snapshot.allTradesTotals.count!==sources.reduce((sum,s)=>sum+s.records,0))return {topTrades:null,topTradesError:'排名记录数与来源汇总不一致'};
  const tolerance=(actual,expected)=>Math.abs(actual-expected)<=Math.max(1e-8,Math.abs(expected)*1e-12);
  const fields=['buy','sell','netIn','netOut','turnover'];
  const validTotals=totals=>totals&&Number.isFinite(totals.net)&&fields.every(field=>Number.isFinite(totals[field])&&totals[field]>=0)&&tolerance(totals.net,totals.buy-totals.sell)&&tolerance(totals.turnover,totals.buy+totals.sell)&&tolerance(totals.netIn,Math.max(totals.net,0))&&tolerance(totals.netOut,Math.max(-totals.net,0));
  if(!validTotals(snapshot.totals)||!validTotals(snapshot.allTradesTotals))return {topTrades:null,topTradesError:'24小时金额汇总字段不一致'};
  const seen=new Set();
  let buy=0,sell=0;
  for(const r of snapshot.rows){
    if(!r||typeof r!=='object')return {topTrades:null,topTradesError:'成交记录格式无效'};
    const key=r.exchange+':'+r.id;
    if(!sources.some(s=>s.name===r.exchange)||typeof r.id!=='string'||!r.id||seen.has(key)||!Number.isFinite(r.time)||r.time<snapshot.windowStart||r.time>=snapshot.windowEnd||!Number.isFinite(r.amount)||r.amount<=0||!['buy','sell'].includes(r.side))return {topTrades:null,topTradesError:'成交记录校验失败'};
    seen.add(key);
    if(r.side==='buy')buy+=r.amount;else sell+=r.amount;
  }
  if(!tolerance(buy,snapshot.totals.buy)||!tolerance(sell,snapshot.totals.sell))return {topTrades:null,topTradesError:'Top 100 成交与汇总金额不一致'};
  return {topTrades:snapshot,topTradesError:null};
}
