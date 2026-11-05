# Night Shift 工作日志

> 规范见 AGENTS.md「夜间自主工作规范」。每项工作按：目标/代码证据/实施/验证结果/未验证事项/Commit/下一项 记录。

## 2026-11-05（夜间会话开始）

### 环境快照（Step 1）
- 分支 main；最后成功提交 98283b5（r24：并发测试确定性化 + S24c patch 双拒，集成门 S1–S28+ GREEN）。
- Runtime 状态：冻结（r21b 裁定 + r24 正式关闭）；GOLDEN v1 五步闭环已真跑（README #98）。

### 任务一：Runtime 测试收尾 —— 已由 r24 完成，不重复造轮子

### 工作目标
S24b 确定性命中竞态窗口 + compile/patch 并发路径验收。

### 代码证据与实施（r24，commit 98283b5）
- S24b 升级为确定性构造：测试进程持与 Agent 同名 Mutex → 两 wrapper 写 ready 信号 + Set 独立 AutoResetEvent（IT_S24_READY_A/B）→ 等 IT_S24_GATE → 才 spawn fr_agent（持锁窗口内入口检查必过、阻塞排队）；harness 内核 WaitOne 两个 ready 事件（零轮询零 sleep——第一版 100ms 轮询循环被用户当场否决后改为纯事件等待；首跑 wrapper 漏 Set ready 事件被红如实记录，补 Set 后绿）。
- S24c：patch 路径并发双拒（预置 patch.json → 双 modify host 双 RUNID_EXISTS）。

### 验证结果
- 集成门 S1–S28+ 全绿（exec_0534ab5d，2026-11-05）：S24b"确定性命中 Mutex 内复查路径"（恰一 ok:true + 恰一 RUNID_EXISTS + runresult 单份 success=true）、S24c patch 双拒。

### 未验证事项
- 无（该场景已真跑）。

### Commit
98283b5。

### 结论
**任务二（Runtime 正式冻结）随之满足**：r21b 裁定 + r24 关闭记录在案（README #100）。除确定性 P0/P1 外不再打开 Runtime。

---

### 任务三：全局审查 Agent 产品链路 —— 进行中

按优先级 P2 走真实代码调用链（非架构图）。聚焦用户价值主线：修改可靠性（D）、需求理解（A）、生成正确性（C）。发现以证据清单记录，逐项最小修复，不一次改完。

（审查发现与修复记录追加于下方时间条目。）

## 2026-11-05 18:40

### 工作目标（B1，night-shift-backlog 首项）
SQL intent 中的 ambiguous 术语（如双指词"机台"）此前被硬拒（rejected），与内嵌路径的反问行为不一致——用户说"按机台"时 Agent 不反问而是失败。

### 代码证据
- `agent/tools/plan.js:71-72`：TermNorm.normalizeList 对 ambiguous（resolver 非 resolved）**原样透传原文**（r14 P2 有意设计，注释承诺"交 planner 走 unresolved"）。
- `semantic/planner/planner.js` sql 分支：透传原文不在模型成员名（dset/mset）→ 走"维度不在模型，未编造"→ memberMissing++ → **status=rejected**。
- 内嵌（rows）路径 mapTerm 对 ambiguous 是 unresolvedQuestions(requiresConfirmation=true)——两条路径行为不一致；r10-C 注释承诺"ambiguous/unknown 原样透传走 unresolvedQuestions"未兑现。
- 用户影响：双指术语=需求理解核心场景，硬拒 vs 反问直接决定可用性。

### 实施内容
- `semantic/planner/planner.js` sql 分支：未命中成员名时先过 `ctx.resolve`——ambiguous → `unresolvedQuestions.push({kind, term, candidates, requiresConfirmation:true})`（不计 memberMissing）；纯 unknown → 原样 warnings+memberMissing（不编造）；status 判定改为 `ambiguousTerms ? 'ambiguous' : (memberMissing ? 'rejected' : ...)`（混合态反问优先），ambiguous 时 reportSpec=null（与内嵌路径一致）。planner 本体 ~20 行，ctx.resolve 本就注入，无新机制。

### 验证结果
- fast_planner TDD：先红后绿——新增 6 断言（ambiguous→反问/uq 含机台+requiresConfirmation/specNull/纯 unknown 保持 rejected/混合优先反问/规范成员 ready 不回归）全 PASS；全套 FAST 13 套件 GREEN。
- 真通道冒烟：fr_agent plan 走"机台"双指 intent → `status=ambiguous, unresolvedQuestions=1, requiresConfirmation=True, reportSpec=null` ✓。
- SCAN 48 / 边界 R1–R8 / STATIC 0 同步 GREEN。

### 未验证事项
- 多候选 UI 反问交互（plan 输出 JSON 已含 candidates，展示层未涉及）。

### Commit
（见下一条 commit SHA。）

### 下一项工作
B2：patch 失败路径的状态可判定性走查（backlog 进行中项）；之后回到任务三链路审查其余主线（C 生成/E 工具链）。

## 2026-11-06 00:10

### 工作目标（B2 + 双路径对拍可行性评估）
① patch 链失败路径状态可判定性走查（修改可靠性主线）；② 评估"GOLDEN vs 手写 rawIR 路径等价对拍"（P3 生成后自动验收候选）。

### 代码证据
- patch 链全读（patch_main.js 174 行 + patch.js + reader.js）：①校验/源件缺失/命名样式拒/apply 抛 → throw → exit≠0 且 **manifest 不落盘**（S17 的 fail-closed 依赖成立）；②执行/渲染/数据集回归 FAIL → **FAIL=1 且 manifest 照写**（diffClean/execution/render/pixelStats 如实）→ patch.json ok=false → artifact 不验收；③原件在 apply 前 copy 保留（.orig.cpt）；④export 只进 staging；⑤`_r5_verify_*.cpt` 临时读回件落 reportlets 是 **FineReport API 约束**（reader.readCpt 显式拒绝对路径，TemplateWorkBookIO 只认 reportlets 相对名），时间戳命名+finally deleteIfExists 兜底——实查部署目录**零残留**。
- 双路径对拍：`reports/agent_daily_report.js` 是日期级 4 列（无机台维度）；GOLDEN 是 day×machine 5 列——粒度不同属设计使然，等价对拍不成立。

### 实施内容
- 无生产代码改动（B2 结论=正面确认，无 P0/P1；_r5_verify 残留为理论触发面且实查无残留，不造任务）。
- `docs/agent-demo-machine-daily.md` 同步至 r24 终态：§4 并发与隔离改单实例薄执行器语义（Mutex/身份恢复/同 RunId 重入防护 S24a/b/c，删 r12 队列/current.json 词汇）；§6 复现命令补 modify 行与 r22e 单 runId 接力语义。

### 验证结果
- 纯文档；无代码路径变化（STATIC 门无涉）。

### 未验证事项
- 无。

### Commit
（见下一条 commit SHA。）

### 下一项工作
评估结论：双路径对拍不成立（粒度差异设计使然）；backlog 剩余项均有外部依赖（B3/B4=审查方解锁）。**按规范停止条件评估：无可信高价值且不依赖外部决定的工作 → 本轮夜间会话在此干净收尾**，最后留置项=任务三综述（E 主线 verb 契约经多轮走查未发现新缺陷）。
