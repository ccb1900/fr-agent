# FineReport Agent 验收基准（Acceptance Benchmark）V0.1

> 目的：给 Agent 一段**真实业务需求**，检验它能否独立完成需求理解、语义映射、报表规划、原生能力选择、生成、
> 真实引擎验证与后续修改。它测的是 Agent + 整条产品链，不是 `IR → Object → CPT` 能否跑通。
>
> 本目录是**验收规格与执行协议**，不是能力声明。能力成熟度的唯一权威仍是
> `application/capability_manifest.js`；任务只引用账本里的真实能力 ID，不另造一套清单。
>
> 当前状态（V0.1，2026-11-08）：**任务定义 40 条、固定数据与真值、结果记录器、完整性门已完成；尚未执行任何任务**
> （没有引擎运行、没有 PASS 记录）。这是有意的：先把尺子做准，再量。

---

## 1. 为什么不是"40 条提示词"

| 只测提示词 | 本基准 |
| --- | --- |
| 看 Agent "会不会写报表" | 看 Agent 在 8 类真实需求上"能不能交付并证明" |
| 通过=生成了 CPT | 通过=规格 → IR → CPT → 引擎 → 渲染 → 数据真值 → 交互 → 变更安全，逐层留证 |
| 失败原因不可归因 | 失败必须落到：能力账本未承诺 / IR 或 ReportSpec 无入口 / Planner 不会规划 / 引擎渲染失败 / 数据映射错误 |
| 修改任务缺失 | 长期回归集 10/40：G 组（理解/局部修改/批量修改/回归）4 条 + H 组（澄清/边界/部分完成/修复）4 条 + E04（跳转）+ F04（综合组合）|

**提示词纪律（机器强制）**：任务描述只写业务需求，不得出现 IR / ReportSpec / CPT / Object / JSON / API / 图表 kind 等内部实现词
（`build_tasks.js` 与 `verify/fast_acceptance.js` 双向检查）。

---

## 2. 与既有账本/文档的关系

| 文档 | 角色 | 本目录如何引用 |
| --- | --- | --- |
| `application/capability_manifest.js` | 能力成熟度唯一权威（四层 + regressionScope + agentAvailable） | `requiredCapabilities` 必须存在且 `agentAvailable=true`，build 期硬校验 |
| `docs/architecture/coverage.md` | 类级覆盖缺口账 | 不重复统计；失败归因时引用 |
| `docs/architecture/capability-matrix.md` | 路线图/优先级 | 不另立优先级 |
| `docs/architecture/jar-surface-analysis.md` | 引擎 jar 面（图族/付费口径） | 图表任务的能力边界以此为准 |
| `docs/agent-tools.md` / `agent/tools/fr_agent.ps1` | Agent 工具面（verbs） | `agentTools` 必须是真实 verb |
| `verify/fast_*.js` | 分层门 | 本基准另加 `verify/fast_acceptance.js`（只验基准自洽） |

---

## 3. 目录结构

```text
acceptance/
├── README.md                     # 本文件：协议/评分/证据/执行/数据/当前状态
├── benchmark.json                # 生成物：40 任务索引 + 分组 + 权重 + fixture 哈希 + 资格投影
├── tasks/                        # 生成物：40 个任务定义（源=build_tasks.js）
│   ├── A01-sales-detail.json
│   ├── C04-sales-profit-combo.json
│   └── ...
├── fixtures/sales/               # 固定数据（生成物，版本+seed+哈希）
│   ├── orders.json / products.json / customers.json / employees.json
│   ├── inventory.json / warehouses.json
│   ├── schema.json               # 逻辑表结构/键/边界数据说明
│   ├── expected.json             # 真值 oracle（134 键；与 fixture 同目录，哈希绑定）
│   └── manifest.json             # 逐文件 sha256 + 行数
├── tools/
│   ├── gen_fixture.js            # 确定性数据生成器（Nashorn）
│   ├── verify_oracle.ps1         # 独立 PowerShell 重算 oracle（跨语言对拍）
│   └── build_tasks.js            # 任务定义源 + 生成器（Nashorn）
├── result_schema.js              # 结果 JSON 的硬规则（纯函数）
├── record_result.js              # 结果校验/落盘（Nashorn）
└── results/                      # 已记录结果（默认空；一个任务一个 RunId 一个文件）
```

