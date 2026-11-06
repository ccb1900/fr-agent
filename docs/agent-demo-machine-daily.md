# Agent 创作闭环演示（r10/r12 契约，机台生产日报）

> 目标（r7 §5 + r10-D）：验证"现成 Agent 从一句自然语言需求开始，经工具层 plan→create→validate→preview 自己完成一份可执行、数据正确、能预览的报表"，全程零人工 JSON 中间产物。
> 边界：Agent 只调工具、只读 ReportArtifact/CapabilityManifest；fr-agent 负责语义约束、编译、执行、核验、预览。
> 执行模型（r12）：任务可并发提交、独立 runId 目录、独立追踪；FineReport Runtime **单实例串行**（全局锁 + 队列 + 受控恢复），任何时刻最多一个 runtime。

## 1. 用户需求（原句）

> 帮我创建一份机台生产日报，按日期和机台统计计划数、完成数和完成率，支持日期筛选，完成率降序排列，并突出显示低于 80% 的机台。

## 2. Agent 侧（只读工具契约与能力清单）

- 依据：`docs/agent-tools.md`、`discover` 产出（含 `capabilityManifest` 五层状态 + `agentAvailable` 名单）、`models/production/model.json`。
- 逐项结论（按 manifest.agentAvailable 对外承诺，不外宣仅挂接的能力）：
  - 按日期/计划数/完成数/完成率 = `spec.sql.*` agentAvailable=true → 支持；
  - 日期筛选 = `spec.sql.filters` 支持（编译期字面量；运行期控件另属浏览器行为）；
  - 完成率降序 = 派生化率不在 SQL 排序白名单（`spec.sql.sort` 仅已选 SQL 别名）→ 不支持，显式告知；
  - <80% 高亮 = `condition.*` 支持，但跨列判断须用 `when.formula` 相对式（`when.column` 是本格值求值，见 AGENTS §3）。
- 三项限制均显式告知，未静默降级（`agentAvailable=false` 的能力绝不当作已支持对外承诺）。

## 3. fr-agent 侧（工具层执行，单一 runId 贯穿）

```text
# 一个 runId 串起全链（缺省自动生成 GUID；显式 -RunId 可续跑同一任务）
plan        → {"ok":true,"runId":"R","status":"ready","result":"logs/agent/runs/R/plan.json"}
plan2spec   → {"ok":true,"result":"logs/agent/runs/R/reportSpec.json"}   # ready 的 reportSpec 落盘，Agent 不手写 JSON
create      → {"ok":true,"result":"logs/agent/runs/R/compile.json","artifact":"logs/agent/runs/R/artifact.json"}
validate    → {"ok":true,"result":"logs/agent/runs/R/validate.json","artifact":".../artifact.json"}  (-ExpectTotals 33531:26531)
preview     → {"ok":true,"result":"logs/agent/runs/R/preview.json"}
```

- `plan`：ReportPlanner 三态分流（ready/ambiguous/rejected）；sql 意图先过 SemanticPreflight（模型回溯+唯一性证据），rows 意图不跑数据库前置（r11-5 分流）。
- `create`：`success=true`、11 阶段全 passed，产物 `机台生产日报_api.cpt/.png/.pdf`；artifact `generated:机台生产日报@R`，acceptance=true。
- `validate`（栅格 13 行：10 天 × 机台明细 + 合计）：合计行 = 明细之和（planned 33531、done 26531）；`completionRate = done/planned×100`（79.1238±0.01）；与外部真值 `33531:26531` 对拍通过。
- `preview`：PNG 尺寸/字节/非空白。

## 4. 并发与隔离（r24 终态：单实例薄执行器）

- 同时提交 A、B 两个 create：A 取全局 Mutex 执行、B 排队；A 成功释放后 B 自动开始；`history.log` 证明 `maxLiveRuntime=1`（从不两个 runtime 并行）。
- 同 RunId 重入防护（r22e/r23/r24）：RunId 判据=**引擎产物存在性**——零引擎产物（plan.json/reportSpec.json）同目录是合法接力（plan→plan2spec→create 共用一个 runId）；compile.json/patch.json 已存在则引擎 verbs 拒绝（入口快查 + **Mutex 内复查**双防，确定性测试 S24a/S24b/S24c）。
- A 失败不污染 B（各 runId 独立 compile.json/artifact.json）。
- runtime 崩溃：Supervisor 仅在确认哨兵持有者进程身份（pid+StartTime）已死后才按身份清理（清 FineDB 遗留锁），**绝不标成功**；无法确认身份时 RUNTIME_BUSY 拒绝（fail-closed）。
- 模板修改（modify）产物/预览/manifest 落各自 `runs/{runId}/staging/`，互不覆盖；原始 CPT 以 `.orig.cpt` 快照保留。

## 5. 这说明什么

- 工具面（discover/resolve/plan/plan2spec/create/validate/preview/modify）足以让外部 Agent 完成一次真实创作闭环，且**并发安全、可追踪、可恢复**；Agent 全程未接触 Java 对象/CPT XML/任意 SQL。
- 能力边界是**结构化可读**的（discover 的 capabilityManifest 五层 + agentAvailable），Agent 据此主动告知用户而不是编造。
- 数据正确性有独立证据（栅格合计/公式/外部真值），不是"能生成就算成功"。

## 6. 复现命令

**§5步3（2026-11-06 闭环审计实施）：以下手动命令已固化为可重跑脚本 `scripts/run-golden-e2e.ps1`**——单 runId 贯穿 plan→plan2spec→create→validate(`-ExpectTotals 33531:26531`，外部真值对拍成为可重复断言)→preview(.NET 直读 PNG，容差判读非空白)，任一失败 exit 1。跑法：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-golden-e2e.ps1`（时间戳 runId 自动防撞）。实跑记录：`ge20261106123412` GOLDEN E2E PASS。
下列逐条命令保留作分步调试用（Agent 侧零人工 JSON 中间产物口径不变）：

```powershell
# 单 runId 贯穿（-Verb 命名参数；create/modify 为 compile/patch 的业务别名；r22e 起 plan→plan2spec→create→
#   validate→preview→modify 全程可共用同一 runId——RunId 判据=引擎产物存在性，零引擎产物同目录是合法接力）
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 -Verb discover
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 -Verb plan -Intent logs/agent/it/sql_intent.json -RunId R1
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 -Verb plan2spec -RunId R1
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 -Verb create -Spec logs/agent/runs/R1/reportSpec.json -RunId R1
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 -Verb validate -RunId R1 -ExpectTotals "33531:26531"
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 -Verb preview -Png "<编译产出的 png 绝对路径>" -RunId R1
# 修改（I6 patch 通道：原报表保留，staging 出货，diff clean 验证"未改部分不变"）
# powershell ... -Verb modify -Patch <PatchSpec.json> -RunId R1
# 集成验收（S1–S28+ 故障注入，覆盖 PowerShell/Nashorn/Application/FineReport Runtime 全链）
powershell -NoProfile -ExecutionPolicy Bypass -File verify/integration_runtime.ps1
```
