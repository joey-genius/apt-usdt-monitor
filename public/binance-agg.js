import {SCALE,decimal,amount,compare,totals} from './trade-amounts.js';
import {DAY_MS} from './top-trades.js?v=20261004-page-scan';

// This scanner uses only Binance's official endpoint. No regional-block fallback.
export async function collectBinanceAggregates({signal,onProgress=()=>{},now=Date.now,maxPages=1200,fetchPage,pause}={}){
  const end=Math.floor((now()-60000)/60000)*60000,start=end-DAY_MS,deadline=now()+18*60000;
  const check=()=>{signal?.throwIfAborted();if(now()>deadline)throw Error('币安24小时回溯超时，未展示部分排名');};
  const wait=pause||(()=>new Promise((resolve,reject)=>{
    const stop=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);reject(signal.reason);};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},900);
    signal?.addEventListener('abort',stop,{once:true});
    if(signal?.aborted)stop();
  }));
  const get=fetchPage||(async params=>{
    const url=new URL('https://fapi.binance.com/fapi/v1/aggTrades');
    for(const [k,v] of Object.entries({symbol:'APTUSDT',limit:1000,...params}))url.searchParams.set(k,String(v));
    const timeout=AbortSignal.timeout(20000);
    const response=await fetch(url,{signal:signal?AbortSignal.any([signal,timeout]):timeout,redirect:'error'});
    if(!response.ok)throw Error(`Binance HTTP ${response.status}；当前网络无法读取完整历史，请勿使用部分记录`);
    const data=await response.json();
    if(!Array.isArray(data))throw Error('Binance 返回无效的聚合成交数据');
    return data;
  });
  let nextId=null,seed=start,pages=0,count=0,buy=0n,sell=0n,top=[],lastTime=-Infinity,complete=false;
  const id=value=>{
    if(typeof value==='number'&&!Number.isSafeInteger(value))throw Error('币安成交ID超出安全范围');
    const text=String(value);if(!/^\d+$/.test(text))throw Error('币安成交ID无效');return BigInt(text);
  };
  while(pages<maxPages&&!complete){
    check();
    const timeSeed=nextId===null;
    const seedEnd=Math.min(seed+3600000,end);
    const params=nextId===null?{startTime:seed,endTime:seedEnd-1}:{fromId:nextId.toString()};
    const batch=await get(params);check();pages++;
    if(!Array.isArray(batch))throw Error('币安分页格式无效');
    if(!batch.length){
      if(nextId!==null)throw Error('币安历史提前结束，未覆盖完整24小时');
      seed=seedEnd;complete=seed>=end;
    }else{
      for(const r of batch){
        const aggId=id(r.a),time=r.T;
        if(!Number.isSafeInteger(time)||time<start||time<lastTime||(timeSeed&&(time<seed||time>=seedEnd)))throw Error('币安成交时间或分页顺序无效');
        if(nextId!==null&&aggId!==nextId)throw Error('币安聚合成交ID缺口或重复，不能确认完整历史');
        nextId=aggId+1n;lastTime=time;
        if(time>=end){complete=true;break;}
        const first=id(r.f),last=id(r.l);
        if(first>last||typeof r.m!=='boolean')throw Error('币安成交区间或主动方向无效');
        const p=decimal(r.p),q=decimal(r.q);
        if(p<=0n||q<=0n)throw Error('币安价格或数量无效');
        const units=p*q*SCALE,side=r.m?'sell':'buy';
        if(side==='buy')buy+=units;else sell+=units;
        count++;
        top.push({exchange:'Binance',id:aggId.toString(),time,side,price:String(r.p),quantity:String(r.q),amount:amount(units),firstTradeId:first.toString(),lastTradeId:last.toString(),units});
      }
    }
    top.sort(compare);top=top.slice(0,100);
    onProgress({pages,records:count});
    if(!complete){check();await wait();}
  }
  check();if(!complete)throw Error('币安分页达到上限，未覆盖完整24小时；不发布部分排名');
  return {schemaVersion:1,recordType:'binance-aggregate',windowStart:start,windowEnd:end,fetchedAt:now(),limit:100,
    rows:top.map(({units,...r})=>r),sources:[{name:'Binance',status:'ok',records:count,pages}],
    totals:totals(top.filter(r=>r.side==='buy').reduce((sum,r)=>sum+r.units,0n),top.filter(r=>r.side==='sell').reduce((sum,r)=>sum+r.units,0n),top.length),
    allTradesTotals:totals(buy,sell,count)};
}
