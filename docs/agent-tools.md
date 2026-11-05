# fr-agent Tool API（外部 Agent 调用契约，r7-B）

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
- 条件格式/高亮（如"完成率<80% 标红"）。
- 自由文本 SQL、非白名单 patch op（style/列宽/筛选/参数/标题）。

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
