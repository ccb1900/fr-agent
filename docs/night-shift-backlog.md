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

## 阶段2 挂账（2026-11-07，外部 34-commit 审查 P3 未修项——如实分级，不冒充高优）

### P3-A：图表 kind 词表多处手同步
- 证据：CHART_KINDS 在 lib/spec_validator.js:34 与 lib/ir.js:358 各一份（report_spec.js capabilities 串第三处文案）；spec_validator 已单向依赖 ReportSpec（`hasOwn(ReportSpec.AGGREGATIONS…)`），可由 report_spec.js 导出 CHART_KINDS 去重一份；lib/ir.js 受红线保护不反向依赖。
- 验收：spec_validator 引 ReportSpec.CHART_KINDS、fast16 绿、scan 零误伤。
- 优先级：P3（每次新图表 kind 三处手改是真实维护成本，但无正确性影响——词表漏项由各层 INVALID_ENUM 拒）。

### P3-B：object.js 公式 '=' 规范化 6 处重复
- 证据：lib/object.js:114/1051/1247/1344/1386/1581 各自 `charAt(0) === '='`；可提 formulaOf(f) 单点。零行为差异机械重构，改后必跑默认 spec+61 spec scan 双 byte-gate。
- 优先级：P3（维护成本真实但低频；回归面成本≈收益）。

### P3-C：fast 套件样板 16 份
- 证据：verify/fast_*.js 各自复制 J/Files/check/src 前导 ~15 行；可抽 verify/_fast_lib.js。
- 优先级：P3/P4（改门禁面文件需全 16 套件复跑验证；收益=样板收缩）。

### truthy 缺省（b.bold !== false 类）
- 判定：**不修**——「缺省=开」是 TABLE_DESIGN_STANDARD 既定版式语义，改动=行为变化；审查项按缺陷报，实测为口径分歧，留档不 action。

## P2: regression.js 扩展位移映射（模板格→执行栅格坐标）
- 真实证据（2026-11-07 阶段3 任务⑤真跑）：总计行公式 =C4*100/B4→=AVERAGE(D3) 被执行回归拒「未预期单元格变动 r=12 c=3」——明细块扩展 10 行后，模板 r3 总计/模板 r5 脚注在执行栅格落 r12/r14，patch_main 的 changedCells 用模板坐标屏蔽对不上。此前所有真测（golden/C 段）只改过 r0（无位移），该盲区首次被真实业务任务踩中。
- 用户影响：patch 链对明细块之后格（总计行/脚注）的公式与文本修改一律被保守拒绝——合法修改无法落地（误拒方向，非误放；fail-closed 未破）。
- 修改范围：template/patch_main.js（changedCells 构造时按 before.rows 与模板静态行数推位移）或 regression.js masked() 增加值语义屏蔽面；裁决语义不变（只扩"预期变化"的定位精度，不放宽守恒面）。
- 验收标准：fast 层反例断言（模板 r3 公式 op → 屏蔽命中扩展位）+ 真引擎载体（生产日报总计行公式修改 promote 全绿）；回归器对未授权格变化的拒绝行为不回归。
- 外部依赖：无。

- 2026-11-07 阶段3 3.2-3 进展（本项继续开放）：中间防线已落——regression.js masked() 增加数据集值池屏蔽面（新值 ∈ PatchSpec op.rows 扁平池才视为数据区格变化，模板坐标口径不变，fast_template 3 钉钉住）；但扩展区位移映射（模板 r3 总计 → 执行栅格 r12）仍未定案，dataset 替换下执行栅格行/列数变化维持保守拒绝。验收标准不变：fast 层位移屏蔽断言 + 真引擎总计行公式修改 promote 全绿 + 拒绝行为不回归。

