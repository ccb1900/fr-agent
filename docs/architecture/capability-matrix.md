# fr-agent 能力矩阵与建设路线图（2026-11-06）

> **五层模型与原生能力库存**：`docs/architecture/native-capability-inventory.md`（Engine / CPT+Object / IR / ReportSpec+Planner / Agent 五层差集；A=Object已有IR缺、B=IR已有Agent无入口、C=Object部分、D=Engine未接 四份清单）。**本矩阵只回答"已接入能力的成熟度与优先级"，不回答"FR 还有多少能力没开放"。**
> 目的：回答"优先补齐哪些能力，才能最大程度提升 Agent 独立创建真实报表的成功率"，而不是"补哪个功能看起来高级"。
> 方法：六维评分 → 四优先级 → 全项目七源对账 → 两项排序（补齐现有 / 新增）→ 前三项（第一实施，后两待办）。
> **证据规则**：每行状态必须有可查证据（IR 键+行号 / Object 代码 / CPT 断言 / 引擎 PNG / Agent runId）；**不从文件存在或 README 声明推断**。
> 七源：① coverage.md（demo 类/tag 盘点）② capability_manifest.js（60 项四层+scope）③ lib/ir.js CAPABILITIES/validate ④ lib/object.js 构造 ⑤ lib/cpt.js + 引擎产物 ⑥ 官方 demo 240 + 生产参考 CPT ⑦ Agent 链路（plan/capability.js/patch）。

## 0. 评分维度与优先级定义

| 维度 | 取值依据 |
|---|---|
| 业务价值 | 真实生产/统计报表是否依赖它出结果 |
| 使用频率 | 240 官方 demo 与生产参考中的出现频次（可量化） |
| 表达缺口 | IR 是否**完全无法表达**（键缺失/结构化拒），而非"实现不完整" |
| 实现成熟度 | FR 原生是否有成熟类（引擎可行性已证） |
| 闭环成本 | IR→Object→CPT→渲染→回归 需要多少改动 |
| Agent 价值 | 是否直接决定 plan/create/modify 能否产出正确报表 |

| 优先级 | 定义 |
|---|---|
| **P0** | 基础表达能力——缺失会导致大量普通报表无法正确生成 |
| **P1** | 高频业务能力——常见生产/统计报表需要 |
| **P2** | 复杂表达能力——高级图表、特殊布局、交互 |
| **P3** | 低频特殊能力——有需求时再实现 |

## 1. 能力矩阵（六领域，状态=证据实证）

状态记号：`✓` 已验证（有可查证据）｜`~` 部分/仅序列化/仅族级｜`✗` 缺失或无表达键｜`—` 不适用。

### 1.1 单元格与布局

