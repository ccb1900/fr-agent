# 工作流（三场景逐步命令与判定）

所有命令在仓库根 `D:\fineagent` 执行。工具入口固定：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 -Verb <verb> [参数] -RunId <id>
```

- `-RunId` 省略会自动生成；**一条链必须显式复用同一个 RunId**，否则 `plan` 与 `create` 不接力。
- RunId 规则 `^[A-Za-z0-9_-]{1,64}$`（工具会拒非法值，exit 2）。
- 每步先读合同行的 `ok` 和 `exit`，再读 `result` 指向的 JSON 文件。失败带 `nextActions`，照做。
- 引擎 verb（`create`/`modify`/`inspect_template`）受 OS 命名 Mutex 串行；`RUNTIME_BUSY`/`QUEUE_TIMEOUT` 是正常保护，不是要清锁。

## 场景 A：创建新报表

### A0 弄清需求与能力面

1. `discover`（不取锁）。读 `logs/agent/runs/<runId>/discover.json`：
   - `entities` / `dimensions` / `metrics` / `relationships`（`joinSafe` 决定是否可安全联表）
   - `capabilities`（ReportSpec 表达面）
   - `capabilityManifest` + `agentAvailable`（唯一可对外承诺的能力名单）
2. 对用户口语里的每个业务词做 `resolve -Term "<词>"`：
   - `resolved` → 用模型名继续
   - `ambiguous` → 读 `candidates` **问用户选哪个**（`resolve` 本身 exit 0，表示"有候选可反问"，不是"已定"）
   - `unknown` → 不编造，问用户或请其换词；可用名单在 `nextActions`/`discover`
3. 语义歧义、口径冲突、日期范围缺失、指标定义不清 → 一次问清。**不要**替用户决定"计划数=COUNT(*) 还是别的"，模型里的口径才是真源。

### A1 写 Intent JSON（不是 ReportSpec）

把用户已确认的信息写成 UTF-8 JSON 文件，路径用仓库内 ASCII 相对路径，例如 `logs/agent/runs/<runId>/intent.json`。形态：

```json
{
  "outName": "生产日报G2",
  "reportName": "生产日报（业务验收 G2：图表+页眉页脚+合计）",
  "dataset": {
    "kind": "sql",
    "connection": "ATOM_LIVE",
    "entity": "InspectionRecord",
    "dimensions": ["bizDate", "machine"],
    "metrics": ["planned", "done", "completionRate"],
    "dateRange": { "from": "2026-09-13", "to": "2026-09-22" }
  },
  "presentation": { "type": "table", "showTotal": true }
}
```

字段都来自 `discover`/`resolve`；不写 SQL、不写物理列名、不写 IR 键。样例见 `references/examples.md`。

### A2 plan → plan2spec

```powershell
... -Verb plan -Intent "logs/agent/runs/<runId>/intent.json" -RunId <runId>
... -Verb plan2spec -RunId <runId>
```

读 `plan.json`：

| `status` | 处理 |
|---|---|
| `ready` | 继续；读 `assumptions` / `validationWarnings`，交付时如实说明假设 |
| `ambiguous` | 读 `unresolvedQuestions` 问用户，改 Intent 后**换一个 RunId**重跑 plan（原文保留，便于追溯） |
| `rejected` | 读 `issues`/`diagnostics`，把不支持点告诉用户，不绕过 |

`plan2spec` 只接受同 RunId 的 `ready` plan，产出 `logs/agent/runs/<runId>/reportSpec.json`。**不要手写这个 JSON 中间产物**。

### A3 create → validate → preview

```powershell
... -Verb create -Spec "logs/agent/runs/<runId>/reportSpec.json" -RunId <runId>
... -Verb validate -RunId <runId> [-ExpectTotals "计划:完成"]
... -Verb preview -Png "<ASCII 路径>" -RunId <runId>
```

- `create` 读 `compile.json`：`ok`、`exit`、`cptPath`/`pngPath`/`pdfPath`、`runResult`。
- **必跑 `validate`**：它核对 RunResult 11 阶段、产物存在、栅格自洽（合计=明细和、公式），有真值用 `-ExpectTotals` 对拍。`validate.json` 的 `checks` 必须全 `pass`。`validate` 会刷新 `artifact.json`。
- `preview` 只读 PNG/PDF，返回尺寸/字节/是否疑似空白。**中文 PNG 路径不要直接作为 `-Png` 传**（PS 5.1 GBK 会打乱）；按 `references/error-handling.md` 用 `artifact.json` 的 `pngPath` 或改走 .NET 检查。
- 最终判定看 `artifact.json` 的 `acceptance.ok`：执行 ok + 无 error 诊断 + `validation.ok !== false`。

### A4 交付

按 `SKILL.md`「交付清单」说清产物、验证数字、假设、未支持项、需肉眼过目项、部署状态。创建默认**不部署**；正式覆盖走 B 场景的 `promote` 且需授权。

## 场景 B：修改已有报表

### B0 定位目标

```powershell
... -Verb list_reports
... -Verb inspect_template -Target "fineagent/<name>.cpt" -RunId <runId>
```

`list_reports` 给部署目录 `.cpt` 清单；`inspect_template` 给 sheet 尺寸、逐格文本**真实坐标**、数据集/参数名。没有这一步不要猜 `(c,r)`。

### B1 PatchSpec（白名单）

```json
{
  "patchVersion": "1",
  "sourceCpt": "fineagent/生产日报GOLDEN_api.cpt",
  "outName": "生产日报GOLDEN_复核",
  "ops": [
    { "op": "replace_cell_value", "sheet": 0, "cell": { "c": 0, "r": 0 },
      "value": { "kind": "text", "text": "生产日报（复核）" } }
  ]
}
```

合法 op **只有两个**：`replace_cell_value`（`sheet`/`cell`/`value`）、`replace_dataset`（`name`/`columns`/`rows`）。`template/ops.js` 的 `UNIMPLEMENTED` 明确不做：样式、列宽、增删列、筛选、参数默认值、标题对象。越权会被结构化拒——不要"偷试"或用重新生成伪装成修改。

### B2 modify → 检查 staging

```powershell
... -Verb modify -Patch "logs/agent/runs/<runId>/patch.json" -RunId <runId>
```

读 `patch.json` 及其 `staging/manifest.json`，**四个都要绿**：

- `diffClean === true`（除指定坐标外结构不变）
- `execution.pass === true`（执行栅格未改部分逐格不变）
- `render.pass === true`（像素 diff 阈值内）
- `datasetChecks` 每项 `pass === true`（有 dataset op 时）

原件保留在 staging 的 `.orig.cpt`；`modify` **只写 staging**，不改部署件。任一不绿 → 报失败，不交付、不 promote。

### B3 部署（需授权）

用户明确说"上线/部署/覆盖正式报表"后：

```powershell
... -Verb promote -RunId <runId>
```

`promote` 有 fail-closed 哈希链：回归全绿 + staging 绑定本 RunId + 部署件 SHA-256 未变 + 原子替换 + 替换后复核。读 `promote.json` 再交付。要撤销用同 RunId 的 `restore`，它用同 run 的 `.orig.cpt` 回退。

**未经授权不调用 `promote`/`restore`**；交付说清"staging 已生成，尚未覆盖正式报表"。

## 场景 C：能力咨询

```powershell
... -Verb discover
```

- 只依据 `capabilityManifest` / `agentAvailable` 回答。`agentAvailable=true` 才能说"支持"。
- `unavailable` 带原因分类（`webInteraction` / `unverifiedRendering` / `notImplemented` / `rejected` / `e5Evidence`），照抄给用户，不美化。
- `evidenceGrade.fullE2e` 才是跑过完整生命周期的名单；其余 `layerEvidence` 只说明四层/回归证据，不能说"端到端验证过"。
- 交互式 Web 行为（点参数重查询、超链翻页、浏览器筛选）静态 PNG 验不了；说明这是边界，不承诺。

## 单实例与 run 纪律

- 引擎 verb 全局串行；遇到 `RUNTIME_BUSY` 等待后重试，不要删 `active.json`/`java.pid`、不要另起 JVM。
- 同一 RunId 的引擎产物若已存在，`RUNID_EXISTS` 是正确拒绝；新报表/重试用**新 RunId**。
- 零引擎 verb（discover/resolve/plan/plan2spec/validate/preview）不取锁，可按需重复读；引擎结果不因此重算。
