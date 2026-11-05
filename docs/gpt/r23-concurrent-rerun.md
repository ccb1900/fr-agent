# r23-concurrent-rerun：同 RunId 并发重入竞态审查（基准 c76d18d + 6e6f404，2026-11-05）

> 命名说明：r22 主题线续篇（golden-scope → golden-readiness → verifier-blocking → 本篇 concurrent-rerun）。裁定：一个 P1（同 RunId 并发重入竞态）修掉即收尾；Runtime 不重开、不加大架构。

思考了 58s

这次有实质性进展：上轮指出的验证器假通过问题已经补上，而且仓库记录显示，Golden v1 第一次真实端到端运行已经完成了五步闭环。

但我不会仅凭提交说明就宣布通过。最新两个提交还修改了 `agent/tools/fr_agent.ps1` 和 `verify/integration_runtime.ps1`，尤其把报表产物组装移回了互斥区。这触及此前冻结的 Runtime 边界，需要单独核对其正确性和副作用。

### 一、验证器：上轮 P1 已修复

`verify/verify_sql_data.js` 现在增加了：

* 真值侧重复键检查；

* 生成侧重复键检查；

* 双向键集合比较；

* 明细行数一致性检查；

* 原有逐行指标和总计检查。

`compare_paths.js` 也增加了连续前缀校验，非法配置退出码为 2。

从代码逻辑看，这次确实堵住了上轮指出的"真值 10 行、生成 9 行，却因总计相同而假通过"的漏洞。

代码修改方向通过

不过，提交记录中的 smoke 测试结果是仓库记录的执行结论，我没有在你的 Windows 环境重新运行这些测试。

### 二、真实 Golden E2E：取得了重要成果

`README.md` 和 `docs/golden-e2e-case.md` 新增了第一次真实运行记录。

### Golden v1 五步闭环

* Plan

    识别 `InspectionRecord`、业务日期、机台、计划数、完成数、完成率及日期区间。

    完成

* Create

    生成 `生产日报GOLDEN_api.cpt`，记录称 11 个阶段全部通过。

    完成

* Validate

    通过机台级真值验证，10 条明细和总计均匹配。

    完成

* Preview

    FineReport 实际渲染 PNG，记录尺寸为 1587 × 2245。

    完成

* Modify

    修改标题为"生产日报（复核）"，记录显示未修改部分保持不变，原始 CPT 保留。

    完成

数据验收记录

### 33,531

计划数

### 26,531

完成数

### 79.1238%

完成率

以上为提交文档记录的运行结果，不代表我独立取得了你的机器上的原始日志和渲染文件。

这是项目迄今为止很重要的里程碑：它不再只是 CPT 生成工具的局部测试，而是有了从需求理解到实际报表修改的完整案例。

### 三、但我发现一个新的 P1：同 RunId 并发检查仍然有竞态

这是本次最需要注意的问题，位置在 `agent/tools/fr_agent.ps1`。

当前执行顺序是：

```powershell
if ($artFile -and (Test-Path $artFile)) {
    # RUNID_EXISTS
}

$r = Invoke-UnderMutex $body
```

问题在于：RunId 重复检查发生在取得 Mutex 之前，而且取得 Mutex 后没有再次检查。

设想两个进程同时使用相同的 RunId：

* A 检查 `compile.json`：不存在。

* B 检查 `compile.json`：也不存在。

* A 取得 Mutex，执行 FineReport，生成 `compile.json`，随后释放 Mutex。

* B 取得 Mutex。

* B 没有重新检查 `compile.json`，继续执行第二次 FineReport。

于是，同一个 RunId 仍可能执行两次。

这恰好是本次修改想要防止的情况。

P1：需要修复

### 为什么现有 S24 没有发现？

我检查了 `verify/integration_runtime.ps1`。

旧的 S24 是两个进程争抢同一个 RunId，验证一个成功、一个失败。

新 S24 改成了：

* 事先创建 `compile.json`；

* 启动两个 compile 进程；

* 断言两个都返回 `RUNID_EXISTS`。

这个测试只能证明预先存在的产物会被拒绝。

它没有测试两个进程同时从"产物不存在"开始争抢同一个 RunId。

而这正是需要覆盖的竞态窗口。

### 建议怎么修

只需要一个很小的修复：

* 保留入口处的快速重复检查；

* 在取得 Mutex 后、真正执行引擎前，再检查一次对应的 `compile.json` 或 `patch.json`；

* 已存在则返回 `RUNID_EXISTS`；

* 增加真正的同 RunId 首次并发负例，验证最终只有一次引擎执行。

不需要增加锁、队列、Token 或 Supervisor。现有 Named Mutex 足够解决这个问题。

### 四、关于 Runtime 冻结

这次把 `create_report.js` 和 `modify_report.js` 移回 Mutex 内执行，我认为方向有合理性：让产物组装和本次执行的关键文件写入处于同一个互斥区间。

但它改变了临界区的持续时间，而且不能代替上述重复检查。

我的判断是：

* 不需要推翻 Runtime 冻结；

* 不需要重新设计并发架构；

* 只需要在现有 Mutex 保护区内补上 RunId 的二次检查，并让测试覆盖真实竞争场景。

### 五、最终裁定

| 项目               | 结论       |
| ---------------- | -------- |
| 复合键验证器           | 通过代码审查   |
| Golden v1 真实创作闭环 | 仓库记录显示完成 |
| 数据真值验证           | 仓库记录显示通过 |
| FineReport 实际预览  | 仓库记录显示完成 |
| 标题修改与原件保留        | 仓库记录显示完成 |
| RunId 并发安全       |          |
| Runtime 整体架构     | 不建议重新打开  |

我的建议：不要再进行大范围架构修复。只修这一个 RunId 竞态，然后结束这轮 Runtime 收尾。

还有一点值得明确：这次 Golden v1 已经证明了项目最重要的产品方向是可行的。接下来应该把注意力从"不断修基础设施"转回 Agent 的需求理解、报表创作质量和修改可靠性。

本次审查基准：

* [c76d18d：验证器双向闭合](https://github.com/ccb1900/fr-agent/commit/c76d18d7236542f3b538070b61736a96fbc89f7a)

* [6e6f404：Golden v1 首次真实运行及 RunId 调整](https://github.com/ccb1900/fr-agent/commit/6e6f404dcc0275491d62f2b0e1fff9e55ca5277e)

这轮不是又要开始无尽修复。只剩一个明确、可复现、可验收的并发缺口。