### P2: create 链产物视觉/数据缺陷清单（2026-11-07 审查方 PNG 人工过目发现——基线既有，非 3.1/3.2 交付面引入）
- 证据（审查方全分辨率裁剪核对+真值栅格对拍）：
  ① plan 链产物（生产日报图C/生产日报GOLDEN）全表无内边框，完成数与完成率相邻粘连可误读成一个数（真值栅格 2854|67.34 均在，视觉可读成 285467.34）；对照钉基线 销售明细_api.png 版式完全合格有全内边框——违反 AGENTS §2「表格必须有内边框（2026-10-27 口径）」红线。
  ② C1/C2 直建链合计行计划数总计被吞：真值栅格即「合计|合计|合计|424」「合计|合计|374」，计划数总计 470/404 不在栅格——README #71 v2 总分列须放最右同族（total.label span=n−1，两度量列时中列被吞）。
  ③ golden 总计行机台列='0'（文本列被数值聚合，真值栅格自带该形态）。
  ④ C1 脚注文案「计划数低于 60 的行红底高亮」与实际行为不符（实际=格级 <60 黄底；高亮色 16638754=#FDE322 与夹具一致，行为符合 README #71 引擎事实）——夹具 verify/fixtures/c_maturity/c1_params_hl.json 脚注文本自身不准确。
- 用户影响：①粘连影响数字可读性（数据呈现正确性）；②合计行缺一个总计值（报表数据面缺项）；③④语义/文案瑕疵。
- 修改范围：①create 链边框/列宽生成（对照 TABLE_DESIGN_STANDARD 落地检查清单）；②C1/C2 夹具 spec 总分列布局（夹具级最小改）或 totalCol 引擎面核查；③golden intent 总计行文本列聚合口径；④夹具脚注一行文本。
- 验收标准：①渲染 PNG 全内边框+相邻数字列可分辨（像素核对）；②真值栅格含计划数总计且与 spec 数值一致；③机台列显示非 '0'；④脚注文案与实际高亮行为一致。改后 run-c-maturity-e2e 全绿+渲染 PNG 人工过目。
- 优先级：P2（①②影响数据可读/完整性；③④文案级）。外部依赖：无（①可能涉及 create 链版式方向，按 AGENTS 一次一方向开工）。

### P3: regression.js 值池屏蔽单侧加固（观察级，defense-in-depth 已兜底）
- 证据：patch_main.js 只传 datasetValues（新值池）；TemplatePatch.apply 的 before.dataset（template/patch.js:58）只回 {name,rowCount,cols} 不带原值行——旧值池不可得，「非数据格被改写为恰在值池内的值」单看执行回归会放行。
- 现有兜底：diff.js plain 侧严格守恒（3.2-2）使任何未申报格文本变化→diffClean=false→promote 拒——defense-in-depth 成立，非红灯。
- 修改范围：patch.js replace_dataset 前用 datasetSnapshot 抓旧值行塞入 before.dataset.rows；patch_main 传 datasetValuesBefore。
- 验收标准：fast_template 新钉（新值不在新池、旧值不在旧池的变化→FAIL；恰落双池的值→按既有口径屏蔽）+ 真链 replace_dataset 全绿不回归。

- 2026-11-07 收口轮进展（位移映射 P2 项）：单行数据块位移规律已真引擎探针确认（probes/probe_coord_map_expand.js，n=3：块上位移 0、数据块起点恒为模板块行、块下 grid_row = template_row + (N − k)，k=1=模板数据块行数；N=10 的 +9 复现阶段3任务⑤单点观察）；多行数据块/合并单元格/列位移仍未测——解锁行数回归需先泛化规律并按反例先行变更，保守拒绝维持（S7b 不变）。

