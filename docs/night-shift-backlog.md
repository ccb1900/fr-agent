# Night Shift 待办（Backlog）

> 每项：优先级/真实问题证据/用户影响/预期修改范围/验收标准/外部依赖。完成即移除。不得把纯风格偏好包装成高优先级。

## 进行中（无；审查轮 2 四项收敛完成，见已完成/新待办）

### R2-1（P1）：IR/Object 契约两处静默丢（审查基准 f21cf94→dd27399）
- 证据：① `label.summary:true` 非 vpie 绕过校验（对象形态才被拒）；② legacy 无 legend 时 axisY 整块被 `(van||b.legend)` 跳过；连带 `title` 在 legacy ValueAxis.setTitle 实测不序列化、Van 专属 max/min/unit/alerts 对 legacy 无门槛。
- 验收：IR 负例（非 vpie summary:true/{format} 拒、vpie 两形态通过、legacy 公共轴键通过、Van 专属键 legacy 结构化拒）+ 真引擎回归（legacy 无 legend 部署 XML 落 FRFont/ShowAxisLabel、PNG 非空）+ 不重构图表后端。
- 状态：**已完成**（commit 见 night-shift-log §2026-11-06 09:20）。IR 9 断言真跑全绿（曾误置于 exit 之后造成假绿，已移回）+ legacy 真引擎部署 XML 落 FRFont/ShowAxisLabel + PNG 非空 + scan 49+1 零误伤（rebuild_first 既有 min/max 误伤当场修正）。

### R2-2（P2）：verify_sql_data 总计行五列新形态真实栅格回归
- 证据：d4a39f2 提交说明"引擎栅格冒烟未跑"；Golden E2E 独立真值验收器不能只靠静态核对关闭。
- 验收：`TRUTH_DAY_MACHINE=1 GRID=logs/agent/runs/g1/grid.txt` 10 行逐格+总计 33531/26531/79.1238 全绿；旧四列总计样例兼容分支不回归。
- 状态：**已完成**：`TRUTH_DAY_MACHINE=1 GRID=logs/agent/runs/g1/grid.txt` 10 行逐格+总计 33531/26531/79.1238 全绿；四列总计样例兼容分支零回归。

### ~~R3-0：rowSpan 正确性与能力证据修正~~（2026-11-06 完成）
- P1 复现属实：初版游标只按显式 r，`rowSpan=2`+无 r 时合并格被下一 block 整格覆盖丢失。修：块占用行数含 rowSpan + 块内重叠兜底；IR 整数闸（rowSpan/span 正整数、r 非负整数）+ 块内重叠 DUPLICATE 静态拒；fast_ir_contract +10 断言；test_rowspan_cases 真引擎载体（rs=2 正确落位、副表头在合并区下方）；矩阵口径修正（cells 合并 vs header 多层拆行、Agent 可用改待验证、频率改 103/240 文件）。
- 门：scan 53+1 / fast15 / 负门5路 / 铁证 CBEB42E3。

## 已完成（从待办移除的记录）

### ~~B1（P2-A）：SQL intent 中 ambiguous 术语应反问而非 rejected~~（2026-11-05 完成）
- 修复=planner sql 分支 memberCheck；fast_planner 6 断言先红后绿+真通道冒烟；commit 见 night-shift-log（candidate 与 in-flight 记录一并销项）。

### ~~B2（P2-D）：patch 失败后的状态可判定性~~（2026-11-05 完成，commit `e0ef1c4`）
- 走查 `template/patch.js`/`reader.js`/`inspector.js`/`diff.js` 失败路径结论：**fail-closed 良好，无 P0/P1，不改生产代码**——校验失败 manifest 不落盘 / 回归 FAIL 时 manifest 照写如实 / 原件 .orig 保留 / export 只进 staging（readCpt 拒绝对路径是 FineReport API 约束）/ 实查零残留。
- 双路径对拍候选否决：agent_daily_report 日期级 4 列无机台 vs GOLDEN day×machine 5 列，粒度不同设计使然。
- 本轮从"进行中"与"候选"两处重复条目一并移除（此前漂移）。

## 候选（外部依赖解锁后定级，夜间不擅动）

### B3：v2+ 解锁清单（机台筛选/TOP-N/图表/SQL 阈值修改）
- 外部依赖：审查方逐项点名解锁（r22 §6.2 约定）。

### B4：运行期日期参数（README #62 记档的架构取舍）
- 外部依赖：同 B3，属能力解锁范畴。

## 新待办（审查轮 2 点名，本轮不扩范围）

