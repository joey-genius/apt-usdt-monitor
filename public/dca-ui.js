import { calculateDca } from './dca.js';
let busy=false;
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
export async function refreshDca(){
 if(busy)return;busy=true;
 const status=document.getElementById('dca-status');status.textContent='正在读取APT现货日线与价格…';
 try{
  const base='https://data-api.binance.vision';
  const [rows,ticker]=await Promise.all([get(base+'/api/v3/klines?symbol=APTUSDT&interval=1d&limit=366'),get(base+'/api/v3/ticker/price?symbol=APTUSDT')]);
  const d=calculateDca(rows,Number(ticker.price));
  document.getElementById('dca-value').textContent=d.index.toFixed(3);
  document.getElementById('dca-zone').textContent=d.zone;
  const dollar=n=>'$'+n.toFixed(4);
  document.getElementById('dca-factors').textContent=`现货价 ${dollar(d.price)} ÷ 200日几何均价 ${dollar(d.geometric)} = ${d.a.toFixed(3)}；现货价 ÷ 趋势拟合价 ${dollar(d.fitted)} = ${d.b.toFixed(3)}`;
  document.getElementById('dca-reading').textContent=d.a<1&&d.b<1?'当前价格同时低于200日几何均价与时间趋势线，相对两条历史基准处于低位；这不意味着价格已经见底。':d.a>1&&d.b>1?'当前价格同时高于200日几何均价与时间趋势线，相对两条历史基准处于高位；这不意味着价格即将下跌。':'价格相对两条基准的方向不一致，不能仅依据乘积大小认定便宜或昂贵。';
  status.textContent=`Binance APTUSDT 现货 · 实时读取于 ${new Date().toLocaleString('zh-CN',{hour12:false})} · 历史截至 ${new Date(d.historyEnd).toISOString().slice(0,10)} UTC · 每5分钟刷新 · 等额日投成本参考 ${dollar(d.harmonic)}`;
 }catch(e){document.getElementById('dca-value').textContent='—';document.getElementById('dca-zone').textContent='数据不可用';document.getElementById('dca-factors').textContent='';document.getElementById('dca-reading').textContent='未使用模拟值或过期日线替代。';status.textContent='定投指数加载失败：'+e.message+'。可点“刷新指数”重试。';}
 finally{busy=false;}
}
export function initDca(){document.getElementById('dca-refresh').addEventListener('click',refreshDca);refreshDca();setInterval(refreshDca,300000);}
