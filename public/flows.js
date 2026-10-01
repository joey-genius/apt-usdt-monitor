import { flow, numeric } from './metrics.js';

export function aggregateFlow({minutes,now,binance,okxSnapshot}) {
  const interval=minutes<=1440?300000:3600000;
  const snapshotTime=okxSnapshot?.fetchedAt;
  const fresh=numeric(snapshotTime)&&now-snapshotTime>=-60000&&now-snapshotTime<=1800000;
  const series=fresh?okxSnapshot[interval===300000?'fiveMinute':'hourly']:[];
  const rows=Array.isArray(series)?series:[];
  // Both venues use candle opening timestamps; exclude the current incomplete candle.
  const end=Math.floor((fresh&&rows.length?Math.min(now,snapshotTime):now)/interval)*interval;
  const start=end-minutes*60000;
  const selected=rows.filter(r=>numeric(r.time)&&r.time>=start&&r.time<end);
  const expected=minutes*60000/interval;
  const complete=selected.length===expected&&new Set(selected.map(r=>r.time)).size===expected&&selected.every(r=>r.time%interval===0&&numeric(r.buy)&&numeric(r.sell)&&r.buy>=0&&r.sell>=0);
  const okx=complete?selected.reduce((sum,r)=>sum+r.buy-r.sell,0):null;
  const bin=flow(binance,minutes,end,interval);
  const breakdown=[{name:'Binance',value:bin},{name:'OKX',value:okx}].filter(r=>numeric(r.value));
  return {flow:breakdown.length?breakdown.reduce((s,r)=>s+r.value,0):null,flowSources:breakdown.map(r=>r.name),flowBreakdown:breakdown,flowStart:start,flowEnd:end,flowSnapshotAt:fresh?snapshotTime:null};
}
