---
name: finereport
description: 用 fr-agent 创建、修改、核验 FineReport 报表的官方工作流。只要用户要求出报表、做日报/月报/明细表/汇总表/图表报表、改已有 cpt、问某个报表功能是否支持、或要用真实业务数据做统计表，就应使用本技能——即使用户没说"FineReport"或"fr-agent"。本技能只驱动 agent/tools/fr_agent.ps1 的现有 verb，不写 Java、IR、CPT XML 或自由 SQL，也不引入 MCP/新运行时。纯代码重构、文档整理、只看 cpt 文件字节不算本技能范围。
---

# fr-agent 报表创作（官方 Agent 入口）

这个技能教 Agent **如何把一句自然语言需求变成一张可验证、可交付的 FineReport 报表**。工具已经存在且其拒绝面是结构化的（2026-11-10 D3.6 实测口径：分组合计/明细/参数面板/条件高亮等各形态的可用与不可用以 `discover` 的 capabilityManifest 为准，明细表 presentation.type=detail 已通 plan→create 全链）；Agent 的职责是理解需求、追问歧义、按流程调用、如实交付，而不是重新实现报表构造。能力墙不是工具坏了——遇到 UNSUPPORTED_CAPABILITY/维度不在模型/明细歧义列 这类结构化拒，如实转述给用户并给替代，不要把 unavailable 说成 supported。

唯一执行入口是 `agent/tools/fr_agent.ps1`（17 个 verb）。**不要**绕过它去直接跑 `run.ps1`、`make_api.js`、`lib/*` 或编 CPT XML——Runtime 的单实例互斥、RunId 隔离、失败非零退出都在这条壳层里，绕过即失去保护。

## 何时触发

| 用户说 | 走哪个场景 |
|---|---|
| "出一份……日报""按……分组统计""做张带合计/图表的报表" | A 创建新报表 |
| "把标题改成……""这张报表的数据换一下" | B 修改已有报表 |
| "支持……吗""能不能做交互式筛选/改列宽" | C 能力咨询 |

涉及部署目录里已有的 `.cpt`、或修改后要**正式覆盖**时，先读 `references/error-handling.md` 的授权规则。

## 三条场景（详细命令与判定读 `references/workflow.md`）

**A 创建**：`discover` → 有歧义先 `resolve`/向用户追问 → 写意图 JSON → `plan -Intent` → 检查 `ready` → `plan2spec`（同一 RunId）→ `create -Spec`（同一 RunId）→ `validate`（有真值必带 `-ExpectTotals`）→ `preview` → 交付。

`plan` 返回 `ambiguous` / `rejected` 时**停下追问**，不要猜字段。全程共用一个 `-RunId`：`plan.json` → `reportSpec.json` → `compile.json` → `validate.json` → `artifact.json` 是同一条链接力。

**B 修改**：`list_reports` → `inspect_template -Target` 拿真实格坐标 → 写 PatchSpec → `modify -Patch` → 检查 staging 的 `manifest`（`diffClean` / `execution.pass` / `render.pass`）→ 交付 staging 结果。**默认到此为止**；`promote` 会覆盖正式部署件，必须用户明确授权。

修改白名单只有 `replace_cell_value` 和 `replace_dataset`。样式、列宽、增删列、筛选、参数默认值、标题对象都 **UNIMPLEMENTED**，不得宣称支持。

**C 能力咨询**：`discover` → 只看 `capabilityManifest` / `agentAvailable` 名单 → 说明支持状态、限制与替代。`agentAvailable=true` 表示"可按账本承诺"，不等于每项都跑过全生命周期（看 `evidenceGrade.fullE2e`）。

**D 资产缺口（语义/数据集）**：用户要的词不在模型里、或需要新数据集时——**不要**改 `model.json`、不要手写 Dataset。产出一份变更申请 JSON（`logs/agent/runs/<runId>/semanticRequest.json`），字段：`type`（add_metric/add_dimension/confirm_relation/add_dataset/new_dataset_metric…）、`term`、`proposed`、`evidence`（schema 快照 + `sample_data` 采样 + 真值文件）、`businessOwnerQuestion`（要人确认的口径一句话）。交人确认后再进入资产变更流程。理由：模型与 Dataset 是**业务事实的权威源**，Agent 有提议权、无自确认权。

## RunId 卫生（走查 P2-8 落地口径）

- **失败/歧义的 plan 可以同 RunId 直接重跑**：plan/resolve/discover 都是零引擎幂等 verb，同 RunId 重跑=产物覆盖，不会撞 `RUNID_EXISTS`（那把锁只管引擎 verb）。`plan.json` 带 `intentHash`（意图文件 MD5）——同 hash 说明意图没变，重跑结果可直接复用；改了 Intent 建议换新 RunId，旧的留给 postmortem，不需要作废机制。

## 铁律（每条都有原因）

