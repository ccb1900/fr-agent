# 外置 Agent 实测走查报告（2026-11-10，基线 b81db05）

> 提供方：外置 agent 实测（discover → plan ×2 → semantic inspect/create/validate/publish 现场走查）。
> 本文按"分级 + 逐条修复映射"维护——**每条末尾记实施结果**，方便回访。
>
> **2026-11-10 状态：W1–W10 全部落地**（见文末"修复映射"；验证=fast_assets_read 112 项全绿 + detail 全链真引擎 rc=0 + fast 22/22 + scan 128/0 + 边界/ps1-static/集成全绿）。

## P0 流程断供
1. **review.{by,at} 无合法入口**：`semantic create` 拒自带 review（防代填），但 17 verb/11 参数没有能写 review 的动作；publish 死锁 PUBLISHED_WITHOUT_REVIEW；错误 nextActions 为空（违约自己定的"失败带 nextActions"合同）。 → **修复：见 §映射 W1**
2. **版本 bump 无合法入口**："同版本内容变更拒"→必须 bump，但 bump 只能手改 model.json，踩铁律"不手改模型文件" → **W2**

## P1 契约不一致
3. **明细表不可达，概念混同**：plan 拒 metrics 空的明细意图；维度白名单把"分组键"与"可展示列"混在一数组，实体 properties 上不了报表 → **W3**
4. **plan 候选语法自相矛盾**：ambiguous 候选给的 ref `InspectionRecord.fileKey`，照抄回 Intent 却被拒；score 给 4 个混杂候选无从下笔 → **W4**
5. **承诺面与表达面脱节**：`page.repeatHeaderRow` 在 agentAvailable 但 spec sheet 键白名单不收 → **W5**
6. **examples 教的比账本承诺弱**：examples.md G3 教 `params`，账本 spec.params.panel=unavailable(webInteraction) → **W6**

## P2 体验与一致性
7. **domain/Target 双轨**：`semantic inspect -Target production` 内部 domain:laser_inspection、create 落 models/<目录域>；三拨名字并存 → **W7**
8. **RunId 孤儿堆积无作废机制**：改 Intent 换新 RunId → rep001/rep002/rep002x 垃圾串；无同 Intent 重试口径 → **W8**
9. **能力级失败回不了根**：参数+分页类需求在 resolve/plan 阶段只有词级候选，能力级提示到 spec 校验才出现 → **W9**
10. **文档承诺与实测不符**：SKILL.md 宣称"已全链验证"，实测明细 rejected、发布死锁，初见信任成本高 → **W10**

## 修复映射（对应仓库提交）
W1 semantic+assets 增 `review` 动作（by 由人传、at 工具 ISO、published 不可再 review、deprecated 拒）；publish/版本相关 bail 补 nextActions（合同违约清零）。
W2 semantic+assets 增 `revise` 动作（modelVersion 必须 > 当前；draft-tier 校验；拒自带 review；低版本拒）。
W3 明细表通路（presentation.type='detail'）。plan 层 dims= 实体 properties 合法上报表；metrics 允许空；spec/编译沿用既有 rows 通路——**实测留痕见 W3 节**。
W4 候选 ref 与 Intent 接受语法同形（`Entity.property` 直接可粘）；同名跨体候选降级并标注归属，避免无从下笔。
W5 repeatHeaderRow：按代码现实接通或如实降级 manifest（二选一，见映射）。
W6 examples G3 改口径：运行期参数筛选按账本如实（unavailable 即 unavailable），不教黑金写法。
W7 list/inspect 输出 `domainDir`+`modelDomain` 双字段，模型内域≠目录域时 warnings 提示。
W8 plan.json 记 `intentHash`（同 Intent 可同 RunId 复跑——零引擎 verb 幂等）；SKILL/tool-api 补"失败重试同 RunId 直接覆盖"口径。
W9 plan 阶段即注入能力级 unresolvedQuestions（分页/参数/筛选关键词命中 → 对应账本 unavailable 提示），不等 spec 校验回头。
W10 SKILL.md 承诺措辞改为"能力门与失败结构化拒绝均结构化实测（2026-11-10 D3.6）"， refraining 全链宣称。
