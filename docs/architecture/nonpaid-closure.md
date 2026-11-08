# 非付费能力闭环清单（2026-11-08 起，用户："付费之外的能力全部闭环，未闭环不得停止"）

> 定义：**闭环 = 构造 → 序列化 → 真实渲染/交互 → Agent plan→create 证据 → 账本状态一致**，五态标注不混写。
> 注意：图种"闭环"指上述四段证据成立；**产品版式**（SQL 路图区偏小、图例截断）列为 P2 独立项（§4.1），不以图种闭环掩盖。
> 付费排除口径：FVS bigScreen 14 包 / `com.fr.extended.chart.*` / 移动端；不实现、不排期。
> 当前基线：84 项账本 / 63 项 Agent 可用 / jar 面 54 Plot 类（23 supported、19 base、12 unsupported=8 图族）。
> 进度以本文件与 `docs/night-shift-log.md` 为准；每完成一项更新状态并做一次独立审查。

## 1. 图族闭环（8 个待办，按可行性排序）

| # | 图族 | 类 | 官方语料 | 数据绑定形态 | 状态 |
|---|---|---|---|---|---|
| 1 | 雷达 radar | VanChartRadarPlot | doc/NewRadarChart 24 | MoreNameCDDefinition | **DONE（chart.vradar，agentAvailable；runId=radar_e2e_001）** |
| 2 | 漏斗 funnel | VanChartFunnelPlot | doc/FunnelPlot 5 | OneValueCDDefinition(seriesName,valueName) | **DONE（chart.vfunnel，agentAvailable；runId=funnel_e2e_001）** |
| 3 | 箱线 box | VanChartBoxPlot | doc 3 | VanBoxTableDefinition detailed | **DONE（chart.vbox，单系列 scope；runId=box_e2e_001）** |
| 4 | 多层饼 multipie | VanChartMultiPiePlot | doc 5 | MultiPieValueDefinition(levels) | **DONE（chart.vmultipie；runId=multipie_e2e_004）** |
| 5 | 树图 treemap | VanChartTreeMapPlot | doc 2 | MultiPieValueDefinition(levels)；carrier `reports/test_treemap.js` | **serialization-only**（真引擎 EXE PASS；顶层 169 块可渲染，嵌套子块=web 层，见 §6.4） |
| 6 | 词云 wordcloud | VanChartWordCloudPlot | doc 3 | WordCloudTableDefinition(wordName/wordValue) | **DONE（chart.vwordcloud；runId=wordcloud_e2e_002）** |
| 7 | 结构图 structure | VanChartStructurePlot | doc 6 | StructureTableDefinition(nodeId/parentId/nodeName/nodeValue) | **DONE（chart.vstructure；rows runId=structure_rows_002；官方默认不显示节点名，只承诺层级）** |
| 8 | 钻取地图 drillmap | VanChartDrillMapPlot | doc 12 | DrillMapDefinition(bg+layers)+setGeoUrl；carrier `probes/probe_drillmap_carrier.js` | **serialization-only**（execute PASS、渲染 blank=web div 层，见 §6.3） |
| 9 | 甘特 gantt | VanChartGanttPlot | doc 15 | **一手探出**：VanGanttDefinition(data=VanGanttTableDefinition firstProcess/series/start/end + linkTable + TimeAxis/ProcessAxis + processList)；**三轮 rawIR 试错**：①NPE（无 geoUrl/axis 类）→ 加 TimeAxis/ProcessAxis 修复 NPE → execute PASS → ②无 rawIR 词表 → IR 补 → ③渲染「图形没有数据」= web 渲染需 div 层（与 drillmap 一致） | **serialization-only**（与 tooltip/hyperlink 等 web 交互相责统一口径） | |
| 10 | 组合图 custom | VanChartCustomPlot | doc/Combination 10 | CustomDefinition.setDefinitionProviderMap（CustomPlotType enum 键 → VanChartMoreNameCDDefinition）+ CustomPlotList[VanChartColumnPlot, VanChartLinePlot] | **DONE（chart.vcombo；column/line/area/bubble(数值x)/pie + stacked；5 carrier 真引擎 + rows runId=combo_rows_002/combo_stack_rows_001；D1 墙破）** |
| 11 | 3D 族 | Area3D/Bar3D/Pie3D/Donut3D | 0（legacy） | Chart+MoreName（3D）；Donut3D 走 OneValue | **DONE（chart.bar3d/pie3d/area3d `_e2e_002`；donut3d 见环形行 `_e2e_003`）** |
| 12 | 环形 donut | Donut2D/Donut | 0（legacy） | Chart+OneValue（每系列一环） | **DONE（chart.donut/donut3d，多环形态；runIds=donut_e2e_003/donut3d_e2e_003）** |
| 13 | 仪表 meter | MeterPlot/SimpleMeterPlot/MeterBluePlot | 0（legacy） | MeterTableDefinition(name/value/targetValue/meterType/custom) | **DONE（chart.meter，单 needle 80 PNG；多 needle 重叠为官方多值不解决）；主题变体 MeterBlue/SimpleMeter=wired+renders 80（carrier test_meter_blue/simple），但静态 PNG 带 share 徽标/默认单位占位 → rendering pending、不承诺** |
| 14 | 区间 range | RangePlot | 0（legacy） | ScatterTableDefinition(低/高)+setFilterDefinition；carrier `reports/test_range.js` | **DONE（chart.range；PNG 4 区间带+图例；官方 0 语料，样式未手调）** |
| 15 | 股价 stock | StockPlot | 0（legacy） | StockTableDefinition(OHLC; StockLabel 不换文本) | **DONE（chart.stock；rows runId=stock_rows_001；官方 0 语料，形态=裸 K 柱）** |
| 16 | GIS 地图 | GisMapPlot | 0（legacy） | probe `probes/probe_gismap.js` 一手：GisMapTableDefinition(setAddress/addressName/addressType/lnglatOrder/addTittleValue)；carrier `reports/test_gismap.js` | **serialization-only**（静态 PNG=引擎内置 `gisMap.png` 固定示例图；单点 vs 三点像素恒等 → 数据不参与静态渲染，真地图需 web+key/网络） |

