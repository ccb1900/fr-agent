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


---

## 二轮走查（同日，验收 W1–W10 + 新暴露 3 项）

**实测确认已修**：P1-3（明细 G4 全链通：laser_aaa_rep005 plan ready→create→validate 8 绿→preview 非空白 1587×2245）、P2-8（intentHash+同 RunId 复跑口径）、P2-9（能力级 unresolvedQuestions 实测输出）、P1-6（G3 账本口径）、P2-10（SKILL 措辞）。

**二轮新暴露 → 三轮修复（2026-11-10 当轮完成）**：

| # | 问题 | 修复 | 验证 |
|---|---|---|---|
| N1 | `machine` 单候选假歧义（明细列唯一 dimension 候选被 ambiguous 拒） | `normalizeDetailColumns`：usable 扩展收 dimension；唯一 dimension 候选=无歧义直接采纳（sqlbuilder dimsByName 命中）；dimension 与 property/column 并存才真歧义照问 | w3c_plan：含 machine 的明细 intent → **ready**（dims=[bizTime,fileKey,machine]） |
| N2 | `acceptance` 死穴（三前提全满足仍 null；preview 合入需"preview 后再跑 validate"的隐秘次序） | 双修：①fr_agent.ps1 preview 段跑完**立即刷新 artifact**（同 validate 规，调用 create_report.js）——preview 合入不再隐秘；②create_report.js `art.acceptance = acc` **落盘**（此前只算不写） | w3c_chain：create→validate→preview → **preview merged=true + acceptance.ok=true**（executionOk/validationOk/errorDiagnostics=0） |
| N3 | discover 表达面无 detail + repeatHeaderRow 标签错挂 unverifiedRendering | ①report_spec capabilities sql 段补 `detail（…）`；②manifest 回四层 verified + **agentOverride=false**（rawIR 回归可重复+agent 无入口→e5Evidence 分类，语义精确） | fast_capability_gate_consistency PASS（94/68/26 冻结口径） |

**文档根因补修（外置 agent 没发现 W1/W2 新动作的原因）**：SKILL.md 九动作 + review/revise 用法与"被 PUBLISHED_WITHOUT_REVIEW 拒不是死锁，走 review→publish"指引；tool-api verb 行补 -ReviewBy/-Doc；assets.md assets/semantic 两段补 review/revise 行——sync 三份到用户级。

**domain 双轨（走查第 5 条）复核**：W7 已在（list/inspect 输出 domainDir…实际字段名 `domain`+`modelDomain`+`domainMismatch` + DOMAIN_MISMATCH_HINT warning）——走查者实跑的是 2c3cafb 之前的 commit，字段在 b81db05..2c3cafb 的 semantic.js 里；文档（assets.md）补一句"语义寻址用目录域，modelDomain 仅展示"随本轮 sync 生效。

**附记（三轮零星）**：二轮提交误将走查者 create 落盘的 `models/laser_inspection/model.json` 带入仓库（git add -A 连坐）——已移除；同时给 semantic create 落盘后补 DOMAIN_DIR_HINT nextActions（目录域=寻址权威，模型内部 domain 字段仅展示——P2-7 的实锤危害闭环）。


---

## 三轮走查（同日，5/7 确认 + 4 实项 1 情报 → 当轮全清）

**实测确认已修（5/7）**：machine 假歧义（rep006 七列含机台 plan ready 一把过）、acceptance 死穴（validate 阶段组装+preview 合入 ok 保持）、review 九动作落地（结构化拒+nextActions 指路）、revise/publish 闭环（publishedAt ISO+快照）、domain 双轨显性标注（domainMismatch）。

**三轮四实项 → 修复**：

| # | 问题 | 修复 | 验证 |
|---|---|---|---|
| R3-1 | 账本/expression 面没画 detail（agent 能力咨询仍答"不支持"） | manifest 增 **spec.sql.detail**（四层 verified，evidence 引证 README #188 + carrier fast_assets_read/e2e；scope=行级直读无聚合）；账本 95/69/26 冻结口径同步 | fast_contracts 引证门 + capability_gate_consistency PASS |
| R3-2 | 数字/措辞三处不一致（tool-api"共 11 个"、assets.md"五/七动作"、AGENTS 计数） | tool-api 参数表改**15 个**（列全名单）；assets.md 标题句改**九动作**；AGENTS 95/69/26 | sync 用户级 |
| R3-3 | review 用法错不落盘（ps1 层拦截 → run 目录 JSON 空转） | ps1 拦截块删除（semantic+assets 两分支）——usage 判定归 js 层 bail（产物必落盘）；**顺带修复 assets review 的 -ReviewBy 从未传入 ps1 的断线** | suite 114 项（含两条落盘断言） |
| R3-4 | create 落盘目录随草案内部域漂移（-Target production 落 laser_inspection 缝里） | create 目录域=显式 -Target > 草案域；**草案内容不改写**（model.domain 参与指纹——改写即证据失效，实测反例记档）；输出双轨字段+NOTE 提示 | suite：内部域草案+显式 Target → 落对目录+内容原样 |

**情报项确认**：repeatHeaderRow e5Evidence 分类正确（agentOverride=false 表达"差 Agent 全链一个 run"）。

**遗留清零状态**：走查三轮全部实项关闭；未验证如实挂账——assets review/revise 引擎 e2e 未单跑（semantic 链全链已通）、repeatHeaderRow spec 入口未接（A2 同级）。
