# Runtime Supervisor 状态协议（r13 R12.3）

> 契约文档。实现：`agent/tools/runtime.ps1`（唯一 writer 逻辑）；调用方：`agent/tools/fr_agent.ps1`。
> 定位：`application` 与 FineReport Runtime 之间的正式基础设施——**任务可并发提交，FineReport Runtime 单实例串行执行**（r12/r13）。
> 原则（r13 §9）：不要把 GREEN 当正确性证明；每条关键不变量都有主动制造故障的测试（`verify/integration_runtime.ps1` S1–S15）。

## 1. 存储布局（文件系统状态机，单机单实例，不引入 Redis/DB）

```
logs/agent/runtime/
  lock/                 全局执行权互斥（目录原子创建 = 跨进程 mutex）
    owner.json          当前持有者身份（仅当锁被持有时存在）
  queue/<runId>.json    在途任务登记（queued / running）
  done/<runId>.json     终态任务记录（released / lost）
  history.log           事件流（ACQUIRE / RELEASE / RECOVER），集成测试据此证明串行
```

明确边界（r13 P2-A）：queue 文件不是可靠消息队列；history.log 不是事务日志；owner.json 与 lock 目录之间无跨文件事务——因此协议用**身份判定**而非**文件存在性**来决定生死（见 §3）。

## 2. 任务状态机

```
SUBMITTED  →  QUEUED  →  ACQUIRED  →  RUNNING  →  RELEASED(SUCCEEDED|FAILED)
                                          │
                                          └─(owner 崩溃)→ RUNTIME_LOST → RECOVERY → LOST(FAILED)
```

两个正交维度，绝不混为一谈（r13 P2-A）：

| 维度 | 取值 | 含义 |
| --- | --- | --- |
| `runtimeState` | queued / running / released / lost | **执行权**生命周期 |
| `businessResult` | pending / succeeded / failed | **报表业务结果** |

`release` 只把 runtimeState 置 `released`；业务成败由调用方（fr_agent）以 `-BusinessResult` 显式传入。"执行权正常释放"≠"报表生成成功"。

## 3. 锁协议（修复 r13 P1-A / P1-B）

### 3.1 获取（acquire）
1. 校验 runId 字符集 `^[A-Za-z0-9_-]{1,64}$`；必须带 `-OwnerToken`（调用方生成的 GUID）。
2. **重复 RunId 策略**：若 `queue/<runId>.json` 已存在（queued/running）→ 拒绝 `RUNID_INFLIGHT`（同一 runId 不得二次执行）。终态（done）不阻断，允许显式重跑。
3. 登记 `queue/<runId>.json`（submittedAt、runtimeState=queued、ownerToken）。
4. **FIFO（best-effort）**：仅当自己是 queue 中 submittedAt 最早的 queued 项时，才尝试 `New-Item lock`；否则等待。
5. 原子创建 lock 目录成功 → 在 lock 内原子写 `owner.json`：`{runId, verb, ownerPid(调用方存活 pid), ownerStart(进程 StartTime.Ticks), ownerToken, pipelineTag, acquiredAt}`。
6. 创建失败（锁已存在）→ **按身份判定，绝不因文件缺失就删锁**：
   - `owned_alive`（pid 存活且 ownerStart 匹配）→ 等待。
   - `owned_dead`（pid 不存在，或 pid 在但 StartTime 不匹配 = PID 复用）→ Recovery(owner-dead, killJava=true)。
   - `initializing`（lock 存在但 owner.json 未写，且 lock 目录创建 < InitGraceSec）→ **等待，不删**（这是初始化窗口，非陈旧）。
   - `init_stalled`（owner.json 缺失且 lock 创建 ≥ InitGraceSec）→ Recovery(init-stalled, killJava=false)（创建者崩在写 owner 之前，无从确认任何 java）。
7. 超过 AcquireTimeoutSec → 删除自己的 queue 登记，返回 `QUEUE_TIMEOUT`（不留幽灵排队项）。

### 3.2 释放（release）
- 必须带 `-OwnerToken`。owner.json 不存在 → 幂等（视为已释放）。
- token 不匹配 → `NOT_OWNER`，**绝不删除他人锁**（r13 S11）。
- token 匹配 → 删 lock 目录、queue→done（runtimeState=released, businessResult=传入值）。

### 3.3 恢复（Invoke-Recovery）—— 只在身份确认已死后
- 仅杀 `CommandLine` 匹配该 owner `pipelineTag`（make_api.js / patch_main.js）的 java，**不杀机器上所有 java**（r13 §6 / S14）。
- 仅当 owner 被确认死亡（owned_dead）才删 FineDB 遗留锁（先确认实例已退出，r13 §6）。
- abandoned run 记 done：`runtimeState=lost, businessResult=failed, reason=RUNTIME_LOST:*`，**绝不记成功**。

### 3.4 年龄 ≠ 死亡（修复 P1-B）
`TaskSuspectSec`（默认 1800）只产生 `status.suspect=true` 告警，**永不触发 Recovery/kill**。生死只由 owner 身份（pid + StartTime）决定。

## 4. 不变量 ↔ 测试映射（r13 §7）

| 不变量 | 测试 |
| --- | --- |
| 并发提交，Runtime 串行（不并行 JVM） | S1/S2/S4/S15（history maxLiveRuntime=1） |
| 失败任务不污染其他 | S3/S15 |
| 崩溃 owner 被识别为 lost/failed，绝不假成功 | S5/S12 |
| 活持有者强制后来者排队（非并行、非误恢复） | S8 |
| 锁初始化窗口 waiter 不删锁（无双获取） | S9 |
| 年龄超限但 owner 存活 → 不恢复 | S10 |
| 错误 token 不能释放他人锁 | S11 |
| 重复 RunId 不产生二次执行 | S13 |
| 恢复只杀 pipeline java，不误杀无关 java | S14 |

## 5. 配置单源（r13 P2-C）

`agent/tools/config.ps1` 提供 root/frHome/java/nashorn/runtime dir/deploy dir/heap/超时策略；runtime.ps1、fr_agent.ps1 dot-source 它；run.ps1/runraw.ps1 读 `FR_HOME`/`FR_AGENT_HOME` env（默认保留）。禁止在各入口重新硬编码路径（`verify/check_ps1_static.ps1` 静态把关）。