| 能力 | IR | Object | CPT | 引擎渲染 | Agent 可用 | 优先级 | 证据 |
|---|---|---|---|---|---|---|---|
| 合并列（colSpan） | ✓ `span` | ✓ setColumnSpan | ✓ | ✓ | ✓ | P0 | ir.js:544；object.js:302；demo `cs>1` **5757 处** |
| **cells 多行合并表头（rowSpan）** | ✓ `rowSpan`（正整数闸） | ✓ setRowSpan | ✓ `rs="2"` | ✓ PNG 合并渲染 | **部分**（spec 可表达=presentation.cells 无绝对 r 的 rowSpan item；plan→create 无 rowSpan 证据 → manifest agentAvailable=false） | **P0** | R3-0：ir.js 整数闸+块内重叠静态拒+ds+rowSpan 拒（C2）；object 游标含 rowSpan+重叠兜底；载体 test_merge_header + test_rowspan_cases；部署 cpt `rs="2"`×2/`cs="2"`×1；PNG 实拍。**使用该能力 103/240 demo 文件（42.9%），1364 个单元格** |
| header block 原生多层表头 | ✗ 单层 columns | — | — | — | ✗ | P1 | ir.js:8 `header{columns[],heightPt}` 仍单层；当前多层表头只能走 cells + r 坐标（上方已收） |
| 边框/背景/字体/对齐 | ✓ `st` | ✓ | ✓ | ✓ | ✓ | P0 | 全量生产报表；AGENTS §2 排版红线 |
| 行高/列宽 | ✓ | ✓ | ✓ | ✓ | ✓ | P0 | ir.js heightsPt/widthsPt |
| 隐藏行列 | ✓ `hideRows/hideCols` | ✓ setRowHeight/setColumnWidth(FU 0) | ✓ | ✓ PNG 实拍 | ✓ `sheet.hideRows/hideCols` | P2→完成 | C2（2026-11-06）：IR 整数闸 + object sheet 构建末归零 + spec 直通；rawIR/spec 双载体 RowHeight/ColumnWidth=0，表头行与列消失 |
| 冻结（引擎侧重复表头） | ✓ | ✓ | ✓ | ✓ | ✓ | P1 | manifest `page.repeatHeaderRow` verified |
| 冻结（web 端） | pending | — | — | — | ✗ | P2 | manifest `page.freezeWeb` pending（240 demo 零语料） |
| 条件格式（8 族） | ✓ | ✓ | ✓ | ✓ | ✓ | P0 | manifest condition.* 全 verified；README #71 PNG |
| 公式（SUM/AVG/MAX/MIN/COUNT/round/row/col） | ✓ 白名单 | ✓ | ✓ | ✓ | ✓ | P0 | ir.js CAPABILITIES.formula；golden 完成率 |
| 公式（SUMPRODUCT/VLOOKUP/IFERROR…） | ✗ 白名单外 | — | — | 引擎 InterpreterError（实测） | ✗ | P2 | ir.js formula.unsupported（README 迭代4 实测） |
| 多层表头（header 块多行） | ✗ header 单层 | 需 rowSpan 键 | ✓ | ✓ | ✗ | P1 | ir.js:8 `header{columns[],heightPt}` |
| 斜线表头 | ✓ corner | ✓ BiasTextPainter | ✓ | ✓ | ✓ | P3 | object.js:724 |
| 富文本/HTML/水印/浮动 | ✓ extras | ✓ | ✓ | ✓ | ✓ | P1 | manifest richtext/html/watermark/float |

### 1.2 数据与计算

| 能力 | IR | Object | CPT | 引擎渲染 | Agent 可用 | 优先级 | 证据 |
|---|---|---|---|---|---|---|---|
| 内嵌数据集（rows） | ✓ | ✓ | ✓ | ✓ | ✓ | P0 | 全部 spec |
| SQL 数据集 | ✓ | ✓ | ✓ | ✓ | ✓ | P0 | manifest spec.sql.* verified；golden 33531/26531 |
| filters / sort / topN | ✓ | ✓ | ✓ | ✓ | ✓ | P0 | README #62 live |
| 分组小计（funcgroup + total sum） | ✓ | ✓ | ✓ | ✓ | ✓ | P0 | manifest；README #33 |
| **合计行 avg/ratio/count（非 sum 聚合）** | ~~✗~~ **✓ aggregate.fn=sum\|avg\|count\|min\|max\|ratio**（#122） | ✓ 公式映射 | ✓ | ✓ PNG（total_agg 60.0/2/35、total_ratio 1.14） | ✓（spec total.aggregate/sumCols[].fn） | **P1→完成** | README #122/#124；manifest spec.rows.totalAgg |
| 跨数据集关联（join/映射） | ✗ | ✗ | ✗ | — | UNSUPPORTED_CROSS_TABLE | P2 | capability.js（跨表拒） |
| SQL 层计算字段/派生列 | ✗ | — | — | 引擎支持 | — | P2 | 无 IR 键 |
| 参数面板（rawIR 路） | ✓ 13 控件 | ✓ | ✓ | ✓（面板） | 部分 | P1 | ir.js param 全 supported；v4.2 载体 |
| **参数面板（ReportSpec/plan 路）** | ~~✗~~ **✓ params[]→IR.param widgets**（B2） | ✓ | ✓ 序列化 | 面板属 web 静态 PNG 不现形（serialization-only 口径） | ✓（结构链路） | **P1→完成** | README #118；manifest spec.params.panel |
| ReportSpec 静默丢弃（footnote/sort/topN/dateRange） | ~~✗~~ **已消**（B1：footnote rows 路发射；sort/topN/dateRange/filters rows 路结构化拒，C1 dataset 键白名单兜底） | — | — | — | ✓ | **P1→完成** | README #118；spec_validator C1 白名单 |
| 运行期日期/机台筛选闭环 | ✗（v1 明确不做，编译期字面量） | — | — | — | ✗ | P2 | README #62；golden-e2e-case §6.2 |
| 字典（custom/tableData/formula） | ✓ | ✓ | ✓ | ✓ | ✓ | P1 | manifest dict 族 |
| 字典（Database/DynamicSQL） | pending | — | — | — | ✗ | P3 | manifest spec.dataset.databaseDict |
| 反向读取既有 CPT（reverseFromCpt） | ✗ unsupported | — | — | — | ✗ | P3 | ir.js dataset.reverseFromCpt |