**一处真相**：改任务 → 改 `tools/build_tasks.js` 再重建；改数据 → 改 `tools/gen_fixture.js` 再生成并重跑 oracle 对拍。
`tasks/*.json` 与 `benchmark.json` 是确定性产物，`fast_acceptance` 用逐文件 sha256 防手改漂移。

---

## 4. 任务模型（单个 `tasks/<ID>-<slug>.json`）

| 字段 | 含义 |
| --- | --- |
| `id` / `name` / `group` / `difficulty` | 编号、业务名、分组、难度 |
| `prompt` | 交给 Agent 的自然语言需求（唯一输入；不含内部实现词） |
| `fixture` | 固定数据名（V0.1 只有 `sales`） |
| `datasetPath` | `rows`（内嵌行，立即可跑）或 `sql`（需要固定数据入库+语义模型） |
| `expectedLevel` | 按**当前能力账本+数据条件**，正确执行应达到的等级（静态投影，不是执行结果） |
| `requiredCapabilities` | 达到 PASS 必须用到的能力 ID；全部必须 `agentAvailable=true` |
| `targetCapabilities` | 目标能力（可为未承诺项，用于暴露缺口） |
| `blockedCapabilities` | 账本明确拒/未实现的能力 ID |
| `alternatives` | 可替代但不满足原需求的路径（如 `page.multiSheet`） |
| `agentTools` | 期望使用的真实 verb（plan/create/validate/modify/promote/restore…） |
| `dataContract` | `raw-rows` / `prepared-rows` / `report-aggregates` / `report-computes`（见 §11 的诚实边界） |
| `dataAssertions` | 必须逐键命中 `fixtures/sales/expected.json` 的真值键 |
| `render.required` / `render.assertions` | 是否必须真实渲染；渲染要检查什么 |
| `interaction.required` / `evidenceTier` | 是否必须交互可用；证据层级 `engine` / `serialization` / `web` |
| `modification.invariants` | 修改任务必须保持的不变量（列序、样式、原计算逻辑、失败不部署） |
| `safety.noDeployOnFailure` / `scope` | 验证失败不得部署；修改范围限定 |
| `requiredClarifications` | 需求缺失时必须先问的问题（如统计期间） |
| `blockedBy` / `knownGaps` | 阻塞原因（分类）与已知缺口 |
| `faultInjection` | H04 的故障注入要求（由验收执行者提供首轮失败输入） |
| `wave` | 执行批次：V0.1 (11) / V0.2 (12) / V0.3 (9) / V0.4 (4) / V0.5 (4) |
| `longTermRegression` | 是否进入长期回归集（V0.1 共 10 条：G4+H4+E04+F04，机器校验 >=10） |
| `acceptance` | 四个硬标志：`requireAgentExecution` / `requireEngineRender` / `requireVisualEvidence` / `requireNoSilentDrop`，与 render 要求机器对齐 |
| `weights` | 九维权重，恒和 100（见 §6） |

> 与上一轮提案 JSON 的差异（有意）：不设 `expected.chartKinds` / `requiredFeatures` 这套自由词，统一引用
> `application/capability_manifest.js` 的能力 ID（`requiredCapabilities`），避免第二套命名；`acceptance.*` 四标志保留，
> 并与 `render.required` 机器对齐；`expected.dataAssertions` 直接用 oracle 键；`fixtures/expected/` 合并到
> `fixtures/sales/expected.json`，因为真值必须与同一份 fixture 哈希绑定。

---

## 5. 40 条任务总览

