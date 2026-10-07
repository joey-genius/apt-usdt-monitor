export const ARKHAM_SOURCE='https://info.arkm.com/announcements/the-us-government-is-now-an-entity-on-arkham';
export const TRACKED_WALLETS=[
  {label:'Silk Road 扣押资金（Individual X）',address:'bc1qa5wkgaew2dkv56kfvj49j0av5nml45x9ek9hz6',sourceLabel:'Arkham 公开公告',source:ARKHAM_SOURCE},
  {label:'Bitfinex 黑客案扣押资金（FBI）',address:'bc1qazcm763858nkj2dj986etajv6wquslv8uxwczt',sourceLabel:'Arkham 公开公告',source:ARKHAM_SOURCE},
  {label:'Bitfinex 案近期转账地址',address:'bc1q2khlx5kynrjrv2zef825hlmx44758c3zrrggvy',sourceLabel:'用户提供的 Arkham 截图',source:null}
];

const API='https://mempool.space/api',EXPLORER='https://mempool.space';
const formatBtc=satoshis=>(satoshis/1e8).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:8});

export async function fetchWalletActivity({wallet=TRACKED_WALLETS[0],fetchImpl=fetch,signal}={}){
  if(!wallet?.address)throw new Error('钱包地址缺失');
  const [addressResponse,txResponse]=await Promise.all([
    fetchImpl(`${API}/address/${wallet.address}`,{cache:'no-store',signal}),
    fetchImpl(`${API}/address/${wallet.address}/txs`,{cache:'no-store',signal})
  ]);
  if(!addressResponse.ok||!txResponse.ok)throw new Error(`链上接口请求失败（${addressResponse.status}/${txResponse.status}）`);
  const [address,transactions]=await Promise.all([addressResponse.json(),txResponse.json()]);
  if(!address?.chain_stats||!address?.mempool_stats||!Array.isArray(transactions))throw new Error('链上接口返回格式无效');
  const balance=address.chain_stats.funded_txo_sum-address.chain_stats.spent_txo_sum+address.mempool_stats.funded_txo_sum-address.mempool_stats.spent_txo_sum;
  if(!Number.isSafeInteger(balance)||balance<0)throw new Error('钱包余额数据无效');
  const rows=transactions.map(tx=>{
    if(!tx||typeof tx.txid!=='string'||!Array.isArray(tx.vin)||!Array.isArray(tx.vout))throw new Error('交易记录格式无效');
    const incoming=tx.vout.reduce((sum,output)=>{
      if(output.scriptpubkey_address!==wallet.address)return sum;
      if(!Number.isSafeInteger(output.value)||output.value<0)throw new Error('交易金额数据无效');
      return sum+output.value;
    },0);
    const outgoing=tx.vin.reduce((sum,input)=>{
      if(input.prevout?.scriptpubkey_address!==wallet.address)return sum;
      if(!Number.isSafeInteger(input.prevout.value)||input.prevout.value<0)throw new Error('交易金额数据无效');
      return sum+input.prevout.value;
    },0);
    const delta=incoming-outgoing;
    if(!Number.isSafeInteger(delta))throw new Error('交易金额超出安全范围');
    const confirmed=tx.status?.confirmed===true;
    return {wallet,txid:tx.txid,time:confirmed&&Number.isFinite(tx.status.block_time)?tx.status.block_time*1000:null,confirmed,direction:delta>0?'转入':delta<0?'转出':'无净变化',amountSat:Math.abs(delta),delta};
  }).sort((a,b)=>(b.time||0)-(a.time||0));
  return {wallet,balance,rows,fetchedAt:Date.now()};
}

export async function fetchAllWalletActivity({wallets=TRACKED_WALLETS,fetchImpl=fetch,signal}={}){
  const settled=await Promise.allSettled(wallets.map(wallet=>fetchWalletActivity({wallet,fetchImpl,signal})));
  const results=settled.filter(item=>item.status==='fulfilled').map(item=>item.value);
  const errors=settled.flatMap((item,index)=>item.status==='rejected'?[{wallet:wallets[index],message:item.reason?.message||String(item.reason)}]:[]);
  if(!results.length)throw new Error(errors.map(error=>`${error.wallet.label}：${error.message}`).join('；')||'所有钱包查询失败');
  const rows=results.flatMap(result=>result.rows).sort((a,b)=>(b.time||0)-(a.time||0));
  return {results,errors,rows,fetchedAt:Date.now()};
}

