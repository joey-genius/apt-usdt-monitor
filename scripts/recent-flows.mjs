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
export async function collectRecent() {
  const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();};
  return Promise.all(['Bybit','Bitget','Gate'].map(async name=>{
    try {
      if(name==='Bybit') {
        const d=await get('https://api.bybit.com/v5/market/recent-trade?category=linear&symbol=APTUSDT&limit=1000');
        if(d.retCode!==0)throw Error(d.retMsg||'接口错误');return normalizeTrades(name,d.result?.list);
      }
      if(name==='Bitget') {
        const d=await get('https://api.bitget.com/api/v2/mix/market/fills-history?symbol=APTUSDT&productType=USDT-FUTURES&limit=1000');
        if(d.code!=='00000')throw Error(d.msg||'接口错误');return normalizeTrades(name,d.data);
      }
      const [rows,contract]=await Promise.all([get('https://api.gateio.ws/api/v4/futures/usdt/trades?contract=APT_USDT&limit=1000'),get('https://api.gateio.ws/api/v4/futures/usdt/contracts/APT_USDT')]);
      return normalizeTrades(name,rows,Number(contract.quanto_multiplier));
    }catch(e){return {name,status:'error',error:e.message,trades:[]};}
  }));
}