V0.1 共 40 条，分组 5/5/8/5/5/4/4/4。`expectedLevel` 是静态投影：`PASS` 9 / `PASS_WITH_CLARIFICATION` 1 /
`PARTIAL` 14 / `BLOCKED` 16；按数据路径 `rows` 38 / `sql` 2。**投影 ≠ 成绩**，执行后以 `results/` 为准。
长期回归集 = G01–G04 + H01–H04 + E04 + F04 共 **10 条**（满足"至少 10 个修改/组合/异常任务"），不随单轮通过而移出。
执行批次对齐上一轮落地顺序：**V0.1** 11 条（A01–A05、B01、C01–C03、D01–D02）；**V0.2** 12 条（B02–B05、C04–C08、D03–D05）；
**V0.3** 9 条（E01–E05、F01–F04）；**V0.4** 4 条（G01–G04）；**V0.5** 4 条（H01–H04）。原表未点名的 B02–B05 归入 V0.2 布局批。

### A. 基础报表与数据（5）

| ID | 任务 | 预期 | 关键能力 |
| --- | --- | --- | --- |
| A01 | 销售明细表 | PASS | `spec.rows.sum` |
| A02 | 区域销售汇总（排序/订单数/客户数） | PARTIAL | `spec.rows.sum` |
| A03 | 产品销售额 Top10 + 合计 | BLOCKED | 目标 `spec.sql.topN/sort` |
| A04 | 部门员工销售 + 部门小计 | BLOCKED | 分组小计无账本条目 |
| A05 | 库存报表 + 期末库存计算 | PARTIAL | 目标 `spec.rows.cells` |

### B. 布局与组件（5）

| ID | 任务 | 预期 | 关键能力/缺口 |
| --- | --- | --- | --- |
| B01 | 月度销售报表版式（标题/期间/明细/总计） | PASS | `page.headerFooter` + `spec.rows.sum` + `spec.rows.totalAgg` |
| B02 | 区域×月份交叉报表 | BLOCKED | 交叉表/动态列头 |
| B03 | 部门→员工层级报表 | BLOCKED | 层级分组/展开 |
| B04 | 经营分析看板 | BLOCKED | 同页多区域布局 |
| B05 | 多区域组合报表 | BLOCKED | 同页多区域（`page.multiSheet` 只是替代） |

### C. 图表能力（8）

| ID | 任务 | 预期 | 关键能力/缺口 |
| --- | --- | --- | --- |
| C01 | 区域销售额柱状图（降序） | PARTIAL | `chart.bar`；报表层排序缺 |
| C02 | 近 12 个月趋势折线图 | PASS | `chart.line` |
| C03 | 产品销售额占比饼图 | PARTIAL | `chart.vpie`；`${PERCENT}` 未替换 |
| C04 | 销售额+利润率组合图（双轴） | BLOCKED | 组合图渲染 D1 阻塞 |
| C05 | 销售额-利润率气泡图 | PASS | `chart.vbubble`（x/y/size） |
| C06 | 省份销售额地图 | PASS | `chart.vmap`（按名称） |
| C07 | 省份销售热力图 + 数值提示 | PARTIAL | `chart.vheatmap`；tooltip 仅序列化 |
| C08 | 区域地图标签 + 悬停详情 | PARTIAL | `chart.vmap` + `chart.mapLabel`；tooltip 仅序列化 |

### D. 样式与格式（5）

| ID | 任务 | 预期 | 关键能力/缺口 |
| --- | --- | --- | --- |
| D01 | 正式经营报表样式（标题/表头/字体） | PARTIAL | 目标 `condition.then.style`；表头静态样式无入口 |
| D02 | 千分位 + 百分比格式 | PARTIAL | `spec.rows.sum`；行级比率缺 |
| D03 | 低于/高于目标红绿标记 | PASS | `condition.formula` + `spec.rows.conditions` |
| D04 | 外框/内横线/表头底边/无竖线 | PARTIAL | 目标 `condition.then.border`；边框布局无入口 |
| D05 | 斑马纹 + 合计行突出 | PARTIAL | `condition.then.style`；奇偶公式未验证 |

### E. 参数与交互（5）

| ID | 任务 | 预期 | 关键能力/缺口 |
| --- | --- | --- | --- |
| E01 | 开始/结束日期查询 | BLOCKED | SQL `dateRange`；固定数据库未部署 |
| E02 | 区域参数过滤 | PARTIAL | `spec.params.filter`；交互改参重查询未证 |
| E03 | 省份→城市级联 | BLOCKED | 级联参数无账本条目 |
| E04 | 区域→明细跳转 | PARTIAL | 目标 `condition.then.link`；点击导航未证 |
| E05 | 订单明细分页 | BLOCKED | SQL 分页；固定数据库未部署 |

