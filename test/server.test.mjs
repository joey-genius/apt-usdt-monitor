import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('local server serves independent Binance aggregate UI and manual scan controls', { timeout: 15000 }, async () => {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server did not start')), 8000);
      child.once('error', err => { clearTimeout(timer); reject(err); });
      child.once('exit', code => { clearTimeout(timer); reject(Error(`Server exited: ${code}`)); });
      child.stdout.once('data', () => { clearTimeout(timer); resolve(); });
    });
    const response = await fetch(`http://127.0.0.1:${port}/report.js?v=20261003-binance-agg`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.match(await response.text(), /export function renderReport/);
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    assert.doesNotMatch(html, /threshold|id="flows"|大额成交|阈值/);
    assert.match(html, /https:\/\/www\.binance\.com\/zh-CN\/futures\/funding-history\/perpetual\/trading-data/);
    assert.match(html, /topLongShortAccountRatio/);
    assert.match(html, /topLongShortPositionRatio/);
    assert.match(html, /globalLongShortAccountRatio/);
    assert.match(html, /boot\.js\?v=20261003-binance-agg/);
    assert.match(html, /id="binance-aggregate-scan"/);
    assert.match(html, /id="binance-aggregate-cancel" disabled/);
    assert.match(html, /id="binance-aggregate-status" role="status"/);
    assert.match(html, /HTTP 451 \/ 403.*不提供绕过/);
    for (const module of ['app.js', 'report.js', 'market.js', 'binance-traders.js', 'top-trades.js', 'binance-agg.js', 'trade-amounts.js', 'insight-ui.js', 'insights.js']) {
      assert.equal((await fetch(`http://127.0.0.1:${port}/${module}?v=20261003-binance-traders`)).status, 200);
    }
    const app=await (await fetch(`http://127.0.0.1:${port}/app.js`)).text();
    for(const module of ['report','market','binance-agg'])assert.ok(app.includes(`./${module}.js?v=20261003-binance-agg`));
    assert.ok(app.includes('./insight-ui.js?v=20261003-binance-traders'));
    assert.equal((await fetch(`http://127.0.0.1:${port}/data/top-trades.json`)).status,200);
    const aggregateResponse=await fetch(`http://127.0.0.1:${port}/data/binance-agg.json`);
    assert.equal(aggregateResponse.status,200);
    assert.equal((await aggregateResponse.json()).recordType,'binance-aggregate');
    const insights=await (await fetch(`http://127.0.0.1:${port}/insight-ui.js`)).text();
    assert.match(insights,/insights\.js\?v=20261003-binance-traders/);
  } finally {
    if (child.exitCode === null) {
      const stopped = once(child, 'exit');
      child.kill();
      await stopped;
    }
  }
});
