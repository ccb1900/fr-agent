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

## 能力矩阵路线图（2026-11-06，docs/architecture/capability-matrix.md）

### R3-1（P1，下一项候选）：ReportSpec 条件高亮通路 + 静默丢弃修复
- 证据：`lib/spec_compiler.js:149` detail 硬写 `conditions:null/highlight:null` → plan/create 路无法交付"<80% 高亮"（golden 需求原句就有）；`spec_validator:33-35` footnote 过校验但 rows 编译器从不发射（`spec_compiler:146-161`）；rows 路 sort/topN/dateRange/filters 不检查不消费。
- 验收：plan 路可表达 conditions；footnote/sort/topN 不再静默丢（实现或结构化拒）；载体+PNG 真值；golden 同需求可由 plan 直达。

### R3-2（P1）：ReportSpec 参数面板 + 执行期筛选
- 证据：`spec_compiler.js` 零 param（IR 有 13 控件族，rawIR 可用；JSON 路无通路）；golden 用编译期 dateRange 字面量。
- 验收：spec 可表达 param 控件族；plan→create 产出带参数面板 cpt；执行期传参筛选真值对拍。

### R3-3（P1）：合计行非 sum 聚合（avg/ratio/count）
- 证据：`lib/ir.js:454` aggregate.fn 仅 sum（object 硬编码 =SUM）；planner `capability.js:9-12` avg/count/ratio deferred（且仅 warning 不阻断）。
- 验收：IR aggregate.fn 白名单扩展；Object 构造对应 FR 聚合；合计行 PNG 真值对拍。

### R3-4（P1）：planner deferred 阻断性
- 证据：`capability.js:10-12` deferred 只写 warning 不阻断，spec 仍 ready（`planner.js:127`）→ Agent 可能"成功"产出少东西的报表。
- 验收：deferred 进入 unresolvedQuestions 或明确降级告知；fast_planner 断言。