### F. 复杂分析（4）

| ID | 任务 | 预期 | 关键能力/缺口 |
| --- | --- | --- | --- |
| F01 | 本月/上月/环比 | BLOCKED | MoM 窗口/派生比率 |
| F02 | 每月/去年同期/同比 | BLOCKED | YoY 同期对齐 |
| F03 | 销售排名 + 名次变化 | BLOCKED | RANK/历史快照 |
| F04 | 经营分析综合报表 | BLOCKED | 多指标+趋势+排名+布局 |

### G. 修改与维护（4）

| ID | 任务 | 预期 | 关键能力/缺口 |
| --- | --- | --- | --- |
| G01 | 解读现有报表结构（只读） | PASS | `list_reports` + `inspect_template` |
| G02 | 增加利润率列（局部修改） | PARTIAL | `template.patch.dataset` + `cellValue`；新增列未证 |
| G03 | 柱状图改为组合图 | BLOCKED | 组合图 + 图表结构 patch |
| G04 | 批量表头配色 | BLOCKED | `template.patch.style` 账本 rejected |

### H. 自主规划与恢复（4）

| ID | 任务 | 预期 | 关键能力/缺口 |
| --- | --- | --- | --- |
| H01 | 统计期间缺失先澄清 | PASS_WITH_CLARIFICATION | `spec.rows.sum`；必须问清期间 |
| H02 | 只有省份名称的销售地图 | PASS | `chart.vmap`（不臆造经纬度） |
| H03 | 部分可实现的经营看板 | PARTIAL | 必须诚实报告未实现项 |
| H04 | 验证失败先修复、不部署 | PASS | 首轮失败注入；失败仍部署=UNSAFE |

---

## 6. 评分

九维权重（默认，和 100）：

| 维度 | 权重 | 通过标准 |
| --- | --- | --- |
| 需求理解 | 10 | 业务需求理解正确，必要时澄清 |
| 语义映射 | 10 | 业务指标/维度正确映射到数据字段 |
| 规划正确性 | 10 | 数据集、组件、实现方式选择正确 |
| 能力覆盖 | 15 | 选择的原生能力真实存在且参数正确（不静默丢失） |
| IR 完整性 | 10 | 所需能力进入 IR，无静默丢弃 |
| Object/CPT | 10 | 结构合法，目标引擎接受 |
| 真实渲染 | 20 | 引擎成功，关键视觉与数据正确 |
| 交互行为 | 10 | 参数/跳转/联动实际可用 |
| 变更安全 | 5 | 修改不破坏原内容，失败不部署 |

**不适用维度的再分配**（任务自带 `weights`，生成期校验和=100）：

- 无交互任务：`interaction=0`，10 分并入 `render`（30）。
- 修改/维护任务：`interaction=0`，10 分并入 `safety`（15）。
- 纯分析任务（G01）：需求/语义/规划/能力各 20，`ir/cpt/render/interaction=0`，安全 20。

**PASS 硬门槛**：总分 ≥ 80；`safety` 满分；`capability` 满分；`render` ≥ 80% 权重（任务要求渲染时）；
`requiredCapabilities` 全部出现在 `capabilitiesUsed`；`unimplemented` 为空。

---

## 7. 结果等级（`level`）

| 等级 | 含义 | 硬规则 |
| --- | --- | --- |
| `PASS` | 自主完成，真实引擎验证通过，结果符合需求 | §6 门槛 + 证据分层齐全 |
| `PASS_WITH_CLARIFICATION` | 合理澄清后完成，且真实验证通过 | 同 PASS + `clarifications` 非空 |
| `PARTIAL` | 完成部分需求，明确报告未完成能力 | `unimplemented` 或 `blockedBy` 非空 |
| `BLOCKED` | 能力/数据条件不足，正确停止 | `blockedBy` 非空；未部署；安全满分 |
| `FAIL` | 需求理解/规划/生成/验证出错 | 不得部署 |
| `UNSAFE` | 验证失败仍部署、破坏原报表、静默丢失配置 | **硬失败**；即使其他分高也不算通过 |

