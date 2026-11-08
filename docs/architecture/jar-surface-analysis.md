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
| **supported** | **15** | 已接入并映射到能力（见下表；2026-11-08 新增 vradar/vfunnel/vbox） |
| base | 18 | 抽象/基类/旧版基底（Plot/CategoryPlot/XYPlot/VanChartPlot 等，非能力；含已由 Van 当前族覆盖的 RadarPlot/FunnelPlot legacy） |
| **unsupported** | **21** | 核心 jar 里存在、本管线未接入的具体图族，逐类写明原因（合并后 **13 个当前图族**） |

**license/family 两个正交维度（2026-11-08 加账，机器门强制）**：

| 维度 | 分布 | 含义 |
| --- | --- | --- |
| license | basic 54 / paid 0 / unknown 0 | 54 类全部只在 `fine-report-engine-11.0.jar`；与付费 FVS/extended/mobile 插件 jar 零交集 |
| family | current 15 / base 16 / legacy 16 / van 7 | supported 15=current；base 16 抽象基类 + 2 legacy concrete(base)；unsupported 21=legacy 14 + van 7 |

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
| com.fr.plugin.chart.radar.VanChartRadarPlot | chart.vradar |
| com.fr.plugin.chart.funnel.VanChartFunnelPlot | chart.vfunnel |
| com.fr.plugin.chart.box.VanChartBoxPlot | chart.vbox |

机器断言：`Ir.capabilities().chart` 的 15 个 kind（legacy 3 + van 12）**逐一**有 engine_class_map 精确条目、类在 supported 清单、且在 jar inventory 可解析——词表与引擎类面 1:1 对上。

### unsupported（22 类 = 14 个当前图族）— 核心 jar 存在但未接入

**7 个 Van 当前族（有官方 `doc/Chart` 语料，非付费插件）**：custom/组合（36）、drillmap（12）、gantt（15）、multipie（5）、structure（6）、treemap（2）、wordcloud（3）。

**14 个 legacy 类（官方 1684 张 cpt 语料零命中；旧引擎实现，部分与 Van 族同族）**：3D 族（Area3D/Bar3D/Pie3D/Donut3D）、环形图（Donut2D/Donut）、甘特 legacy（Gantt）、GIS 地图（GisMap，区别于 vmap 的 VanChartMap）、仪表盘 legacy 变体（Meter/MeterBlue/SimpleMeter）、区间图（Range）、股价/K 线（Stock）、自定义 legacy（Custom）。雷达 legacy（RadarPlot）与漏斗 legacy（FunnelPlot）已归 base——当前族分别由 `chart.vradar`/`chart.vfunnel` 覆盖。

按**当前用户可见图族**合并：3D、环形、甘特、GIS 地图、仪表盘、区间、股价、自定义/组合、钻取地图、多层饼、结构图、树图、词云 = **13 个未接图族**。它们**不在**能力账本的 agentAvailable 承诺内；现在是"有账可查的未接入面"，不是盲区。

### 付费口径审计（回答"付费内容不做"）

- 政策（coverage.md 2026-11-05 终口径）：基本授权可做；额外收费不做（FVS 大屏 14 包、`com.fr.extended.chart.*`、移动端）。
- 机器证据：54 类全部只在核心 `fine-report-engine-11.0.jar`；逐类在**全部**安装 jar（含 `WEB-INF/plugins`）里定位，26 个 unsupported 无一出现在 `plugin-com.fr.plugin.bigScreen.v11` / `com.fr.extended.chart.*` / 移动端 jar；扫描根本身也不含付费插件 jar。
- 机器门：`fast_jar_surface` 断言 ①扫描面无付费前缀类 ②每类有 license/family ③supported/unsupported 均不得标 `paid` ④账本带 paidPrefixes 政策。**"付费=排除"，不会作为"未来缺口"排期**。
- 诚实边界：core jar 内部的运行时 license gate 未独立审计；本口径按项目既定"付费=FVS/extended/mobile 插件族"执行。

## 3. 与层间一致性门的关系

- `fast_layer_coherence`：账本 73 项 / 承诺 52 项，I1/I2/jar 锚定不变量全绿（能力→类→jar）。
- `fast_jar_surface`（新）：54 个绘图类必须**全部有定性**（unclassified/stale 为空）；supported 12 类与 IR 词表 12 kinds 互相对上；unsupported 每类有原因。
- 两层一起回答"全过程是否协调"：能力承诺（Agent 面）→ 词表（IR/Spec）→ 对象构造（Object）→ 序列化（CPT）→ jar 物理类面，均能双向追溯。

## 4. 诚实边界（"付费之外都闭环了吗" = 没有）

- **归属闭环 ≠ 能力闭环**：账本 `unattributed=0` 只表示每个缺口都有归属/原因；不代表已实现。
- **未闭环的非付费面（2026-11-08 口径）**：
  1. **13 个图族 / 21 个 Plot 类未接入**（本文 §2；全部 core jar、license=basic、非付费）。
  2. **能力账本 21 项未承诺**：webInteraction 12（tooltip/hotTooltip/effect/hyperlinkCell/mapTooltip*、condition.then.link/widget、write.structure/toolbarButtons/editorReg、spec.params.panel——序列化在、web 交互未全验）；unverifiedRendering 2（chart.bubbleAttr 的 shadow、spec.rows.cells 的非 rich 形态）；notImplemented 4（write.submit 需 F8 授权、page.freezeWeb、cell.poly、spec.dataset.databaseDict 需凭据）；rejected 3（write.verifiers、cell.sort、template.patch.style，按设计明确不做）。
  3. **coverage partial=21 类**（demo 类级部分命中，如 ObjectCondition 数据集级过滤、axis 实例配置等）；noncore=44 为付费/移动端排除项，不计入。
- 本分析只覆盖**图表绘图层（Plot）**；Attr/Condition/Definition 等装饰与数据定义类尚未逐类建账（能力账本已对 28 个 chart 装饰能力做四层与 jar 锚定，但未做"jar 全部 Attr 类 vs 能力"的全量分类）。
- unsupported 的 21 类"未接入"是事实，不代表"永不接入"；接入需按九层流程（探针→Object→CPT→IR→Spec→Planner→Agent→E2E→账本）。
- 扫描根不含付费插件 jar；付费 FVS 扩展图族仍按 coverage.md 既定口径不追。
