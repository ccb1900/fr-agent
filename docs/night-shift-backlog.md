# Night Shift 待办（Backlog）

> 每项：优先级/真实问题证据/用户影响/预期修改范围/验收标准/外部依赖。完成即移除。不得把纯风格偏好包装成高优先级。

## 进行中

### B1（P2-A）：SQL intent 中 ambiguous 术语应反问而非 rejected
- 优先级：P2（需求理解主线；r22-golden-scope.md §3 点名的语义差距）。
- 真实问题证据：待核实——r22 审查称"SQL Planner 对未规范化的维度名称走模型成员缺失检查 → rejected 而非反问"；r10-C 则称胶水层"ambiguous/unknown 原样透传走 unresolvedQuestions"。两者矛盾，需读 `agent/tools/plan.js`（TermNorm.normalizeList）与 `semantic/planner/planner.js` sql 分支实际交互定性。
- 用户影响：用户说"按机台"（术语双指）时 Agent 硬拒而不是反问是哪台——需求理解质量核心场景。
- 预期修改范围：plan.js 胶水层（若缺陷在透传）；不动 planner 本体（r10-C 约束）。
- 验收标准：ambiguous 术语 → plan 输出含 unresolvedQuestions(requiresConfirmation=true) 且不静默 rejected；fast_planner/fast 断言覆盖。
- 外部依赖：无。

## 候选（待任务三审查后定级）

### B2：patch 失败后的状态可判定性（P2-D 修改可靠性）
- 待走查 `template/patch.js`/`reader.js`/`inspector.js` 的失败路径：patch 中途失败时 staging/部署件状态是否明确、能否准确报告"改了什么/没改什么"。
- 验收标准：失败场景 exit≠0 且 artifact/manifest 如实反映；无半成品冒充成功。

### B3：v2+ 解锁清单（机台筛选/TOP-N/图表/SQL 阈值修改）
- 外部依赖：审查方逐项点名解锁（r22 §6.2 约定）。夜间自主工作**不擅自动**，仅在 backlog 记账。

### B4：运行期日期参数（README #62 记档的架构取舍）
- 外部依赖：同 B3，属能力解锁范畴，不夜间擅动。