> 注：legacy Funnel/Gantt/Custom 类与其 Van 族合并；legacy RadarPlot 已归 base（当前族由 vradar 覆盖）。

## 2. 能力账本 21 项未承诺

| 类别 | 数量 | 项 | 闭环定义 |
|---|---|---|---|
| webInteraction | 12 | chart.tooltip / hotTooltip / effect / hyperlinkCell / mapTooltipFormat / mapTooltip；condition.then.link / widget；write.structure / toolbarButtons / editorReg；spec.params.panel | web 端真实交互验证（浏览器像素/DOM）；静态 PNG 不可见=官方同规则时记为 serialization-only 并给官方语料证据 |
| unverifiedRendering | 2 | chart.bubbleAttr（shadow）、spec.rows.cells（非 rich 形态） | 静态 PNG / web canvas 至少一种真实渲染证据 |
| notImplemented | 4 | write.submit（需 F8 写库授权）、page.freezeWeb、cell.poly、spec.dataset.databaseDict（需凭据注入） | 实现 + 真实引擎/交互验证；write.submit/databaseDict 需用户显式授权 |
| rejected | 3 | write.verifiers、cell.sort、template.patch.style | **已闭环（明确不做 + 理由入账）**，无需实现 |

## 3. coverage partial=21 的再分类（待做，先把假 partial 清掉）

- **版本包名差异 10 类**（First/Previous/Next/Last/PageNavi/Export/Print/FlashPrint/Email/TemplateIdAttrMark）：引擎新类已支持，功能非缺 → 应标 full/alias。
- **axis 实例配置 4 类**（VanChartValueAxis/VanChartAxis/ValueAxis/CategoryAxis）：公共 axis setter 已支持，非构造缺口 → 应标 full/usage。
- **VerifyItem 5 次**：write.verifiers 已 rejected → 标 rejected。
- **DatabaseDictionary/DynamicSQLDict**：凭据未授权 → pending（非 partial）。
- **真正 partial**：ObjectCondition（数据集级过滤）、AttrLabelDetail（content 深水）、VanChartCustomPlot（组合图渲染）、SimpleDateFormatThreadSafe（日期/文本格式待核）→ 逐项验收。
- 目标：coverage 的 partial 从 21 降到只含真实缺口；任何"假 partial"不得留在账上充数。

## 4. 每项验收模板（九层）

