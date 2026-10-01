# APT / USDT 合约监测台

中文网页版 APTUSDT 永续合约监测工具，支持手机和电脑浏览器。

在线访问：https://joey-genius.github.io/apt-usdt-monitor/

## 功能

- 最新价格、24小时涨跌、成交额、资金费率及下次结算时间。
- Binance、Bybit、OKX 持仓分布，明确显示实际接入范围。
- Binance 大户账户多空比、大户持仓多空比、全体账户多空比。
- 5分钟至168小时持仓变化、主动买卖净额，以及48小时价格曲线。
- 每30秒刷新、手动刷新、独立演示模式、JSON快照导出。

## 在线运行

GitHub Pages 托管 `public/` 目录。浏览器直接请求交易所公开 API，不依赖个人电脑或常驻服务器，不需要 API 密钥。只有打开网页时才会刷新，不提供关闭页面后的后台监测。

行情可用性取决于访问者所在地区、网络、交易所跨域策略和接口限流。失败数据以“—”显示，绝不自动使用模拟数据。界面中的演示模式会显著标识所有数值均为模拟值。

网站通过 GitHub Pages 的分支部署发布；发布前运行本地指标测试。

## 本地运行

需要 Node.js 24 或更新版本，无第三方 npm 依赖。

```sh
node start.mjs
```

打开 http://127.0.0.1:3000 。Windows 也可以双击 `启动监测台.cmd`。本地服务只监听本机，并自动采用 Windows 已配置的系统代理（若没有显式设置 HTTPS_PROXY）。不会存储代理配置。使用 `PORT` 环境变量可修改端口。

```sh
node --test
```

## 数据口径

- 持仓分布：USDT永续名义价值；分母仅包含成功获取的交易所，并非全市场总持仓。小于1%的项合并。
- Binance当前持仓价值 = 持仓币数 × 标记价格。历史持仓变化 = 当前价值 ÷ 历史价值 − 1，因此包含价格影响。历史取目标时间之前最近快照，最多允许两个采样周期的间隔。
- 多空比：交易所5分钟采样，账户比按账户数，持仓比按头寸比例。
- 主动买卖净额 = 2 × 主动买入计价成交额 − 总计价成交额。仅统计完整K线，24小时及以下对齐5分钟边界，48小时及以上对齐小时边界。该指标无法识别“主力账户”，不等同于链上资金净流入。
- 不同接口采样时间可能不同，168小时指标需要足够历史数据。缺失时不补造。

## 数据来源

- [Binance USDⓈ-M Futures](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Open-Interest-Statistics)：价格、资金费率、持仓、多空比和K线。
- [Bybit Tickers](https://bybit-exchange.github.io/docs/v5/market/tickers)：`openInterestValue`。
- [OKX Open Interest](https://www.okx.com/docs-v5/en/#public-data-rest-api-get-open-interest)：`oiUsd`。

只读行情工具，不连接交易账户，不执行交易。

## 发布更新

Pages 从 `gh-pages` 分支根目录部署；该分支只包含 `public/` 中的网站文件。更新网页后执行：

```sh
git subtree push --prefix public origin gh-pages
```

