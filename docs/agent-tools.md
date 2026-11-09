# fr-agent Tool API（外部 Agent 调用契约，r7-B）

> **官方 Agent 使用入口（2026-11-09）：`.agents/skills/finereport/`**。它把本文件的工具契约组织成创建/修改/能力咨询三条工作流，含铁律、错误面与真实样例；外部 Agent 应优先按该 Skill 驱动本 Tool API。Skill 与本文冲突时以代码和 `discover` 的机器输出为准。
> 本文的 r12 / r13 段（队列、OwnerToken、current.json）是 **r13/r14 历史档案**，现行 Runtime 协议见 §r15 薄执行器、`docs/architecture/runtime-supervisor.md` 与 AGENTS §N；不要按历史段实施。

> 目的：让**现成 AI Agent** 通过稳定业务接口使用 fr-agent 的能力，而不是直接操作 Java 对象、CPT XML 或任意 SQL。
> Agent 负责理解需求、追问、规划；fr-agent 负责语义约束、编译、修改、执行验证与产物交付。

## 调用方式

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 <verb> [参数]
```

每个 verb **打印一行 ASCII JSON**：`{"ok":true,"result":"logs/agent/runs/<runId>/<verb>.json"}`；
详细结果（可能含中文）写入该 UTF-8 JSON 文件，Agent 直接读取文件。

| Verb | 参数 | 作用 |
|---|---|---|
| `discover` | — | 输出实体/维度/指标/关系（含 `joinSafe`）与 `ReportSpec.capabilities()` |
| `resolve` | `-Term 业务词` | 语义解析三态（resolved/ambiguous/unknown），候选带置信度，不自动选 |
| `compile` | `-Spec <ReportSpec.json>` | ReportSpec → CPT（含 PNG/PDF），结果含 RunResult 路径与产物路径 |
| `validate` | `[-ExpectTotals 计划:完成]` | 核验 RunResult 11 阶段 + 产物存在 + 栅格自洽（合计=明细和、完成率公式），可选对拍外部真值 |
| `preview` | `-Png <path>` | 返回 PNG 尺寸/字节数/是否疑似空白 |
| `patch` | `-Patch <PatchSpec.json>` | 对已有 CPT 做受控局部修改（白名单 op），写 staging 并跑结构/执行/渲染回归 |
| `assets` | `-Action list`（无参）/ `-Action inspect` `-Target <id>` / `-Action create` `-Doc <file>` / `-Action validate` `-Target <id>`（连库）/ `-Action publish` `-Target <id>` | Dataset 资产全生命周期管理（D2 完整）：list=清单；inspect=契约+派生列+粒度；create=只产 draft（非法拒写）；validate=自采样+自执行+自产绑定证据（列对拍+状态升级）；publish=重检全链+review+不可变。零 FR 引擎、不进 Mutex；validate 走 SQL classpath |

## 约束（Agent 必须遵守）

1. **只写 ReportSpec / PatchSpec JSON**，不写 Java、IR、CPT XML、任意 SQL；SQL 由 `semantic/query/sqlbuilder` 从语义模型生成。
2. **能力边界以 `discover` 输出为准**：`capabilities.datasets.rows/sql` 已按实现分列；写了不支持的能力会被 validator 结构化拒（不会静默忽略）。
3. **语义未决必须问**：`resolve` 返回 `ambiguous` 时不得自行钦定；`compile` 前可先 `resolve` 关键业务词。
4. **数据口径要可核**：`compile` 后必须 `validate`；有外部真值时用 `-ExpectTotals` 对拍。
5. **修改已有 CPT 只能走 `patch`**：写回只进 `logs/template_staging`，原件保留；结构/执行/渲染回归任一失败即整体失败。

## ReportSpec 最小形态（sql 路）

```json
{
  "specVersion": "1",
  "outName": "机台日报",
  "report": { "name": "机台生产日报" },
  "dataset": {
    "kind": "sql",
    "connection": "ATOM_LIVE",
    "entity": "InspectionRecord",
    "dimensions": ["bizDate", "machine"],
    "metrics": ["planned", "done", "completionRate"],
    "dateRange": { "from": "2026-09-13", "to": "2026-09-22" },
    "sort": [{ "field": "planned", "dir": "desc" }]
  },
  "presentation": { "type": "table", "showTotal": true }
}
```

## 当前明确不支持（会结构化拒，需 Agent 如实告知用户）

- 交互式参数/日期控件（日期范围在编译时写成字面量；运行期筛选=未接）。
- 按派生比率列排序（`completionRate` 不在 SQL 里，不能直接 ORDER BY）。
- 自由文本 SQL、非白名单 patch op（style/列宽/筛选/参数/标题）。
- ~~条件格式/高亮~~：已接（2026-11-06 B1，`presentation.conditions` → 明细格条件属性；能力边界以 `discover` 的 capabilityManifest/agentAvailable 为准——文档此节不再是能力清单真相源，manifest 是）。

> 这些不是"静默降级"：Agent 应在交付说明里列出，并给出可用的替代（如改按计划数降序）。

## r10 契约升级（2026-11-05，runId 隔离 + plan/create/modify）

- **每 verb 一次独立 run**：产物全部写 `logs/agent/runs/{runId}/`（compile.json/validate.json/preview.json/artifact.json/…），互不共享文件；`-RunId` 显式传可续跑同一 run（plan→create→validate→preview 用同一 runId），缺省自动生成。老固定路径 `logs/agent/*.json` 不再写。
- **退出码**：0 = verb 与 artifact 均成功；1 = 任一失败（compile rc=0 但 artifact 失败也返回 1——artifact 失败不再被掩盖）；2 = 用法错误。
- **防陈旧验收**：validate.json/preview.json 带生成时 runId；create/modify 仅并入与本 run runId 一致的 validate/preview（mismatch 即整体失败）。
- **新增 verb**：
  - `plan -Intent <意图JSON>`：自然语言意图（业务词/label 均可，工具层自动归一模型名）→ 三态 `ready|ambiguous|rejected` + reportSpec + assumptions + unresolvedQuestions + validationWarnings。ready 的 reportSpec 直接作为 `-Spec` 喂给 `create`。
  - `create`（=compile 别名）／`modify`（=patch 别名）：业务命名入口，行为与底层 verb 一致。
- **能力声明**：`discover` 输出 `capabilityManifest`（四层 construction/serialization/rendering/agentAvailable，逐能力带 README/probe 引证）与 `agentAvailable` 扁平名单——**只有 agentAvailable=true 的能力才可对外承诺**；serialization-only/pending 的能力仅内部使用或明确告知未达。
- **artifact.json**：带 `runId`；`artifactId = sourceType:outName@runId`（每次操作唯一）；acceptance 口径不变（执行成功+无 error 诊断+validation≠false）。

## r12 执行模型：单实例 Runtime Supervisor + 多任务队列

任务可**并发提交**，但 FineReport Runtime **串行执行**（全局单执行权）。这是 `application` 与 FineReport Runtime 之间的正式基础设施（`agent/tools/runtime.ps1`），不是散落在脚本里的互斥逻辑。

- 全局锁 = `logs/agent/runtime/lock`（目录原子创建，跨进程互斥）；`current.json` 记持有者 runId+pid+startedAt；`queue/` `done/` 记任务态；`history.log` 记 ACQUIRE/RELEASE/RECOVER 事件流。
- `create`/`modify` 两条起 Runtime 的路径经 `acquire → run.ps1 -NoKill → release` 包裹；零引擎 verb（discover/resolve/plan/plan2spec/validate/preview）不取锁。
- **run.ps1 默认不再随意杀 JVM**：agent 路径用 `-NoKill`；kill+删 FineDB 锁降格为 Supervisor 的 Recovery 动作，且**仅在确认 current 持有者 pid 已死后**才执行（abandoned run 标 `failed/RUNTIME_LOST`，绝不标成功）。
- 验收（`verify/integration_runtime.ps1`，覆盖 PowerShell/Nashorn/Application/FineReport Runtime 全链）：S1/2/4 并发提交串行（maxLiveRuntime=1）、S3 失败隔离、S5 崩溃恢复、S6 模板 staging 不串、S7 plan sql/rows 分流。

## r10/r12 verb 全表

| Verb | 参数 | 产物（logs/agent/runs/{runId}/） | 取 Runtime 锁 |
|---|---|---|---|
| discover | — | discover.json（含 capabilityManifest 五层 + agentAvailable 名单） | 否 |
| resolve | -Term | resolve.json | 否 |
| plan | -Intent | plan.json（ready/ambiguous/rejected） | 否 |
| plan2spec | （同 runId） | reportSpec.json（ready 的 spec 落盘） | 否 |
| create（=compile） | -Spec | compile.json + artifact.json | 是 |
| validate | -ExpectTotals | validate.json + 刷新 artifact.json | 否 |
| preview | -Png | preview.json | 否 |
| modify（=patch） | -Patch | patch.json + staging/ + artifact.json | 是 |

## r13 Supervisor 正确性协议（详见 docs/architecture/runtime-supervisor.md）

- 锁生死**只由 owner 身份判定**（pid 存活 + StartTime 匹配，防 PID 复用）；`initializing` 窗口（lock 在、owner.json 未写、<InitGraceSec）waiter **只等待不删锁**（杜绝双获取竞态）；`TaskSuspectSec` 年龄仅 `status.suspect` 告警，**绝不触发恢复/杀进程**。
- `release`/recovery 必须校验 **OwnerToken**（错 token 不能删他人锁）；恢复**只杀 CommandLine 匹配 pipelineTag 的 java**（不误杀无关 java），FineDB 锁仅在确认 owner 已死后删。
- `runtimeState`(queued/running/released/lost) 与 `businessResult`(pending/succeeded/failed) 正交：释放执行权 ≠ 报表成功。
- 路径/策略单源于 `agent/tools/config.ps1`；`verify/check_ps1_static.ps1` 静态把关（禁硬编路径、ASCII-only）；`scripts/run-integration-tests.ps1` = 静态门 + 全链故障注入（现行 S 号见 `docs/architecture/runtime-supervisor.md` §5；S1–S19 为 r13/r14 历史编号）。

## r15 薄执行器（当前态，覆盖并简化 r13/r14 协议；r17 边界硬化 + r18 严格身份与登记失败收口）

单机单实例前提下 Runtime 尽可能薄：**互斥=OS 命名 Mutex（作用域=单 Windows 登录 Session，跨 Session 消费者不受保护，需 Global\+ACL 另行评估，见 docs/architecture/runtime-supervisor.md §0）；恢复=进程身份判定**（无 queue/OwnerToken/done/FIFO/recover-previous 独立动作，结果真相=artifact.json）。

- compile/modify 临界区（r16 起整套临界区只在 fr_agent 主流程里，runtime.ps1 只读 status）：`WaitOne → 遗留检测 → claim → run.ps1(-NoKill,记 java.pid) → release → ReleaseMutex`。
- 遗留检测语义（r17 三态 + r18 严格身份 + r19 文件状态分类）：哨兵**存在性用 `Get-FilePresence` 四分类**（absent/readable/unreadable/unknown——Test-Path 的 false 不承担 absent 判定，被锁/畸形路径绝不冒充"无哨兵"，r19 P1）；哨兵缺失→放行；损坏哨兵/活持有者/身份不可读/文件状态不可确认→`RUNTIME_BUSY` 拒绝（fail-closed，绝不为恢复清哨兵或起第二个 FineReport）；前手确认已死→按 `runs/<runId>/java.pid` 身份化处理：pidfile 缺失=放行；**PENDING（宿主在 spawn 与登记之间被杀，r17 P1-3）/corrupt/不可读=拒绝**（绝不猜；r18 起"可转成整数"不构成身份——**恰好两字段 pid>0 且 start>0** 才合法，`1234 -1` 类一律 corrupt，防止 pid-only 降级误杀无关进程/带幽灵身份放行）；严格命中（同一 Process 对象 verify+Kill，复用 PID 永不误杀）→ WaitForExit 确认退出=放行，未退出=拒绝；start 不符=pid 被复用，复用者对象绝不动。
- **哨兵释放**（r17 P1-5）：只在本 run 的 Java 确认退出（或从未启动）时清 active.json，否则保留哨兵（history 记 HOLD），让下一次任务拒绝/按身份恢复。
- **RunId 判据=引擎产物存在性（r22e，覆盖 r17 P2-1 的目录级粗判；r23 补 Mutex 内复查）**：引擎 verbs（compile/patch）的重复 RunId 拒绝面=该 verb 自己的引擎产物已存在（`compile.json` / `patch.json`）——目录里只有零引擎产物（plan.json/reportSpec.json）是 **demo 定义的单 runId 贯穿接力**（plan→plan2spec→create 共用一个 runId），放行；S23 实证"预置 compile.json 后 compile=RUNID_EXISTS、同目录 plan 续跑放行"。artifact 组装**移回互斥内**（r22e，恢复防 r16 缩锁后产物在 ReleaseMutex 点后才可见的竞写窗）。零引擎 verbs 本身不限次数（幂等续跑）。**r23 P1 同 RunId 并发重入闭口**：入口查在 WaitOne 前，A/B 双零产物可双通过——`Invoke-UnderMutex` 增 `DupCheckFile` 参数，**取 Mutex 后、claim 前**复查引擎产物，dup=不 claim 直接 RUNID_EXISTS（r22e 组装回互斥内=复查可行的前提）；S24 拆 **S24a**（预置产物双拒）/ **S24b**（真竞态：两进程同 RunId 同真实 spec 从零产物并发起跑→恰一引擎执行+恰一 RUNID_EXISTS+runresult 单份 success=true）。
- **java.pid 登记前移与失败收口**（r17 P1-3 + r18 P1-2 + r19 P2，engine_launch.ps1）：spawn 前先写 `PENDING`，进程起来后立即覆盖为 "pid start"；**spawn 前任一步失败可撤登记**（此刻确实没有 java）；**spawn 成功后的登记失败（StartTime 读取失败/pidfile 覆盖失败）绝不删 PENDING 冒充"没启动"**——`Collect-UnregisteredSpawn` 在已持有的同对象上 Kill 后以 WaitForExit 裁决（**Kill 异常只是提示**——JVM 已自退时 Kill 抛 InvalidOperationException 是好结局，r19 竞态修复：确认退出才清登记，否则 PENDING 留守下一次拒绝）；StartTime 失败绝不写 `pid -1` 伪身份。Windows Job Object 方案评估过、未引入（现有 .NET/Win32 已够，且 r17 起禁止新增运行机制）。
- `FR_AGENT_HEAP` env 可覆盖堆（embedded spec 无 j2v8，测试用低堆保证故障注入确定性）；`FR_AGENT_RUNTIME_DIR`/`FR_AGENT_MUTEX` env 供测试隔离。
- 验收 `verify/integration_runtime.ps1` 故障注入（r17/r18/r19 诚实口径：互斥 S2/S4/S15·遗留**路径**（decoy 构造）S5/S5b·放过 S14·活锁拒绝 S6·损坏拒绝 S16·真宿主崩溃 S20·java.pid **十变体**拒绝 S21（r19 补多空格/tab/Int32·Int64 溢出）·PENDING 拒 S22·RunId 重复拒 S23·同 RunId 并发单赢 S24·spawn 前登记故障无泄漏 S25（r19 改确定性注入：pidfile 父路径=普通文件，不依赖盘符）·spawn 后登记失败白盒收集 S26（真 java confirmed/两 stub 留守/自退竞态分支 confirmed）·**文件状态四分类 S27**（白盒 absent/readable/锁住 unknown/畸形 unknown + 黑盒锁哨兵防退化；**S27e unreadable 分支证明=Everyone-deny Read，管理员运行也成立**）·**runtime.ps1 status 真实黑盒链 S28**（持久回归：pidfile 不可确认透出 unknown 绝不显示 absent；r21 收尾审查曾抓到收尾提交误删 `$jp=Read-JavaPid…` 使全部哨兵查询退化 unknown——正常链 alive + 锁定 unknown 双断言修复后转绿）·排队 S8·patch 证据 S17）。协议详见 `docs/architecture/runtime-supervisor.md`。

## 阶段2 B段（2026-11-07）：外置 Agent 产品闭环 verbs + 错误面统一

新增五个 verb（混合路线：plan 链保业务术语映射/歧义反问/SQL 语义安全，表达层由外置 LLM 直写 ReportSpec、validator 把门）：

| Verb | 参数 | 产物（logs/agent/runs/{runId}/） | 取 Runtime 锁 |
|---|---|---|---|
| list_reports | — | list_reports.json（部署目录 .cpt 清单：名称/字节/mtime/伴随 PNG/PDF + sourceCpt 相对名） | 否 |
| sample_data | -Sample <spec JSON> | sample.json（只读 LIMIT 采样：{entity, columns?, limit?≤200, where?}；entity/columns 模型白名单，op/值面受控字面量） | 否（plain JVM + WEB-INF/lib 驱动 classpath） |
| inspect_template | -Target fineagent/<名>.cpt | inspect.json（sheet 尺寸+逐格文本真实坐标+XML 侧数据集/参数名——modify 打通的前置体检；只读，不 export） | 是（引擎读 cpt） |
| promote | （同 runId） | promote.json（把 staging 里回归全绿的补丁件原子部署到 sourceCpt；SHA-256 全链复核；缺失即拒=fail-closed，见阶段3节） | 是 |
| restore | （同 runId） | restore.json（用同 run staging 的 .orig.cpt 原子回退部署面=撤销 promote；SHA-256 全链复核，见阶段3节） | 是 |

**modify→promote→restore 闭环**：modify 只写 staging（原件 .orig.cpt 自动保留）→ promote 才真正替换部署报表（fail-closed 于回归全绿）→ restore 一键回退。promote/restore 都要求**同一 runId**（staging 按 run 隔离）。

**退出码一致（B段裁决规则）**：`resolve` 与 `plan` 同规——exit 0 = 产出可向前走的答案（resolve: resolved|ambiguous；plan: ready）；exit 1 = 失败（resolve: unknown；plan: ambiguous/rejected）；exit 2 = 用法错误。合同行 `ok` 字段与退出码同步。

**错误面 nextActions 约定**：所有 verb 的失败输出（合同行或产物 JSON）带 `nextActions`（下一步可执行动作）；名单类拒绝（实体/属性/verb 不存在）附**可用名单**（如 unknown entity → available entities: …）。

## 阶段3 A/B/C（2026-11-07）：修改部署安全收口（promote/restore fail-closed 全链）

modify 端（template/patch_main.js）：manifest 新增 `sourceHash`（modify 时点部署件 SHA-256，大写十六进制，java.security.MessageDigest）与 `datasetOps`（replace_dataset op 数）。promote/restore 端（agent/tools/fr_agent.ps1 + agent/tools/_deploy.ps1 共享函数）：

**promote fail-closed 链（缺失=拒，绝不跳过）**：patch.json ok==true → manifest 存在 → diffClean 严格 true → **execution/render 块必须存在且 pass==true** → **datasetChecks 必须存在**（每项 pass==true；datasetOps>0 时条数 ≥ datasetOps）→ staged 补丁件存在且位于本 run staging 目录内且 .cpt 后缀 → staging 磁盘 manifest.json 与 patch.json 内嵌 manifest 逐字段一致（MANIFEST_MISMATCH）→ sourceCpt 三处一致（patch.json→PatchSpec vs manifest，白名单闸）→ 部署件存在 → **SHA-256(部署件)==manifest.sourceHash，否则 SOURCE_CHANGED 拒绝**（外部改动绝不覆盖）→ staging .orig.cpt 存在且哈希==sourceHash → **同卷临时件 + File.Replace 原子替换**（失败保留原文件+明确诊断，无 Copy-Item -Force 无条件覆盖）→ 换后 SHA-256 复核 → promote.json 记 `sourceHash/origHash/deployedHash/promotedHash/deployedBeforeHash`。

**restore fail-closed 链**：本 run patch.json（RESTORE_NO_PATCH）→ **本 run promote 状态判定（P1×2，按 deploy_state 记录+实际部署件 SHA-256，非仅 promote.json 存在性/ok 位）**：已提交 promote（ok=true 且带 deployedHash+origHash）按记录链回退；**ok=false 的未完成 promote 仅在可识别"已换未提交"态放行 undo**（deploy_state 有匹配 patch manifest sourceHash 的 PREPARED promote 记录 → 部署件此刻载的即本 run staged 字节 → 原子换回 .orig.cpt，restore.json 记 `undoUncommittedPromote=1`）；其余 ok=false（守卫拒绝未换件/无证据）与不可读 promote.json 一律 RESTORE_NO_PROMOTE 拒绝（fail-closed）→ staging .orig.cpt 存在且哈希==期望 orig 哈希（STAGING_ORIG_CHANGED）→ 部署件存在且 **SHA-256==期望 deployed 哈希，否则 DEPLOYED_CHANGED 拒绝**（部署件被外部改动不回退覆盖）→ 原子替换 → 换后 SHA-256==orig 哈希 → restore.json 记 `origHash/restoredHash/deployedBeforeHash`。任一拒绝不触碰部署文件（守卫全部先于换件执行）。

**部署事务状态机（P1×2 收口，2026-11-07）**：每 run 的 `deploy_state.jsonl` 记五态事件 `PREPARED → SWAPPED → COMMITTED`（主流程顺序）与 `FAILED_BEFORE_SWAP`/`FAILED_AFTER_SWAP`（失败 catch 诊断）。主流程事件写入**事务性**（`Add-DeployStateEvent` 写失败即抛）：`PREPARED` 写失败=换件前终止（部署件绝不无证据换件，fix ①）；`COMMITTED` 写失败=显式 ok=false 未完成态，同 RunId 重试按 PREPARED+实际 SHA-256 补完成提交（recovered=1，fix ②）。**同 RunId 重试/restore 的登记判据=已提交产物**：promote.json/restore.json ok=false（catch 留下的显式未完成态）放行重入并完整重跑守卫链（门与 Mutex 内复查同规；ok=true 或不可读 → RUNID_EXISTS）；引擎 verbs 维持产物存在性判据不变。**持久化口径（如实）**：恢复覆盖**进程崩溃**（宿主被杀）；断电级不覆盖——deploy_state.jsonl 与提交产物为 OS 缓冲写、无 fsync 语义（promote/restore.json 的 `concurrencyBoundary` 字段随产物声明）。

**共享件 agent/tools/_deploy.ps1**（与 _identity.ps1 同层函数库，无新基础设施）：`Get-FileSha256`（.NET SHA256，缺/不可读返 null 由调用方 fail-closed）；`Replace-FileAtomic`（同卷 `._deploy_<guid>.tmp` + `[IO.File]::Replace(tmp,target,[NullString]::Value)`——PS5.1 方法绑定把字面 $null 转 "" 会炸「路径形式不合法」，探针实证后用 NullString；任何异常=目标件字节不动，**无 Move/Copy -Force 回退**，文件系统不支持原子替换时明确失败=拒绝部署+诊断，恢复策略=排除原因后重跑 promote/restore）。

**验收**：`scripts/run-promote-restore-tests.ps1` 回归矩阵 40 例全 PASS（反例先行：首轮对旧实现 24 红；P1×2 收口轮新增 8 反例+2 静态断言，改前实测 8 红：D1 PREPARED 写失败旧码照换、D2/D5/D6/D7 同 RunId 重试 RUNID_EXISTS 死锁、D3 restore 被堵、X5 静态两项），已接入 `scripts/run-integration-tests.ps1`（静态门后、引擎场景前）。矩阵含全部失败路径：execution/render/datasetChecks 缺失、dataset 项失败、staged 缺失/staging 外/非 .cpt、磁盘 manifest 不一致、sourceCpt 不一致/越白名单、SOURCE_CHANGED、SOURCE_HASH_MISSING、orig 缺失、diffClean=false、patch.json ok=false、锁定目标原子替换失败保留原文件（NTFS FileShare 注入，无代码钩子）、未 promote 就 restore、DEPLOYED_CHANGED、staging 篡改、二次 restore 拒、promote 后 staging 丢失（中途失败恢复面）、**PREPARED 写失败注入换件前终止（D1：deploy_state.jsonl 置为目录，无代码钩子）、同 RunId 重试补完成提交（D2）/restore undo 未提交换件（D3）/ok=false 无证据拒绝（D4）/restore 重试补提交（D5）/守卫拒绝重入再拒（D6）/换件失败重试成功（D7）/undo 证据闸（D8）**、正常 promote/restore 锚例 + 原子替换单元 2 例 + 静态接线断言 6 例；全程真实部署目录清单（308 文件+MD5）篡改证据比对=零改动。
