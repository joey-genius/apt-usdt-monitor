const DAY=86400000;
export function calculateDca(klines,price,now=Date.now()) {
  if(!Number.isFinite(price)||price<=0)throw Error('当前现货价格不可用');
  const today=Math.floor(now/DAY)*DAY;
  const rows=klines.filter(k=>Number(k[0])<today).sort((a,b)=>Number(a[0])-Number(b[0])).slice(-365);
  if(rows.length!==365||rows.some((k,i)=>Number(k[0])!==today-(365-i)*DAY||!Number.isFinite(Number(k[4]))||Number(k[4])<=0))throw Error('需要截至昨日连续365个完整UTC日线，当前历史缺失或过期');
  const logs=rows.map(k=>Math.log(Number(k[4])));
  const geometric=Math.exp(logs.slice(-200).reduce((s,v)=>s+v,0)/200);
  const mean=logs.reduce((s,v)=>s+v,0)/365,center=182;
  const slope=logs.reduce((s,y,x)=>s+(x-center)*(y-mean),0)/logs.reduce((s,_,x)=>s+(x-center)**2,0);
  const fitted=Math.exp(mean+slope*(365-center));
  const harmonic=200/rows.slice(-200).reduce((s,k)=>s+1/Number(k[4]),0);
  const a=price/geometric,b=price/fitted,index=a*b;
  if(![geometric,fitted,index].every(Number.isFinite)||fitted<=0)throw Error('模型数值无效');
  return {index,price,geometric,fitted,harmonic,a,b,slope,historyEnd:today-DAY,model:'APT-365-log-linear-v1',zone:a<1&&b<1?'低于双基准':a>1&&b>1?'高于双基准':'双基准分歧'};
}
