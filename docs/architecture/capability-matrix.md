# fr-agent 能力矩阵与建设路线图（2026-11-06）

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
| **合并行（rowSpan）/多层表头** | **✓ 已收** `rowSpan` | ✓ setRowSpan | ✓ `rs="2"` | ✓ PNG 合并渲染 | ✓ | **P0** | 本轮实施：ir.js:545 白名单 + object.js cells 分支传 spanR/多行游标/行高；载体 `reports/test_merge_header.js`；部署 cpt `rs="2"`×2 + `cs="2"`×1；PNG 实拍（生产线/良率跨两行、生产情况跨两列）；demo 原频次 `rs>1` 1364/`cs>1` 5757 |
| 边框/背景/字体/对齐 | ✓ `st` | ✓ | ✓ | ✓ | ✓ | P0 | 全量生产报表；AGENTS §2 排版红线 |
| 行高/列宽 | ✓ | ✓ | ✓ | ✓ | ✓ | P0 | ir.js heightsPt/widthsPt |
| 隐藏行列 | **✗ 无键** | 待查 | — | — | ✗ | P2 | ir.js 零命中 hidden |
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
| **合计行 avg/ratio/count（非 sum 聚合）** | **✗ aggregate.fn 仅 sum** | 硬编码 =SUM | — | 引擎支持 | planner deferred | **P1** | ir.js:454 注释；capability.js:9-12 |
| 跨数据集关联（join/映射） | ✗ | ✗ | ✗ | — | UNSUPPORTED_CROSS_TABLE | P2 | capability.js（跨表拒） |
| SQL 层计算字段/派生列 | ✗ | — | — | 引擎支持 | — | P2 | 无 IR 键 |
| 参数面板（rawIR 路） | ✓ 13 控件 | ✓ | ✓ | ✓（面板） | 部分 | P1 | ir.js param 全 supported；v4.2 载体 |
| **参数面板（ReportSpec/plan 路）** | **✗ spec_compiler 零 param** | — | — | — | ✗ | **P1** | spec_compiler.js 无 param；golden 用编译期 dateRange |
| ReportSpec 静默丢弃（footnote/sort/topN/dateRange） | ✗ rows 路不检查不消费 | — | — | — | ✗ | **P1** | 独立取证：footnote 过校验（spec_validator:33-35）但 rows 编译器从不发射（spec_compiler:146-161）；rows 只取 rows（:160）→ **假成功风险** |
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
| 组合图（多 plot/双轴） | ✗ | ✗ | ✗ | 引擎支持 | ✗ | P2 | coverage 漏账判定"显式排期" |
| 地图 vmap | ✗ | ✗ | ✗ | **✓ 引擎已证** | ✗ | P2 | probe_r4m19 官方 mapfather.cpt 无头实拍 |
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
| 多 Sheet | rejected | — | — | 引擎支持 | ✗ | P2 | ir.js:469 UNSUPPORTED_CAPABILITY |
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
| **ReportSpec 条件高亮（plan 路）** | ✗ detail 硬写 `conditions:null` | spec_compiler.js:149；golden 需求"<80% 高亮"只能 rawIR 手写 | **P1** |
| planner 能力墙阻断性 | ~ deferred 仅 warning 不阻断（spec 仍 ready） | capability.js:10-12 + planner.js:127 → 可能"成功"产出少东西的报表 | P1 |

## 2. 六维评分与优先级（关键项）

| 能力 | 业务价值 | 频率 | 表达缺口 | FR 成熟度 | 闭环成本 | Agent 价值 | 优先级 |
|---|---|---|---|---|---|---|---|
| 合并行/多层表头 | 高 | **极高**（rs 1364/cs 5757） | **完全缺失**（IR 无键） | 高（setRowSpan 已备） | **低**（仅 IR 键+传参） | 高 | **P0** |
| ReportSpec 参数面板 | 高 | 高（真实报表几乎必有筛选） | 完全缺失（spec 无 param） | 高（IR 13 控件已收） | 中（spec_compiler+载体+渲染） | 高 | **P1** |
| 合计行非 sum 聚合（avg/ratio/count） | 高 | 高（完成率/合格率/平均） | 完全缺失（fn 仅 sum） | 高（引擎 AVERAGE 等） | 中（fn 白名单+object 构造+真值） | 高 | **P1** |
| 跨数据集关联 | 中高 | 中（分析报表） | 完全缺失 | 中（SQL 本身可 join） | 高（新语义+校验+执行） | 中 | P2 |
| 组合图/双轴 | 中 | 中 | 完全缺失 | 中高 | 中高 | 中 | P2 |
| 地图 vmap | 中 | 低中 | 完全缺失 | 已证（m19） | 中高 | 低中 | P2 |
| 多 Sheet | 中 | 低 | rejected | 高 | 高 | 低 | P2 |
| VLOOKUP/SUMPRODUCT | 中 | 中 | 引擎不支持 | **无**（实测 InterpreterError） | 极高（需自定义函数注册） | 中 | P3 |
| Poly/块面、填报 DML、Verifier | 低 | 极低 | 缺失 | 部分 | 高 | 低 | P3 |

