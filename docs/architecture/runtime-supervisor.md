# Runtime Supervisor 状态协议（r15/r16 薄执行器 + r17 边界硬化）

> 契约文档。互斥=OS 命名 Mutex（`fr_agent.ps1` 的 Invoke-UnderMutex 持有，r16 起**无独立 enter/recover 动作**——整套临界区只活在主流程里）。
> 前提（r15）：单机、单个 FineReport 实例，同一时刻最多一个任务；任务可并发提交但必须串行进入 FineReport。
> **架构目标：Runtime 尽可能薄——无 queue/、无 OwnerToken、无 done/ 记录、无 FIFO、无 recover-previous 独立动作。结果真相 = artifact.json。r17 不新增任何状态目录/Token/调度器，只把身份与异常退出的边界收对（docs/gpt/r17.md）。**

## 1. 三性质（r15 §6 验收，r17 收口）

1. **互斥安全**：OS Named Mutex 内核保证，任何时刻最多一个持有者（history.log 只是自报诊断，不是内核证明；互斥性的证明是 S2/S4/S15 的串行结果与"同时只有一个引擎 JVM"）。
2. **恢复安全**：取锁后按**进程身份**判遗留——**三态**（r17）：alive=活持有者→拒绝；unknown=无法确认（权限/损坏/PENDING pidfile）→拒绝（fail-closed）；gone=确认已死→身份化杀孤儿（未知/卡住也拒绝）。绝不扫全部 java、绝不无条件杀、绝不为"恢复"保留复杂协议。
3. **结果可信**：contracts.js fail-closed——缺 manifest/diffClean/execution/render 证据即不验收。

## 2. 关键洞见（r15 §3 + r17 修正）

**Mutex 被 OS 释放 ≠ FineReport Java 进程退出。** PowerShell 宿主崩溃后其 Java 子进程可能仍存活并占着 FineDB。下一次调用虽能取到 Mutex，却不能因此直接再起一个 FineReport。故必须有一层**极薄的遗留进程检测**，通过可靠进程身份（pid + StartTime）识别自己启动的 Java，而非扫描/全杀。

（本机实测：`TerminateProcess` 后 Mutex 变**空闲**、不抛 AbandonedMutexException——所以恢复检测走身份判定，不依赖 abandoned 信号。）

r17 补充边界：
- **验证与击杀必须同一 Process 对象**（P1-1）：r16 先校验一次、再按 pid 重新 Get-Process 的写法在 PID 复用窗口会拿成另一个进程对象直接杀；r17 一次取对象、读该对象 StartTime、命中才在那一个对象上 Kill+WaitForExit。
- **进程不存在与身份不可读必须分开**（P1-2）：`ProcStartTicks` 把一切异常折成 -1（=死人）是可被权限错误打穿的假门。三态：alive/gone/unknown，unknown 一律拒绝启动。
- **Java 进程存在与 java.pid 落盘不是原子**（P1-3）：宿主可能在 spawn 之后、登记之前死掉，留下无身份孤儿。r17 把登记前移：spawn 前先写 `PENDING`（真身份落地后覆盖）——窗口内的崩溃留 `PENDING`，下次检测读它=identity unknown=拒绝（安全拒绝 + 更可靠的启动登记；Windows Job Object 评估过，未引入：现有 .NET/Win32 已够，且方案要求不新增运行机制）。
- **文件不存在、合法、损坏、不可读是四个事实**（P1-4）：损坏/不可读 ≠ 进程不存在，按 unknown 拒。
- **只有确认本次 Java 已退出才能清哨兵**（P1-5）：RunBody 异常时 JVM 可能还活着；r17 release 前先确认本 run 的 java 已确认退 absent=从未起的情形），否则保留 active.json 并记 HOLD 事件，让下一次拒绝/按身份恢复，而不是"看不到哨兵=没遗留"。
- **RunId 登记必须 create-new**（P2-1）：显式重复 RunId=RUNID_EXISTS 拒绝；New-Item 无 -Force 作并发窗口兜底。消除 r16 "Mutex 外组装 artifact 可读到下一次 run 覆写"的交叉污染路径。

## 3. 执行流程（fr_agent compile/patch，r17 后）

