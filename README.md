# APT / USDT 合约监测台

## 币安聚合成交 Top 100 · 近24小时

- 使用无需 API Key 的官方 `/fapi/v1/aggTrades?symbol=APTUSDT`。这是聚合执行记录，不是原始逐笔、完整委托订单或已识别的大户交易；与下方 Bitget / OKX 逐笔排行独立展示，不混排、不合并汇总。
- 固定到采集开始前一分钟的分钟边界，回溯完整24小时。先按不超过1小时的时间段定位首笔，再使用 `fromId=last.a+1` 升序翻页，直到取得截止时间或之后的记录。校验聚合 ID 连续、时间顺序、价格、数量、主动方向及原始首末成交 ID。空的初始时间段逐小时检查；已开始 ID 翻页后提前空页视为不完整。
- `m=false` 是主动买入，`m=true` 是主动卖出。以精确定点价格乘数量排序，独立展示 Top 100 和全天已覆盖记录的买入、卖出、净额；金额不是充值提现，不能据此识别主力账户。
- 每页最多1000条，页间等待900毫秒，最多1200页 / 18分钟，每次请求20秒超时。限流、HTTP 451 / 403、网络错误、缺口或超时立即终止，不发布部分结果，不自动切换端点或规避限制。
- 发布工作流生成独立的 `public/data/binance-agg.json`，失败写入明确错误且汇总为 null。也可执行 `node scripts/binance-agg.mjs`。GitHub 云端可能受到币安地区限制，不保证云端快照可用。
- 页面提供手动浏览器采集及取消按钮，显示页数与记录数；只在访问者网络正常允许币安请求时可用。完整结果保存在当前页面内，普通行情自动刷新不触发重新扫描；窗口截止超过1小时失效，重载页面不保留本地结果。演示模式不采集、不制造聚合记录。

## 近24小时成交金额 Top 100

保留 Binance 大户多空比，新增独立的24小时成交排行，无最低金额门槛。

- 后台从 Bitget `fills-history`（`idLessThan`）向前翻页，直到越过固定24小时起点；OKX `history-trades` 实测完整24小时需约1818页、16分钟，超过打开页面时的采集预算，因此明确标注未纳入。只纳入整个窗口扫描成功的平台，不把最近1000笔当作全天。
- 采集发生在访问者浏览器：打开页面即开始，无需点击，只采集 Bitget，约30秒完成；完成前不展示任何部分结果。可随时取消，取消后立即清空且不回退旧快照。演示模式不采集。
- 浏览器请求必须是 CORS 简单 GET（Bitget 对任何预检请求返回 403），因此不发送自定义请求头，改用 `cache:'no-store'`；取消会立即中止进行中的请求。
- 每30秒行情自动刷新与手动刷新都不会重复扫描；切到演示模式再切回实时会重新采集一次。
- 跨平台按 USDT 成交金额从大到小取100条；同一毫秒的不同成交ID保留，交易所+成交ID是唯一键。价格、数量和合约乘数各支持18位小数，乘积保留54位定点整数排序汇总，不中途截断；展示换成普通数字。大整数ID必须为字符串。
- 展示时间、平台、主动方向、价格、APT数量、USDT金额、成交ID，以及入选Top100的买入总额、卖出总额、买减卖净额。完整24小时的所有成交汇总另外折叠展示，两种口径不混用。
- 正净额的净买入值为 `max(买入-卖出,0)`，负净额的净卖出值为 `max(卖出-买入,0)`；不是交易所充值提现净流入，更不是已识别大户账户资金流。
- 每个平台 Bitget 最多200页、OKX 最多2200页，页面端预算3分钟；超限、空页提前结束、游标不前进、字段异常均不纳入部分排名。API提供历史记录的完整性仍取决于交易所；对未接入完整回溯的 Binance/Bybit/Gate 明确标注。
- 排名窗口以采集开始时的固定分钟为截止，显示实际起止和生成时间；窗口截止超过1小时即显示过期，需重新采集。
- 手动快照命令 `node scripts/top-trades.mjs`（默认尝试 Bitget + OKX、15分钟预算）。发布工作流不再生成该快照，`public/data/top-trades.json` 仅为空占位，页面不读取。

