const number=value=>value==null||value===''||typeof value==='boolean'||(typeof value==='string'&&!value.trim())?null:Number(value);
const valid=value=>typeof value==='number'&&Number.isFinite(value);

// Preserve Binance's published ratios: rounded percentages need not reproduce them exactly.
export function binanceTraderRatios(data,now,errors=[]) {
  return ['accounts','positions','global'].map(key=>{
    const empty={key,ratio:null,long:null,short:null,timestamp:null,sources:[],history:[],samples:[]};
    const upstreamError=errors.find(e=>e.key===key)?.message;
    if(upstreamError)return {...empty,error:`Binance 接口不可用：${upstreamError}`};
    const input=data?.[key];
    if(!Array.isArray(input)||!input.length)return {...empty,error:'Binance 未返回数据'};
    const rows=input.map(r=>({symbol:r?.symbol,timestamp:number(r?.timestamp),ratio:number(r?.longShortRatio),long:number(r?.longAccount),short:number(r?.shortAccount)}));
    const fields=r=>r.symbol==='APTUSDT'&&[r.timestamp,r.ratio,r.long,r.short].every(valid)&&r.timestamp>0&&r.timestamp<=now+60000&&r.ratio>=0&&r.long>=0&&r.long<=1&&r.short>=0&&r.short<=1&&Math.abs(r.long+r.short-1)<=0.002;
    // Do not silently select older data when the latest row is malformed or contradictory.
    if(rows.some(r=>!valid(r.timestamp)))return {...empty,error:'Binance 时间字段无效'};
    rows.sort((a,b)=>b.timestamp-a.timestamp);
    const latest=rows[0];
    if(!fields(latest))return {...empty,error:'Binance 最新采样字段无效'};
    if(now-latest.timestamp>900000)return {...empty,error:'Binance 最新采样已超过15分钟，暂不展示'};
    const seen=new Map();
    for(const row of rows){
      if(!fields(row))continue;
      const previous=seen.get(row.timestamp);
      if(previous&&(previous.ratio!==row.ratio||previous.long!==row.long||previous.short!==row.short))return {...empty,error:'Binance 同一时间戳数据冲突'};
      seen.set(row.timestamp,row);
    }
    const history=[...seen.values()].filter(r=>r.timestamp>=latest.timestamp-55*60000).slice(0,12).map(({symbol,...r})=>r);
    return {...empty,ratio:latest.ratio,long:latest.long,short:latest.short,timestamp:latest.timestamp,sources:['Binance'],history,error:null,samples:[{name:'Binance',ratio:latest.ratio,long:latest.long,short:latest.short,timestamp:latest.timestamp}]};
  });
}
