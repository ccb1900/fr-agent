# jar 级引擎面分析（demo CPT ≠ 引擎面）2026-11-08

> 用户口径："demo cpt 其实没有 jar 覆盖全面，应该已经有针对 jar 的分析吧。"
> 本文把"引擎里到底有哪些图"从核心 jar 物理类面钉成账，并与能力账本/IR 词表机器对账。
> 产物：`data/jar_surface_analysis.json`（build_jar_surface.ps1 生成），规则表 `data/jar_surface_classifications.json`，
> 门 `verify/fast_jar_surface.js`（fast 第 19 套件）。

## 1. 扫描口径

- 核心安装 jar：`lib/`、`server/lib/`、`WEB-INF/lib/`（**不含** `WEB-INF/plugins` 付费插件 jar）
- 类面正则：`com/fr/(plugin/)?chart/.*(Plot|Plot4VanChart)\.class`（图表绘图层；`PiePlot4VanChart` 命名不带 Plot 后缀，单独纳入）
- 结果：**54 个 Plot/绘图类**（另：核心 jar 全部类 140,118，见 `data/jar_class_inventory.json`；240 个官方 demo CPT 只是语料，不是引擎面）

## 2. 分类结果（54 类，逐类可查）

| 类别 | 数量 | 含义 |
| --- | --- | --- |
| **supported** | **12** | 已接入并映射到能力（见下表） |
| base | 16 | 抽象/基类/旧版基底（Plot/CategoryPlot/XYPlot/VanChartPlot 等，非能力） |
| **unsupported** | **26** | 核心 jar 里存在、本管线未接入的具体图族，逐类写明原因 |

### supported（12）↔ 能力 ↔ IR 词表

| jar 类 | 能力 |
| --- | --- |
| com.fr.chart.chartattr.Bar2DPlot | chart.bar |
| com.fr.chart.chartattr.PiePlot | chart.pie |
| com.fr.chart.chartattr.LinePlot | chart.line |
| com.fr.plugin.chart.PiePlot4VanChart | chart.vpie |
| com.fr.plugin.chart.column.VanChartColumnPlot | chart.vbar |
| com.fr.plugin.chart.line.VanChartLinePlot | chart.vline |
| com.fr.plugin.chart.area.VanChartAreaPlot | chart.varea |
| com.fr.plugin.chart.scatter.VanChartScatterPlot | chart.vscatter |
| com.fr.plugin.chart.bubble.VanChartBubblePlot | chart.vbubble |
| com.fr.plugin.chart.gauge.VanChartGaugePlot | chart.vgauge |
| com.fr.plugin.chart.map.VanChartMapPlot | chart.vmap |
| com.fr.plugin.chart.heatmap.VanChartHeatMapPlot | chart.vheatmap |

机器断言：`Ir.capabilities().chart` 的 12 个 kind（legacy 3 + van 9）**逐一**有 engine_class_map 精确条目、类在 supported 清单、且在 jar inventory 可解析——词表与引擎类面 1:1 对上。

### unsupported（26）— 核心 jar 存在但未接入的图族

按族归纳（每类原因见 JSON）：3D 族（Area3D/Bar3D/Pie3D/Donut3D）、环形图（Donut2D/Donut）、漏斗（Funnel/VanChartFunnel）、甘特（Gantt/VanChartGantt）、雷达（Radar/VanChartRadar）、仪表盘 legacy 变体（Meter/MeterBlue/SimpleMeter）、股价/K 线（Stock）、区间图（Range legacy）、GIS 地图（GisMap，区别于 vmap 的 VanChartMap）、自定义/组合（Custom/VanChartCustom）、钻取地图（DrillMap）、多层饼（MultiPie）、结构图（Structure）、树图（TreeMap）、词云（WordCloud）。

这些**不在**能力账本的 agentAvailable 承诺内；它们现在是"有账可查的未接入面"，不是盲区。

## 3. 与层间一致性门的关系

- `fast_layer_coherence`：账本 73 项 / 承诺 52 项，I1/I2/jar 锚定不变量全绿（能力→类→jar）。
- `fast_jar_surface`（新）：54 个绘图类必须**全部有定性**（unclassified/stale 为空）；supported 12 类与 IR 词表 12 kinds 互相对上；unsupported 每类有原因。
- 两层一起回答"全过程是否协调"：能力承诺（Agent 面）→ 词表（IR/Spec）→ 对象构造（Object）→ 序列化（CPT）→ jar 物理类面，均能双向追溯。

## 4. 诚实边界

- 本分析只覆盖**图表绘图层（Plot）**；Attr/Condition/Definition 等装饰与数据定义类尚未逐类建账（能力账本已对 28 个 chart 装饰能力做四层与 jar 锚定，但未做"jar 全部 Attr 类 vs 能力"的全量分类）。
- unsupported 的 26 类"未接入"是事实，不代表"永不接入"；接入需按九层流程（探针→Object→CPT→IR→Spec→Planner→Agent→E2E→账本）。
- 扫描根不含付费插件 jar；付费 FVS 扩展图族仍按 coverage.md 既定口径不追。
