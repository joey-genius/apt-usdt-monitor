import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAllWalletActivity, fetchWalletActivity, TRACKED_WALLETS} from '../public/gov-wallets.js';

const address = TRACKED_WALLETS[0].address;
const tx = (txid, input, outputs, status = {confirmed: true, block_time: 100}) => ({
  txid,
  vin: [{prevout: {scriptpubkey_address: input.address, value: input.value}}],
  vout: outputs.map(output => ({scriptpubkey_address: output.address, value: output.value})),
  status
});

test('queries the configured address and normalizes net BTC direction from satoshis', async () => {
  const calls = [];
  const replies = [
    {chain_stats: {funded_txo_sum: 500, spent_txo_sum: 200}, mempool_stats: {funded_txo_sum: 10, spent_txo_sum: 0}},
    [tx('a'.repeat(64), {address, value: 300}, [{address: 'elsewhere', value: 299}]),
      tx('b'.repeat(64), {address: 'elsewhere', value: 100}, [{address, value: 100}], {confirmed: false})]
  ];
  const result = await fetchWalletActivity({fetchImpl: async url => {
    calls.push(url); const body = replies.shift();
    return {ok: true, status: 200, json: async () => body};
  }});
  assert.deepEqual(calls, [`https://mempool.space/api/address/${address}`, `https://mempool.space/api/address/${address}/txs`]);
  assert.equal(result.balance, 310);
  assert.deepEqual(result.rows.map(({direction, amountSat, confirmed, time}) => ({direction, amountSat, confirmed, time})), [
    {direction: '转出', amountSat: 300, confirmed: true, time: 100000},
    {direction: '转入', amountSat: 100, confirmed: false, time: null}
  ]);
});

test('rejects failed or malformed explorer responses instead of inventing empty activity', async () => {
  await assert.rejects(fetchWalletActivity({fetchImpl: async () => ({ok: false, status: 503})}), /链上接口请求失败/);
  await assert.rejects(fetchWalletActivity({fetchImpl: async () => ({ok: true, status: 200, json: async () => ({})})}), /返回格式无效/);
  const responses = [
    {chain_stats: {funded_txo_sum: 0, spent_txo_sum: 0}, mempool_stats: {funded_txo_sum: 0, spent_txo_sum: 0}},
    [tx('c'.repeat(64), {address, value: '100'}, [])]
  ];
  await assert.rejects(fetchWalletActivity({fetchImpl: async () => ({ok: true, status: 200, json: async () => responses.shift()})}), /交易金额数据无效/);
});

test('loads all sourced addresses and keeps per-address failures visible', async () => {
  const calls=[];
  const result=await fetchAllWalletActivity({fetchImpl:async url=>{
    calls.push(url);
    if(url.includes(TRACKED_WALLETS[1].address))return {ok:false,status:429,json:async()=>({})};
    if(url.endsWith('/txs'))return {ok:true,status:200,json:async()=>[]};
    return {ok:true,status:200,json:async()=>({chain_stats:{funded_txo_sum:100,spent_txo_sum:20},mempool_stats:{funded_txo_sum:0,spent_txo_sum:0}})};
  }});
  assert.equal(calls.length,TRACKED_WALLETS.length*2);
  assert.equal(result.results.length,2);
  assert.equal(result.errors.length,1);
  assert.equal(result.errors[0].wallet.address,TRACKED_WALLETS[1].address);
});