### 1.3 图表

| 能力 | IR | Object | CPT | 引擎渲染 | Agent 可用 | 优先级 | 证据 |
|---|---|---|---|---|---|---|---|
| legacy bar/pie/line | ✓ | ✓ | ✓ | ✓ | ✓ | P1 | manifest chart.bar/pie/line |
| Van 7 图（vbar/vline/varea/vscatter/vbubble/vpie/vgauge） | ✓ | ✓ | ✓ | ✓ | ✓ | P1 | test_vanchart 11 块 PNG |
| 装饰（tooltip/label/stack/条件色/趋势线/轴） | ✓ 多数 | ✓ | ✓ | ✓/`~` 分层 | ✓/✗ | P1 | manifest（3 项 pending：seriesBorder/areaFill/seriesImage） |
| 组合图（多 plot/双轴） | ✗ | ✗ | ✗ | **构造/序列化已证、渲染未达成（D1 第4轮，2026-11-06）** | ✗ | P2（D1 blocked） | 官方 柱形图变形.cpt 同构；线系列无头不可见（官方 demo 同）；重开条件=可运行系列分配语料；probes/probe_combo_sql_carrier.js + logs/d1_combo* |
| 地图 vmap | ✓ mapType=area\|point（line/custom 拒） | ✓ | ✓ | ✓ PNG（区域着色/散点标记） | ✗（无省份数据源/无 plan→create e2e → agentAvailable=false） | P2→完成（area/point） | D2：test_vmap/test_vmap_point 载体；manifest chart.vmap |
| 热力图 heatmap | ✗ | ✗ | ✗ | 引擎支持 | ✗ | P3 | manifest pending |
| 雷达/漏斗/词云 | ✗ | ✗ | ✗ | 部分原生 | ✗ | P3 | 无 IR 键 |
| 图表单元格热链（ChartHyperRelateCellLink） | ✗ | ✗ | ✗ | — | ✗ | P3 | manifest chart.hyperlinkCell pending |

### 1.4 交互

| 能力 | IR | Object | CPT | 引擎渲染 | Agent 可用 | 优先级 | 证据 |
|---|---|---|---|---|---|---|---|
| 参数控件 13 种 | ✓ | ✓ | ✓ | ✓ | ✓ | P1 | ir.js param；v4.2 |
| 超链/钻取（reportlet/parameter js） | ✓ | ✓ | ✓ | serialization-only | ✓ | P1 | manifest condition.then.link / hyperlink |
| 过滤联动（控件驱动数据集） | ✗（br 族专有，spec 路无） | — | — | ✓ | ✗ | P2 | browser 族 br_* 不迁移（r22 裁定） |
| 分页（SQL page/size） | ✓ | ✓ | ✓ | ✓ | ✓ | P1 | README #62；SQL 分页唯一抗大表 |
| 点击排序（cell.sort/SortHeader） | rejected | — | — | — | ✗ | P3 | ir.js:522 结构化拒（缺语料） |
| 条件显隐/内嵌控件注入 | ✓ | ✓ | ✓ | serialization-only | ✓ | P2 | manifest condition.then.widget |

