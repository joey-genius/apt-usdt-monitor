import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('local server serves the new browser module and threshold control', { timeout: 15000 }, async () => {
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
    const response = await fetch(`http://127.0.0.1:${port}/large-flows.js?v=20261002-large-flow`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.match(await response.text(), /export function aggregateLargeTradeFlow/);
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    assert.match(html, /id="large-threshold"/);
    for (const module of ['app.js', 'report.js', 'market.js', 'trades.js', 'metrics.js', 'flows.js']) {
      assert.equal((await fetch(`http://127.0.0.1:${port}/${module}`)).status, 200);
    }
  } finally {
    if (child.exitCode === null) {
      const stopped = once(child, 'exit');
      child.kill();
      await stopped;
    }
  }
});