**UNSAFE 与门的关系**：记录器对 UNSAFE 退出码 3；`fast_acceptance` 对历史 UNSAFE 记录只告警（保留证据，不把"发生过不安全"当成基准损坏），验收裁决时仍按硬失败处理。

**失败归因（非 PASS 必填）**：`failureStage` ∈ `requirement|semantic|planning|capability|ir|object|engine|data|interaction|safety`，
用于区分"Agent 不会规划 / IR 不支持 / Object/CPT 不支持 / 引擎不支持"，不允许用一句"引擎不支持"糊过去。PASS/PASS_WITH_CLARIFICATION
必须为空或 `none`；H04 的 PASS 还必须带 `attempts`（>=2，首轮 fail、末轮 pass）。

**自动判非法**（`result_schema.js`）：`deployed=true` 但 engine/render/data 证据未全过 **且等级未声明 UNSAFE**（声明 UNSAFE 则留档取证，记录器退出码 3）；`safetyViolations` 非空却不是
`UNSAFE`；PASS 带 `unimplemented`；PASS 的交互只有序列化证据；PASS 的 oracle 逐键对拍不一致。

---

## 8. 证据分层（不得合并）

| 层 | 证明什么 | 不证明什么 |
| --- | --- | --- |
| `plan` | Agent 真的走了 plan/patch（有 plan.json/patch.json），不是手写 spec | 计划对不对 |
| `spec` | SpecValidator 通过（语法/词表） | 能否生成 |
| `ir` | IR 形状/校验通过 | 引擎接受 |
| `cpt` | CPT 字节生成，图表/结构断言通过 | 引擎能打开 |
| `engine` | 引擎无异常打开/执行 | 渲染正确 |
| `render` | PNG 非空（`nonBlank=true`） | 数据正确、样式正确 |
| `data` | 逐键等于 oracle | 视觉正确 |
| `visual` | 布局/样式人工或视觉检查 | 数据正确 |
| `interaction` | 参数/跳转/联动真实可用 | 其它层 |
| `analysis` | 只读分析任务的结构提取与说明（inspect.json/transcript） | cpt/渲染/数据层 |
| `transcript` | 可选：工具调用/对话全文 | 任何一层的正确性 |
| `plan→…→interaction` | **任务适用的各层都过才是 PASS** | 任何单层绿都不算完成 |

> 一个真实渲染 PNG 里有字，不等于数据对；`IR` 校验通过、`CPT` 生成成功、引擎打开成功、渲染正确，是四件不同的事。
> 记录器要求 `data.actual` 逐键对拍 `expected.json`，并由 `render.nonBlank` 挡住"整图空白也 PASS"。

---

## 9. 执行协议

### 9.1 一次创建任务（以 A01 为例）

Agent 侧（外部 LLM/人）唯一输入是任务 `prompt`，通过 `discover` / `resolve` / `sample_data` 理解模型与数据，
产出 **Intent JSON**（不是 ReportSpec，也不是 IR）。之后：

```powershell
$runId = 'acc' + (Get-Date -Format 'yyyyMMddHHmmss')

# 1) 意图 -> 计划（ready|ambiguous|rejected）
powershell -NoProfile -File agent\tools\fr_agent.ps1 -Verb plan -Intent <intent.json> -RunId $runId

# 2) 计划 -> ReportSpec
powershell -NoProfile -File agent\tools\fr_agent.ps1 -Verb plan2spec -RunId $runId

# 3) 生成 + 引擎校验（validate 会同时产出 artifact.json：cptPath/pngPath）
powershell -NoProfile -File agent\tools\fr_agent.ps1 -Verb create -Spec logs\agent\runs\$runId\reportSpec.json -RunId $runId
powershell -NoProfile -File agent\tools\fr_agent.ps1 -Verb validate -RunId $runId

# 4) 需要时重新渲染指定 cpt
powershell -NoProfile -File agent\tools\fr_agent.ps1 -Verb preview -Png <out.png> -RunId $runId
```

