# 非付费能力闭环清单（2026-11-08 起，用户："付费之外的能力全部闭环，未闭环不得停止"）

> 定义：**闭环 = 构造 → 序列化 → 真实渲染/交互 → Agent plan→create 证据 → 账本状态一致**，五态标注不混写。
> 注意：图种"闭环"指上述四段证据成立；**产品版式**（SQL 路图区偏小、图例截断）列为 P2 独立项（§4.1），不以图种闭环掩盖。
> 付费排除口径：FVS bigScreen 14 包 / `com.fr.extended.chart.*` / 移动端；不实现、不排期。
> 当前基线：81 项账本 / 60 项 Agent 可用 / jar 面 54 Plot 类（20 supported、19 base、15 unsupported=11 图族）。
> 进度以本文件与 `docs/night-shift-log.md` 为准；每完成一项更新状态并做一次独立审查。

## 1. 图族闭环（11 个待办，按可行性排序）

| # | 图族 | 类 | 官方语料 | 数据绑定形态 | 状态 |
|---|---|---|---|---|---|
| 1 | 雷达 radar | VanChartRadarPlot | doc/NewRadarChart 24 | MoreNameCDDefinition | **DONE（chart.vradar，agentAvailable；runId=radar_e2e_001）** |
| 2 | 漏斗 funnel | VanChartFunnelPlot | doc/FunnelPlot 5 | OneValueCDDefinition(seriesName,valueName) | **DONE（chart.vfunnel，agentAvailable；runId=funnel_e2e_001）** |
| 3 | 箱线 box | VanChartBoxPlot | doc 3 | VanBoxTableDefinition detailed | **DONE（chart.vbox，单系列 scope；runId=box_e2e_001）** |
| 4 | 多层饼 multipie | VanChartMultiPiePlot | doc 5 | 待探针 | 待做 |
| 5 | 树图 treemap | VanChartTreeMapPlot | doc 2 | 待探针 | 待做 |
| 6 | 词云 wordcloud | VanChartWordCloudPlot | doc 3 | 待探针 | 待做 |
| 7 | 结构图 structure | VanChartStructurePlot | doc 6 | 待探针 | 待做 |
| 8 | 钻取地图 drillmap | VanChartDrillMapPlot | doc 12 | 待探针 | 待做 |
| 9 | 甘特 gantt | VanChartGanttPlot | doc 15 | 待探针（起止/分类） | 待做 |
| 10 | 组合图 custom | VanChartCustomPlot | doc/demo 36 | D1 已证构造/序列化，线系列渲染未达成（README #105） | 阻塞（需官方条件块语料） |
| 11 | 3D 族 | Area3D/Bar3D/Pie3D/Donut3D | 0（legacy） | Chart+MoreName | **DONE（chart.bar3d/pie3d/area3d/donut3d；runId 各 _e2e_002）** |
| 12 | 环形 donut | Donut2D/Donut | 0（legacy） | Chart+MoreName | **DONE（chart.donut，多环形态；runId=donut_e2e_003）** |
| 13 | 仪表 meter | Meter/MeterBlue/SimpleMeter | 0（legacy） | 待探针 | 待做 |
| 14 | 区间 range | RangePlot | 0（legacy） | 待探针 | 待做 |
| 15 | 股价 stock | StockPlot | 0（legacy） | 待探针 | 待做 |
| 16 | GIS 地图 | GisMapPlot | 0（legacy） | 待探针（区别于 vmap） | 待做 |

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