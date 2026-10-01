import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Match the proxy used by Windows desktop apps without storing its address.
const env = { ...process.env };
if (process.platform === 'win32' && !env.HTTPS_PROXY && !env.https_proxy) {
  try {
    const proxy = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "$p=[System.Net.WebRequest]::GetSystemWebProxy().GetProxy([Uri]'https://fapi.binance.com'); if($p.Host -ne 'fapi.binance.com'){$p.AbsoluteUri}"], { encoding:'utf8', windowsHide:true, timeout:5000 }).trim();
    if (proxy) { env.HTTPS_PROXY = proxy; env.HTTP_PROXY = proxy; }
  } catch { /* Direct connection remains available. */ }
}
env.NO_PROXY = [env.NO_PROXY, 'localhost', '127.0.0.1'].filter(Boolean).join(',');
const child = spawn(process.execPath, ['--use-env-proxy', fileURLToPath(new URL('./server.mjs', import.meta.url))], { env, stdio:'inherit', windowsHide:true });
child.on('exit', code => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill());