function dateTime(timestamp){return timestamp?new Date(timestamp).toLocaleString('zh-CN',{hour12:false}):'等待确认';}
function renderWallets(container,results){
  container.replaceChildren();
  for(const result of results){
    const card=document.createElement('div');card.className='gov-wallet-address';
    const name=document.createElement('b');name.textContent=result.wallet.label;
    const address=document.createElement('a');address.href=`${EXPLORER}/address/${encodeURIComponent(result.wallet.address)}`;address.target='_blank';address.rel='noopener noreferrer';address.textContent=result.wallet.address;address.title=result.wallet.address;
    const balance=document.createElement('span');balance.className='gov-wallet-balance';balance.append('余额 ');const strong=document.createElement('strong');strong.textContent=`${formatBtc(result.balance)} BTC`;balance.append(strong);
    const source=document.createElement('span');source.className='gov-wallet-source';source.append('标签：');
    if(result.wallet.source){const link=document.createElement('a');link.href=result.wallet.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent=result.wallet.sourceLabel;source.append(link);}else source.append(result.wallet.sourceLabel);
    card.append(name,address,balance,source);container.append(card);
  }
}
function renderRows(tbody,rows){
  tbody.replaceChildren();
  if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.className='gov-wallet-empty';td.textContent='接口未返回近期交易记录';tr.append(td);tbody.append(tr);return;}
  for(const row of rows.slice(0,30)){
    const tr=document.createElement('tr'),timeCell=document.createElement('td');timeCell.append(dateTime(row.time));const caseName=document.createElement('span');caseName.className='gov-wallet-case';caseName.textContent=row.wallet.label;timeCell.append(caseName);tr.append(timeCell);
    const direction=document.createElement('td');direction.textContent=row.direction;direction.className=row.direction==='转出'?'gov-wallet-direction-out':row.direction==='转入'?'gov-wallet-direction-in':'';tr.append(direction);
    for(const value of [`${formatBtc(row.amountSat)} BTC`,row.confirmed?'已确认':'待确认']){const td=document.createElement('td');td.textContent=value;tr.append(td);}
    const txCell=document.createElement('td'),link=document.createElement('a');link.href=`${EXPLORER}/tx/${encodeURIComponent(row.txid)}`;link.target='_blank';link.rel='noopener noreferrer';link.textContent=`${row.txid.slice(0,10)}…${row.txid.slice(-8)}`;link.setAttribute('aria-label',`查看交易 ${row.txid}`);txCell.append(link);tr.append(txCell);tbody.append(tr);
  }
}

export function initGovWallets({documentRef=document,fetchImpl=fetch,intervalMs=30000}={}){
  const refreshButton=documentRef.getElementById('gov-wallet-refresh'),status=documentRef.getElementById('gov-wallet-status'),wallets=documentRef.getElementById('gov-wallet-addresses'),tbody=documentRef.getElementById('gov-wallet-rows');
  if(!refreshButton||!status||!wallets||!tbody)return()=>{};
  let busy=false,timer;
  const refresh=async()=>{
    if(busy)return;busy=true;refreshButton.disabled=true;status.removeAttribute('data-state');status.textContent=`正在查询 ${TRACKED_WALLETS.length} 个 Bitcoin 地址…`;
    try{const data=await fetchAllWalletActivity({fetchImpl,signal:AbortSignal.timeout(15000)});renderWallets(wallets,data.results);renderRows(tbody,data.rows);status.textContent=`更新于 ${dateTime(data.fetchedAt)} · ${data.results.length}/${TRACKED_WALLETS.length} 个地址 · ${Math.min(data.rows.length,30)} 笔近期记录${data.errors.length?` · ${data.errors.length} 个地址查询失败`:''}`;if(data.errors.length)status.dataset.state='error';}
    catch(error){status.dataset.state='error';status.textContent=`查询失败：${error?.message||String(error)}。稍后自动重试。`;if(tbody.children.length===0)renderRows(tbody,[]);}
    finally{busy=false;refreshButton.disabled=false;}
  };
  refreshButton.addEventListener('click',refresh);refresh();timer=setInterval(refresh,intervalMs);return()=>{clearInterval(timer);refreshButton.removeEventListener('click',refresh);};
}
if(typeof document!=='undefined')initGovWallets();
