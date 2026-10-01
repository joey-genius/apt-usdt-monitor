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


## 多交易所聚合（2026-10-01更新）

当前接入 Binance、Bybit、OKX、Bitget、Gate、Hyperliquid。价格和资金费率按有效单边名义持仓加权；资金费率统一为8小时等效。持仓与成交额求和，缺失数据不外推。Hyperliquid 为 USDC 永续，按1 USDC = 1 USD折算。OKX 的24小时报价未提供精确计价成交额，因此从成交额合计中剔除。

Bybit 使用官方 `singleOpenInterestValue`，不将双边持仓与其他交易所单边持仓混加。Gate 使用 `position_size × quanto_multiplier × mark_price`。历史持仓按 Binance / Bybit / OKX 同组匹配计算；Bybit 历史单边币数以同时刻标记K线开盘价估值。各行显示来源与同组当前持仓，避免覆盖差异产生虚假变化。

多空情绪为持仓加权代理指标（大户：Binance/Gate；全体账户：Binance/Bybit/Gate），不是实际全市场人数比。各交易所大户定义不同。价格曲线按当前固定持仓权重加权，并仅采用共同时间点。主动买卖净额仍只覆盖 Binance，界面明确标为局部指标。

本站独立聚合公开 API，**不是 CoinGlass 数据源**。官网参考：https://www.coinglass.com/currencies/APT 。CoinGlass覆盖更多市场，其官方API需要密钥：https://docs.coinglass.com/reference/authentication 。没有复制官网瞬时数值充当持续实时数据。

新增口径依据：[Bybit Tickers](https://bybit-exchange.github.io/docs/v5/market/tickers)、[Bybit Open Interest](https://bybit-exchange.github.io/docs/v5/market/open-interest)、[Gate Contract](https://github.com/gateio/gateapi-python/blob/master/docs/Contract.md)、[Hyperliquid Funding](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding)。

## 数据与持仓变化解读

数据解读随行情更新，涵盖费率、情绪、持仓和集中度。持仓变化解读分为短线（5分钟至1小时）、日内（4至24小时）、多日（48至168小时），逐周期显示变化及来源，说明扩张、收缩、方向分化和覆盖差异。缺失周期不补造结论。

已移除事件、新闻解读及新闻接口轮询。

## 联合行情分析

新增1/4/24小时已闭合窗口的价格、持仓币数、主动买卖与量比联合分析。Binance / Bybit 必须有准确起止时刻配对才参与，按起点名义持仓固定加权，避免名义持仓的价格效应。主动买卖占比、量比、区间高低取Binance，明确为局部确认。资金费率为当前背景，非历史窗口费率。

输出综合方向、增仓上涨/增仓下跌/回补/去杠杆等规则推断，并给出继续验证及失效条件。阈值在页面公开，未声称回测胜率、因果识别或预测目标价。分析随已闭合整点窗口推进，不把未完成K线用作确认。
