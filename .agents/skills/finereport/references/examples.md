# 真实样例（照抄比自创安全）

所有样例都来自仓库里跑通过的资产；路径是仓库相对路径。看更多：`examples/report-spec/`、`verify/fixtures/golden/`、`docs/golden-e2e-case.md`、`scripts/run-golden-e2e.ps1`。

## 1. 创建：GOLDEN v1（生产日报，主验收案例）

**用户原话**（`docs/golden-e2e-case.md` §2）：

> 出一份激光机台生产日报：固定日期区间 2026-09-13 至 2026-09-22，按业务日期、机台分组；每天每台给计划数（件数）、完成数（score≥0.9 口径件数）、完成率（完成/计划×100，展示层指标不进 SQL）；合计行在最右，版式按生产同款。

**Agent 动作要点**：`discover` 确认 `InspectionRecord` / `bizDate` / `machine` / `planned` / `done` / `completionRate` 都在模型里；日期区间明确，无需追问；`completionRate` 是展示层指标，不进 SQL 排序。

**Intent**（写 `logs/agent/runs/<runId>/intent.json`，路径用 ASCII）：

```json
{
  "outName": "生产日报GOLDEN",
  "reportName": "激光机台生产日报",
  "dataset": {
    "kind": "sql", "connection": "ATOM_LIVE", "entity": "InspectionRecord",
    "dimensions": ["bizDate", "machine"],
    "metrics": ["planned", "done", "completionRate"],
    "dateRange": { "from": "2026-09-13", "to": "2026-09-22" }
  },
  "presentation": { "type": "table", "showTotal": true }
}
```

**链**（同一 RunId，真实顺序见 `scripts/run-golden-e2e.ps1`）：

```powershell
$f = 'agent/tools/fr_agent.ps1'
powershell -NoProfile -ExecutionPolicy Bypass -File $f -Verb plan -Intent "logs/agent/runs/<runId>/intent.json" -RunId <runId>
powershell -NoProfile -ExecutionPolicy Bypass -File $f -Verb plan2spec -RunId <runId>
powershell -NoProfile -ExecutionPolicy Bypass -File $f -Verb create -Spec "logs/agent/runs/<runId>/reportSpec.json" -RunId <runId>
powershell -NoProfile -ExecutionPolicy Bypass -File $f -Verb validate -RunId <runId> -ExpectTotals "33531:26531"
```

`validate` 的 `-ExpectTotals` 是外部真值（`data/db_laser_machine_daily_truth.txt`）；有真值必须对拍，不能只说"执行成功"。真值粒度是日期×机台级，10 行 + 合计。

**修改回归**（GOLDEN v1 唯一承诺的修改）：用户说"把标题改为《生产日报（复核）》" → 不重新生成，走 `inspect_template` + `modify`：

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

验收：`patch.json.manifest` 的 `diffClean=true`、`execution.pass=true`、`render.pass=true`（像素 diff <5%），原件 `.orig.cpt` 保留在 staging。

## 2. 创建：G2（图表 + 页眉页脚 + 合计）

文件：`verify/fixtures/golden/g2_intent.json`（已实证链路 `ge20261108081409-3c1bc7`）。在 GOLDEN v1 基础上加：

```json
{
  "presentation": {
    "type": "table",
    "showTotal": true,
    "chart": { "kind": "bar", "category": "bizDate", "value": "planned", "title": "每日计划数" }
  },
  "sheet": {
    "headerFooter": {
      "header": { "center": [ { "text": "生产日报 G2（9/13-9/22）", "bold": true } ] },
      "footer": { "right": [ { "text": "机密 · 内部使用" } ] }
    }
  }
}
```

要点：图表 `category`/`value` 必须是数据集里真实列名；页眉页Footer 用 list 形态（工具内部已验证「便捷 addXxx API 不落 list」的坑）。

## 3. 创建：G3（参数面板 + 条件高亮 + 图表 + 页脚）

> 账本口径（写之前先对齐）：`params` 的默认参数值过滤 **agentAvailable=true**（rows 路单条 filter）；**参数面板 Web 改参重查询=unavailable(webInteraction)**，manifest 是唯一真相源（`discover` 输出），不要把 layerEvidence 说过 fullE2e。

