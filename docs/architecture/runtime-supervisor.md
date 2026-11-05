# Runtime Supervisor 状态协议（r14）

> 契约文档。互斥实现：`agent/tools/fr_agent.ps1` 持有 OS 命名 Mutex；`agent/tools/runtime.ps1` 管理记录/状态机。
> 定位：`application` 与 FineReport Runtime 之间的正式基础设施——**任务可并发提交，FineReport Runtime 单实例串行执行**。
> r14 关键修正：互斥用 **OS 命名 Mutex（内核级）**，崩溃恢复用 **owner 身份（pid+StartTime）判定**，不再用文件锁 + 时间启发式（r13 的 InitGraceSec/init_stalled 时间回收会把"挂起但存活"的持有者误删）。

## 1. 三性质（r14 §6 验收）

1. **互斥安全性**：任何时刻最多一个 FineReport 执行权持有者（OS Mutex WaitOne 内核保证）。
2. **故障恢复安全性**：不能证明 owner 已死亡，就绝不回收锁、绝不终止 JVM（身份判定，非时间/损坏判定）。
3. **结果可信性**：没有完整执行+回归证据，绝不向 Agent 声明成功（contracts.js fail-closed）。

## 2. 存储布局（记录/状态，非互斥体）

```
logs/agent/runtime/
  owner.json          当前持有者身份记录 {runId,verb,ownerPid,ownerStart,ownerToken,pipelineTag,acquiredAt}
  queue/<runId>.json  RunId 独占登记（CreateNew 原子）+ 排队态
  done/<runId>.json   终态记录 {runtimeState, businessResult, reason?}
  history.log         事件流（SUBMITTED/ACQUIRE/RELEASE/RECOVER），集成测试据此证串行
logs/agent/runs/<runId>/java.pid   本次启动的 JVM pid + StartTime（身份化恢复用）
```

互斥体 = OS 命名 Mutex `fr-agent-fine-report-runtime`（同登录会话内跨进程）。文件只是记录，生死由身份定。

## 3. 执行协议（fr_agent compile/patch）

```
register（CreateNew queue/<runId>.json 原子独占；已存在→RUNID_INFLIGHT，严格一个赢）
  ↓
Mutex.WaitOne(timeout)  ── 超时→ unregister 自己槽 + QUEUE_TIMEOUT（绝不偷活锁）
  ↓ 获得
取锁后检测：owner.json 若指向"别的 runId 且其 ownerPid 已死(pid+StartTime 身份)"→ recover-previous（崩溃前手）
  ↓
mark-running（写 owner.json 身份）
  ↓
run.ps1（-NoKill；写 java.pid=pid+start；跑 FineReport）→ create_report/modify_report
  ↓
finalize（验 runId+ownerToken 匹配 owner.json；queue→done{released,businessResult}；删 owner.json）
  ↓ finally
（若 body 抛出未 finalize：安全网补 finalize failed，绝不留 phantom running）→ ReleaseMutex
```

## 4. 恢复语义（fail-closed，身份判定）

| 状态 | 判定 | 动作 |
| --- | --- | --- |
| owner.json 缺失 | 无持有者记录 | 幂等/NO_OWNER_RECORD，绝不伪造成功 |
| owner.json 损坏（不可解析） | 身份不可验证 | fail-closed：不回收、不判成功（S19） |
| ownerPid 存活 + StartTime 匹配 | 持有者活着（哪怕慢/挂起） | 绝不回收、绝不杀（S8/S10） |
| ownerPid 不存在 或 StartTime 不符（PID 复用） | 持有者已死 | recover-previous：按 java.pid 身份杀该 JVM、清 FineDB 锁、标 lost/failed |

**关键**：TerminateProcess 后本机 Mutex 变"空闲"而非抛 AbandonedMutexException——故恢复检测走 owner.json 身份，不依赖 abandoned 信号（可靠）。

## 5. RunId 独占登记（r14 P1#1）

`register` 用 `FileMode.CreateNew` 原子独占 queue/<runId>.json；**不做"死 owner 回收"**（那会让重复 RunId 非严格）。槽清理只归 finalize（正常）或 recover-previous（崩溃前手）。两个同 RunId 并发 register 严格一个赢（S18）。

## 6. JVM 恢复定位（r14 P1#5）

恢复只杀 `runs/<lostRunId>/java.pid` 记录的进程，且**校验 pid+StartTime 完全匹配**（防 PID 复用误杀无关 java）。CommandLine 匹配（r13）已废除。S14 双向证明：start 不符→放过；精确匹配→杀。

## 7. runtimeState ⊥ businessResult（r14 P2-A）

`runtimeState`(queued/running/released/lost) 是执行权生命周期；`businessResult`(pending/succeeded/failed) 是报表业务结果。`finalize` 只置 released + 传入的 businessResult，二者正交——"释放执行权"≠"报表成功"。

## 8. 不变量 ↔ 测试映射（verify/integration_runtime.ps1，S1–S19 故障注入）

| 不变量 | 测试 |
| --- | --- |
| 互斥：并发提交串行、无双 JVM | S2/S4/S15 |
| RunId 独占：并发同 RunId 严格一个赢 | S18 |
| 恢复安全：崩溃持有者→lost/failed 绝不假成功 | S5 |
| 恢复安全：活持有者阻塞后来者、不回收 | S8 |
| 恢复安全：JVM 身份化杀（不误杀无关 java） | S14 |
| 恢复安全：owner 损坏 fail-closed 不伪造成功 | S19 |
| 结果可信：patch 缺 manifest→不验收 | S17（+ fast_contracts fail-closed） |
| 术语归一：候选契约按 target 映射，歧义/未知透传不臆造 | fast_planner TermNorm |

## 9. 配置单源（r14 P2-C）

`agent/tools/config.ps1` 提供 root/frHome/java/nashorn/runtime dir/deploy/heap/MutexName/超时；runtime.ps1、fr_agent.ps1、集成/静态/入口脚本一律源自它或 `FR_AGENT_HOME`/`FR_HOME` env（无裸硬编路径，`check_ps1_static.ps1` 把关）。
