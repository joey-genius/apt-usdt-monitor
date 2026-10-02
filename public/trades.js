export function normalizeTrades(name, rows, multiplier=1) {
  if(!Array.isArray(rows)||!rows.length)throw Error('未返回成交记录');
  const trades=new Map();
  for(const r of rows) {
    const gate=name==='Gate';
    const binance=name==='Binance',okx=name==='OKX';
    const rawId=gate||binance?r.id:name==='Bybit'?r.execId:r.tradeId;
    const id=String(rawId);
    const time=gate?(r.create_time_ms!=null?Number(r.create_time_ms):Number(r.create_time)*1000):Number(r.time??r.ts);
    const size=Number(binance?r.qty:okx?r.sz:r.size),price=Number(okx?r.px:r.price);
    if(binance&&typeof r.isBuyerMaker!=='boolean')throw Error('缺少主动成交方向');
    const side=binance?(r.isBuyerMaker?'sell':'buy'):gate?(size>0?'buy':'sell'):String(r.side).toLowerCase();
    const notional=price*Math.abs(size)*multiplier;
    if(rawId==null||id===''||![time,size,price,multiplier,notional].every(Number.isFinite)||time<=0||size===0||(!gate&&size<0)||price<=0||multiplier<=0||!['buy','sell'].includes(side))throw Error('成交字段无效');
    const excluded=r.is_internal===true||r.isBlockTrade===true;
    const trade={id,time,side,notional,excluded,net:excluded?0:notional*(side==='buy'?1:-1)};
    if(trades.has(id)&&JSON.stringify(trades.get(id))!==JSON.stringify(trade))throw Error('重复成交 ID 内容冲突');
    trades.set(id,trade);
  }
  const sorted=[...trades.values()].sort((a,b)=>a.time-b.time);
  // Binance raw trade IDs can expose a missing execution inside a recent batch.
  if(name==='Binance') {
    const ids=sorted.map(t=>Number(t.id)).sort((a,b)=>a-b);
    if(ids.some((id,i)=>!Number.isSafeInteger(id)||(i>0&&id!==ids[i-1]+1)))throw Error('Binance 成交序号有缺口');
  }
  return {name,start:sorted[0].time,end:sorted.at(-1).time,trades:sorted,status:'ok',recordUnit:'exchange-reported-trade'};
}
