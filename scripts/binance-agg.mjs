import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {collectBinanceAggregates} from '../public/binance-agg.js';

export async function collectBinanceSnapshot(){
  let snapshot;
  try{
    snapshot=await collectBinanceAggregates({onProgress:({pages,records})=>{if(pages%50===0)console.log(`Binance aggregate scan: ${pages} pages / ${records} records`);}});
  }catch(error){
    const end=Math.floor((Date.now()-60000)/60000)*60000;
    snapshot={schemaVersion:1,recordType:'binance-aggregate',windowStart:end-86400000,windowEnd:end,fetchedAt:Date.now(),limit:100,rows:[],sources:[{name:'Binance',status:'error',records:0,pages:0,error:error.message}],totals:null,allTradesTotals:null};
  }
  await mkdir('public/data',{recursive:true});
  await writeFile('public/data/binance-agg.json',JSON.stringify(snapshot));
  console.log('Binance aggregate result:',JSON.stringify({sources:snapshot.sources,topCount:snapshot.rows.length,totals:snapshot.totals}));
  return snapshot;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await collectBinanceSnapshot();
