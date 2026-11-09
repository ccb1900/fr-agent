# ReportSpec / Intent / PatchSpec 编写规范

Agent 只写这三种 JSON。**不写** Java、IR（`lib/ir.js` 的节点）、CPT XML、任意 SQL、自由文本查询。SQL 由 `semantic/query/sqlbuilder` 从 `models/production/model.json` 生成；IR/对象图/CPT 由管线生成。

事实源：`schemas/report-spec.schema.json`（顶层必填 `outName` + `dataset`）、`lib/spec_validator.js`、`lib/report_spec.js`、`template/ops.js`、`agent/tools/plan.js`、`agent/tools/plan2spec.js`。

## 1. Intent JSON（喂给 `plan -Intent`）

Intent 是**用户已确认信息的结构化表达**，不是最终 spec。字段来自 `discover` 的模型名与 `resolve` 的业务词解析，不臆造。

最小 sql 形态（真实样例 `verify/fixtures/golden/g2_intent.json`）：

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
  "presentation": {
    "type": "table",
    "showTotal": true,
    "chart": { "kind": "bar", "category": "bizDate", "value": "planned", "title": "每日计划数" }
  }
}
```

规则：

- `outName`：产物名，可中文；**文件/参数路径本身用 ASCII**，避免 PS 5.1 GBK 打乱。
- `dataset.entity` / `dimensions` / `metrics` 必须是模型里的名字；未知词先 `resolve`，`unknown` 就问用户。
- `dateRange` 是固定字面量（运行期交互筛选未接，README #62）。不要写 `${}` 或参数化 SQL。
- `presentation` / `sheet` / `params` 等表达层键的能力边界以 `discover` 的 `agentAvailable` 为准（见 `capability-rules.md`）。
- `rows` 路线（内嵌数据集）存在，但真库业务报表优先 `kind:"sql"`；`rows` 必须由真实采样/聚合得来，不许编数。

`plan` 输出 `ready` 后由 `plan2spec` 生成 `reportSpec.json`——**Agent 不手写这个中间产物**。

## 2. ReportSpec JSON（喂给 `create -Spec`）

通常由 `plan2spec` 自动落盘。外置 LLM 直写路线也允许，但必须过 `spec_validator` 的结构闸。顶层：

| 键 | 说明 |
|---|---|
| `specVersion` | `"1"` |
| `outName` | 必填，产物名 |
| `report` | `{ name, description? }` |
| `dataset` | 必填；`sql` 或 `rows` 形态 |
| `presentation` | `type` / `showTotal` / `chart` / `conditions` 等 |
| `params` / `sheet` / `extraSheets` / `filters` / `dimensions` / `metrics` / `chart` | 表达层扩展，按 manifest 能力使用 |

真例（`examples/report-spec/daily_report_auto.json`）：

```json
{
  "specVersion": "1",
  "report": { "name": "激光生产日报（计划 / 完成 / 完成率）", "description": "统计 2026-09-13 至 2026-09-22 每日……" },
  "outName": "生产日报_自动",
  "dataset": {
    "kind": "sql", "connection": "ATOM_LIVE", "entity": "InspectionRecord",
    "dimensions": ["bizDate"],
    "metrics": ["planned", "done", "completionRate"],
    "dateRange": { "from": "2026-09-13", "to": "2026-09-22" }
  },
  "presentation": { "type": "table", "showTotal": true }
}
```

组合能力示例：`verify/fixtures/golden/g3_intent.json` 同时带 `chart`（bar）、`presentation.conditions`（相对公式 `=E3<75` 改红字加粗）、`params`（date 控件）、`sheet.headerFooter`。这些是已实证的形态，照抄比自创安全。

硬约束：

- **不写自由文本 SQL**。SQL 数据集只声明模型实体/维度/指标/日期范围/排序意图；物理列与 JOIN 由 sqlbuilder 从模型生成并受只读闸。
- **派生比率不进 SQL 排序**（如 `completionRate` 由展示层算，不能直接 ORDER BY）；要排序就按已存在的数值指标排。
- **不承诺交互行为**：参数面板、超链、图表热链多为 Web 行为，静态 PNG 不验；`agentAvailable` 未列名或 `unavailable.webInteraction` 的能力不能说"支持运行期改条件重查询"。
- **条件高亮跨列判断用相对公式**（`when.formula = "=E3<75"`，本格锚 + 行偏移），`when.column` 只对本格值求值。
- **合计与明细一致**：`showTotal` 开启时末尾要有合计；`validate` 会查栅格自洽。

## 3. PatchSpec JSON（喂给 `modify -Patch`）

只允许 `template/ops.js` 冻结的白名单：

| op | 参数 | 语义 |
|---|---|---|
| `replace_cell_value` | `sheet`, `cell:{c,r}`, `value:{kind:"text"\|"formula", text}` | 改一个已存在的格（String 或 Formula） |
| `replace_dataset` | `name`, `columns[{name,type}]`, `rows[][]` | 替换一个已存在的命名数据集（EmbeddedTableData） |

真例（`logs/agent/runs/g1/patch1.json`，GOLDEN v1 唯一承诺的修改）：

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

`replace_dataset` 的列型词表（`DS_TYPES`）：`text/string/number/integer/long/float/decimal/boolean/date/datetime`；未知类型拒，不静默回退 String。

**明确 UNIMPLEMENTED**（`template/ops.js`，不要写、不要宣称支持）：

- `set_cell_style`：读回对象 `setStyle` 无证据 + 命名样式读回即默认化，会损坏未改部分
- `set_column_width`：R0 探针方法签名不合
- `add_column` / `remove_column`：跨列引用/DSColumn 绑定会波及
- `add_filter` / `change_filter_default`：参数/条件面读回无口
- `set_report_title`：标题对象级 setter 无证据；若标题是文本格改用 `replace_cell_value`

坐标必须来自 `inspect_template` 的真实输出；不要按"看起来像第一行"猜 `(c,r)`。每个 op 执行前工具会校验目标真实存在，越界/不存在即拒，不静默新建。

`FORBIDDEN_TARGETS` 包含 `demo_api.cpt` / `demo_template_final.cpt`；patch 只写 `logs/agent/runs/<runId>/staging/`，原件以 `.orig.cpt` 保留。正式覆盖必须 `promote` 且需用户授权。

## 4. 一句话判断"能不能写这个键"

1. `discover` 的 `agentAvailable` 里有能力名吗？没有 → 不写，如实告知。
2. 是模型里真实存在的实体/维度/指标吗？不是 → 先 `resolve`，`unknown` 就问。
3. 是 PatchSpec op 吗？不在两 op 白名单 → 不写。
4. 写完必跑 `validate`（创建）/ 检查 staging manifest（修改）。**不靠 JSON 长得对来判断成功**。
