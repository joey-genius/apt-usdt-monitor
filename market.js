import { WINDOWS, change, historical, flow } from './metrics.js';
const B = 'https://fapi.binance.com';
async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.code && Number(data.code) !== 0 || data.retCode && Number(data.retCode) !== 0) throw new Error(data.msg || data.retMsg || '接口错误');
  return data;
}
function num(value) { const n = Number(value); return value != null && value !== '' && Number.isFinite(n) ? n : null; }
export async function collect() {
  const endpoints = {
    ticker: `${B}/fapi/v1/ticker/24hr?symbol=APTUSDT`,
    premium: `${B}/fapi/v1/premiumIndex?symbol=APTUSDT`,
    oi: `${B}/fapi/v1/openInterest?symbol=APTUSDT`,
    accounts: `${B}/futures/data/topLongShortAccountRatio?symbol=APTUSDT&period=5m&limit=1`,
    positions: `${B}/futures/data/topLongShortPositionRatio?symbol=APTUSDT&period=5m&limit=1`,
    global: `${B}/futures/data/globalLongShortAccountRatio?symbol=APTUSDT&period=5m&limit=1`,
    hist5: `${B}/futures/data/openInterestHist?symbol=APTUSDT&period=5m&limit=500`,
    hist1: `${B}/futures/data/openInterestHist?symbol=APTUSDT&period=1h&limit=200`,
    k5: `${B}/fapi/v1/klines?symbol=APTUSDT&interval=5m&limit=500`,
    k1: `${B}/fapi/v1/klines?symbol=APTUSDT&interval=1h&limit=200`,
    bybit: 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=APTUSDT',
    okx: 'https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=APT-USDT-SWAP'
  };
  const results = await Promise.all(Object.entries(endpoints).map(async ([key,url]) => {
    try { return [key, await get(url), null]; } catch(e) { return [key, null, e.name === 'TimeoutError' ? '请求超时' : e.message]; }
  }));
  const d = Object.fromEntries(results.map(([k,v])=>[k,v]));
  const errors = results.filter(([,v,e])=>e).map(([key,,message])=>({key,message}));
  const now = Date.now();
  const price = num(d.ticker?.lastPrice), mark = num(d.premium?.markPrice);
  const amount = num(d.oi?.openInterest);
  const oi = amount != null && mark != null ? amount * mark : null;
  const exchanges = [
    {name:'Binance', value:oi},
    {name:'Bybit', value:num(d.bybit?.result?.list?.[0]?.openInterestValue)},
    {name:'OKX', value:num(d.okx?.data?.[0]?.oiUsd)}
  ];
  const ratios = ['accounts','positions','global'].map(key=>({key, ratio:num(d[key]?.[0]?.longShortRatio), long:num(d[key]?.[0]?.longAccount), timestamp:num(d[key]?.[0]?.timestamp)}));
  const history = WINDOWS.map(minutes=>{
    const previous = historical((minutes <= 1440 ? d.hist5 : d.hist1) || [], now - minutes*60000, minutes <= 1440 ? 600000 : 7200000);
    return {minutes, previous, change:change(oi,previous), flow:flow((minutes<=1440 ? d.k5 : d.k1)||[],minutes,now,minutes<=1440 ? 300000 : 3600000)};
  });
  return {mode:'live', fetchedAt:now, price, mark, priceChange:num(d.ticker?.priceChangePercent), volume:num(d.ticker?.quoteVolume), funding:num(d.premium?.lastFundingRate), nextFunding:num(d.premium?.nextFundingTime), oi, exchanges, ratios, history, chart:(d.k1||[]).slice(-48).map(k=>({time:Number(k[0]),price:Number(k[4])})), errors};
}
