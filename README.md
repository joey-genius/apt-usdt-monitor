# APT / USDT 合约监测台

## 大额成交买卖净额（本次更新）

报告主指标改为 **大额主动买入金额 − 大额主动卖出金额**，不再把全成交主动净额称作主力净流入。

- 可自定义最低单条上报成交额，例如100 / 500 / 2000 USDT，支持不小于0.01的金额及小数，默认1万；按1 USDT约等于1 USD比较。输入后点击“应用金额”或回车本地重算，自动刷新保留当前已应用金额；无效输入不覆盖已应用值。这是观察门槛，不是官方主力身份判定，也未经收益回测优化。
- 尝试 Binance 原始近期成交、OKX、Bybit、Bitget、Gate 近期成交；OKX 的合约张数按接口返回的 APT 合约面值转换，Gate 使用 quanto_multiplier。没有逐笔记录时绝不回退到 K 线总额或主动买卖聚合额。
- 门槛作用于交易所上报的成交记录，不代表完整委托订单。平台记录聚合方式不同，大户拆单无法从匿名记录中可靠还原；不是已识别主力账户的资金净流入。内部交易和标记的大宗成交不计入普通主动成交流。
- 同一批采集使用开始时的已闭合5分钟边界；每个来源的全量近期记录必须包住统计窗口，才允许筛选并计算净额。按 ID 去重，冲突记录拒绝，Binance 原始成交序号有缺口时拒绝。其他来源无可验证序号，时间覆盖不等于可证明无漏单，因此标注为近期记录覆盖估计，不宣称全市场完整。
- 展示买入、卖出、净额、记录数、大额成交占比、分平台明细、起止时间和未纳入原因。合格窗口没有大单为0，缺数据为未知；记录条数不足的24小时/7天窗口不能拼造。快照/截止时间超过30分钟不参与。
- 价格、持仓币数变化仅在起止时间完全一致时作为同期背景；大户多空比和当前资金费率作为独立背景，不混入美元净额。不把它们称为主力身份识别或开平仓事实。强平、订单簿与地址追踪目前未接入，页面明示。
- 演示模式不提供大额逐笔金额；旧版已发布快照缺少新字段时也显示未知，需成功运行新版采集工作流后才有新数据。

GitHub Actions 定时拉近期记录不能保证连续覆盖。需要精确累计长周期成交或跟踪 Hyperliquid 大户地址时，仍需常驻 WebSocket 采集、持久化和断线补采；本次没有部署这类服务。此前各节提及的普通主动买卖净额仍保留为底层/分析背景，不再替代新的大额净额主指标。

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

## 多交易所主动净额

净流入参考聚合 Binance APTUSDT 和 OKX APT-USDT-SWAP 的主动买入减主动卖出，按相同截止时间、同一完整周期求和，不按持仓加权。逐行显示来源、分项净额和截止时间。不是已识别的主力账户资金。

OKX采用官方 `/api/v5/rubik/stat/taker-volume-contract`，`unit=2` 为美元计价额，返回 `[ts,sellVol,buyVol]`。时间戳为周期起点，排除未完成周期。单次最多100条，因此采集3页5分钟、2页小时数据，覆盖到168小时。该接口不能可靠地从浏览器跨域读取，使用GitHub Actions每5分钟请求并发布 `data/okx-flows.json`；调度可能延迟，不保证精确5分钟到账。快照超过30分钟、时间有缺段或数据无效时，OKX从对应行剔除，页面明确显示实际剩余来源。

定时工作流同时完成网站发布，后续将代码推送到main即可更新；不再手动推送gh-pages。每次运行先检查脚本和指标测试，再采集，失败不覆盖已发布页面。分析卡片中的主动买卖确认仍使用Binance并明确标注，与净额聚合表分开。

## Bybit / Bitget / Gate 逐笔净额扩展

后台同时尝试三家近期最多1000笔成交。Bybit/Bitget用价格×币数×主动方向；Gate用价格×合约数×quanto_multiplier，正数量为主动买入、负为主动卖出；排除内部交易和场外大宗成交。按成交ID去重，仅当最近成交记录的起止时间完整包住统一统计窗口时纳入。不把最近1000笔当24小时，不跨采集批次拼接，不补造历史。每行可展开查看未纳入原因；来源随成交密度、网络地区限制和周期变化。

依据：[Bybit Recent Trades](https://bybit-exchange.github.io/docs/v5/market/recent-trade)、[Gate Futures Trades](https://www.gate.com/docs/developers/futures/ws/en/)。新增指标仍是主动成交净额，不是可识别主力账户的资金流。

## 扩展持仓历史

Gate 5分钟/小时历史按双边美元持仓价值除以2，匹配当前单边持仓，覆盖至168小时。Bitget和Hyperliquid自首次部署开始累积当前持仓价值快照，保留9天，每次后台运行先恢复上一版已发布历史；源接口失败时保留历史。只采用目标时刻之前且10分钟以内的真实快照，调度缺口会导致该周期不参与，不插值。GitHub调度可能延迟，因此不保证每个周期均有六家数据。各行显示真实配对来源。