### ~~P1×2: 部署事务状态机收口（外部评审 fb16935 轮，2026-11-07）~~（完成 2026-11-07，commit 见 night-shift-log）
- 证据①：agent/tools/_deploy.ps1 Add-DeployStateEvent 用 -ErrorAction SilentlyContinue 吞掉 deploy_state.jsonl 写失败——PREPARED 写失败后仍继续 File.Replace，进程在 COMMITTED/promote.json 前退出则崩溃恢复保证失效（磁盘满/权限/占用均可触发）。
- 证据②：fr_agent.ps1 promote 入口 RUNID_EXISTS 只看 promote.json 是否存在；替换成功但后续验证失败的 promote.json(ok=false) 同时堵死同 RunId 重试与 restore（RESTORE_NO_PROMOTE 要求 ok===true），与 PREPARED/COMMITTED 恢复机制冲突。
- 完成：`Add-DeployStateEvent` 写失败即抛（PREPARED 失败=换件前终止，COMMITTED 失败=显式 ok=false 未完成态）；deploy_state.jsonl 五态（PREPARED/SWAPPED/COMMITTED/FAILED_BEFORE_SWAP/FAILED_AFTER_SWAP）；promote/restore 的 RunId 登记改由**已提交产物**认领（ok=false 放行重入、门与 Mutex 内同规、引擎 verbs 不变），重试/restore 按 deploy_state 记录+实际部署件 SHA-256 裁决；restore 新增 undo 未提交换件路径（须 PREPARED promote 记录证据，restore.json 记 undoUncommittedPromote=1，矩阵 D8 钉「证据闸」）；持久化口径如实声明（进程崩溃恢复、非断电级）。
- 验收达成：反例矩阵逐例先红后绿（改前实测 8 红：D1/D2/D3/D5/D6/D7/X5×2；改后 40/40 全 PASS，既有 30 例零回归）；静态门 failures=0；集成门全链 GREEN（failures=0 skips=0，含 S9d 矩阵）；真实 E2E PASS（ale20261107174522-03410d）；三铁证 MD5 不变（CBEB42E3…/6161F402…/A8EF39AB…）。

### 主线转向：报表能力覆盖扩张（评审 2026-11-07 定调，状态机收口后为主工作）
- 证据：评审明确「不能让项目最后变成部署安全做得很好、但只会创建几种固定报表的工具」；8 任务验证暴露 ③日期筛选 ④多Sheet修改 ⑤公式坐标映射 ⑥热力图接入 四类修改能力缺口；coverage missing 清单持续可用。
- 修改范围：按 coverage/inventory 缺口，依「真引擎探针→Object→CPT→IR→ReportSpec→Planner→Agent E2E」分层接线；优先服务「创建+修改」两条产品路径的能力（修改路径当前明显弱于创建路径）。
- 验收标准：每能力五态如实（Engine/Object/CPT/IR/ReportSpec/Planner/Agent/E2E 逐层），agentAvailable 按真实链路证据；每项反例先行+载体 PNG/CPT；门禁全绿；不为接线而虚高账本。
- 优先级：P1（产品主线）。外部依赖：无（F8 写库/凭据仍需用户授权，维持不做）。