### 1.5 报表工程

| 能力 | IR | Object | CPT | 引擎渲染 | Agent 可用 | 优先级 | 证据 |
|---|---|---|---|---|---|---|---|
| CPT 创建（create） | ✓ | ✓ | ✓ | ✓ | ✓ | P0 | Golden e2e `ge20261106150630-a8693e` |
| 局部修改（patch 2 op） | ✓ | ✓ | ✓ | ✓ | ✓ | P0 | template/patch.js:34/43；modify diffClean |
| patch 其余 op（样式/行列增删） | rejected | — | — | — | ✗ | P2 | README #60 R0 探针不过，明确不做 |
| 多 Sheet | ✓ 多 sheet IR | ✓ 每 sheet 独立游标 | ✓ 两个 `<Report>` | ✓ PNG 两页 | ✓ `extraSheets[]`（rows）+ planner | 完成（rows） | A1+多Sheet spec+e2e（2026-11-06，C4 口径拆分）：载体 test_multisheet 与 multisheet.json 真引擎 failures=0、PNG 汇总/明细两页；e2e=结构链路（plan→plan2spec→create 保留 extraSheets/params+cpt 结构），不证明逐格/第二 Sheet 视觉/隐藏行列；SQL extra 待后续批。manifest page.multiSheet agentAvailable=true |
| 模板继承 / 样式复用 | ✗ 无键 | — | — | 引擎支持 | ✗ | P3 | ir.js 零命中 |
| 页眉页脚 | ✓ | ✓ | ✓ | ✓ | ✓ | P1 | manifest page.headerFooter verified |
| 模板级 marks（theme/id） | ✓ | ✓ | ✓ | ✓ | ✓ | P2 | manifest page.templateMarks |
| 导出 PNG/PDF | ✓ | ✓ | ✓ | ✓ | ✓ | P0 | preview/e2e |
| 绝对布局（WAbsoluteLayout） | ✗ 无键 | — | — | 引擎支持 | ✗ | P3 | 3D翘曲有 5 处 BoundsWidget |

### 1.6 Agent 能力

| 能力 | 状态 | 证据 | 优先级 |
|---|---|---|---|
| 需求理解 plan 三态（ready/ambiguous/rejected） | ✓ | README #82 三态实测；fast_planner 52 断言 | P0 |
| 语义对齐 SemanticPreflight + 术语归一 | ✓ | plan.js；README #82 | P0 |
| 能力发现 discover（含 manifest + 名单） | ~ 声明非闸门 | 审计 §4 类别5：全仓无执行消费者 | P1 |
| IR 规划 plan2spec | ~ I1 仅 table+sum+rows | capability.js:18-19；SQL/chart 走 I5 | P1 |
| 错误诊断 RunResult 11 段 | ✓ | runresult.js；负门 5 路 | P1 |
| 视觉检查 preview | ~ 仅 PNG 非空/墨量 | e2e preview 步 | P1 |
| 自动修改复验 modify（diffClean/原件保留） | ✓ | Golden e2e modify 步 | P1 |
| **ReportSpec 条件高亮（plan 路）** | ~~✗~~ **✓**（B1：presentation.conditions→IR detail.conditions；hl_conditions 载体 PNG） | README #118；manifest spec.rows.conditions | **P1→完成** |
| planner 能力墙阻断性 | ~~仅 warning 不阻断~~ **✓ deferred/rejected 聚合指标累计阻断**（C6：blockedMetrics>0 → rejected，不静默少指标） | planner.js rows 分支；fast_planner C6 断言（先红后绿） | **P1→完成（C6，2026-11-06）** |

## 2. 六维评分与优先级（关键项）

