import { numeric } from './metrics.js';

export const LARGE_TRADE_THRESHOLD = 10000;
export const LARGE_TRADE_VENUES = ['Binance','OKX','Bybit','Bitget','Gate'];
const MAX_AGE = 30 * 60000;

export function parseLargeTradeThreshold(value) {
  const text=String(value??'').trim();
  if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))return null;
  const amount=Number(text);
  return Number.isFinite(amount)&&amount>=0.01&&amount<=Number.MAX_SAFE_INTEGER?amount:null;
}

// Only execution records can pass the size filter. Candle/taker aggregates cannot.
export function aggregateLargeTradeFlow({minutes,now,snapshot,threshold=LARGE_TRADE_THRESHOLD}) {
  if(!numeric(threshold)||threshold<=0||!numeric(minutes)||minutes<=0||!numeric(now))throw Error('Invalid large-trade window or threshold');
  const fresh=numeric(snapshot?.fetchedAt)&&now-snapshot.fetchedAt>=-60000&&now-snapshot.fetchedAt<=MAX_AGE;
  const cutoff=snapshot?.tradeCutoff;
  const validCutoff=fresh&&numeric(cutoff)&&cutoff%300000===0&&cutoff<=snapshot.fetchedAt&&now-cutoff>=0&&now-cutoff<=MAX_AGE;
  const end=validCutoff?cutoff:null,start=validCutoff?end-minutes*60000:null;
  const breakdown=[],excluded=[];
  for(const name of LARGE_TRADE_VENUES) {
    const venue=snapshot?.recent?.find(r=>r.name===name);
    let reason=null;
    if(!validCutoff)reason='逐笔快照缺失、过期或无统一截止时间';
    else if(!venue||venue.status!=='ok')reason=venue?.error||'未返回逐笔成交';
    else if(!numeric(venue.fetchedAt)||venue.fetchedAt<end||venue.fetchedAt>snapshot.fetchedAt||now-venue.fetchedAt>MAX_AGE)reason='交易所采集时间缺失或过期';
    else if(venue.recordUnit!=='exchange-reported-trade'||!Array.isArray(venue.trades)||!venue.trades.length)reason='旧快照或非逐笔数据，不能筛选大单';
    else {
      const trades=venue.trades,ids=new Set();
      const valid=trades.every(t=>{
        if(typeof t.id!=='string'||!t.id||ids.has(t.id))return false;
        ids.add(t.id);
        return numeric(t.time)&&t.time>0&&t.time<=venue.fetchedAt+60000&&numeric(t.notional)&&t.notional>0&&['buy','sell'].includes(t.side)&&typeof t.excluded==='boolean'&&t.net===(t.excluded?0:t.notional*(t.side==='buy'?1:-1));
      });
      if(!valid)reason='成交字段无效、重复 ID 或时间异常';
      else if(Math.min(...trades.map(t=>t.time))>start||Math.max(...trades.map(t=>t.time))<end)reason='近期成交记录未覆盖整个周期，不补算历史';
      else {
        let buy=0,sell=0,count=0,total=0;
        for(const t of trades) {
          if(t.time<start||t.time>=end||t.excluded)continue;
          total+=t.notional;
          if(t.notional<threshold)continue;
          if(t.side==='buy')buy+=t.notional;else sell+=t.notional;
          count++;
        }
        breakdown.push({name,buy,sell,net:buy-sell,count,total,share:total>0?(buy+sell)/total:null});
      }
    }
    if(reason)excluded.push({name,reason});
  }
  const sum=key=>breakdown.length?breakdown.reduce((s,r)=>s+r[key],0):null;
  const buy=sum('buy'),sell=sum('sell');
  return {net:breakdown.length?buy-sell:null,buy,sell,count:sum('count'),threshold,start,end,sources:breakdown.map(r=>r.name),breakdown,excluded,snapshotAt:fresh?snapshot.fetchedAt:null,quality:'recent-records'};
}
