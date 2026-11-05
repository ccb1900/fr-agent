# fr-agent Tool API（外部 Agent 调用契约，r7-B）

> 目的：让**现成 AI Agent** 通过稳定业务接口使用 fr-agent 的能力，而不是直接操作 Java 对象、CPT XML 或任意 SQL。
> Agent 负责理解需求、追问、规划；fr-agent 负责语义约束、编译、修改、执行验证与产物交付。

## 调用方式

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 <verb> [参数]
```

每个 verb **打印一行 ASCII JSON**：`{"ok":true,"result":"logs/agent/runs/<runId>/<verb>.json"}`；
详细结果（可能含中文）写入该 UTF-8 JSON 文件，Agent 直接读取文件。

| Verb | 参数 | 作用 |
|---|---|---|
| `discover` | — | 输出实体/维度/指标/关系（含 `joinSafe`）与 `ReportSpec.capabilities()` |
| `resolve` | `-Term 业务词` | 语义解析三态（resolved/ambiguous/unknown），候选带置信度，不自动选 |
| `compile` | `-Spec <ReportSpec.json>` | ReportSpec → CPT（含 PNG/PDF），结果含 RunResult 路径与产物路径 |
| `validate` | `[-ExpectTotals 计划:完成]` | 核验 RunResult 11 阶段 + 产物存在 + 栅格自洽（合计=明细和、完成率公式），可选对拍外部真值 |
| `preview` | `-Png <path>` | 返回 PNG 尺寸/字节数/是否疑似空白 |
| `patch` | `-Patch <PatchSpec.json>` | 对已有 CPT 做受控局部修改（白名单 op），写 staging 并跑结构/执行/渲染回归 |

## 约束（Agent 必须遵守）

1. **只写 ReportSpec / PatchSpec JSON**，不写 Java、IR、CPT XML、任意 SQL；SQL 由 `semantic/query/sqlbuilder` 从语义模型生成。
2. **能力边界以 `discover` 输出为准**：`capabilities.datasets.rows/sql` 已按实现分列；写了不支持的能力会被 validator 结构化拒（不会静默忽略）。
3. **语义未决必须问**：`resolve` 返回 `ambiguous` 时不得自行钦定；`compile` 前可先 `resolve` 关键业务词。
4. **数据口径要可核**：`compile` 后必须 `validate`；有外部真值时用 `-ExpectTotals` 对拍。
5. **修改已有 CPT 只能走 `patch`**：写回只进 `logs/template_staging`，原件保留；结构/执行/渲染回归任一失败即整体失败。

## ReportSpec 最小形态（sql 路）

```json
{
  "specVersion": "1",
  "outName": "机台日报",
  "report": { "name": "机台生产日报" },
  "dataset": {
    "kind": "sql",
    "connection": "ATOM_LIVE",
    "entity": "InspectionRecord",
    "dimensions": ["bizDate", "machine"],
    "metrics": ["planned", "done", "completionRate"],
    "dateRange": { "from": "2026-09-13", "to": "2026-09-22" },
    "sort": [{ "field": "planned", "dir": "desc" }]
  },
  "presentation": { "type": "table", "showTotal": true }
}
```

## 当前明确不支持（会结构化拒，需 Agent 如实告知用户）

- 交互式参数/日期控件（日期范围在编译时写成字面量；运行期筛选=未接）。
- 按派生比率列排序（`completionRate` 不在 SQL 里，不能直接 ORDER BY）。
- 条件格式/高亮（如"完成率<80% 标红"）。
- 自由文本 SQL、非白名单 patch op（style/列宽/筛选/参数/标题）。

> 这些不是"静默降级"：Agent 应在交付说明里列出，并给出可用的替代（如改按计划数降序）。

## r10 契约升级（2026-11-05，runId 隔离 + plan/create/modify）

- **每 verb 一次独立 run**：产物全部写 `logs/agent/runs/{runId}/`（compile.json/validate.json/preview.json/artifact.json/…），互不共享文件；`-RunId` 显式传可续跑同一 run（plan→create→validate→preview 用同一 runId），缺省自动生成。老固定路径 `logs/agent/*.json` 不再写。
- **退出码**：0 = verb 与 artifact 均成功；1 = 任一失败（compile rc=0 但 artifact 失败也返回 1——artifact 失败不再被掩盖）；2 = 用法错误。
- **防陈旧验收**：validate.json/preview.json 带生成时 runId；create/modify 仅并入与本 run runId 一致的 validate/preview（mismatch 即整体失败）。
- **新增 verb**：
  - `plan -Intent <意图JSON>`：自然语言意图（业务词/label 均可，工具层自动归一模型名）→ 三态 `ready|ambiguous|rejected` + reportSpec + assumptions + unresolvedQuestions + validationWarnings。ready 的 reportSpec 直接作为 `-Spec` 喂给 `create`。
  - `create`（=compile 别名）／`modify`（=patch 别名）：业务命名入口，行为与底层 verb 一致。
- **能力声明**：`discover` 输出 `capabilityManifest`（四层 construction/serialization/rendering/agentAvailable，逐能力带 README/probe 引证）与 `agentAvailable` 扁平名单——**只有 agentAvailable=true 的能力才可对外承诺**；serialization-only/pending 的能力仅内部使用或明确告知未达。
- **artifact.json**：带 `runId`；`artifactId = sourceType:outName@runId`（每次操作唯一）；acceptance 口径不变（执行成功+无 error 诊断+validation≠false）。

## r12 执行模型：单实例 Runtime Supervisor + 多任务队列

任务可**并发提交**，但 FineReport Runtime **串行执行**（全局单执行权）。这是 `application` 与 FineReport Runtime 之间的正式基础设施（`agent/tools/runtime.ps1`），不是散落在脚本里的互斥逻辑。

- 全局锁 = `logs/agent/runtime/lock`（目录原子创建，跨进程互斥）；`current.json` 记持有者 runId+pid+startedAt；`queue/` `done/` 记任务态；`history.log` 记 ACQUIRE/RELEASE/RECOVER 事件流。
- `create`/`modify` 两条起 Runtime 的路径经 `acquire → run.ps1 -NoKill → release` 包裹；零引擎 verb（discover/resolve/plan/plan2spec/validate/preview）不取锁。
- **run.ps1 默认不再随意杀 JVM**：agent 路径用 `-NoKill`；kill+删 FineDB 锁降格为 Supervisor 的 Recovery 动作，且**仅在确认 current 持有者 pid 已死后**才执行（abandoned run 标 `failed/RUNTIME_LOST`，绝不标成功）。
- 验收（`verify/integration_runtime.ps1`，覆盖 PowerShell/Nashorn/Application/FineReport Runtime 全链）：S1/2/4 并发提交串行（maxLiveRuntime=1）、S3 失败隔离、S5 崩溃恢复、S6 模板 staging 不串、S7 plan sql/rows 分流。

## r10/r12 verb 全表

| Verb | 参数 | 产物（logs/agent/runs/{runId}/） | 取 Runtime 锁 |
|---|---|---|---|
| discover | — | discover.json（含 capabilityManifest 五层 + agentAvailable 名单） | 否 |
| resolve | -Term | resolve.json | 否 |
| plan | -Intent | plan.json（ready/ambiguous/rejected） | 否 |
| plan2spec | （同 runId） | reportSpec.json（ready 的 spec 落盘） | 否 |
| create（=compile） | -Spec | compile.json + artifact.json | 是 |
| validate | -ExpectTotals | validate.json + 刷新 artifact.json | 否 |
| preview | -Png | preview.json | 否 |
| modify（=patch） | -Patch | patch.json + staging/ + artifact.json | 是 |
