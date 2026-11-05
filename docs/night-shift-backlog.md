# Night Shift 待办（Backlog）

> 每项：优先级/真实问题证据/用户影响/预期修改范围/验收标准/外部依赖。完成即移除。不得把纯风格偏好包装成高优先级。

## 进行中

### B2（P2-D）：patch 失败后的状态可判定性（修改可靠性）
- 待走查 `template/patch.js`/`reader.js`/`inspector.js`/`diff.js` 的失败路径：patch 中途失败时 staging/部署件状态是否明确、能否准确报告"改了什么/没改什么"、失败后 artifact/manifest 是否如实。
- 验收标准：失败场景 exit≠0 且 artifact/manifest 如实反映；无半成品冒充成功；原件在任何失败路径下保留。
- 外部依赖：无。

## 已完成（从待办移除的记录）

### ~~B1（P2-A）：SQL intent 中 ambiguous 术语应反问而非 rejected~~（2026-11-05 完成）
- 证据定性成立（plan.js 透传 + planner sql 分支 rejected 硬拒，与内嵌路径反问不一致）；修复=planner sql 分支 memberCheck（ambiguous→unresolvedQuestions 反问/unknown 保持拒/混合态反问优先/ambiguous 时 spec=null）；fast_planner 6 断言先红后绿+真通道冒烟 status=ambiguous+requiresConfirmation=true；全门 GREEN。commit 见 night-shift-log。

## 候选（待任务三审查后定级）

### B2：patch 失败后的状态可判定性（P2-D 修改可靠性）
- 待走查 `template/patch.js`/`reader.js`/`inspector.js` 的失败路径：patch 中途失败时 staging/部署件状态是否明确、能否准确报告"改了什么/没改什么"。
- 验收标准：失败场景 exit≠0 且 artifact/manifest 如实反映；无半成品冒充成功。

### B3：v2+ 解锁清单（机台筛选/TOP-N/图表/SQL 阈值修改）
- 外部依赖：审查方逐项点名解锁（r22 §6.2 约定）。夜间自主工作**不擅自动**，仅在 backlog 记账。

### B4：运行期日期参数（README #62 记档的架构取舍）
- 外部依赖：同 B3，属能力解锁范畴，不夜间擅动。
