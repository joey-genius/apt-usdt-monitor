export function normalizeTrades(name, rows, multiplier=1) {
  if(!Array.isArray(rows)||!rows.length)throw Error('未返回成交记录');
  const trades=new Map();
  for(const r of rows) {
    const gate=name==='Gate';
    const id=String(gate?r.id:name==='Bybit'?r.execId:r.tradeId);
    const time=gate?Number(r.create_time)*1000:Number(r.time??r.ts);
    const size=Number(r.size),price=Number(r.price);
    const side=gate?(size>0?'buy':'sell'):String(r.side).toLowerCase();
    if(id==='undefined'||![time,size,price,multiplier].every(Number.isFinite)||price<=0||multiplier<=0||!['buy','sell'].includes(side))throw Error('成交字段无效');
    trades.set(id,{time,net:r.is_internal||r.isBlockTrade?0:price*Math.abs(size)*multiplier*(side==='buy'?1:-1)});
  }
  const sorted=[...trades.values()].sort((a,b)=>a.time-b.time);
  return {name,start:sorted[0].time,end:sorted.at(-1).time,trades:sorted,status:'ok'};
}