### ~~R2-3：换装后负门干净复跑~~（2026-11-06 完成）
- 证据：FineDateFormat 换装后的负门与后台跑批并发重叠（r18 同机互污场景），逐案 OK 可见、GREEN 终行未捕获。
- 验收达成：串行单实例全套门最后一段 `ENGINE NEG GATE GREEN (no false-green; default baseline intact)` + 默认 CBEB42E3 逐字节回补（与前轮后台并发重叠的未捕获终行区分）。

### R2-4：能力边界与视觉验证留账
- 证据：审查轮 2 分层——tooltip 格式/richText/hotTooltip/seriesBorder/areaFill/seriesImage/vpie summary 只有序列化证据；label/stack/conditionalSeries 四层 verified 仅限已验证形态，不能从单 carrier 推导全组合；axisX legacy 路径缺验证。
- 验收：按实况维持在 manifest 的 serialization-only/pending 分层；视觉验证逐项补 PNG 实拍再升层；不把"缺口归属清零(unattributed=0)"写成"能力缺口清零(missing=32)"。

### R2-5：vmap/poly/批F 写回/批D 凭据（原留账，顺序后延）
- 外部依赖：R2-1~R2-4 收敛后再启动；直续步骤见 docs/night-shift-log.md。

## 原生能力库存（2026-11-06，docs/architecture/native-capability-inventory.md）

### B 类（IR 已有、Agent 无入口）——**2026-11-06 收口：已清空（B1–B6 批 + R3-0/C2/C6 全部接入）**
- ~~R3-1 条件高亮 + 静默丢弃修复~~（完成 B1，README #118；hl_conditions 载体 PNG）
- ~~R3-2 参数面板 + 执行期筛选~~（完成 B2+#140；C3 口径：filter agentAvailable=false）
- ~~R3-5：cells 族进 ReportSpec~~（完成 B3：presentation.cells 直通 IR cells item 族，README #118）
- ~~R3-6：页眉页脚/水印/浮动/工具栏/纸型进 ReportSpec~~（完成 B4：sheet.headerFooter/floats/paper/watermark/toolbar）
- ~~R3-7：图表装饰族进 ReportSpec~~（完成 B5：CHART_KEYS 直通 IR chart 块）
- ~~R3-8：合计行 sumCols/groupCustom、编辑器 reg 进 ReportSpec~~（完成 B6 total.sumCols/aggregate 全词表；params[].reg；groupCustom 走 cells）
- 剩余 B 类边界：rowSpan 的 plan→create 证据（spec 可表达=presentation.cells item，agentAvailable=false）、多 filter AND（暂限 1）、多 Sheet SQL extra（显式拒）

### A 类（Object/CPT 已有、IR 缺/拒）
- ~~R3-9（P2 低成本）：多 Sheet~~（完成 A1+#127：extraSheets[] + planner 透传 + e2e 结构链路 #135）

### C 类（Object 部分/原生类未接）
- R3-10：TemplateInfoAttrMark（与已构造 Id/Theme 同族，低成本；探针裁定 cloud 插件类 noncore 不追）
- ~~R3-11：隐藏行列~~（完成 C2，README #116：IR+object+ReportSpec 三层 + 载体 PNG）

### D 类（Engine 支持未接）
- vmap：~~pending~~ 已接（D2 area+point，README #136/#138，agentAvailable=false）
- 热力图：~~pending~~ 已接（D2 vheatmap，2026-11-07，probe_heatmap R0+test_vheatmap 载体 PNG；agentAvailable=false）
- poly/热链：保持 pending 不接线（P2–P3）
- 组合图 D1：blocked（第4轮结论：构造/序列化同构、线系列无头不可见；重开条件=可运行系列分配语料）

## 能力矩阵路线图（2026-11-06，docs/architecture/capability-matrix.md）

### ~~R3-1（P1）：ReportSpec 条件高亮通路 + 静默丢弃修复~~（完成 B1，2026-11-06）
- 已完成：presentation.conditions→IR detail.conditions；footnote 发射、sort/topN/dateRange/filters 结构化拒（C1 dataset 键白名单兜底）；hl_conditions 载体 PNG；README #118。

### ~~R3-2（P1）：ReportSpec 参数面板 + 执行期筛选~~（完成 B2+#140，2026-11-06）
- 已完成：params 控件族+params[].filter→IR.param.filters；param_filter 载体默认值 A线 PNG 真值；C3 口径收紧（agentAvailable=false）。

### ~~R3-3（P1）：合计行非 sum 聚合（avg/ratio/count）~~（完成 #122/#124，2026-11-06）
- 已完成：IR aggregate.fn 全词表+sumCols[].fn；test_total_agg/test_total_ratio 载体 PNG 真值。

