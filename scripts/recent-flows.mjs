import { normalizeTrades } from '../public/trades.js';
export { normalizeTrades } from '../public/trades.js';
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
