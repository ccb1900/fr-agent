# r21b-freeze：最终冻结裁定（收尾审查，基准 447e2b5，2026-11-05）

> 命名说明：审查裁定"不要再开 R22"，本归档按 rNN-主题 命名风格取 r21b（r21-dia-runtime-status-regression 的裁定后续），避免与"下一轮 rNN"命名冲突。

思考了 1m 47s

我重新查了 `main`，最新提交已经是 `447e2b5`（完整 SHA：`447e2b536c08583f30221a1afeaf4b7a3a173151`）。

先说结论：这次确实是在收尾，没有重新扩张 Runtime 架构。 上一轮指出的两个问题都针对性地处理了：恢复 `$jp` 的读取，并增加了真正调用 `runtime.ps1 -Action status` 的 S28 黑盒回归。

但我还发现一个测试脚本的收尾瑕疵，下面把它和真正的功能问题区分开，不会为了一个日志问题再启动一轮架构修复。

### 1\. 上一轮两个问题：都已修复

| 上轮问题                              | 本次处理                      | 我的判断 |
| --------------------------------- | ------------------------- | ---- |
| runtime.ps1 使用 $jp.file，却没有读取 $jp | 恢复 $jp = Read-JavaPid ... |      |
| 缺少 status 完整调用链的持久化测试             | 增加 S28                    |      |

尤其是 S28，设计是正确的：

* A 路径：构造真实存活的 Java 进程身份，调用 `runtime.ps1 -Action status`，断言 `javaState = alive`。

* B 路径：独占锁定 `java.pid`，再次调用 status，断言 `javaState = unknown`，不能错误报告为 `absent`。

它不是单独测试 `switch`，而是实际走过状态读取、进程身份判定、JSON 输出这条调用链。这正是上轮缺少的测试。

### 2\. 本次还剩两个小问题

P3，不阻塞冻结

问题 A：S28 后面多了一条提前结束日志。

`verify/integration_runtime.ps1` 中：

```powershell
if (($java28a -eq 'alive') -and ($java28b -eq 'unknown')) {
    Pass "S28 status chain..."
} else {
    Fail "S28 broken..."
}

Write-Output ("INTEGRATION END, failures=" + $fail)

# 后面才开始执行 S27
```

而文件末尾本来就有一条真正的 `INTEGRATION END`。

这不会让后面的 S27 停止执行，也不会直接改变最终退出码，但会让测试日志提前宣告结束。

建议：只删除 S28 后面那条提前结束日志，保留文件末尾的最终统计。

问题 B：测试编号文档没有完全同步。

`scripts/run-integration-tests.ps1` 和 `AGENTS.md` 仍有 S1–S19 的旧描述，而实际集成测试已经到 S28。

建议将这两处更新为 S1–S28，并注明具体编号以 `runtime-supervisor.md` 为准。

这两项都是收尾整理，不应该再引出新的 Runtime 设计工作。

### 3\. 整体架构复核

这次我还重新检查了 Runtime 的实际实现，不只是看提交说明。

当前结构仍然是：

```text
fr_agent.ps1
    │
    ├── Named Mutex
    │
    ├── active.json
    │
    ├── _identity.ps1
    │     ├── Get-FilePresence
    │     ├── Read-JavaPid
    │     ├── Classify-Process
    │     └── Kill-OrphanJvm
    │
    ├── engine_launch.ps1
    │     └── Process / WaitForExit
    │
    └── FineReport
```

没有发现本次修改重新引入：

* 自制任务队列；

* 数据库调度；

* OwnerToken；

* 新的 Supervisor；

* 额外进程管理框架；

* 新的并发执行模型。

`docs/architecture/runtime-supervisor.md` 对 S28 的归属也已经同步。

我的判断：当前 Runtime 架构可以冻结，不需要继续重构。

### 4\. 审查范围与验证边界

本次检查了：

* 最新提交及完整变更文件清单；

* `agent/tools/runtime.ps1`

* `agent/tools/_identity.ps1`

* `agent/tools/fr_agent.ps1`

* `verify/integration_runtime.ps1`

* `scripts/run-integration-tests.ps1`

* `verify/check_ps1_static.ps1`

* `docs/architecture/runtime-supervisor.md`

* `docs/agent-tools.md`

* `AGENTS.md`

* `README.md`

没有发现 GitHub Actions 与该提交关联的运行记录。提交说明声称 S1–S28 全绿，但我没有在你的 Windows/FineReport 环境实际执行这些测试，因此不会把提交说明当作我亲自验证过的结果。

### 最终裁定

Runtime 架构冻结

我建议：

* 删除提前输出的 `INTEGRATION END`。

* 同步两处过时的 S1–S19 描述。

* 运行一次现有完整集成门。

* 完成后不再安排 Runtime 专项修复。

不要再开 R22，不要再扩展状态机，不要再增加恢复机制。

接下来应该回到 `fr-agent` 的核心目标：让 Agent 稳定地生成、修改和验证 FineReport 报表。

这次更新是有效收尾，不应该再演变成下一轮无休止的修复。
