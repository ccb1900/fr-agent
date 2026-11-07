# Runtime Supervisor 状态协议（r15/r16 薄执行器 + r17/r18 边界硬化）

> 契约文档。互斥=OS 命名 Mutex（`fr_agent.ps1` 的 Invoke-UnderMutex 持有，r16 起**无独立 enter/recover 动作**——整套临界区只活在主流程里）。
> 前提（r15）：单机、单个 FineReport 实例，同一时刻最多一个任务；任务可并发提交但必须串行进入 FineReport。
> **架构目标：Runtime 尽可能薄——无 queue/、无 OwnerToken、无 done/ 记录、无 FIFO、无 recover-previous 独立动作。结果真相 = artifact.json。r17/r18 不新增任何状态目录/Token/调度器，只把身份与异常退出的边界收对（docs/gpt/r17.md、docs/gpt/r18.md）。**

## 0. 部署边界（r18 P1-3，先于一切机制）

**互斥作用域 = 单个 Windows 登录 Session。** Mutex 名不带 `Global\` 前缀 → 落在 Local（每登录会话）命名空间；产品运行形态即"同一台机器、同一交互会话内的所有调用方"。跨 Session 调用方（桌面程序、计划任务、服务、其他登录会话）**不在当前互斥保护内**——同名 Local Mutex 可在两个 Session 各自成立，active.json 也救不了（可能双双读到无哨兵然后各起各的 JVM）。若未来出现这种消费者：先评估 `Global\` 前缀 + 跨 Session 创建权限/ACL，并重跑并发验收；本协议明确不支持当前形态之外的任何使用。

其余运行边界：connect 记录只在本地 spec；部署件凭据自动门不变。

## 1. 三性质（r15 §6 验收，r17 三态化，r18 严格身份）

1. **互斥安全**：OS Named Mutex 内核保证，任何时刻最多一个持有者（作用域见 §0；history.log 只是自报诊断，不是内核证明；互斥性的证明是 S2/S4/S15 的串行结果与"同时只有一个引擎 JVM"、S24 的同 RunId 竞争单赢）。
2. **恢复安全**：取锁后按**进程身份**判遗留——**三态**：alive=活持有者→拒绝；unknown=无法确认（权限/损坏/PENDING）→拒绝（fail-closed）；gone=确认已死→身份化杀孤儿（卡住/未知也拒绝）。参与 Kill 的身份必须严格：**恰好两字段 pid>0 且 start>0**（r18，"可转成整数"不构成身份）。
3. **结果可信**：contracts.js fail-closed——缺 manifest/diffClean/execution/render 证据即不验收。

## 2. 关键洞见（r15 §3 + r17/r18 修正）

**Mutex 被 OS 释放 ≠ FineReport Java 进程退出。** PowerShell 宿主崩溃后其 Java 子进程可能仍存活并占着 FineDB。下一次调用虽能取到 Mutex，却不能因此直接再起一个 FineReport。故必须有一层**极薄的遗留进程检测**，通过可靠进程身份（pid + StartTime）识别自己启动的 Java，而非扫描/全杀。

（本机实测：`TerminateProcess` 后 Mutex 变**空闲**、不抛 AbandonedMutexException——所以恢复检测走身份判定，不依赖 abandoned 信号。）

r17 补充边界：
- **验证与击杀必须同一 Process 对象**：r16 先校验一次、再按 pid 重新 Get-Process 的写法在 PID 复用窗口会拿成另一个进程对象直接杀；r17 一次取对象、读该对象 StartTime、命中才在那一个对象上 Kill+WaitForExit。
- **进程不存在与身份不可读必须分开**：`ProcStartTicks` 把一切异常折成 -1（=死人）是可被权限错误打穿的假门。三态：alive/gone/unknown，unknown 一律拒绝启动。
- **Java 进程存在与 java.pid 落盘不是原子**：宿主可能在 spawn 之后、登记之前死掉，留下无身份孤儿。r17 把登记前移：spawn 前先写 `PENDING`（真身份落地后覆盖）——窗口内的崩溃留 `PENDING`，下次检测读它=identity unknown=拒绝。
- **文件不存在、合法、损坏、不可读是四个事实**：损坏/不可读 ≠ 进程不存在，按 unknown 拒。
- **只有确认本次 Java 已退出才能清哨兵**：RunBody 异常时 JVM 可能还活着；r17 release 前先确认本 run 的 java 已确认退出，否则保留 active.json 并记 HOLD 事件，让下一次拒绝/按身份恢复。
- **RunId 登记必须 create-new**：显式重复 RunId=RUNID_EXISTS 拒绝；New-Item 无 -Force 作并发窗口兜底。消除 r16 的交叉污染路径。

r18 补充边界：
- **"可转成整数" ≠ 身份**（r18 P1-1）：pidfile `1234 -1` 曾经解析成 ok 且按 pid-only（expectStart≤0→alive）降级——pid 存在则可能**误杀任意无关进程**，pid 不存在则带着幽灵身份照跑任务。现在 Java 击杀目标身份要求**恰好两字段、pid>0、start>0**，不合者=corrupt=unknown=拒绝；owner 语义（ownerStart=-1 且 pid 存在→保守认定 alive）保留、两者不混。
- **"已启动" 之后的登记失败，绝不能用删文件表达"没启动"**（r18 P1-2）：spawn 前的失败（PENDING 写失败/Start-Process 抛）才允许撤销登记——此刻确实没有 java；spawn 成功后 StartTime 读取失败或 pidfile 覆盖失败一律进入 **Collect-UnregisteredSpawn**：在已持有的同一 Process 对象上 Kill+WaitForExit，**确认退出才可清登记**，否则 PENDING 留守让下一次拒绝。理由：r17 版把拆分前的三步共用一个 catch，spawn 成功后的失败会删 PENDING→fr_agent 侧 `Confirm-RunJavaGone` 看到 absent→清哨兵→下一次起第二个 JVM，正好击穿 r17 核心承诺。此外 StartTime 失败绝不写 `pid -1` 伪身份（那会重新触发 r18 P1-1）。
- **同 RunId 并发独占必须证明而非注释宣称**（r18 P2）：S24 用两个独立进程抢同一 RunId——恰一个 `"ok":true`，另一个 `RUNID_EXISTS`（New-Item 的 create-new 语义在 OS 层兜住竞争窗口）。
- **Test-Path 的 false 不承担 absent 判定**（r19 P1）：`Test-Path`/`File.Exists` 把访问错误折叠成 false——被锁/畸形路径/权限故障都可能"谎报不存在"，若哨兵判断采信就可能在真实遗留还在时 claim 执行权起第二个 JVM。统一 `Get-FilePresence`（.NET File.Open 按**真实异常类型名**分层）：absent（FileNotFound/DirectoryNotFound=确实不在）/ readable（可读→继续解析）/ unreadable（存在但拒绝访问→拒）/ unknown（共享冲突、畸形路径等其他 FS 错→拒）。三者 fail-closed，只有 absent 允许按"无哨兵"处理。★PS 5.1 套娃陷阱第 N 张面孔：.NET 方法异常被包成 `MethodInvocationException`（真异常在 InnerException）——分类前解一层再对比类型名（typed catch 不可靠的 r17 教训在 .NET 方法面重演，红探针实读）。
- **Collect-UnregisteredSpawn 的 Kill 只是个提示，退出才是裁决**（r19 P2）：JVM 在回收前已自然退出时 Kill 抛 InvalidOperationException——旧单 catch 把这个"已确认退出"的好结局判成 kept-pending（哨兵被 HOLD 留守→下一次 RUNTIME_BUSY 恶循环、需人工恢复）。修=吞掉 Kill 的任何异常、统一由 WaitForExit 裁决：确认退出才清登记，否则保留 PENDING。

## 3. 执行流程（fr_agent compile/patch，r18 后）

```
RunId create-new 登记（Mutex 外） ── 已存在 → RUNID_EXISTS 拒绝（S23 顺序；S24 并发）
  ↓
