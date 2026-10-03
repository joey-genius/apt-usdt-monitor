import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {collectTopTrades} from '../public/top-trades-scan.js';

// Browser page loads use Bitget only; this CLI can afford the long OKX backfill.
export async function collectTopTradesSnapshot({venues=['Bitget','OKX'],budgetMs=15*60000}={}){
  const snapshot=await collectTopTrades({venues,budgetMs});
  await mkdir('public/data',{recursive:true});
  await writeFile('public/data/top-trades.json',JSON.stringify(snapshot));
  console.log('24h top trades:',JSON.stringify({sources:snapshot.sources,topCount:snapshot.rows.length,totals:snapshot.totals}));
  return snapshot;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await collectTopTradesSnapshot();
