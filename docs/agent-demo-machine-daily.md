# Agent 创作闭环演示（r7-B，机台生产日报）

> 目标（r7 §5）：验证"现成 Agent 从一句自然语言需求开始，自己完成一份可执行、数据正确、能预览的报表"。
> 边界：Agent 只产出 ReportSpec JSON 与交付说明；fr-agent 负责编译、执行、数据核验、预览。

## 1. 用户需求（原句）

> 帮我创建一份机台生产日报，按日期和机台统计计划数、完成数和完成率，支持日期筛选，完成率降序排列，并突出显示低于 80% 的机台。

## 2. Agent 侧（独立子代理，只读工具契约与能力清单）

- 依据：`docs/agent-tools.md`、`logs/agent/discover.json`（discover verb 产出）、`models/production/model.json`。
- 产出：`examples/report-spec/machine_daily_demo.json` + 交付说明（`logs/agent/agent_response.md`）。
- 逐项结论：按日期/按机台/计划数/完成数/完成率 = 支持；日期筛选 = 仅编译期字面量（运行期控件未接）；
  完成率降序 = 不支持（派生化率不在 SQL 中）；<80% 高亮 = 不支持（无按条件格式能力）。
- 替代方案：排序改 `[{bizDate asc},{planned desc}]`；高亮交导出后处理；日期区间写死 2026-09-13~2026-09-22。
  三项限制均显式告知，未静默降级。

## 3. fr-agent 侧（工具层执行）

```text
discover  → {"ok":true,"result":"logs/agent/discover.json"}
compile   → {"ok":true,"result":"logs/agent/compile.json"}
validate  → {"ok":true,"result":"logs/agent/validate.json"}   (-ExpectTotals 33531:26531)
preview   → {"ok":true,"result":"logs/agent/preview.json"}
```

- compile：`success=true`、11 阶段全 passed，产物 `机台生产日报_api.cpt/.png/.pdf`。
- validate（栅格 13 行：10 天 × 机台明细 + 合计）：
  - 合计行 = 明细之和（planned 33531、done 26531）；
  - `completionRate = done/planned×100`（79.1238±0.01）；
  - 与外部真值 `33531:26531` 对拍通过。
- preview：PNG 1587×2245、34 KB、非空白。

## 4. 这说明什么

- 工具面（discover/resolve/compile/validate/preview/patch）足以让外部 Agent 完成一次真实创作闭环；
  Agent 全程未接触 Java 对象/CPT XML/任意 SQL。
- 能力边界是**结构化可读**的（discover 的 capabilities + 编译期拒），Agent 能据此主动告知用户而不是编造。
- 数据正确性有独立证据（栅格合计/公式/外部真值），不是"能生成就算成功"。

## 5. 复现命令

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 discover
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 compile -Spec examples/report-spec/machine_daily_demo.json
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 validate -ExpectTotals "33531:26531"
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 preview -Png "<编译产出的 png 绝对路径>"
```