Mutex.WaitOne(timeout)          ── 超时 → QUEUE_TIMEOUT（绝不偷活锁）
  ↓ 获得
遗留检测（只可能在持锁时发生）:
  active.json 缺失                       → 放行
  active.json 损坏/不可解析              → RUNTIME_BUSY 拒绝（fail-closed，不清哨兵）
  owner(pid+start) 身份 alive 或 unknown → RUNTIME_BUSY 拒绝（不起第二个、不清）
  owner 确认 gone（前手死了/被复用）      → 按 runs/<runId>/java.pid 三态处理（严格身份见 §2 r18）:
        pidfile absent                     → gone 放行
        pidfile pending                    → unknown 拒绝（spawn 窗口崩溃）
        pidfile corrupt/不可读（含 pid≤0、start≤0、字段数≠2、非数字） → unknown 拒绝（r18 P1-1）
        进程 alive 且 start 严格命中（同一对象）   → 该对象 Kill → WaitForExit:
              确认退出=killed 放行；未退出=stuck 拒绝；Kill 时已自退=gone 放行
        start 不符（pid 被复用）→ gone 放行（复用者对象绝不动）
  清 FineDB 锁 → RECOVER 记录
  ↓
claim（写 active.json {runId,ownerPid,ownerStart}）
  ↓
