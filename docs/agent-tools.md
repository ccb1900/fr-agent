# fr-agent Tool API（外部 Agent 调用契约，r7-B）

> 目的：让**现成 AI Agent** 通过稳定业务接口使用 fr-agent 的能力，而不是直接操作 Java 对象、CPT XML 或任意 SQL。
> Agent 负责理解需求、追问、规划；fr-agent 负责语义约束、编译、修改、执行验证与产物交付。

## 调用方式

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 <verb> [参数]
```

每个 verb **打印一行 ASCII JSON**：`{"ok":true,"result":"logs/agent/<verb>.json"}`；
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
