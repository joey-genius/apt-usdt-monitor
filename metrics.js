export const WINDOWS = [5, 15, 30, 60, 240, 480, 720, 1440, 2880, 4320, 10080];
export const numeric = n => typeof n === 'number' && Number.isFinite(n);
export function weighted(rows, field) {
  const included = rows.filter(r => numeric(r.value) && r.value > 0 && numeric(r[field]));
  const weight = included.reduce((s,r) => s+r.value,0);
  return {value:weight ? included.reduce((s,r)=>s+r.value*r[field],0)/weight:null, sources:included.map(r=>r.name), weight};
}
export function normalizeFunding(rate, hours) {
  return numeric(rate) && numeric(hours) && hours>0 ? rate*8/hours : null;
}
export function aggregateHistory(rows) {
  const included=rows.filter(r=>numeric(r.current)&&numeric(r.previous)&&r.previous>0);
  const current=included.reduce((s,r)=>s+r.current,0), previous=included.reduce((s,r)=>s+r.previous,0);
  return {previous:included.length?previous:null,current:included.length?current:null,change:included.length?change(current,previous):null,sources:included.map(r=>r.name)};
}
export function change(current, previous) {
  return Number.isFinite(current) && Number.isFinite(previous) && previous > 0 ? (current / previous - 1) * 100 : null;
}
export function historical(rows, target, tolerance) {
  const valid = rows.filter(r => Number(r.timestamp) <= target).sort((a,b) => Number(b.timestamp)-Number(a.timestamp));
  return valid[0] && target - Number(valid[0].timestamp) <= tolerance ? Number(valid[0].sumOpenInterestValue) : null;
}
export function flow(klines, minutes, now, interval) {
  const end = Math.floor(now / interval) * interval;
  const start = end - minutes * 60000;
  const rows = klines.filter(k => Number(k[0]) >= start && Number(k[0]) < end);
  const expected = minutes * 60000 / interval;
  if (!Number.isInteger(expected) || rows.length !== expected || new Set(rows.map(k=>Number(k[0]))).size !== expected) return null;
  return rows.reduce((sum, k) => sum + 2 * Number(k[10]) - Number(k[7]), 0);
}