1. **不臆造业务事实**：实体/维度/指标只能来自 `discover` 的模型与 `resolve` 的解析结果。未知术语 → `unknown`，问用户，不编字段、不猜表。
2. **不写底层产物**：只写 Intent JSON / ReportSpec JSON / PatchSpec JSON。SQL 由 `semantic/query/sqlbuilder` 从模型生成；IR、对象图、CPT XML 由管线生成。**Dataset 资产（`models/<domain>/datasets/*.json`）与语义模型（`models/<domain>/model.json`）用管理 verb 操作，不手写**：`assets`/`semantic` 各**九动作**（list/inspect/create/validate/publish/**review/revise**/deprecate/impact）落实完整生命周期。**review=人审入口**（`-Action review -Target <id> -ReviewBy "<业务人名>"`——由业务人自己执行或明确转述人名，Agent 绝不发明名字）；**revise=合法版本 bump 入口**（版本必须 > 当前、拒自带 review——bump 后必须重审再 publish）。发布被 PUBLISHED_WITHOUT_REVIEW 拒时，不是死锁：走 review 动作 → 再 publish。需要新数据集/新指标时按 §场景 D 产出变更申请交人确认。
3. **不跳过 `validate`**：`create` 的 `exit=0` 只说明工具链跑通；合计/公式/栅格自洽由 `validate.json` 判定。有真值时用 `-ExpectTotals` 对拍，执行成功不等于数据正确。
4. **歧义必问**：`ambiguous`、`requiresConfirmation`、用户口径冲突都停下来问。一次问清，别用"先按常见的来"蒙过去。
5. **不静默降级**：不支持的能力要明说并给替代（如"按派生完成率排序"→ 改按计划数排序）。不要偷偷删掉用户要求的字段或图表。
6. **修改守白名单 + staging**：PatchSpec 越权 op 会被结构化拒；`diffClean`/执行回归/像素 diff 任一不绿即报失败，不得把 staging 件说成已交付。
7. **不绕 Runtime**：不要自己起 JVM、不要删 `active.json`/`java.pid`、不要并发提交同 RunId 的引擎 verb。`RUNTIME_BUSY` 是正常拒绝，等待后重试，不要"清锁继续"。
8. **部署需授权**：`promote`/`restore` 改的是正式部署件。未经用户明确说"部署/上线/覆盖正式报表"，不调用；交付时说明产物还在 staging。
9. **诚实交付**：区分"已生成 / 已自动验证 / 需用户肉眼过目"。PNG 像素检查只能发现空白，不能替代人看排版；不说"validator 绿了就完成"。

## 调用形态

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 -Verb <verb> [参数] -RunId <同一链>
```

每次调用打印**一行 ASCII JSON**：`{"ok":true,"runId":"…","result":"logs/agent/runs/<runId>/<verb>.json"}`。详细结果（含中文）在 `result` 指向的 UTF-8 文件里，**读文件**再判断，不要只看那一行。

- `exit 0` = 该 verb 可向前走；`1` = 失败/未决；`2` = 用法错。失败输出带 `nextActions`，照它做，不要改断言迁就。
- `resolve`/`plan` 的 `ambiguous` 是"有候选可反问"：读 `unresolvedQuestions`/`candidates` 后**问用户**。
- 英文/ASCII 路径才安全：PS 5.1 在 GBK 主机上会打乱中文路径。产物名可以中文，但 `-Spec`/`-Intent`/`-Patch`/`-Png` 一律用仓库内 ASCII 路径，PNG 预览走 `artifact.json` 里的 `pngPath`（见 `references/error-handling.md`）。

## 交付清单

创建任务交付给用户时，按这个顺序说清：

1. 报表名 + `cptPath` / `pngPath` / `pdfPath`（从 `artifact.json` 读）
2. `validate.json` 的 checks 全 pass；有真值时给出对拍数字
3. `artifact.json` 的 `acceptance.ok` 与 `runId`
4. 用户需要肉眼过目的东西（排版、中文、图表观感）
5. 明确列出未支持/被替代的需求，以及"未部署/已部署"的状态

## 深入阅读

- `references/workflow.md`：三场景逐步命令、RunId 接力、每步判定
- `references/tool-api.md`：17 个 verb 的参数/产物/取锁面
- `references/report-spec.md`：Intent 与 ReportSpec 写法、PatchSpec 白名单
- `references/capability-rules.md`：capabilityManifest 为唯一能力依据
- `references/error-handling.md`：错误分类、重试与停止、部署授权
- `references/examples.md`：真实可用样例（GOLDEN v1 / G2 / G3 / 修改标题）
- `references/assets.md`：Dataset / Semantic 资产的七动作生命周期、契约边界（发布人审、数据侧证据不跨库）、变更申请格式、为什么 Agent 不能自确认口径

仓库事实库 `README.md`、工具契约 `docs/agent-tools.md`、架构边界 `AGENTS.md` 仍有效；技能与代码冲突时**以代码和机器输出为准**，并把它当成待修的文档问题报告出来。
