export const TRACKED_WALLETS = [{
  label: 'Bitfinex Hacker Seized Funds',
  address: 'bc1q2khlx5kynrjrv2zef825hlmx44758c3zrrggvy',
  explorer: 'https://mempool.space'
}];

const API = 'https://mempool.space/api';
const formatBtc = satoshis => (satoshis / 1e8).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 8});

export async function fetchWalletActivity({wallet = TRACKED_WALLETS[0], fetchImpl = fetch, signal} = {}) {
  const [addressResponse, txResponse] = await Promise.all([
    fetchImpl(`${API}/address/${wallet.address}`, {cache: 'no-store', signal}),
    fetchImpl(`${API}/address/${wallet.address}/txs`, {cache: 'no-store', signal})
  ]);
  if (!addressResponse.ok || !txResponse.ok) throw new Error(`链上接口请求失败（${addressResponse.status}/${txResponse.status}）`);
  const [address, transactions] = await Promise.all([addressResponse.json(), txResponse.json()]);
  if (!address?.chain_stats || !Array.isArray(transactions)) throw new Error('链上接口返回格式无效');
  const balance = address.chain_stats.funded_txo_sum - address.chain_stats.spent_txo_sum
    + address.mempool_stats.funded_txo_sum - address.mempool_stats.spent_txo_sum;
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('钱包余额数据无效');
  const rows = transactions.map(tx => {
    if (!tx || typeof tx.txid !== 'string' || !Array.isArray(tx.vin) || !Array.isArray(tx.vout)) throw new Error('交易记录格式无效');
    const incoming = tx.vout.reduce((sum, output) => {
      if (output.scriptpubkey_address !== wallet.address) return sum;
      if (!Number.isSafeInteger(output.value) || output.value < 0) throw new Error('交易金额数据无效');
      return sum + output.value;
    }, 0);
    const outgoing = tx.vin.reduce((sum, input) => {
      if (input.prevout?.scriptpubkey_address !== wallet.address) return sum;
      if (!Number.isSafeInteger(input.prevout.value) || input.prevout.value < 0) throw new Error('交易金额数据无效');
      return sum + input.prevout.value;
    }, 0);
    const delta = incoming - outgoing;
    if (!Number.isSafeInteger(delta)) throw new Error('交易金额超出安全范围');
    const confirmed = tx.status?.confirmed === true;
    return {
      txid: tx.txid,
      time: confirmed && Number.isFinite(tx.status.block_time) ? tx.status.block_time * 1000 : null,
      confirmed,
      direction: delta > 0 ? '转入' : delta < 0 ? '转出' : '无净变化',
      amountSat: Math.abs(delta),
      delta
    };
  }).sort((a, b) => (b.time || 0) - (a.time || 0));
  return {balance, rows, fetchedAt: Date.now()};
}

function dateTime(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleString('zh-CN', {hour12: false}) : '等待确认';
}

function renderRows(tbody, rows) {
  tbody.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'gov-wallet-empty';
    td.textContent = '接口未返回近期交易记录';
    tr.append(td); tbody.append(tr); return;
  }
  for (const row of rows) {
    const tr = document.createElement('tr');
    const cells = [dateTime(row.time), row.direction, `${formatBtc(row.amountSat)} BTC`, row.confirmed ? '已确认' : '待确认'];
    for (const value of cells) {
      const td = document.createElement('td'); td.textContent = value; tr.append(td);
    }
    const txCell = document.createElement('td'), link = document.createElement('a');
    link.href = `${TRACKED_WALLETS[0].explorer}/tx/${encodeURIComponent(row.txid)}`;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `${row.txid.slice(0, 10)}…${row.txid.slice(-8)}`;
    link.setAttribute('aria-label', `查看交易 ${row.txid}`);
    txCell.append(link); tr.append(txCell); tbody.append(tr);
  }
}

export function initGovWallets({documentRef = document, fetchImpl = fetch, intervalMs = 30000} = {}) {
  const refreshButton = documentRef.getElementById('gov-wallet-refresh');
  const status = documentRef.getElementById('gov-wallet-status');
  const balance = documentRef.getElementById('gov-wallet-balance');
  const tbody = documentRef.getElementById('gov-wallet-rows');
  if (!refreshButton || !status || !balance || !tbody) return () => {};
  let busy = false, timer;
  const refresh = async () => {
    if (busy) return;
    busy = true; refreshButton.disabled = true; status.removeAttribute('data-state'); status.textContent = '正在查询 Bitcoin 公共链上数据…';
    try {
      const data = await fetchWalletActivity({fetchImpl, signal: AbortSignal.timeout(15000)});
      balance.textContent = `${formatBtc(data.balance)} BTC`;
      renderRows(tbody, data.rows);
      status.textContent = `更新于 ${dateTime(data.fetchedAt)} · ${data.rows.length} 笔近期记录`;
    } catch (error) {
      status.dataset.state = 'error';
      status.textContent = `查询失败：${error?.message || String(error)}。稍后自动重试。`;
      if (tbody.children.length === 0) renderRows(tbody, []);
    } finally {
      busy = false; refreshButton.disabled = false;
    }
  };
  refreshButton.addEventListener('click', refresh);
  refresh(); timer = setInterval(refresh, intervalMs);
  return () => { clearInterval(timer); refreshButton.removeEventListener('click', refresh); };
}

if (typeof document !== 'undefined') initGovWallets();
