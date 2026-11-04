# 报表创作架构（vNext）与统一产物契约

> 来源：r8 全局架构审查（`docs/gpt/r8.md`），本文件落地其中 **A1 统一创作契约**，并把长期方向写成可检索口径。
> 原则：**不推翻现有代码**；先建接口再谈迁移；Compiler 是基础设施，产品中心是 Report Authoring。

## 1. 六层目标视图（不是当前目录结构）

| 层 | 职责 | 当前代码 |
|---|---|---|
| Agent Integration | 外部 Agent / 未来 MCP，只提供专业工具 | `agent/tools/`、`docs/agent-tools.md` |
| Application Services | Create / Modify / Validate / Preview 编排与统一结果 | `application/` |
| Intelligence | Schema → Model → Resolver → Planner → SQL + Preflight | `semantic/` |
| Authoring | ReportSpec / PatchSpec / Template Inspector | `lib/report_spec.js`、`lib/spec_*`、`template/` |
| Compiler | ReportSpec/IR → FineReport Object → CPT | `lib/ir.js`、`lib/object.js`、`lib/cpt.js` |
| Backend & Runtime | 对象 API / CPT I/O / 执行 / 渲染 / 连接 | `runtime/`、`make_api.js` |
| Quality & Artifact | 回归 / 真值 / 视觉 / ReportArtifact | `verify/`、`logs/agent/artifact.json` |

**口径统一（r8 §八）**：Semantic 在**依赖上**与 Core 解耦（不 import 报表对象、零 Java），在**创作流程中**参与报表生成（Planner/SQL/Preflight 是 AI 创作链的一部分）。两句话同时成立，不矛盾。

## 2. ReportArtifact v1（统一产物契约）

Create 与 Modify 产出**同一种** JSON（`logs/agent/artifact.json`），Agent 只消费它，不再解析控制台日志。

```json
{
  "artifactVersion": "1",
  "artifactId": "generated:机台生产日报",
  "sourceType": "generated | patched | duplicated",
  "outName": "机台生产日报",
  "createdAt": "2026-11-04T12:31:25Z",
  "cptPath": ".../机台生产日报_api.cpt",
  "pngPath": ".../机台生产日报_api.png",
  "pdfPath": ".../机台生产日报_api.pdf",
  "execution": { "ok": true, "exit": 0, "stages": { "...": "passed" }, "failedStage": null, "source": "runresult|patch" },
  "validation": { "ok": true, "checks": [{ "name": "...", "pass": true, "detail": null }] },
  "preview": { "path": "...", "bytes": 34057, "width": 1587, "height": 2245, "blankish": false },
  "diagnostics": [{ "code": "UNSUPPORTED_RELATION_KEY", "path": "relationships[0].to.column", "message": "...", "stage": null, "severity": "error" }],
  "spec": { "path": "examples/report-spec/...", "kind": "report-spec" },
  "patch": null,
  "staging": null
}
```

- **结构校验**：`ReportArtifact.validate(art)`（generated 必带 `spec`，patched 必带 `patch`）。
- **业务验收**：`ReportArtifact.acceptance(art)` = 执行成功 + 无 `severity:error` 诊断 + `validation.ok !== false`；`warn` 不阻断。
- **诊断统一**：RunResult 的字符串诊断与 patch manifest 的回归结果都归一成 `{code,path,message,stage,severity}`；失败段另发 `STAGE_FAILED`。
- **防陈旧验收**：Create 默认不读 `validate.json`；只有 `validate` verb 显式设置 `AGENT_WITH_VALIDATION=1` 时才并入本轮验收。

## 3. 操作与工具映射

| 操作 | 工具调用 | 产物 |
|---|---|---|
| Create | `fr_agent.ps1 compile -Spec <ReportSpec.json>` | CPT/PNG/PDF + RunResult + artifact(generated) |
| Modify | `fr_agent.ps1 patch -Patch <PatchSpec.json>` | staging CPT + 结构/执行/渲染/数据集回归 + artifact(patched) |
| Validate | `fr_agent.ps1 validate [-ExpectTotals a:b]` | validate.json + 刷新 artifact.validation |
| Preview | `fr_agent.ps1 preview -Png <png>` | preview.json（尺寸/字节/空白判定） |
| Discover / Resolve | `fr_agent.ps1 discover` / `resolve -Term` | 能力清单 / 语义三态 |

## 4. 明确冻结（r8 §十二）

| 事项 | 原因 |
|---|---|
| 再造 Agent Runtime | 已选择 existing Agent |
| 完整 CPT → IR 反编译 | FineReport 对象图不保证可无损恢复业务意图 |
| 大规模重写 object.js / 迁移 TypeScript / 引入 ANTLR | 现有引擎实证与 Nashorn 约束 |
| 多 Backend 抽象 / 完整 OWL·RDF | 当前只有一个后端与轻量本体 |
| 目录大搬迁 | 先有稳定接口再迁移（本文件即是接口） |

## 5. 下一阶段（A2）启动条件

A2（把可表达的 JS Feature 逐步转为 ReportSpec）必须先产出"5 类现有报表的新旧路径对照清单"：
同数据、同结构、同渲染三项对比，不允许为迁移牺牲能力；不能表达的能力登记为缺口，不做静默降级。
在此之前，只做 A1 契约与 A3 闭环（已交付，见 `docs/agent-demo-machine-daily.md`）。
