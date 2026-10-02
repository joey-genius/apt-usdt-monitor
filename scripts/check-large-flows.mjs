import { collectRecent } from './recent-flows.mjs';
import { aggregateLargeTradeFlow } from '../public/large-flows.js';

// Read-only diagnostic: do not replace the published snapshot with a partial probe.
const tradeCutoff = Math.floor(Date.now() / 300000) * 300000;
const recent = await collectRecent();
const now = Date.now();
const snapshot = { tradeCutoff, fetchedAt: now, recent };
console.log(JSON.stringify({
  venues: recent.map(r => ({ name: r.name, status: r.status, error: r.error, records: r.trades.length, start: r.start, end: r.end })),
  fiveMinute: aggregateLargeTradeFlow({ minutes: 5, now, snapshot }),
}, null, 2));