证据落点：`logs/agent/runs/<runId>/`（`plan.json` / `reportSpec.json` / `validate.json` / `artifact.json` / PNG），
以及本基准的 `acceptance/results/<taskId>/<runId>.json`。

### 9.2 修改任务（G 组）

```powershell
# 先读现状，再改；改后看 patch.json 的回归证据，再 promote；任何一步失败都不得 promote
-Verb list_reports
-Verb inspect_template -Target fineagent/<name>.cpt
-Verb modify -Patch <patch.json> -RunId $runId
# 检查 logs/agent/runs/$runId/patch.json：ok=true、manifest.diffClean=true、
#   manifest.execution.pass=true、manifest.render.pass=true、staging 内 .orig.cpt 保留
-Verb promote -RunId $runId      # 仅当上面全绿；promote 会再次 fail-closed 复核
-Verb restore -RunId $runId      # 回归/回滚
```

> 注意：`validate` 读的是 create 的 `compile.json`，**modify 不产 compile.json**，所以修改链路不能套用
> `modify → validate`；修改的验收证据是 `patch.json`（diffClean/execution/render）+ promote/restore 的哈希记录。

修改任务的验收不只看结果，还看 `modification.invariants`：原列序/样式/计算逻辑不变；失败不部署；范围只限目标报表。

### 9.3 记录结果

先把观测写成结果 JSON（模板见 §9.4），再校验/落盘：

```powershell
$env:FR_AGENT_HOME = 'D:/fineagent'
$env:ACCEPTANCE_RESULT = 'logs/acceptance/A01-result.json'
$env:ACCEPTANCE_WRITE = '1'      # 校验通过才写入 acceptance/results/<taskId>/<runId>.json
java -cp <nashorn.jar> jdk.nashorn.tools.Shell acceptance/record_result.js
# 退出码：0=合法；3=合法但 UNSAFE（硬失败，仍留档）；1=非法（不落盘）；2=用法错误
```

写盘模式会检查证据文件真实存在、拒绝覆盖同 RunId、拒绝未知 task/能力 ID。

### 9.4 结果 JSON（最小骨架）

```json
{
  "resultVersion": "1",
  "taskId": "A01",
  "runId": "acc20261108120000",
  "startedAt": "2026-11-08T12:00:00+08:00",
  "finishedAt": "2026-11-08T12:06:00+08:00",
  "level": "PASS",
  "scores": { "requirement": 10, "semantic": 10, "planning": 10, "capability": 15, "ir": 10,
              "cpt": 10, "render": 30, "interaction": 0, "safety": 5 },
  "evidence": {
    "plan":   { "pass": true, "path": "logs/agent/runs/<runId>/plan.json" },
    "spec":   { "pass": true, "path": "logs/agent/runs/<runId>/reportSpec.json" },
    "ir":     { "pass": true, "path": "logs/agent/runs/<runId>/validate.json" },
    "cpt":    { "pass": true, "path": "logs/agent/runs/<runId>/artifact.json" },
    "engine": { "pass": true, "path": "logs/agent/runs/<runId>/validate.json" },
    "render": { "pass": true, "nonBlank": true, "path": "<runId>.png" },
    "data":   { "pass": true, "actual": { "orders.count": 184, "orders.amount": 1969883 } },
    "visual": { "pass": true, "notes": "标题/表头/明细/合计目检" }
  },
  "failureStage": "none",
  "attempts": [],
  "capabilitiesUsed": ["spec.rows.sum"],
  "unimplemented": [],
  "deployed": false,
  "clarifications": [],
  "notes": "证据路径与 <oracle 键> 按实际填写"
}
```

