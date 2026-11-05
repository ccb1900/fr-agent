# r21-runtime-status-regression：收尾提交的收尾审查（基准 5de4019，2026-11-05）

> 命名说明：朴素号 rNN 与 r20/r21-ddd（并行会话占用）冲突规避，本文件是 r19/r20 收尾之后针对收尾提交 5de4019 的独立审查归档。用户指示模式同前（逐字入档、回归修复、全门、提交 push）。

思考了 1m 3s

### fr-agent 最新收尾提交审查

最新 `main` 已更新到：

`5de40194a389f4a57056d1a307ff5eadd51a4d93`

提交说明是 R19 收尾：修复 `runtime.ps1` 状态映射，并增加 `S27e` 权限拒绝测试。

我检查了实际代码，发现一个比上轮状态映射更值得注意的问题：`runtime.ps1` 新增的穷尽式 `switch` 使用了 `$jp.file`，但当前文件中没有看到 `$jp = Read-JavaPid ...` 的赋值。

这意味着状态映射虽然补齐了，输入却没有准备。PowerShell 下未初始化变量默认为 `$null`，最终会走 `default { 'unknown' }`。如果确实没有其他隐式赋值，这会让所有带活动哨兵的状态查询都报告 `javaState: unknown`，而不是实际的 Java 状态。

这是本次需要优先核实和修正的回归。我继续检查测试是否覆盖了真实 `runtime.ps1 status` 调用，而不只是单独验证状态映射。

### 一、确认的问题：`$jp` 赋值被删掉了

`agent/tools/runtime.ps1` 当前第 31 行：

```powershell
$javaState = switch ($jp.file) {
```

但从整个 45 行文件来看，没有任何地方给 `$jp` 赋值。

对照上一版本，原本有：

```powershell
$jp = Read-JavaPid $cfg.RunsDir ([string]$a.runId)
```

这行在本次修改中被删除了，却没有在 `switch` 前恢复。

实际执行路径是：

```text
读取 active.json
    ↓
解析 owner
    ↓
直接读取 $jp.file
    ↓
$jp 为 null
    ↓
switch 进入 default
    ↓
javaState = unknown
```

这会让正常情况下也无法正确显示 Java 状态。

| 实际情况                    | 当前预期    | 当前代码结果  |
| ----------------------- | ------- | ------- |
| java.pid 不存在            | absent  | unknown |
| java.pid 为 PENDING      | unknown | unknown |
| java.pid 是有效身份且 JVM 活着  | live    | unknown |
| java.pid 是有效身份但 JVM 已退出 | gone    | unknown |
| java.pid 损坏             | corrupt | unknown |

P2：明确回归

建议只补回原来的读取语句：

```powershell
$jp = Read-JavaPid $cfg.RunsDir ([string]$a.runId)

$javaState = switch ($jp.file) {
    'ok'         { Classify-Process ([int]$jp.pid) ([long]$jp.start) $true }
    'absent'     { 'absent' }
    'pending'    { 'unknown' }
    'corrupt'    { 'corrupt' }
    'unreadable' { 'unknown' }
    'unknown'    { 'unknown' }
    default      { 'unknown' }
}
```

这不是设计问题，而是修改时漏掉了一行必要的数据读取。

### 二、测试还有一个缺口

`docs/architecture/runtime-supervisor.md` 第 107 行宣称：

> runtime.ps1 status 穷尽映射：pidfile 不可确认透出 unknown 而非 absent。

但我检查了 `verify/integration_runtime.ps1`：

* S27 验证的是 `Get-FilePresence`。

* S27b 验证的是锁定哨兵会导致 `RUNTIME_BUSY`。

* S27e 验证的是 `unreadable`。

* 没有看到 S27 实际启动 `runtime.ps1 -Action status` 并断言 `javaState` 的调用。

因此，文档声称的 S27 白盒联动与当前提交中的集成测试代码并不对应。

提交说明提到了 `logs/_r20_red_probe` 红绿探针，但一次性探针不能替代持续运行的回归测试。

建议增加一个真正的黑盒测试：

* 构造 `active.json`，其中 `runId` 指向测试目录。

* 构造一个被独占锁定的 `java.pid`。

* 执行 `runtime.ps1 -Action status`。

* 解析 JSON，断言 `javaState == "unknown"`。

* 释放文件锁并清理测试状态。

这样才能证明完整调用链正确，而不只是证明 `switch` 语句本身正确。

### 三、S27e 权限测试

这次的改进是有价值的。

```powershell
icacls $f27u /deny '*S-1-1-0:(R)'
$cls27u = Get-FilePresence $f27u
icacls $f27u /remove:d '*S-1-1-0'
```

使用 Everyone 的显式拒绝读取 ACE，比单纯依赖普通用户权限更有说服力，也覆盖了管理员运行时容易出现的测试盲区。

我没有在自己的 Windows 环境执行这段 ACL 测试，所以认可的是实现思路和测试设计，不是替你确认了实机结果。

### 四、整体架构结论

本次提交的实际代码改动集中在：

* `agent/tools/runtime.ps1`

* `verify/integration_runtime.ps1`

* `docs/architecture/runtime-supervisor.md`

* `README.md`

* `docs/gpt/r19.md`

没有看到 Runtime 执行模型发生变化。

此前确立的核心方案仍然合理：

* Windows Named Mutex 负责单 Session 互斥。

* `active.json` 负责运行哨兵。

* `java.pid` 负责 FineReport JVM 身份。

* `.NET Process` 负责进程生命周期。

* `WaitForExit` 负责确认退出。

* 无法确认状态时拒绝执行。

没有理由重做 Runtime，也没有理由再引入一套调度系统。

### 五、最终审查意见

| 优先级 | 问题                     | 处理建议      |
| --- | ---------------------- | --------- |
| P2  | runtime.ps1 删除了 $jp 赋值 | 必须恢复      |
| P2  | 没有持久化测试覆盖完整 status 调用链 | 补真实调用测试   |
| 已解决 | unreadable 分类缺少专项测试    | S27e 已补   |
| P3  | 文件检查和内容读取分两次打开         | 保留记录，暂不阻塞 |
| 无   | Runtime 架构需要重构         | 不需要       |

我的最终判断：这次收尾方向正确，但还不能宣布完成。

尤其是第一项，是一个很典型的重构回归：为了让状态映射更完整，反而删掉了状态映射所依赖的数据来源。

修复后再跑一次完整测试即可。不要因此扩大修改范围，更不要重新设计已经收敛的 Runtime。

[查看本次提交](https://github.com/ccb1900/fr-agent/commit/5de40194a389f4a57056d1a307ff5eadd51a4d93)
