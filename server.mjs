import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { collect } from './public/market.js';

const PORT = Number(process.env.PORT || 3000);
let cached, pending;
async function snapshot() {
  if (cached && Date.now()-cached.fetchedAt<15000) return cached;
  if (!pending) pending = collect().then(d=>(cached=d)).finally(()=>pending=null);
  return pending;
}
const files = {'/':'index.html','/app.js':'app.js','/style.css':'style.css','/market.js':'market.js','/metrics.js':'metrics.js','/flows.js':'flows.js','/large-flows.js':'large-flows.js','/trades.js':'trades.js','/data/oi-history.json':'data/oi-history.json','/data/okx-flows.json':'data/okx-flows.json','/boot.js':'boot.js','/report.js':'report.js','/report.css':'report.css','/market-analysis.js':'market-analysis.js','/insights.js':'insights.js','/insight-ui.js':'insight-ui.js'};
http.createServer(async(req,res)=>{
  const path = new URL(req.url,'http://localhost').pathname;
  try {
    if (path === '/api/market') {
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(JSON.stringify(await snapshot())); return;
    }
    if (!files[path]) {res.writeHead(404);res.end('Not found');return;}
    const body = await readFile(new URL(`./public/${files[path]}`,import.meta.url));
    res.writeHead(200,{'Content-Type':path.endsWith('.json')?'application/json; charset=utf-8':path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(body);
  } catch(e) {res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'服务暂时不可用'}));}
}).listen(PORT,'127.0.0.1',()=>console.log(`APT Monitor: http://127.0.0.1:${PORT}`));
