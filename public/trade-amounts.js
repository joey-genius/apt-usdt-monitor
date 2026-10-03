export const SCALE=10n**18n;
export function decimal(value){
  const s=String(value);
  if(!/^\d+(\.\d{1,18})?$/.test(s))throw Error('Invalid price or size precision');
  const [whole,fraction='']=s.split('.');
  return BigInt(whole)*SCALE+BigInt(fraction.padEnd(18,'0'));
}
export function fixed(n,places){
  const sign=n<0n?'-':'';
  const digits=(n<0n?-n:n).toString().padStart(places+1,'0');
  const fraction=digits.slice(-places).replace(/0+$/,'');
  return sign+digits.slice(0,-places)+(fraction?'.'+fraction:'');
}
export const amount=n=>{
  const value=Number(fixed(n,54));
  if(!Number.isFinite(value))throw Error('Trade amount exceeds supported range');
  return value;
};
export const compare=(a,b)=>a.units===b.units?b.time-a.time||a.id.localeCompare(b.id):(a.units>b.units?-1:1);
export const totals=(buy,sell,count)=>({buy:amount(buy),sell:amount(sell),net:amount(buy-sell),netIn:amount(buy>sell?buy-sell:0n),netOut:amount(sell>buy?sell-buy:0n),turnover:amount(buy+sell),count});