## 3. 两项排序

### 3.1 补齐现有（部分实现但闭环不完整）
1. **合计行非 sum 聚合**（fn 仅 sum，引擎支持 avg/ratio/count）——P1，最高该项
2. **ReportSpec 参数面板**（IR 有 13 控件，spec 编译层零 param）——P1
3. chart.seriesBorder / seriesImage / vpie summary 视觉验证（manifest pending）——P3，价值低
4. write.submit（DML 真提交）、page.freezeWeb、spec.dataset.databaseDict——P3
5. chartDeco 深水区剩余（tooltip 格式件视觉）——P3

### 3.2 新增（当前完全无法表达且业务价值高）
1. **合并行/多层表头（cells rowSpan）**——P0，成本最低、频率最高
2. **跨数据集关联**——P2，成本高
3. 组合图/双轴——P2
4. 地图/热力——P2/P3
5. 隐藏行列、绝对布局、模板继承——P2/P3

## 4. 前三项与实施顺序

| 序 | 能力 | 优先级 | 验收标准 |
|---|---|---|---|
| **1（本轮已实施）** | **合并行/多层表头（IR cells rowSpan）** | **P0** | ✅ ir.js:545 白名单；object.js cells 分支传 spanR + 多行游标/行高；载体 `reports/test_merge_header.js` scan 过；部署 cpt `rs="2"`×2 + `cs="2"`×1；PNG 合并渲染实拍；fast15/负门5路/铁证 CBEB42E3 |
| 2（待办） | **ReportSpec 条件高亮通路 + 静默丢弃修复** | P1 | plan 路 detail 可表达 conditions；footnote/sort/topN 不再静默丢（或结构化拒）；载体+PNG 真值；golden 需求"<80% 高亮"可由 plan 直达 |
| 3（待办） | **ReportSpec 参数面板 + 执行期筛选** | P1 | spec 可表达 param 控件族；plan→create 产出带参数面板 cpt；执行期传参筛选真值对拍 |
| 4（待办） | 合计行非 sum 聚合（avg/ratio/count） | P1 | IR aggregate.fn 白名单扩展；合计行 PNG 真值对拍 |

**明确不做（本轮及下轮）**：vmap / poly / heatmap / 多 Sheet / VLOOKUP / 跨表关联 / 绝对布局——它们要么成本高、要么频率低、要么引擎墙，排序在 P2/P3，不进入前三。

## 5. 实施记录（第一项：合并行/多层表头）

- **改动面**：`lib/ir.js:545`（cells item 白名单加 `rowSpan`，numOpt 类型闸）；`lib/object.js` cells 分支（putCell 第 6 参传 `it.rowSpan`；块内按 `item.r` 计算 maxR，逐行补设行高；块后游标按 maxR+1 推进；单行形态行为不变）。
- **载体**：`reports/test_merge_header.js`（title → 双层表头 cells：生产线/良率 rowSpan=2、生产情况 span=2 → detail 4 列 → total）。
- **CPT 序列化实证**：部署件 `能力自检_合并表头_api.cpt` 含 `rs="2"`×2（生产线/良率）+ `cs="2"`×1（生产情况）+ `cs="4"`×1（标题）。
- **渲染实证**：PNG 目检——生产线/良率纵向跨两行居中、生产情况横向跨"计划/完成"两列、数据行 4 列对齐、合计 3600。
- **门**：scan 52+1；fast 15 GREEN；负门 5 路 GREEN；默认铁证 `CBEB42E3` 逐字节（载体轮后默认 spec 回补）。
- **回归面**：既有 cells 块均无 `r` 键（maxR=0 → 游标推进 1），全量 scan 52 张零误伤。