1. 官方语料一手结构（cpt XML/活对象反射）。
2. Object 构造 + CPT 序列化（部署 cpt 关键标签断言）。
3. 真引擎 PNG 目检（非空、图形/数据可辨；空白门 PASS）。
4. IR/ReportSpec 词表 + spec 编译零误报。
5. Planner 合同（plan ready 且发射路径含该能力）。
6. Agent plan→plan2spec→create→validate（SQL/rows 真值不变）。
7. manifest 四层 + engine_class_map + jar inventory 锚定。
8. jar 面分类更新（supported/legacy 归位），fast_jar_surface GREEN。
9. 默认基线 CBEB42E3 + fast 19 + scan + 引擎负门；文档/README/日志同步。

## 4.1 已知产品边界（审查发现，不阻塞图种闭环但需后续处理）

- **SQL 路图表格子偏小/图例截断**：`生产日报*_api.png` 中图区约 180-280px 宽，图例出现 `plann...`/日期截断；旧图同样存在（非本批引入）。根因疑为 SQL 路 chart cell 固定布局/页面分页，待专项 P2。
- **box 多系列无 spec 入口**：rawIR 3 箱 carrier 有，ReportSpec `presentation.chart` 无 `values` 键；Agent scope=单 value 列（每 category 一箱）。
- **donut 经典单环分段**：当前 Donut2D/Donut3D 为多环（每系列一环），经典单环分段未承诺。
- **golden 全生命周期**：本批图种用 plan→plan2spec→create→validate 链路；golden（含 preview/modify/promote/restore）需在收尾重跑并回填新 runId。

## 5. 独立审查协议（每次停止前）

- 审查人（子 agent 或自审清单）只读：`git diff`、`docs/night-shift-log.md`、本文件、门输出。
- 审查问题：①有没有把未验证写成已闭环？②付费项有没有被排期？③账本数字与门输出是否一致？④基线/门是否真跑过？⑤下一项是否可直续？
- 审查不通过 → 回到对应项继续，不得以"已记录"代替闭环。
## 6.3 drillmap 二轮结果（2026-11-08）
- 找到 NPE 根因：pl 需 `setGeoUrl`（引擎 map 解析无 map◤ 源就 NPE）→ 加上后 **execute 一次通过**；render 输出 uniqueColors=2（空白），即 **chardata 可建/引擎可跑/setGeoUrl 需要，但**底层 map 图不含区县图层**。
- 结论：drillmap 定义结构已建成（`DrillMapDefinition(bg+layers)` + `setFromBottomData(false)/setBottomDataDefinition/setEachLayerDataDefinitionList`），但地图渲染需要 web 端 div/layer init。**serialization-only** 与 tooltip/hyperlink 等 web 交互相责统一口径。

## 6.4 剩余 5 图族当前状态汇总（2026-11-08 本轮探针后）

| 图族 | 一手证据源 | 当前阻塞点 | 下一步 |
|---|---|---|---|
| drillmap | 官方 XML + `probe_chartdata_builder` | `execute` 已通（加 `setGeoUrl` 后），但渲染 blank（web div 层） | **serialization-only**（与 tooltip/hyperlink 口径一致） |
| gantt | `probe_gantt_official` 读官方对象图 | `reports/test_gantt.js` 真引擎 EXE PASS（firstProcess/processList/linkTable/TimeAxis/ProcessAxis 全序列化） | **serialization-only**（PNG「图形没有数据」=web div 层） |
| treemap | 官方 XML=`MultiPieValueDefinition(levelCount=2)`（与 vmultipie 同型） | `reports/test_treemap.js` 真引擎 EXE PASS；顶层 blocks 渲染，嵌套子块未出（web 层） | **serialization-only**（TreeMapIndependentVanChart 存在） |
| custom | 官方 doc/Chart/Combination/柱形-折线组合图.cpt + `probes/probe_custom_surface.js` | DefinitionProviderMap 键必须 CustomPlotType enum（String 键导出 ClassCastException）；旧 D1 缺分键→线不渲染 | **DONE column\|line（chart.vcombo）；其他组合样式未承诺** |
| GIS | `probes/probe_gismap.js` + carrier `reports/test_gismap.js` | 构造/序列化 PASS；静态渲染=内置 gisMap.png 固定示例图（数据不参与） | **serialization-only**（真地图需 web+百度/谷歌 key/网络，外部依赖未授权） |
