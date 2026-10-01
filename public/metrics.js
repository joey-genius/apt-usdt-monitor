export const WINDOWS = [5, 15, 30, 60, 240, 480, 720, 1440, 2880, 4320, 10080];
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