engine_launch: 写 java.pid(PENDING) → Start-Process:
        spawn 前任一步失败（PENDING 写失败/S-Process 抛）→ 撤登记 + rc=1（此刻确实没有 java）
        spawn 后 StartTime 读取失败      → Collect-UnregisteredSpawn（同对象 Kill+Wait；确认退出才清登记，否则 PENDING 留守）→ rc=1（不写 pid -1 伪身份）
        spawn 后 pidfile 覆盖失败        → 同上 Collect-UnregisteredSpawn → rc=1
        正常                            → 覆盖 "pid start" → WaitForExit
  ↓
run.ps1 / runraw.ps1（-NoKill；跑 FineReport）→ create_report / modify_report
  ↓ finally（r17 P1-5）
本 run java 确认退出（或 pidfile 缺=从未起）→ 清 active.json → RELEASE
本 run java 未能确认（alive/pending/corrupt）→ 保留哨兵 → HOLD
  ↓
Mutex.ReleaseMutex
```

## 4. 存储（仅两类，皆薄）

```
logs/agent/runtime/
  active.json     遗留哨兵 {runId, ownerPid, ownerStart, claimedAt}（当前持有者身份）
  history.log     ACQUIRE/RELEASE/HOLD/RECOVER 事件流（自报诊断，非内核证明）
