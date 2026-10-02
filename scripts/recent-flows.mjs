import { normalizeTrades } from '../public/trades.js';
export { normalizeTrades } from '../public/trades.js';
export async function collectRecent() {
  const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();};
  return Promise.all(['Binance','OKX','Bybit','Bitget','Gate'].map(async name=>{
    try {
      const done=(rows,multiplier=1)=>({...normalizeTrades(name,rows,multiplier),fetchedAt:Date.now()});
      if(name==='Binance') {
        return done(await get('https://fapi.binance.com/fapi/v1/trades?symbol=APTUSDT&limit=1000'));
      }
      if(name==='OKX') {
        const [d,metadata]=await Promise.all([get('https://www.okx.com/api/v5/market/trades?instId=APT-USDT-SWAP&limit=500'),get('https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=APT-USDT-SWAP')]);
        const contract=metadata.data?.find(r=>r.instId==='APT-USDT-SWAP');
        if(d.code!=='0'||metadata.code!=='0'||contract?.ctType!=='linear'||contract?.ctValCcy!=='APT'||!(Number(contract.ctVal)>0))throw Error('OKX 合约面值或逐笔数据不可验证');
        // ctVal is the base-currency value of one linear contract; sz is contracts.
        return done(d.data,Number(contract.ctVal));
      }
      if(name==='Bybit') {
        const d=await get('https://api.bybit.com/v5/market/recent-trade?category=linear&symbol=APTUSDT&limit=1000');
        if(d.retCode!==0)throw Error(d.retMsg||'接口错误');return done(d.result?.list);
      }
      if(name==='Bitget') {
        const d=await get('https://api.bitget.com/api/v2/mix/market/fills-history?symbol=APTUSDT&productType=USDT-FUTURES&limit=1000');
        if(d.code!=='00000')throw Error(d.msg||'接口错误');return done(d.data);
      }
      const [rows,contract]=await Promise.all([get('https://api.gateio.ws/api/v4/futures/usdt/trades?contract=APT_USDT&limit=1000'),get('https://api.gateio.ws/api/v4/futures/usdt/contracts/APT_USDT')]);
      return done(rows,Number(contract.quanto_multiplier));
    }catch(e){return {name,status:'error',error:e.message,trades:[]};}
  }));
}