### P3: vpie 标签/汇总渲染未达成（2026-11-08 升级为序列化墙）
- 真实证据：test_vanchart vpie 臂配置 `label {enable:true, position:2, summary:{format}}` → 真引擎 PNG 饼图无任何标签文字；2026-11-08 四次挂载实验（命名 ConditionAttr+ListCondition / 类目条件 CATEGORY_INDEX / ConditionCollection DefaultAttr（官方 基础饼图.cpt 挂法）/ position 0）PNG 目检均无标签。官方语料一手：`PieCategoryLabelContent` 用于 `gaugeValueLabel`（仪表值标签）；饼图 labelDetail 内容是 `AttrTooltipContent` + value/percent/category/series format 开关（活对象反射一手 probe_labelcontent_api）。
- **2026-11-08 后续两次实现尝试均失败**：⑤新建 AttrTooltipContent 挂 value/percent/category → cpt 导出期 CHART SERIALIZED 门失败（`<O t="CC">` 缺失，ChartCollection 整体被丢）⑥复用 detail 自带 content 只翻转 percent（补 CoreDecimalFormat）→ 同样失败。结论：本版 headless 构建对 AttrTooltipContent 的 writeXML 不可用——**这是序列化/引擎墙，不是接线问题**；实现代码已回滚。
- **2026-11-08 第三次复核（隔离实验，关键）**：同代码 vbar + label.percent 开关 → CHART SERIALIZED 通过（AttrTooltipContent 类路径本身可用）；vpie 三条路线（复用 content+percent / 显式 new content / 官方 richText `${SERIES}:${PERCENT}`）均 CHART SERIALIZED 失败 → **墙在 vpie 的 label content 写路径**（非类本身、非挂载：命名 ConditionAttr 与官方条件属性4 同构仍失败）。代码再次回滚。
- 用户影响：饼图无法展示分类/数值/百分比标签；`label.summary` 当前"写了不生效"（仅序列化）。
- 修改范围（若未来版本解锁）：以 AttrTooltipContent 开关重实现并 PNG 实证；在此之前 `label.summary` 应改为 IR 明确拒（避免写了不生效）——需一次专门小批（含负例与载体），本轮未做以免半成品。
- 验收标准：新载体 vpie label（percent/value 开关）真引擎 PNG 目检文字可见且 cpt 保留 ChartCollection；`label.summary` 要么渲染达成要么 IR 明确拒；fast/scan/基线全绿。
- 外部依赖：无。优先级：P3（视觉低价值，不阻塞产品主线）。

### P2: 无头 Tomcat（frserver）下内嵌数据图表不渲染——官方语料同样（环境调查，非我们的序列化缺陷）
- 真实证据（logs/webverify/evidence.md + rows_chart_web_blank.png）：frserver 8705 + 浏览器登录后打开 `能力自检_rows图表_api.cpt`——表格正常、图表 canvas 300×150 painted=0；**同一服务器打开官方 `demo/chart/ColumnChart/国旗柱形图.cpt`（内嵌数据）同样 canvas 空白**；SQL 路 G3 柱图正常。官方与本项目内嵌图序列化形状同为 `MoreNameCDDefinition + NameTableData + ChartSummaryColumn NoneFunction`；Van 改 SumFunction 实验 web 仍空白且 headless 只显示单类目 → 已回滚。
- 用户影响：仅影响"用 frserver 无头 Tomcat 自建 web 预览"场景；生产 FineReport 服务器（designer 内置/标准部署）未验证。不是本项目产物缺陷（官方 corpus 同样表现）。
- 修改范围：调查该 Tomcat 部署是否缺少 designer-server 设置（系统属性/插件资源/会话缓存）导致内嵌图 web 数据链路不可用；若确认为部署差异，文档写明用 frserver 验证图表 web 的局限。
- 验收标准：至少给出官方 cpt 在该部署下空白的归因（缺什么属性/资源）或改用官方宿主复现；不把环境限制当产物缺陷。
- 外部依赖：无。优先级：P2（环境/验证基建，不阻塞产品链路）。

### P3: 超链（ReportletHyperlink）web 点击行为未验证（2026-11-08）
- 真实证据：销售明细_超链_api.cpt 的 hyperlink 序列化与官方 比例信息查询.cpt 同构（NameJavaScriptGroup→ReportletHyperlink→fineagent/销售明细_api.cpt，产品列 c2 r2）；web 端三次点击（getByText/JS el.click/坐标 cua.click）均未导航，无新标签/URL 变化；同期工具栏按钮可见（说明 DOM 交互面正常）。
- 用户影响：超链在 web 预览中是否能点开尚未证实；不宣称支持也不宣称损坏。
- 修改范围：判断 decision 视图/无头部署是否限制 hyperlink，或在生产 FR 服务器复验；必要时对齐官方 hyperlink 的 Features/target 配置。
- 验收标准：web 点击后新报表打开（URL/tab 可验证）或明确环境归因。
- 外部依赖：无。优先级：P3。