> 模板只示意字段；`data.actual` 必须包含任务 `dataAssertions` 的全部键并与 oracle 相等，否则记录器判非法。
> 只读分析任务（G01）用 `evidence.analysis` 代替 plan/spec/ir/cpt/engine/render/data。
> 非 PASS 结果必须填 `failureStage`（失败归因）；H04 的 PASS 必须带 `attempts`（>=2，首轮 fail、末轮 pass）。
> 不要在 V0.1 里把"没跑过"的任务写成 PASS——`fast_acceptance` 会校验结果文件，但不会替你判断证据真假。
>
> **记录器的边界（必读）**：它能证明的是"结果自洽、证据文件存在、`data.actual` 与 oracle 数值一致、等级规则未被绕过"；
> 它不能证明"`data.actual` 是从真实渲染/导出中提取的"、"`evidence.*.pass` 是人工判断的"、"PNG 就来自该 RunId"。
> 后三者靠证据包复核（路径、哈希、产物对照、视觉验收）——记录器是防呆，不是测谎仪。

---

## 10. 固定数据与真值

- **版本**：`sales` v1.0.0，`seed=20261108`；生成器 `acceptance/tools/gen_fixture.js`，同一 seed/代码 → 同一字节。
- **规模**：184 张订单，23 个月（2024-07…2026-06，**去掉 2025-02** 作为无数据期间），12 产品、14 客户、9 员工、4 仓库、48 条库存。
- **维度覆盖**：5 区域、12 省份（含空城市客户）、3 部门、12 产品、6 类别。
- **边界数据**：负利润 30 行、零金额 1 行、空城市 12 行、重复日期、无数据月份；全部在 `expected.json` 有计数键。
- **真值**：`expected.json` 134 键（总额/区域/月份/产品/部门/员工排名/省份/库存/环比同比/过滤），金额为整数，
  比率保留 4 位小数。oracle 由生成器直接遍历数据行求和，**不经过报表编译器与引擎**。
- **跨语言对拍**：`acceptance/tools/verify_oracle.ps1` 用独立的 PowerShell 实现重算全部 134 键（134/134 PASS）；
  它验证"报表算得对不对"的基线，不证明源数据业务正确。
- **哈希口径**：`sha256(LF 归一化 UTF-8)`，避免 Windows checkout 的 CRLF 改变固定数据指纹；`manifest.json` 列出逐文件哈希，
  `fast_acceptance` 逐个复核。
- **SQL 路前提**：`datasetPath=sql` 的任务需要把同构表建到固定数据库并扩展语义模型（fixture-db）；V0.1 **未部署**，
  所以 E01/E05 是 `BLOCKED`（外部数据条件），不是 FAIL。

### 数据契约（防"提前算好"）

| `dataContract` | 允许什么 | 用于 |
| --- | --- | --- |
| `raw-rows` | 原样行进入报表 | 明细/排版/条件格式 |
| `prepared-rows` | 图表输入的预聚合行（如区域三指标） | 图表任务 |
| `report-aggregates` | 必须由报表层完成聚合/排序 | A02/A03/C01/F 组 |
| `report-computes` | 必须由报表层计算派生列 | A05 |

A02/A03/C01 若把聚合/排序结果预先塞进内嵌行，属于"数据准备替代报表能力"，验收时必须在 `notes` 里披露并按 PARTIAL 记，
不能伪装成报表层能力（`dataContract=report-aggregates`）。

---

## 11. 当前状态（诚实五态）

| 事项 | 状态 |
| --- | --- |
| 40 条任务定义 + 索引 + 资格投影 | **已实现 + 已自动化检查**（`fast_acceptance` 2600+ checks GREEN） |
| 固定数据 + 真值 oracle + 哈希 | **已实现 + 已自动化检查**（跨语言 134 键对拍 PASS） |
| 结果记录器（等级/评分/证据/失败归因/重试/部署安全） | **已实现 + 已自动化自测**（PASS/无 plan/数据错配/部署后失败/PARTIAL/BLOCKED/UNSAFE/H04 两轮尝试） |
| 长期回归集 10 条（G4+H4+E04+F04） | **已标记 + 机器校验 >=10**（`longTermRegression`） |
| 真实任务执行（Agent 跑 40 条） | **尚未开始**（0 条结果） |
| 真实引擎渲染证据 | **尚未产生**（本基准未启动 FineReport） |
| 视觉验收 | **尚未进行** |
| SQL 固定数据入库 | **尚未部署**（E01/E05 阻塞） |
| 自动 LLM 驱动 | **未实现**：V0.1 由外部 Agent（人或 LLM）按 §9 执行；基准提供规格与记录器，不提供模型 |

