import {decimal,fixed,amount,compare,totals} from './trade-amounts.js';

export const DAY_MS=86400000;

// Page through one venue newest-first until a page proves the window start was crossed.
export async function scanTrades({name,start,end,page,multiplier='1',maxPages=1200,wait=()=>Promise.resolve(),deadline=Infinity,signal,now=Date.now,onProgress=()=>{}}){
  const check=()=>{signal?.throwIfAborted();if(now()>deadline)throw Error('24小时扫描超时，部分记录不纳入排名');};
  const mult=decimal(multiplier);
  if(mult<=0n)throw Error('Invalid contract multiplier');
  let cursor=null,buy=0n,sell=0n,count=0,pages=0,top=[];
  const seen=new Set();
  for(;pages<maxPages;){
    check();
    const rows=await page(cursor,signal);
    check();
    pages++;
    if(!Array.isArray(rows)||!rows.length)throw Error('历史分页提前结束，尚未越过24小时起点');
    let oldest=null,minTime=Infinity,previous=null,previousTime=Infinity;
    for(const r of rows){
      if(typeof r.tradeId!=='string'||!/^\d+$/.test(r.tradeId))throw Error('成交 ID 必须是字符串数字');
      const id=r.tradeId,time=Number(r.ts);
      if(!Number.isFinite(time)||time<=0)throw Error('Invalid trade ID or timestamp');
      if(cursor!==null&&BigInt(id)>=BigInt(cursor))throw Error('分页游标未前进或记录重复');
      if(previous!==null&&BigInt(id)>=BigInt(previous))throw Error('成交顺序无效');
      if(time>previousTime)throw Error('成交时间与游标顺序不一致');
      previous=id;
      previousTime=time;
      if(seen.has(id))throw Error('重复成交 ID，无法确认完整历史');
      seen.add(id);oldest=id;minTime=Math.min(minTime,time);
      if(time<start||time>=end)continue;
      const price=String(name==='OKX'?r.px:r.price),size=String(name==='OKX'?r.sz:r.size),side=String(r.side).toLowerCase();
      const p=decimal(price),q=decimal(size);
      if(p<=0n||q<=0n||!['buy','sell'].includes(side))throw Error('Invalid trade price, quantity or side');
      const units=p*q*mult;
      if(units<=0n)throw Error('Trade amount below supported precision');
      if(side==='buy')buy+=units;else sell+=units;
      count++;
      top.push({exchange:name,id,time,side,price,quantity:fixed(q*mult,36),amount:amount(units),units});
    }
    top.sort(compare);top=top.slice(0,100);
    onProgress({name,pages,records:count});
    if(minTime<start)return {name,status:'ok',records:count,pages,top,buy,sell};
    cursor=oldest;await wait();
  }
  throw Error('达到分页上限，尚未覆盖完整24小时；不发布部分排名');
}

export function assembleTopTrades(results,start,end,fetchedAt=Date.now()){
  const complete=results.filter(r=>r.status==='ok');
  const top=complete.flatMap(r=>r.top).sort(compare).slice(0,100);
  const sum=key=>complete.reduce((s,r)=>s+r[key],0n);
  return {schemaVersion:1,windowStart:start,windowEnd:end,fetchedAt,limit:100,
    rows:top.map(({units,...r})=>r),
    sources:results.map(({top,buy,sell,...r})=>r),
    totals:complete.length?totals(top.filter(r=>r.side==='buy').reduce((s,r)=>s+r.units,0n),top.filter(r=>r.side==='sell').reduce((s,r)=>s+r.units,0n),top.length):null,
    allTradesTotals:complete.length?totals(sum('buy'),sum('sell'),complete.reduce((s,r)=>s+r.records,0)):null};
}

const VENUES={
  Bitget:{wait:350,maxPages:200,
    url:(cursor,end)=>`https://api.bitget.com/api/v2/mix/market/fills-history?symbol=APTUSDT&productType=USDT-FUTURES&limit=1000&endTime=${end}${cursor?'&idLessThan='+cursor:''}`,
    parse:d=>{if(d.code!=='00000')throw Error(d.msg||'History API error');return d.data;}},
  OKX:{wait:350,maxPages:2200,
    url:(cursor,end)=>`https://www.okx.com/api/v5/market/history-trades?instId=APT-USDT-SWAP&limit=100&type=${cursor?'1':'2'}&after=${cursor||end}`,
    parse:d=>{if(d.code!=='0')throw Error(d.msg||'History API error');return d.data;}},
};

function requestSignal(signal){
  const timeout=AbortSignal.timeout(15000);
  if(!signal)return timeout;
  if(typeof AbortSignal.any==='function')return AbortSignal.any([signal,timeout]);
  const controller=new AbortController();
  const abort=()=>controller.abort(signal.reason);
  if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  timeout.addEventListener('abort',()=>controller.abort(timeout.reason),{once:true});
  return controller.signal;
}

// Bitget answers 403 to every CORS preflight, so requests must stay header-free simple GETs.
async function get(url,signal){
  let last;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{signal:requestSignal(signal),cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      return response;
    }catch(error){
      last=error;
      if(signal?.aborted||error.name==='AbortError')throw error;
      if(attempt<2)await new Promise(r=>setTimeout(r,1000*(attempt+1)));
    }
  }
  throw last;
}

// Only venues that finish the whole window join the ranking; failures stay visible per venue.
export async function collectTopTrades({signal,onProgress=()=>{},now=Date.now,venues=['Bitget'],budgetMs=180000}={}){
  const end=Math.floor((now()-60000)/60000)*60000,start=end-DAY_MS;
  const results=await Promise.all(venues.map(async name=>{
    try{
      const venue=VENUES[name];
      if(!venue)throw Error('Unknown venue');
      return await scanTrades({name,start,end,deadline:now()+budgetMs,signal,now,onProgress,maxPages:venue.maxPages,
        page:async(cursor,signal)=>venue.parse(await (await get(venue.url(cursor,end),signal)).json()),
        wait:()=>new Promise(r=>setTimeout(r,venue.wait))});
    }catch(e){
      if(signal?.aborted)throw e;
      return {name,status:'error',records:0,pages:0,error:e.message};
    }
  }));
  for(const [name,reason] of Object.entries({
    Binance:'未接入可验证的完整24小时逐笔回溯，不使用近期成交代替',
    Bybit:'未接入可验证的完整24小时逐笔回溯，不使用近期成交代替',
    Gate:'未接入可验证的完整24小时逐笔回溯，不使用近期成交代替',
    OKX:'完整24小时实测需约1818页、16分钟，超过浏览器打开页面时的采集预算；未纳入本排行',
  }))if(!results.some(r=>r.name===name))results.push({name,status:'unsupported',records:0,pages:0,error:reason});
  return assembleTopTrades(results,start,end,now());
}
