import {mkdir,writeFile} from 'node:fs/promises';
async function get(url,body){const r=await fetch(url,{signal:AbortSignal.timeout(15000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
let previous={series:{}};
const response=await fetch('https://joey-genius.github.io/apt-usdt-monitor/data/oi-history.json?t='+Date.now(),{signal:AbortSignal.timeout(15000)});
if(response.ok)previous=await response.json();else if(response.status!==404)throw Error('Cannot restore OI history: '+response.status);
const now=Date.now(),series={},errors=[];
for(const name of ['Bitget','Hyperliquid']){
 let rows=(previous.series?.[name]||[]).filter(r=>r.timestamp>=now-9*86400000);
 try{
  let value;
  if(name==='Bitget'){const d=await get('https://api.bitget.com/api/v2/mix/market/ticker?symbol=APTUSDT&productType=USDT-FUTURES');if(d.code!=='00000')throw Error('Bitget response');const r=d.data[0];value=Number(r.holdingAmount)*Number(r.markPrice);}
  else {const d=await get('https://api.hyperliquid.xyz/info',{type:'metaAndAssetCtxs'});const i=d[0].universe.findIndex(r=>r.name==='APT');const r=d[1][i];value=Number(r.openInterest)*Number(r.markPx);}
  if(!Number.isFinite(value)||value<=0)throw Error('Invalid OI');
  rows.push({timestamp:Date.now(),sumOpenInterestValue:value});
 }catch(e){errors.push({name,message:e.message});}
 series[name]=rows;
}
await mkdir('public/data',{recursive:true});
await writeFile('public/data/oi-history.json',JSON.stringify({fetchedAt:Date.now(),series,errors}));
console.log('Saved OI snapshots',Object.entries(series).map(([k,v])=>[k,v.length]),errors);