文件：`verify/fixtures/golden/g3_intent.json`（链路 `ge20261108082641-e5ede7`，PNG 红字 1411 像素）。新增：

```json
{
  "presentation": {
    "type": "table", "showTotal": true,
    "chart": { "kind": "bar", "category": "bizDate", "value": "planned", "title": "每日计划数" },
    "conditions": [
      { "column": 4, "when": { "formula": "=E3<75" }, "then": { "color": 16711680, "bold": true } }
    ]
  },
  "params": [ { "kind": "date", "name": "d1", "value": "2026-09-13" } ]
}
```

两个要点别弄反：

- 条件高亮跨列判断用 **`when.formula` 相对公式**（`=E3<75`，本格锚 + 行自动偏移）；`when.column` 只对本格值求值，写错会全列染色或全空。
- `params` 里的 date 控件是**默认参数值**，不是运行期交互筛选；Web 端改参重查询不承诺（README #62）。

## 3.5 明细表（G4：presentation.type=detail，W3 新通路）

**用户**："给我一张检测明细台账，按时间正序，每条记录一行。"

```json
{
  "specVersion": "1",
  "outName": "检测明细台账",
  "report": { "name": "检测明细台账" },
  "dataset": {
    "kind": "sql", "connection": "ATOM_LIVE", "entity": "InspectionRecord",
    "dimensions": ["InspectionRecord.bizTime", "InspectionRecord.fileKey", "InspectionRecord.rowNo", "InspectionRecord.score"],
    "metrics": [],
    "dateRange": { "from": "2026-09-13", "to": "2026-09-14" },
    "sort": [{ "field": "bizTime", "dir": "asc" }]
  },
  "presentation": { "type": "detail", "showTotal": false }
}
```

三条纪律：

- **metrics 必须为空数组**（明细无聚合；非空会被 `INVALID_SHAPE` 结构化拒）；展示列全部放 dimensions，实体 property（`Entity.prop` 或裸列名）可直上报表
- **showTotal 必须 false**（无聚合总计；v2 校验器按 allowNoFormula 通道放行无公式格）
- 粒度=一行一条记录（行级 DISTINCT 直读；`grain` 概念不进 spec，属 Dataset 资产侧）

## 4. 能力咨询（正确与错误示范）

**用户**："能不能做张报表，用户在页面上改日期就重新查？"

- ❌ 错："能，G3 有参数面板 date 控件"——把控件存在说成 Web 交互支持。
- ✅ 对：先 `discover`，查 `agentAvailable` 与 `unavailable.webInteraction`；回答"参数面板可生成带默认值的控件，但运行期改参重查询是 Web 交互边界，静态 PNG 验不了、不承诺；当前做法是编译时固定日期范围，需要不同区间就重新出一份"。

**用户**："支持改列宽吗？"

- ✅ 对：`discover` + `template/ops.js` 白名单 → "PatchSpec 不支持列宽（R0 探针签名不合，UNIMPLEMENTED）；可以重新生成一份新报表来改版式，但那不是'修改已有报表'"。

## 5. 交付话术模板

> 已生成《激光机台生产日报》（runId `ge…`）：
> - 产物：`…\fineagent\生产日报GOLDEN_api.cpt` / `.png` / `.pdf`
> - 验证：`validate.json` 全部 checks pass；真值对拍 10 行 + 合计 33531:26531 逐格一致；`artifact.json.acceptance.ok=true`
> - 假设：`dataset.kind=sql`，SQL 由模型生成；日期区间固定为 9/13–9/22
> - 需你过目：PNG 排版/中文字体/图表观感（像素检查只能判空白）
> - 状态：**未部署**；修改件在 staging，正式覆盖需你明确授权 `promote`
> - 未支持：运行期改日期重查询（Web 交互边界），当前按固定区间出报表

## 6. 三个刻意不做的例子

1. 用户要"按完成率排序" → 不写 `sort: completionRate`（派生比率不进 SQL）；改按 `planned` 排序并说明替代。
2. 用户要"把这张表的标题样式改红" → 不写 `set_cell_style`；白名单只有 `replace_cell_value`，告知不支持样式修改。
3. 用户要"翻页用按钮导航" → 不造工具条超链（会撑大请求头导致 Tomcat 400）；用参数面板 page/size + 查询提交，或直接说明边界。