logs/agent/runs/<runId>/java.pid   本次 Java 身份（PENDING=预登记未起/未落地；"pid start"=已登记，pid>0 且 start>0）
```

已删除（r15/r16 减法）：`queue/`、`done/`、`owner.json`、OwnerToken、RUNID_INFLIGHT、recover-previous 独立动作、runtimeState/businessResult 记录。r17 起 RunId 唯一性不只靠 GUID：显式重复 = RUNID_EXISTS 拒绝（并发窗口由 New-Item 无 -Force 的 create-new 语义兜底，S24 证明单赢）。

## 5. 不变量 ↔ 测试（verify/integration_runtime.ps1，故障注入；r17/r18 诚实口径）

| 不变量 | 测试 | 性质 |
| --- | --- | --- |
| 互斥：并发提交串行、无双 JVM | S2/S4/S15（maxLiveRuntime≤1 + 串行结果） | 真并发 |
| 同 RunId **并发**独占：恰一赢/一 RUNID_EXISTS、无交叉写 | S24 | 真并发（r18 P2） |
| 恢复**路径**：构造遗留态被身份化杀、后继正常 | S5（compile）/ S5b（patch 记 java.pid） | decoy 构造，非真宿主崩溃 |
| 恢复：**真宿主崩溃**（活宿主起引擎后被 TerminateProcess）→ 保哨兵 → 下一次身份恢复 | S20 | 真宿主杀（r17 P2-2） |
| 恢复：身份不符（PID 复用/无关 java）放过 | S14 | decoy 构造 |
| 恢复：活持有者哨兵 + 空闲 Mutex → RUNTIME_BUSY 拒绝、不清 | S6 | 构造 |
| 恢复：损坏哨兵 → 拒绝、fail-closed 不清 | S16 | 构造 |
| 恢复：java.pid 损坏**六变体**（非数字/pid≤0/start≤0/字段数≠2 等整数可解析垃圾）→ 拒、decoy 无恙 | S21 | 构造（r18 P1-1，红实测后修） |
| 恢复：java.pid PENDING → unknown 拒 | S22 | 构造 |
| 互斥：活持有者阻塞后来者排队 | S8 | 真并发 |
| 结果可信：patch 缺 manifest → 不验收 | S17 | 构造 |
| RunId create-new：显式重复 → RUNID_EXISTS | S23 | 构造 |
| 登记：spawn 前 pidfile 不可用 → rc≠0 且无 java 起来 | S25 | 故障注入（r18 P2） |
| 收集器：spawn 后登记失败 → 确认退出才清登记；Kill 失败/未退出=PENDING 留守；Kill 抛 InvalidOperationException 但 JVM 已自退 → confirmed（r19 P2） | S26（白盒：真 java + Kill/Wait stub 三分支 + 自退竞态分支） | 故障注入 |
| 文件状态四分类：锁住/畸形路径 = unknown 绝不 absent；锁哨兵→RUNTIME_BUSY 不清（r19 P1） | S27（白盒四态 + 黑盒锁哨兵防退化） | 故障注入 |
| unreadable 分支实证：Everyone-deny Read（显式 deny 先于 allow/继承、backup 特权默认停用 → 管理员运行也成立） | S27e | 故障注入（r19 收尾） |
| runtime.ps1 status **真实黑盒链**（S28，持久回归——r21 收尾审查发现收尾提交曾删 `$jp=Read-JavaPid…` 致全部哨兵查询退化 unknown，且仅一次性探针与文档"S27 白盒联动"不对应）：正常身份 pidfile → alive；锁定 pidfile → unknown（绝不 absent）| S28（构造 active.json + pidfile：A 正常链→alive；B 独占锁→unknown；解析 status JSON 断言） | 故障注入 + 真实调用链（r21） |

（S5 曾抓到 `IdentityAlive([int]$pid,…)` 参数撞 PowerShell 自动变量 `$PID` 致身份判定失效；r17 六项 FAIL 抓出类型 catch 不可靠须按 FQID 指纹判；r18 红探针再抓出 `1234 -1` 类整数垃圾以 pid-only 语义进入身份链——主动制造故障证明系统正确拒绝的价值持续兑现。）

## 6. 配置单源

`agent/tools/config.ps1` 提供 root/fr/java/nashorn/runtime dir(FR_AGENT_RUNTIME_DIR env)/deploy/heap(FR_AGENT_HEAP env)/MutexName(FR_AGENT_MUTEX env)/AcquireTimeoutSec；runtime.ps1/fr_agent.ps1/engine_launch/run/runraw/集成/静态/入口脚本一律源自它或 env，无裸硬编路径（`check_ps1_static.ps1` 把关，r17 起把 engine_launch.ps1/_identity.ps1 纳入 PARSE/ASCII 清单）。**Mutex 作用域约束见 §0（单 Windows 登录 Session；跨 Session 需先评估 Global\+ACL）。**

另：`run.ps1` 的 `Get-Process java | Stop-Process`（手动门专用路径，agent 路径一律 -NoKill）为既有惯例，其"全杀 java"副作用的使用边界单独记录于 README（#89）；本协议职责边界仅覆盖 agent 路径。

## 7. 部署窗口（promote/restore 替换的协作边界，2026-11-07 阶段3 3.1-4）

promote/restore 的部署替换是一个 **check-then-act 窗口**：全部哈希守卫（patch.json ok、manifest 全量比对、staging 绑定 RunId、sourceHash 三方一致、staged/.orig 哈希）都在 agent 运行时命名 Mutex **之内**、紧贴 `File.Replace` 原子替换之前执行，窗口内不存在第二个持有执行权的写入者——这就是 promote 部署窗口的协作边界声明。引擎写路径（make_api deploy）与 promote/restore 一样各自整体处于 Mutex 区内，两个写入者在窗口上串行，不共享未受保护间隙。

崩溃一致性（3.1-3）：替换前写 `PREPARED`、替换并哈希复核后写 `COMMITTED`（每 run 的 `deploy_state.jsonl`）。进程在替换与提交之间任意时刻崩溃，下一次 promote/restore 按**实际部署件哈希**对照 PREPARED 记录识别"已换未记"状态：补完成提交（重物化丢失的 promote.json/restore.json），绝不盲目重换；无 PREPARED 证据时同字节态仍按 SOURCE_CHANGED/DEPLOYED_CHANGED 拒绝（fail-closed）。

并发窗口故障测试结论（如实三态）：真进程 kill 注入（`File.Replace`→`WriteAtomic` 提交之间毫秒级窗口）黑盒不可确定性注入 = **BLOCKED**；其确定性等价注入（真实 promote/restore 成功后截断提交物 → 重试按哈希身份识别并补提交）= **PASS**（stage3 验证器 S3b/S3c + 回归矩阵 R5 二次 restore 拒 / P16 锁定目标原子替换失败保留原文件）。并发窗口本身的互斥语义由 S2/S4/S15/S24 真并发用例持续把守。
