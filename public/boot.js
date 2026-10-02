// Keep the error handler outside the module graph so even import/parse errors surface.
import('./app.js?v=20261002-large-flow').catch(error => {
  const status = document.getElementById('status');
  const report = document.getElementById('contract-report');
  const notice = document.getElementById('notice');
  if (status) status.textContent = '页面脚本加载失败';
  if (report) report.textContent = '页面未能启动，尚未请求行情。请刷新页面重试。';
  if (notice) {
    notice.hidden = false;
    notice.textContent = `加载错误：${error.message}。可按 Ctrl+F5 强制刷新；若仍失败，请反馈此错误。`;
  }
});
