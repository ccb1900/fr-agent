# Runtime Supervisor 状态协议（r15 薄执行器）

> 契约文档。互斥=OS 命名 Mutex（`fr_agent.ps1` 持有）；遗留进程检测=`runtime.ps1 -Action enter`（身份判定）。
> 前提（r15）：单机、单个 FineReport 实例，同一时刻最多一个任务；任务可并发提交但必须串行进入 FineReport。
> **架构目标：Runtime 尽可能薄——无 queue/、无 OwnerToken、无 done/ 记录、无 FIFO、无 recover-previous 独立动作。结果真相 = artifact.json。**

## 1. 三性质（r15 §6 验收）

1. **互斥安全**：OS Named Mutex 内核保证，任何时刻最多一个持有者。
2. **恢复安全**：取锁后按**进程身份**判遗留——确认孤儿则身份化杀，无法确认则**拒绝启动**（绝不扫全部 java、绝不无条件杀、绝不为"恢复"保留复杂协议）。
3. **结果可信**：contracts.js fail-closed——缺 manifest/diffClean/execution/render 证据即不验收。

## 2. 关键洞见（r15 §3）

**Mutex 被 OS 释放 ≠ FineReport Java 进程退出。** PowerShell 宿主崩溃后其 Java 子进程可能仍存活并占着 FineDB。下一次调用虽能取到 Mutex，却不能因此直接再起一个 FineReport。故必须有一层**极薄的遗留进程检测**，通过可靠进程身份（pid + StartTime）识别自己启动的 Java，而非扫描/全杀。

（本机实测：`TerminateProcess` 后 Mutex 变**空闲**、不抛 AbandonedMutexException——所以恢复检测走身份判定，不依赖 abandoned 信号。）

## 3. 执行流程（r15 §4，fr_agent compile/patch）

```
Mutex.WaitOne(timeout)          ── 超时 → QUEUE_TIMEOUT（绝不偷活锁）
  ↓ 获得
runtime enter（遗留检测）:
  active.json 缺失            → 放行
  active.json 损坏/不可解析    → RUNTIME_BUSY 拒绝（fail-closed，不清哨兵）
  owner(pid+start) 仍存活      → RUNTIME_BUSY 拒绝（无法确认，不起第二个、不清）
  owner 确认已死（前手崩溃）    → 按 runs/<runId>/java.pid 身份杀孤儿 Java（start 不符则放过）→ 清哨兵 → 放行
  ↓
runtime claim（写 active.json {runId,ownerPid,ownerStart}）
  ↓
run.ps1 / runraw.ps1（-NoKill；记 java.pid=pid+start；跑 FineReport）→ create_report / modify_report
  ↓ finally
runtime release（清 active.json，仅当属于本 runId）→ Mutex.ReleaseMutex
```

## 4. 存储（仅三类，皆薄）

```
logs/agent/runtime/
  active.json     遗留哨兵 {runId, ownerPid, ownerStart, claimedAt}（当前持有者身份）
  history.log     ACQUIRE/RELEASE/RECOVER 事件流（互斥性的外部验证信号）
logs/agent/runs/<runId>/java.pid   本次 Java 的 pid+StartTime（身份化遗留杀，FineReport 特有边界）
```

已删除（r15 减法）：`queue/`、`done/`、`owner.json`、OwnerToken、RUNID_INFLIGHT、recover-previous 独立动作、runtimeState/businessResult 记录。RunId 唯一性由 GUID 生成保证；重复 RunId 并发是调用方错误，Mutex 串行 + artifact 覆盖已兜底，无需队列所有权。

## 5. 不变量 ↔ 测试（verify/integration_runtime.ps1，故障注入）

| 不变量 | 测试 |
| --- | --- |
| 互斥：并发提交串行、无双 JVM | S2/S4/S15（history maxLiveRuntime=1） |
| 恢复：崩溃前手的孤儿 Java 被身份化杀、后继正常 | S5 |
| 恢复：身份不符（PID 复用/无关 java）放过 | S14 |
| 恢复：活持有者哨兵 + 空闲 Mutex → RUNTIME_BUSY 拒绝、不清 | S6 |
| 恢复：损坏哨兵 → 拒绝、fail-closed 不清 | S16 |
| 互斥：活持有者阻塞后来者排队 | S8 |
| 结果可信：patch 缺 manifest → 不验收 | S17 |

（S5 曾抓到 `IdentityAlive([int]$pid,…)` 参数撞 PowerShell 自动变量 `$PID` 致身份判定失效——正是"主动制造故障证明系统正确拒绝"的价值。）

## 6. 配置单源

`agent/tools/config.ps1` 提供 root/fr/java/nashorn/runtime dir/deploy/heap(FR_AGENT_HEAP env)/MutexName/AcquireTimeoutSec；runtime.ps1/fr_agent.ps1/集成/静态/入口脚本一律源自它或 env，无裸硬编路径（`check_ps1_static.ps1` 把关）。