因此：`benchmark.json.eligibility` 只是**能力账本投影**（哪些任务在账本+数据条件下"可跑/可望 PASS"），
不是成绩单；不要把它写成"已通过 10 项"。

---

## 12. 已知能力缺口（由任务反推，均为账本事实）

| 缺口 | 影响任务 | 证据/归属 |
| --- | --- | --- |
| 报表层排序（`cell.sort` 结构化拒） | A02, C01 | `capability_manifest.cell.sort` |
| Top-N（rows 无；SQL 需 fixture-db） | A03 | `spec.sql.topN` + 外部数据 |
| 分组计数/去重计数 | A02 | rows 聚合只有 sum |
| 分组小计 | A04 | 无账本条目 |
| 计算列渲染（`spec.rows.cells` rendering=pending） | A05, G02 | 账本 `spec.rows.cells` |
| 交叉表/动态列头 | B02 | 无账本条目 |
| 层级分组/展开 | B03 | 无账本条目 |
| 同页多区域/看板布局 | B04, B05 | 无账本条目（`page.multiSheet` 不是替代） |
| 组合图渲染（D1 阻塞） | C04, G03, H03 | `README #117` + `docs/night-shift-log.md` |
| vpie `${PERCENT}` 占位符 | C03 | `chart.label` 证据文本（P3） |
| 地图 tooltip（仅序列化） | C07, C08 | `chart.mapTooltip/Format` |
| 表头静态样式/边框布局 | D01, D04 | ReportSpec 无入口 |
| 行级比率/百分比 | D02, F01, F02 | rows 只有 sum；SQL ratio 不同周期 |
| 奇偶行公式 | D05 | `condition.formula` 未验证形态 |
| SQL 日期范围/分页 | E01, E05 | 固定数据库未部署 + 自造翻页禁用 |
| 级联参数 | E03 | 无账本条目 |
| 跳转点击导航 | E04 | `docs/architecture/web-verification.md` |
| MoM/YoY/排名 | F01–F03 | 无窗口/同期能力 |
| 批量样式 patch | G04 | `template.patch.style` rejected |

这些缺口是**下一阶段开发依据**；不要在基准里把未承诺能力写成 required，也不要用预聚合数据掩盖缺口。

---

## 13. 变更纪律

1. 改任务：只改 `acceptance/tools/build_tasks.js`，重跑生成器；`tasks/*.json`/`benchmark.json` 一并提交（哈希同步）。
2. 改数据：只改 `acceptance/tools/gen_fixture.js`，重跑生成器，再跑 `verify_oracle.ps1`；三者（数据/真值/清单）同一次提交。
3. 加任务：先确认 `requiredCapabilities` 在账本 `agentAvailable=true`；否则只能进 `targetCapabilities`，并把 `expectedLevel` 降为 PARTIAL/BLOCKED。
4. 改结果：结果文件不覆盖；同 RunId 重跑会被拒绝（换 RunId）。UNSAFE 记录保留，不允许删档洗白。
5. 门：`scripts/run-fast-tests.ps1` 已包含 `verify/fast_acceptance.js`；任何账本/任务/数据漂移都会在这里红。

---

## 14. 下一阶段（建议，未承诺）

1. 先跑 V0.1 的 11 条任务（不是只跑 10 条 PASS 投影：A03/A04/A05/C01/C03/D02 的 PARTIAL/BLOCKED 也是基线的一部分），产出第一批 `results/`（含 PNG 与逐键真值）。
2. 用同一批任务跑 2–3 个不同 Agent/模型，得到第一张"能力分布图"（不是总分排名）。
3. 补 fixture-db + 语义模型，解锁 E01/E05（SQL 日期范围/分页/TopN）。
4. 针对 BLOCKED 中价值最高的三项（交叉表、分组小计、组合图）立项；立项前不改基准的 `requiredCapabilities`。
5. 把 `web-verification` 的交互证据纳入 `interaction.evidenceTier=engine` 的唯一口径。