## Binance 大户原始数据（当前版本）

已移除自定义成交额门槛及大额净额表，主报告直接展示 Binance APTUSDT 的三项官方统计：

- 大户账户多空比：`/futures/data/topLongShortAccountRatio`。
- 大户持仓多空比：`/futures/data/topLongShortPositionRatio`。
- 全账户多空比：`/futures/data/globalLongShortAccountRatio`，独立标为全账户对照，并非大户指标。

三个请求均为 `symbol=APTUSDT&period=5m&limit=12`，浏览器直接访问 `https://fapi.binance.com`，不依赖 GitHub Actions 的成交快照。页面每30秒刷新，展示接口原始多空比、多空占比、采样时间和最近12个5分钟历史点；不再与 Gate / Bybit 混合或按持仓加权。超过15分钟、字段无效或请求失败时显示不可用，不回填其他平台或模拟数据。比例不转换成资金金额、订单金额或买卖净额。

参考页面：https://www.binance.com/zh-CN/futures/funding-history/perpetual/trading-data 。数据通过官方公开统计接口读取，不声称抓取网页内部接口。网络/地区限制可能导致 Binance 无法访问；页面会显示错误原因。其他多交易所价格、OI及费率作为独立背景保留。以下旧版净额聚合说明仅涉及底层历史功能，不代表当前大户展示口径。

中文网页版 APTUSDT 永续合约监测工具，支持手机和电脑浏览器。

在线访问：https://joey-genius.github.io/apt-usdt-monitor/

## 功能

- 最新价格、24小时涨跌、成交额、资金费率及下次结算时间。
- Binance、Bybit、OKX 持仓分布，明确显示实际接入范围。
- Binance 大户账户多空比、大户持仓多空比、全体账户多空比。
- BTC 链上钱包动态：查询 Arkham 公开公告列出的 Silk Road、Bitfinex 扣押地址及截图中的 Bitfinex 案地址，每30秒刷新；逐项显示标签来源。
- 5分钟至168小时持仓变化、主动买卖净额，以及48小时价格曲线。
- 每30秒刷新、手动刷新、独立演示模式、JSON快照导出。

## 在线运行

GitHub Pages 托管 `public/` 目录。浏览器直接请求交易所公开 API，不依赖个人电脑或常驻服务器，不需要 API 密钥。只有打开网页时才会刷新，不提供关闭页面后的后台监测。

行情可用性取决于访问者所在地区、网络、交易所跨域策略和接口限流。失败数据以“—”显示，绝不自动使用模拟数据。界面中的演示模式会显著标识所有数值均为模拟值。

网站通过 GitHub Actions 采集数据并部署到 GitHub Pages；发布前运行指标与界面测试。

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
- [Arkham 公开公告](https://info.arkm.com/announcements/the-us-government-is-now-an-entity-on-arkham)：公布 Silk Road 与 Bitfinex 扣押 BTC 地址。该公告不代表美国政府钱包完整名册，地址归属来自第三方标签，非官方确认。
- [mempool.space API](https://mempool.space/docs/api)：公开 Bitcoin 地址与交易数据。

只读行情工具，不连接交易账户，不执行交易。

## 发布更新

推送到 `main` 后由 `.github/workflows/pages.yml` 运行测试、采集并发布 `public/`。也支持手动触发和每5分钟的计划触发；GitHub 调度可能延迟。无需手动推送 `gh-pages`。


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

## APT定投参考指数

顶部独立模块采用Binance现货API（日线与现价），每5分钟刷新，与永续演示模式分离。指数=(现价/200日几何均价)×(现价/365日对数线性时间趋势拟合价)。只使用截至昨日的连续完整UTC日线，拟合ln价格对天数，外推至当日。此APT自定义模型不是BTC Ahr999，不采用BTC币龄曲线或其0.45/1.2阈值，不推算收益率或回本时间。另列等额日投的调和均价成本参考。数据缺失或过期时不计算。