| 能力 | 业务价值 | 频率 | 表达缺口 | FR 成熟度 | 闭环成本 | Agent 价值 | 优先级 |
|---|---|---|---|---|---|---|---|
| cells 多行合并表头 | 高 | **极高**（103/240 文件 42.9%，1364 单元格） | 已收（R3-0 修复游标） | 高（setRowSpan 原生） | **低**（IR 键+传参+游标） | 高 | **P0** |
| ReportSpec 参数面板 | 高 | 高（真实报表几乎必有筛选） | 完全缺失（spec 无 param） | 高（IR 13 控件已收） | 中（spec_compiler+载体+渲染） | 高 | **P1** |
| 合计行非 sum 聚合（avg/ratio/count） | 高 | 高（完成率/合格率/平均） | **已收（2026-11-06）**：IR aggregate.fn=sum|avg|count|min|max|ratio + sumCols[].fn | 高（公式 AVERAGE/COUNT/MIN/MAX；ratio=SUM/SUM） | 中（object 公式映射+2 载体） | 高 | **P1→完成** |
| 跨数据集关联 | 中高 | 中（分析报表） | 完全缺失 | 中（SQL 本身可 join） | 高（新语义+校验+执行） | 中 | P2 |
| 组合图/双轴 | 中 | 中 | 完全缺失 | 中高 | 中高 | 中 | P2 |
| 地图 vmap | 中 | 低中 | **已接 area+point（D2）** | ✓ VanChartMapPlot+VanMapDefinition | 中（10 参绑定+geo 参数） | 低中 | **P2→完成（area/point）** |
| 多 Sheet | 中 | 低 | ~~rejected~~ 已收（rows 路 extraSheets） | 高 | 高 | 低 | P2→完成（rows；SQL extra 待后续批） |
| VLOOKUP/SUMPRODUCT | 中 | 中 | 引擎不支持 | **无**（实测 InterpreterError） | 极高（需自定义函数注册） | 中 | P3 |
| Poly/块面、填报 DML、Verifier | 低 | 极低 | 缺失 | 部分 | 高 | 低 | P3 |

## 3. 两项排序

### 3.1 补齐现有（部分实现但闭环不完整）
1. ~~**合计行非 sum 聚合**（fn 仅 sum，引擎支持 avg/ratio/count）——P1~~ 已完成（2026-11-06）
2. ~~**ReportSpec 参数面板**~~——P1→完成（B2+#140，2026-11-06）
3. chart.seriesBorder / seriesImage / vpie summary 视觉验证（manifest pending）——P3，价值低
4. write.submit（DML 真提交）、page.freezeWeb、spec.dataset.databaseDict——P3
5. chartDeco 深水区剩余（tooltip 格式件视觉）——P3

### 3.2 新增（当前完全无法表达且业务价值高）
1. ~~**合并行/多层表头（cells rowSpan）**~~——P0→IR/渲染已收（R3-0）；plan→create 证据缺（agentAvailable=false）
2. **跨数据集关联**——P2，成本高
3. 组合图/双轴——P2
4. 地图/热力——P2/P3
5. 隐藏行列、绝对布局、模板继承——P2/P3

## 4. 前三项与实施顺序

