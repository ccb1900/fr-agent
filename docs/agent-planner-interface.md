# fr-agent · Report Planner 确定性接口（I4，r2 §4；2026-11-04）

> 给**现成 Agent**（Codex/Claude 等）的规划层接口契约。I4 **不自建 Agent、不跑 LLM**（r2 §I4 明说用现成 Agent，fr-agent 只提供确定性工具）。本文只描述已存在的确定性件；NL→结构化意图那一环由现成 Agent 承担，闭环实跑在 I5 接入。

## 0. 定位：planner 在三能力里的位置

| 能力 | 件 | 产出 |
|---|---|---|
| 知道数据是什么 | I2 `semantic/schema` → `data/schema_<source>.json` | 结构事实（类型/可空/PK/FK 三分桶） |
| 知道业务是什么意思 | I3 `semantic/model` + `models/production/model.json` | 实体/指标/维度/关系，映射可回溯 I2 |
| 知道如何生成报表 | I1 `lib/spec_validator`+`spec_compiler`（ReportSpec→IR） | 受约束 JSON 报表规格 |
| **I4 把上面接起来** | `semantic/planner`（本层） | **结构化意图 → ReportSpec + 假设/追问/警告** |

planner 是**纯函数编排**：注入 I3 `ModelResolver`（术语解析）、I1 `SpecValidator`（合法性）、能力名册 `ReportSpec`。它**不重造校验**、**不 load 后端**、**零 Java/零 com.fr**（满足 ABR-1 R7）。

## 1. 输入：结构化意图（不是自然语言）

现成 Agent 的职责是把用户需求转成本意图对象，再交给 planner：
```
intent = {
  outName,                       // 裸文件名（planner 会经 I1 outName 路径安全闸）
  reportName?,                   // 报表标题
  dimensions: [ "<业务术语>", … ],          // 分组键，如 "bizTime"/"collectionDate"（须能在 I3 模型唯一解析）
  metrics: [ { term:"<业务术语>", aggregation?:"sum" }, … ],   // v1 只 sum（列求和）
  rows: [[…], …],                // 内嵌数据行（由 Agent 查询/聚合后供入；列宽 = dims+metrics）
  filters?, chart?,              // 越权项 → 触发 deferred（不静默降级）
  presentation?: { showTotal? }
}
```
术语取值口径 = I3 模型的实体属性名/业务标签/物理列名/指标名/维度名。`ModelResolver.resolve` 决定它是 resolved / ambiguous / unknown。

## 2. 输出：四件套（r2 §4.2）

```
{
  status: 'ready' | 'ambiguous' | 'rejected',
  reportSpec: <I1 ReportSpec | null>,   // 仅 ready 时非空
  assumptions: [ {key,value,why} ],     // 非正确性默认（版式/宽度/是否合计）——自决不追问
  unresolvedQuestions: [ {kind,term,candidates,requiresConfirmation:true} ],  // 正确性歧义——必问，不替用户选
  validationWarnings: [ {term|feature,reason,owner} ]   // 越权/未知——明拒，标归属迭代
}
```

## 3. 三分流铁律（r2 §4.3 追问策略固化）

- **不问的（→ assumptions）**：字体、颜色、列宽、单元格位置、是否合计 → 按产品设计规则自决。
- **必问的（→ unresolvedQuestions）**：指标口径不清、一个概念多字段候选（如"评分"→属性 score + 指标 avgScore）、数据关联不确定、粒度不一致 → **planner 绝不自动选**，交回人类/上层 Agent 确认。
- **必拒的（→ validationWarnings）**：超出后端能力（filters/chart 属 I2/I3/I4；ratio/count/avg 聚合属 I5 语义查询） → 结构化拒 + owner 标注，**绝不悄悄降级**（如把 ratio 偷塞成 sum）。
- **绝不编造**：未知业务术语 → warning（"模型缺口，未编造字段"），不会凭空造 dimensions/metrics 里的字段（r2 §4"不能产生未定义的数据字段/不静默编造业务指标"）。

## 4. 与 I1 的接法（闭环，I5 用）

planner 产出的 `reportSpec`（status=ready）即 I1 ReportSpec，写盘 `examples/report-spec/<name>.json`，走 I1 JSON 入口：
```powershell
$env:REPORT_SPEC='examples/report-spec/<name>.json'; .\run.ps1 -Script make_api.js
```
planner 内部已用**同一个** `SpecValidator.validate` 复验 ready spec 必 0 err（一处真相），所以 planner 自吐的 spec 进 I1 不会再被拒。越权项（ratio/筛选/图种）的真实报表走已验证的 rawIR 语料路（#52 agent_stage_report），I4 不强行塞进 I1 v1。

## 5. 离线可证伪（不依赖 Agent/引擎/库）

`verify/fast_planner.js`：喂真 I3 模型 + 真 I1 SpecValidator，跑 20+ 需求矩阵，四分支全断言（明确→ready 过 I1 0 err、模糊→requiresConfirmation 不自动选、越权→deferred+owner、未知→不编造）。planner 纯函数：确定序、输入不可变、抗炸。跑法同 fast 层（`scripts/run-fast-tests.ps1` 第 8 套件）。

> I5 计划把「现成 Agent 产 intent → planner → I1 → CPT → RESULT 自修」接成真闭环端到端；I4 只交付确定性件 + 本接口契约，不抢 I5 的活。
