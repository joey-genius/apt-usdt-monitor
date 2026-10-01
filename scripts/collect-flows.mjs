import { mkdir, writeFile } from 'node:fs/promises';
import { collectRecent } from './recent-flows.mjs';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function pages(period,count) {
  const result=new Map();let cursor;
  for(let i=0;i<count;i++) {
    const url=new URL('https://www.okx.com/api/v5/rubik/stat/taker-volume-contract');
    for(const [key,value] of Object.entries({instId:'APT-USDT-SWAP',period,unit:'2',limit:'100',...(cursor?{end:String(cursor)}:{})}))url.searchParams.set(key,value);
    const res=await fetch(url,{signal:AbortSignal.timeout(20000)});
    if(!res.ok)throw Error(`OKX ${res.status}`);
    const d=await res.json();if(d.code!=='0'||!Array.isArray(d.data)||!d.data.length)throw Error('OKX empty or invalid response');
    for(const row of d.data){const [time,sell,buy]=row.map(Number);if(![time,sell,buy].every(Number.isFinite)||sell<0||buy<0)throw Error('Invalid taker amount');result.set(time,{time,sell,buy});}
    cursor=Math.min(...d.data.map(r=>Number(r[0])));
    await delay(550);
  }
  return [...result.values()].sort((a,b)=>a.time-b.time);
}
const recentPromise=collectRecent();
const fiveMinute=await pages('5m',3);
const hourly=await pages('1H',2);
const recent=await recentPromise;
const fetchedAt=Date.now();
if(fetchedAt-fiveMinute.at(-1).time>900000||fetchedAt-hourly.at(-1).time>7200000)throw Error('OKX data stale');
await mkdir('public/data',{recursive:true});
await writeFile('public/data/okx-flows.json',JSON.stringify({fetchedAt,source:'OKX + Bybit + Bitget + Gate',unit:'USD',timestampConvention:'candle-open',fiveMinute,hourly,recent}));
console.log(recent.map(v=>`${v.name}: ${v.status}; ${v.trades.length} trades; ${v.error||''}`).join('\n'));
console.log(`OKX snapshot: ${fiveMinute.length} 5m rows, ${hourly.length} hourly rows; ${new Date(fetchedAt).toISOString()}`);