### ~~R3-4（P1）：planner deferred 阻断性~~（完成 C6 + B段复审扩展，2026-11-06/07 收口）
- 已完成：rows 分支 blockedMetrics + blockedFeatures 双累计阻断（deferred/rejected 聚合指标与被能力墙丢掉的 filters/chart → rejected，不静默少指标/少筛选/少图，a7be9f7）；sql 分支顶层 filters 未采纳同阻断；fast_planner 断言先红后绿。

## ~~B-审查1-1 manifest 补新能力行~~（完成 2026-11-06）
- 已完成：6 行入 manifest（sheet.hideRowsCols / cells.rowSpan / spec.rows.conditions / spec.rows.cells / spec.rows.sumCols / spec.params.panel），KEY_OF 同步；四层状态按证据如实（cells rendering=pending、params=serialization-only、rowSpan agentOverride=false）；fast_manifest_evidence 零 FAIL。

## B-审查3-1 schema 宽松镜像（P3，2026-11-06）
- 证据：schemas/report-spec.schema.json 的 if/then/else 只按 kind 分流，散点仍允许同时写 category/value、bar 仍允许 x/y（spec_validator 会拒）。
- 方向：schema 自declare spec_validator 为权威，宽松方向不产生假绿；若外部工具依赖 schema 严格性再收紧（additionalProperties/not）。
- 验收：schema 与 validator 双向一致性测试（可选）。

## ~~B-审查3-2 legacy pie/line + legend + barInterval 仍被 object 丢~~（完成 2026-11-06）
- 已完成：反射+部署 cpt 一手定案——真正落 XML 的宿主只有 vbar（legacy Bar2DPlot 有 setter 但 writer 不序列化）；IR 限 vbar，其余 kind 结构化拒；object 改为 setter 存在性守卫；载体 test_barinterval（vbar，categoryIntervalPercent=25.0 入 XML）；rebuild_first 移除从未生效的 legacy barInterval 伪键。

## ~~B-审查3-3 fast_report_spec 3 列 span 测试的 dataset.rows 仍 2 列~~（完成 2026-11-06）
- 已完成：rs3 mutator 内 dataset 改 { rows: [['A','X',1]] } 与 3 列一致；fast 15 rc=0。

## ~~B-复审B-1 REPORT_SPEC/SCHEMA_MODEL 路径无穿越钳制~~（完成 2026-11-07）
- 已完成：make_api.js assertLocalRel 入口单点（specPath 于 try 顶先于一切 load；modelPath 于 sql 分支），拒 `..`/绝对/反斜杠/盘符/控制符 → exit 2 + input_load failed + 诊断明示。**反例先行**：root 外 escape.js 经 `REPORT_SPEC=../fa_negtmp/escape.js` 被 load 并真实执行（marker 落盘实证）→ 修后同 probe 无 marker。负门新增第 6 路 spec-traverse（自带 escape 件+marker 反证+清理，`NEG GATE OK: outside-root JS not executed`）。runtime/paths.js（Runtime 冻结面）未动。

## ~~B-复审B-2 plan.js 模型路径与 make_api 分叉~~（完成 2026-11-07）
- 已完成：plan.js 模型加载改 `genv('SCHEMA_MODEL', 'models/production/model.json')`（genv 顶层函数声明 ES5 提升可用）；SCHEMA_MODEL 显式覆盖与缺省两态 plan verb 冒烟均 ready——plan/create 同源模型。

## ~~B-复审B-3 object.js 引擎互操作静默 catch~~（探针证据收口·关闭不 action，2026-11-07）
- 已完成：probes/probe_b3_catches.js 对六处守卫的可抛调用 17 个边界用例（createColumn null/''/123、setColumn(null)、setColumnName(null)、ZoomLevel.parseInt null/-1/2.5/99、MapMarkerType.COMMON、AttrLineStyle.setLineStyle(2)、ViewCenter.setLongitude(null/106.2)）**全部无抛出**——VERDICT: ALL-UNTRIGGERABLE（守卫面=类缺失/防御性边界，本引擎版本不可触达）。按纪律不盲改；探针入库可复跑（run.ps1 -Script probes/probe_b3_catches.js）。

## B-复审B-4 make_api 图表/超链断言只看 sheets[0]（P3，2026-11-07 B段审查）
- 证据：make_api.js:309/320 `(IR.sheets[0].blocks || [])` 找 link/chart 块——多 sheet 报表第二 sheet 的图表/超链不做序列化断言（test_multisheet 无图无链，未覆盖）。
- 用户影响：低（断言缺口非功能缺陷；多 sheet 图表能力本身未接 SQL extra）。
- 修改范围：断言循环改全 sheets；或等多 sheet 图表能力接线时一并补。
- 验收：多 sheet+图表载体真引擎轮断言命中第二 sheet 图表 XML。
