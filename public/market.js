import { normalizeTrades } from './trades.js?v=20261003-custom-flow';
import { binanceTraderRatios } from './binance-traders.js?v=20261003-binance-traders';
import { availableTopTrades } from './top-trades.js?v=20261003-binance-agg';
import { aggregateFlow } from './flows.js?v=20261001-flow5b';
import { buildAnalysis } from './market-analysis.js';
import { WINDOWS, change, historical, flow, weighted, normalizeFunding, aggregateHistory, numeric } from './metrics.js';
const B='https://fapi.binance.com', Y='https://api.bybit.com/v5/market', O='https://www.okx.com/api/v5', G='https://api.gateio.ws/api/v4/futures/usdt';
const n=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const mul=(a,b)=>numeric(a)&&numeric(b)?a*b:null;
const arr=x=>Array.isArray(x)?x:[];
const list=x=>arr(x?.result?.list);
async function get(url,body) {
  if(url.startsWith('file:')){const {readFile}=await import('node:fs/promises');return JSON.parse(await readFile(new URL(url),'utf8'));}
  const response=await fetch(url,{signal:AbortSignal.timeout(10000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const d=await response.json();
  if(d.code&&Number(d.code)!==0||d.retCode&&Number(d.retCode)!==0)throw Error(d.msg||d.retMsg||'接口错误');
  return d;
}
export async function collect() {
  const endpoints={
    binanceAggregates:typeof location!=='undefined'?new URL('./data/binance-agg.json?t='+Math.floor(Date.now()/300000),location.href).href:new URL('./data/binance-agg.json',import.meta.url).href,
    topTrades:typeof location!=='undefined'?new URL('./data/top-trades.json?t='+Math.floor(Date.now()/300000),location.href).href:new URL('./data/top-trades.json',import.meta.url).href,
    savedOi:typeof location!=='undefined'?new URL('./data/oi-history.json?t='+Math.floor(Date.now()/300000),location.href).href:new URL('./data/oi-history.json',import.meta.url).href,
    bybitTrades:'https://api.bybit.com/v5/market/recent-trade?category=linear&symbol=APTUSDT&limit=1000',
    okxFlowSnapshot:typeof location!=='undefined'?new URL('./data/okx-flows.json?t='+Math.floor(Date.now()/300000),location.href).href:new URL('./data/okx-flows.json',import.meta.url).href,
    ticker:`${B}/fapi/v1/ticker/24hr?symbol=APTUSDT`,premium:`${B}/fapi/v1/premiumIndex?symbol=APTUSDT`,oi:`${B}/fapi/v1/openInterest?symbol=APTUSDT`,fundInfo:`${B}/fapi/v1/fundingInfo`,
    accounts:`${B}/futures/data/topLongShortAccountRatio?symbol=APTUSDT&period=5m&limit=12`,positions:`${B}/futures/data/topLongShortPositionRatio?symbol=APTUSDT&period=5m&limit=12`,global:`${B}/futures/data/globalLongShortAccountRatio?symbol=APTUSDT&period=5m&limit=12`,
    hist5:`${B}/futures/data/openInterestHist?symbol=APTUSDT&period=5m&limit=500`,hist1:`${B}/futures/data/openInterestHist?symbol=APTUSDT&period=1h&limit=200`,k5:`${B}/fapi/v1/klines?symbol=APTUSDT&interval=5m&limit=500`,k1:`${B}/fapi/v1/klines?symbol=APTUSDT&interval=1h&limit=200`,
    bybit:`${Y}/tickers?category=linear&symbol=APTUSDT`,byratio:`${Y}/account-ratio?category=linear&symbol=APTUSDT&period=5min&limit=1`,byoi5:`${Y}/open-interest?category=linear&symbol=APTUSDT&intervalTime=5min&limit=200`,byoi1:`${Y}/open-interest?category=linear&symbol=APTUSDT&intervalTime=1h&limit=200`,bymark5:`${Y}/mark-price-kline?category=linear&symbol=APTUSDT&interval=5&limit=1000`,bymark1:`${Y}/mark-price-kline?category=linear&symbol=APTUSDT&interval=60&limit=200`,byk1:`${Y}/kline?category=linear&symbol=APTUSDT&interval=60&limit=48`,
    okx:`${O}/public/open-interest?instType=SWAP&instId=APT-USDT-SWAP`,okxt:`${O}/market/ticker?instId=APT-USDT-SWAP`,okxf:`${O}/public/funding-rate?instId=APT-USDT-SWAP`,okxoi5:`${O}/rubik/stat/contracts/open-interest-history?instId=APT-USDT-SWAP&period=5m`,okxoi1:`${O}/rubik/stat/contracts/open-interest-history?instId=APT-USDT-SWAP&period=1H`,okxk1:`${O}/market/candles?instId=APT-USDT-SWAP&bar=1H&limit=48`,
    bitget:'https://api.bitget.com/api/v2/mix/market/ticker?symbol=APTUSDT&productType=USDT-FUTURES',bitgetf:'https://api.bitget.com/api/v2/mix/market/current-fund-rate?symbol=APTUSDT&productType=USDT-FUTURES',
    gate:`${G}/contracts/APT_USDT`,gatet:`${G}/tickers?contract=APT_USDT`,gateratio:`${G}/contract_stats?contract=APT_USDT&interval=5m&limit=2`,
    hyperliquid:['https://api.hyperliquid.xyz/info',{type:'metaAndAssetCtxs'}]
  };
  const results=await Promise.all(Object.entries(endpoints).map(async([key,url])=>{try{return [key,await (Array.isArray(url)?get(...url):get(url)),null]}catch(e){return [key,null,e.name==='TimeoutError'?'超时':e.message]}}));
  const d=Object.fromEntries(results.map(([k,v])=>[k,v])), errors=results.filter(([,v,e])=>e).map(([key,,message])=>({key,message}));
  const now=Date.now(), by=list(d.bybit)[0]||{}, ot=d.okxt?.data?.[0]||{}, of=d.okxf?.data?.[0]||{}, bit=d.bitget?.data?.[0]||{}, bf=d.bitgetf?.data?.[0]||{}, gate=d.gate||{}, gt=d.gatet?.[0]||{};
  const agg=d.binanceAggregates?.recordType==='binance-aggregate'?availableTopTrades(d.binanceAggregates,now):{topTrades:null,topTradesError:'币安聚合成交快照缺失或类型无效'};
  const hi=d.hyperliquid?.[0]?.universe?.findIndex(x=>x.name==='APT'), hyper=hi>=0?d.hyperliquid[1][hi]:{};
  const binHours=d.fundInfo? n(arr(d.fundInfo).find(x=>x.symbol==='APTUSDT')?.fundingIntervalHours??8):null;
  const okHours=n(of.nextFundingTime)&&n(of.fundingTime)?(n(of.nextFundingTime)-n(of.fundingTime))/3600000:null;
  const exchanges=[
    {name:'Binance',value:mul(n(d.oi?.openInterest),n(d.premium?.markPrice)),price:n(d.ticker?.lastPrice),funding:normalizeFunding(n(d.premium?.lastFundingRate),binHours),volume:n(d.ticker?.quoteVolume),priceChange:n(d.ticker?.priceChangePercent),contract:'APTUSDT · USDT'},
    {name:'Bybit',value:n(by.singleOpenInterestValue),price:n(by.lastPrice),funding:normalizeFunding(n(by.fundingRate),n(by.fundingIntervalHour)),volume:n(by.turnover24h),priceChange:mul(n(by.price24hPcnt),100),contract:'APTUSDT · USDT'},
    {name:'OKX',value:n(d.okx?.data?.[0]?.oiUsd),price:n(ot.last),funding:normalizeFunding(n(of.fundingRate),okHours),volume:null,priceChange:change(n(ot.last),n(ot.open24h)),contract:'APT-USDT-SWAP · USDT'},
    {name:'Bitget',value:mul(n(bit.holdingAmount),n(bit.markPrice)),price:n(bit.lastPr),funding:normalizeFunding(n(bf.fundingRate),n(bf.fundingRateInterval)),volume:n(bit.usdtVolume),priceChange:mul(n(bit.change24h),100),contract:'APTUSDT · USDT'},
    {name:'Gate',value:mul(mul(n(gate.position_size),n(gate.quanto_multiplier)),n(gate.mark_price)),price:n(gate.last_price),funding:normalizeFunding(n(gate.funding_rate),n(gate.funding_interval)/3600),volume:n(gt.volume_24h_quote),priceChange:n(gt.change_percentage),contract:'APT_USDT · USDT'},
    {name:'Hyperliquid',value:mul(n(hyper.openInterest),n(hyper.markPx)),price:n(hyper.midPx),funding:normalizeFunding(n(hyper.funding),1),volume:n(hyper.dayNtlVlm),priceChange:change(n(hyper.midPx),n(hyper.prevDayPx)),contract:'APT · USDC（按1 USD折算）'}
  ];
  const weights=Object.fromEntries(exchanges.map(e=>[e.name,e.value]));
  const oiRows=exchanges.filter(e=>numeric(e.value)), oi=oiRows.length?oiRows.reduce((s,e)=>s+e.value,0):null;
  const price=weighted(exchanges,'price'), funding=weighted(exchanges,'funding'), priceChange=weighted(exchanges,'priceChange');
  const vol=exchanges.filter(e=>numeric(e.volume));
  const ratios=binanceTraderRatios(d,now,errors);
  const byHistory=(key,markKey)=>list(d[key]).map(r=>{
    // OI timestamp is a point in time: use that candle's opening mark price, not its future close.
    const mark=list(d[markKey]).find(k=>n(k[0])===n(r.timestamp));
    return {timestamp:n(r.timestamp),sumOpenInterestValue:mul(n(r.singleOpenInterest),n(mark?.[1]))};
  }).filter(r=>numeric(r.sumOpenInterestValue));
  const histories={Binance:[arr(d.hist5),arr(d.hist1)],Bybit:[byHistory('byoi5','bymark5'),byHistory('byoi1','bymark1')],OKX:['okxoi5','okxoi1'].map(key=>arr(d[key]?.data).map(r=>({timestamp:n(r[0]),sumOpenInterestValue:n(r[3])}))),Gate:[d.okxFlowSnapshot?.gateOpenInterest5m||[],d.okxFlowSnapshot?.gateOpenInterest1h||[]]};
  for(const name of ['Bitget','Hyperliquid'])histories[name]=[arr(d.savedOi?.series?.[name]),[]];
  if(d.okxFlowSnapshot&&d.bybitTrades?.retCode===0){try{const recent=normalizeTrades('Bybit',list(d.bybitTrades));d.okxFlowSnapshot.recent=[...(d.okxFlowSnapshot.recent||[]).filter(r=>r.name!=='Bybit'),recent];}catch{}}
  const history=WINDOWS.map(minutes=>{
    const matched=Object.entries(histories).map(([name,series])=>{
      let previous=historical(series[0],now-minutes*60000,600000);
      if(previous===null&&minutes>=60)previous=historical(series[1],now-minutes*60000,7200000);
      return {name,current:weights[name],previous};
    });
    return {minutes,...aggregateHistory(matched),...aggregateFlow({minutes,now,binance:arr(d[minutes<=1440?'k5':'k1']),okxSnapshot:d.okxFlowSnapshot})};
  });
  const chartSeries=[{name:'Binance',rows:arr(d.k1).slice(-48)},{name:'Bybit',rows:list(d.byk1)},{name:'OKX',rows:arr(d.okxk1?.data)}].filter(s=>weights[s.name]>0&&s.rows.length>=48);
  const chartTimes=[...new Set(chartSeries.flatMap(s=>s.rows.map(k=>n(k[0]))))].sort((a,b)=>a-b);
  const chart=chartTimes.map(time=>{const rows=chartSeries.map(s=>({name:s.name,value:weights[s.name],price:n(s.rows.find(k=>n(k[0])===time)?.[4])}));return {time,price:rows.every(r=>numeric(r.price))?weighted(rows,'price').value:null}}).filter(r=>numeric(r.price)).slice(-48);
  return {binanceAggregates:agg.topTrades,binanceAggregatesError:agg.topTradesError,...availableTopTrades(d.topTrades,now),analysis:buildAnalysis({now,binHistory:arr(d.hist5),byHistory:list(d.byoi1),binCandles:arr(d.k1),byMarks:list(d.bymark1),funding:funding.value}),mode:'live',fetchedAt:now,price:price.value,priceChange:priceChange.value,funding:funding.value,oi,volume:vol.length?vol.reduce((s,e)=>s+e.volume,0):null,exchanges,ratios,history,chart,errors,coverage:{price:price.sources,funding:funding.sources,volume:vol.map(e=>e.name),chart:chartSeries.map(s=>s.name)},aggregation:'OI weighted price/funding; Binance-only unweighted trader ratios; matched historical cohorts; Hyperliquid USDC assumed USD parity'};
}