```
RunId create-new 登记（Mutex 外） ── 已存在 → RUNID_EXISTS 拒绝（P2-1）
  ↓
Mutex.WaitOne(timeout)          ── 超时 → QUEUE_TIMEOUT（绝不偷活锁）
  ↓ 获得
遗留检测（只可能在持锁时发生）:
  active.json 缺失                       → 放行
  active.json 损坏/不可解析              → RUNTIME_BUSY 拒绝（fail-closed，不清哨兵）
  owner(pid+start) 身份 alive 或 unknown → RUNTIME_BUSY 拒绝（不起第二个、不清）
  owner 确认 gone（前手死了/被复用）      → 按 runs/<runId>/java.pid 三态处理:
        pidfile absent        → gone 放行
        pidfile pending       → unknown 拒绝（P1-3 spawn 窗口崩溃）
        pidfile corrupt/不可读 → unknown 拒绝（P1-4）
        进程 alive 且 start 命中 → 同一 Process 对象 Kill → WaitForExit:
              确认退出=killed 放行；未退出=stuck 拒绝；Kill 时已自退=gone 放行
        start 不符（pid 被复用）→ gone 放行（复用者对象绝不动）
  清 FineDB 锁 → RECOVER 记录
  ↓
claim（写 active.json {runId,ownerPid,ownerStart}）；engine_launch 写 java.pid（先 PENDING，spawn 后真身份）
  ↓
run.ps1 / runraw.ps1（-NoKill；跑 FineReport）→ create_report / modify_report
  ↓ finally（P1-5）
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
logs/agent/runs/<runId>/java.pid   本次 Java 身份（PENDING=预登记未起/未落地；"pid start"=已登记）
```

已删除（r15/r16 减法）：`queue/`、`done/`、`owner.json`、OwnerToken、RUNID_INFLIGHT、recover-previous 独立动作、runtimeState/businessResult 记录。r17 起 RunId 唯一性不只靠 GUID：显式重复 = RUNID_EXISTS 拒绝（并发窗口由 New-Item 无 -Force 的 create-new 语义兜底）。

## 5. 不变量 ↔ 测试（verify/integration_runtime.ps1，故障注入；r17 诚实口径）

| 不变量 | 测试 | 性质 |
| --- | --- | --- |
| 互斥：并发提交串行、无双 JVM | S2/S4/S15（maxLiveRuntime≤1 + 串行结果） | 真并发 |
| 恢复**路径**：构造遗留态被身份化杀、后继正常 | S5（compile）/ S5b（patch 记 java.pid） | decoy 构造，非真宿主崩溃 |
| 恢复：**真宿主崩溃**（活宿主起引擎后被 TerminateProcess）→ 保哨兵 → 下一次身份恢复 | S20 | 真宿主杀（P2-2） |
| 恢复：身份不符（PID 复用/无关 java）放过 | S14 | decoy 构造 |
| 恢复：活持有者哨兵 + 空闲 Mutex → RUNTIME_BUSY 拒绝、不清 | S6 | 构造 |
| 恢复：损坏哨兵 → 拒绝、fail-closed 不清 | S16 | 构造 |
| 恢复：java.pid 损坏 → unknown 拒、不清（P1-4） | S21 | 构造 |
| 恢复：java.pid PENDING → unknown 拒（P1-3） | S22 | 构造 |
| 互斥：活持有者阻塞后来者排队 | S8 | 真并发（持锁者=简单 sleeper） |
| 结果可信：patch 缺 manifest → 不验收 | S17 | 构造 |
| RunId create-new：显式重复 → RUNID_EXISTS | S23 | 构造（P2-1） |

（S5 曾抓到 `IdentityAlive([int]$pid,…)` 参数撞 PowerShell 自动变量 `$PID` 致身份判定失效——主动制造故障证明系统正确拒绝的价值；r17 把该原语升级为三态 `Classify-Process`。）

## 6. 配置单源

`agent/tools/config.ps1` 提供 root/fr/java/nashorn/runtime dir(FR_AGENT_RUNTIME_DIR env)/deploy/heap(FR_AGENT_HEAP env)/MutexName(FR_AGENT_MUTEX env)/AcquireTimeoutSec；runtime.ps1/fr_agent.ps1/engine_launch/run/runraw/集成/静态/入口脚本一律源自它或 env，无裸硬编路径（`check_ps1_static.ps1` 把关，r17 起把 engine_launch.ps1 纳入 PARSE/ASCII 清单）。