| 序 | 能力 | 优先级 | 验收标准 |
|---|---|---|---|
| **1（本轮已实施 + R3-0 收尾）** | **cells 多行合并表头（rowSpan）** | **P0** | ✅ 游标含 rowSpan（不再覆盖合并区）；IR 整数闸 + 块内重叠静态拒；7 场景断言（含零/负/小数拒、r 拒、单行零回归）；真引擎 `rs="2"`×2 + PNG（副表头落在合并区下方）；fast15/负门5路/铁证 CBEB42E3；**Agent 可用=部分**（spec 可表达=presentation.cells rowSpan item；plan→create 证据缺 → agentAvailable=false，C5 口径） |
| 2（~~待办~~ **已实施 B1**） | **ReportSpec 条件高亮通路 + 静默丢弃修复** | P1 | ✅ presentation.conditions→IR detail.conditions；footnote 发射、sort/topN/dateRange/filters 结构化拒（C1 白名单兜底）；hl_conditions 载体 PNG；README #118 |
| 3（**已实施 2026-11-06**） | **ReportSpec 参数面板 + 执行期筛选** | P1 | ✅ param 控件族（B2）+ `params[].filter` → IR.param.filters；param_filter 载体默认值 A线 → PNG 只渲染 A线 行；部署 cpt 参数面板 + 条件；fast 断言 |
| 4（**已实施 2026-11-06**） | 合计行非 sum 聚合（avg/ratio/count/min/max + ratio） | P1 | ✅ IR aggregate.fn 白名单 + sumCols[].fn；载体 test_total_agg（PNG 合计 60.0/2/35）与 test_total_ratio（PNG 1.14）；部署 cpt 公式 =AVERAGE/=COUNT/=MIN/=SUM/SUM；fast 断言 + scan57 |

**明确不做（本轮及下轮）**：vmap 已接（area+point，D2）~~/ poly / heatmap~~ / VLOOKUP / 跨表关联 / 绝对布局——poly/heatmap/VLOOKUP/跨表/绝对布局要么成本高、要么频率低、要么引擎墙，排序在 P2/P3，不进入前三；D1 组合图 blocked（第4轮结论）。多 Sheet 已完成 rows 路 spec/planner 入口+结构链路 e2e（SQL extra 待后续批）。

## 5. 实施记录（第一项：cells 多行合并表头）

### 5.1 初版（9cabf84）
- `lib/ir.js` cells item 加 `rowSpan` 白名单；`lib/object.js` cells 分支传 `it.rowSpan`（putCell spanR）+ 多行游标/逐行行高；载体 `reports/test_merge_header.js`。

### 5.2 R3-0 收尾（外部审查 P1 修复）
- **P1 复现**：初版游标只按显式 `r` 计算——`rowSpan=2` 且后续 item 无 `r` 时块只推进 1 行，下一 block 落到合并区上。实测载体 cpt：`r1 c0`（rowSpan 合并格）**整格丢失**，`r2 c0` 被副表头占据（覆盖丢失，比重叠更严重）。
- **修复**：cells 块占用行数 = `max(r 相对偏移 + rowSpan - 1)`；新增块内区域重叠检测（object 绝对行兜底，`r` 倒退/重叠即抛结构化错误）。
- **IR 收紧**：`rowSpan`/`span` 正整数、`r` 非负整数（拒 0/负/小数）；cells 块内「显式 r 之间」「无 r 同行之间」区域重叠 → `DUPLICATE` 结构化拒；混合形态由 object 兜底。
- **回归用例**：`verify/fast_ir_contract.js` +10 条（rowSpan=2 无 r 零误报 / rowSpan=3+r 混合零误报 / 0·-1·1.5 拒 / r=-1·2.5 拒 / 显式 r 重叠拒 / 同行同列重复拒 / 单行零回归）；`reports/test_rowspan_cases.js` 真引擎载体（修复后 `r1 c0 rs="2"` + `r3 c0` 副表头 + detail r4 起，PNG 目检无重叠）。
- **门**：scan 53+1；fast 15 GREEN；负门 5 路 GREEN；默认铁证 `CBEB42E3` 逐字节。

### 5.3 口径修正（外部审查）
- `cells` 多行合并表头与 `header` block 原生多层表头**拆为两行**（后者仍 ✗ 单层）。
- rowSpan 的 **Agent 可用改为「部分」**（2026-11-06 C5 口径：spec 经 presentation.cells 可表达 rowSpan item——probe 实证编译+Ir.validate 零误报；rawIR 载体不能证明 plan→create 链路 → manifest agentAvailable=false）。
- 频率口径：从「rs>1 单元格 1364」改为「**103/240 demo 文件（42.9%）使用，1364 个单元格**」——文件数是需求覆盖面，单元格数是使用密度。
