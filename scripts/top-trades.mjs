import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const SCALE=10n**18n;
function decimal(value){
  const s=String(value);
  if(!/^\d+(\.\d{1,18})?$/.test(s))throw Error('Invalid price or size precision');
  const [whole,fraction='']=s.split('.');
  return BigInt(whole)*SCALE+BigInt(fraction.padEnd(18,'0'));
}
function fixed(n,places){
  const sign=n<0n?'-':'';
  const digits=(n<0n?-n:n).toString().padStart(places+1,'0');
  const fraction=digits.slice(-places).replace(/0+$/,'');
  return sign+digits.slice(0,-places)+(fraction?'.'+fraction:'');
}
const amount=n=>Number(fixed(n,54));
const compare=(a,b)=>a.units===b.units?b.time-a.time||a.id.localeCompare(b.id):(a.units>b.units?-1:1);
const totals=(buy,sell,count)=>({buy:amount(buy),sell:amount(sell),net:amount(buy-sell),netIn:amount(buy>sell?buy-sell:0n),netOut:amount(sell>buy?sell-buy:0n),turnover:amount(buy+sell),count});

export async function scanTrades({name,start,end,page,multiplier='1',maxPages=1200,pause=()=>Promise.resolve(),deadline=Infinity}){
  let cursor=null,buy=0n,sell=0n,count=0,pages=0,top=[];
  const seen=new Set();
  const mult=decimal(multiplier);
  if(mult<=0n)throw Error('Invalid contract multiplier');
  for(;pages<maxPages;){
    if(Date.now()>deadline)throw Error('24小时扫描超时，部分记录不纳入排名');
    const rows=await page(cursor);
    if(Date.now()>deadline)throw Error('24小时扫描超时，部分记录不纳入排名');
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
    if(minTime<start)return {name,status:'ok',records:count,pages,top,buy,sell};
    cursor=oldest;await pause();
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

export async function collectTopTrades(){
  // Fixed historical boundary avoids changes at the head of the feed while paginating.
  const end=Math.floor((Date.now()-10000)/60000)*60000,start=end-86400000;
  const get=async url=>{
    let last;
    for(let attempt=0;attempt<3;attempt++){
      try{const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});if(!response.ok)throw Error('HTTP '+response.status);return await response.json();}
      catch(error){last=error;if(attempt<2)await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
    }
    throw last;
  };
  const results=await Promise.all(['Bitget','OKX'].map(async name=>{
    try{
      let multiplier='1';
      if(name==='OKX'){
        const d=await get('https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=APT-USDT-SWAP');
        const c=d.data?.find(r=>r.instId==='APT-USDT-SWAP');
        if(d.code!=='0'||c?.ctType!=='linear'||c.ctValCcy!=='APT'||c.settleCcy!=='USDT')throw Error('OKX contract units invalid');
        multiplier=c.ctVal;
      }
      const page=async cursor=>{
        const url=name==='Bitget'?`https://api.bitget.com/api/v2/mix/market/fills-history?symbol=APTUSDT&productType=USDT-FUTURES&limit=1000&endTime=${end}${cursor?'&idLessThan='+cursor:''}`:`https://www.okx.com/api/v5/market/history-trades?instId=APT-USDT-SWAP&limit=100&type=${cursor?'1':'2'}&after=${cursor||end}`;
        const d=await get(url);
        if(d.code!==(name==='Bitget'?'00000':'0'))throw Error(d.msg||'History API error');
        return d.data;
      };
      return await scanTrades({name,start,end,page,multiplier,pause:()=>new Promise(r=>setTimeout(r,350)),deadline:Date.now()+8*60000});
    }catch(e){return {name,status:'error',records:0,pages:0,error:e.message};}
  }));
  for(const name of ['Binance','Bybit','Gate'])results.push({name,status:'unsupported',records:0,pages:0,error:'暂未接入可验证的完整24小时逐笔回溯，不使用近期成交代替'});
  const snapshot=assembleTopTrades(results,start,end);
  await mkdir('public/data',{recursive:true});
  await writeFile('public/data/top-trades.json',JSON.stringify(snapshot));
  console.log('24h top trades:',JSON.stringify({sources:snapshot.sources,topCount:snapshot.rows.length,totals:snapshot.totals}));
  return snapshot;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await collectTopTrades();
