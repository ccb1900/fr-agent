# r22b-golden-readiness：Golden v1 收齐审查（基准 ed7a48a，2026-11-05）

> 命名说明：r22 主题线的收尾审查（r22-golden-scope.md 之后）。审查定向：NOT 开跑前的三项快备，完成后即进入第一次真实端到端运行。

思考了 43s

我定位到最新提交：`ed7a48a`（2026-11-05）。

这次确实按上轮要求收敛了范围：Golden v1 不再承诺机台筛选、TOP N、每日图表和 SQL 阈值修改；新增了日期 × 机台真值文件，并把验证工具的复合键改造留到 v1 开跑前。

方向上，我认可这次减法。 但我还要核实一个关键点：新增真值是否真的能验证"日期 × 机台"，以及 JOIN 自证是否足以证明关联正确。提交说明里的数字不能代替这项检查。

### 一、复核结果

这次做对了三件事：

* `docs/golden-e2e-case.md` §6.1 已明确固定日期区间、日期 × 机台分组、三个指标、`recordToFile` JOIN 和仅修改标题。

* §6.2 将四项未实现能力放进 v2+，没有继续把它们冒充现有能力。

* 新增的 `db_laser_machine_daily_truth.txt` 与旧真值的区间总计一致：计划数 33531、完成数 26531、完成率 79.1238%。

但是还有三个问题。

### 二、需要处理的三个问题

1\. Golden 文档前后仍然矛盾（P1）

§6 已经收敛，但前面的 §2、§3 仍然把机台筛选、TOP N、图表、修改阈值列为主案例和验收能力。

这意味着代码 Agent 如果只读文档前半部分，仍然可能按旧范围实施。

应当让 §2、§3 明确引用 §6.1 的 v1 范围，把旧设计标记为历史方案或 v2+，不能留下两套验收口径。

2\. JOIN 自证还不够（P1）

我检查了 `probe_machine_daily_truth.js`。

当前逻辑是：

```sql
FROM laser_aaa a
LEFT JOIN laser_files f
  ON a.file_key = f.file_key
```

而 `join_sanity` 检查：

```text
base_cnt = 33531
joined_cnt = 33531
distinct_key_cnt = 10
```

它能证明 LEFT JOIN 没有放大行数，但不能证明每条记录都成功匹配。

因为 LEFT JOIN 即使存在未匹配记录，也会保留左表行数。

另外，实际 SQL Builder 对这条关系使用的是 `INNER JOIN`。真值探针应该与实际生成 SQL 的关联语义一致，或者明确证明没有未匹配记录。

建议增加：

* `matched_cnt`

* `unmatched_cnt`

* `fanout_cnt`

并确保真值查询与生产生成 SQL 使用相同的 JOIN 类型。

3\. 目前只有一台机台，复合键场景尚未被真正覆盖（P2）

新真值文件的 10 条明细全部是：

```text
laser3-aaa
```

所以它确实覆盖了 10 个日期 × 1 台机台，但还没有覆盖同一天存在多台机时的键冲突。

这不影响当前单机台数据的基本验证，但不能据此宣称多机台复合键回归已经得到证明。

而且 `compare_paths.js` 和 `verify_sql_data.js` 还没有完成复合键适配，这是 v1 开跑前必须完成的工作。

### 三、我建议本轮只做一次小收尾

不要再动语义层、SQL Builder、Runtime、Patch 框架。

| 修改           | 范围                                                |
| ------------ | ------------------------------------------------- |
| 统一 Golden 文档 | docs/golden-e2e-case.md                           |
| 补足 JOIN 匹配证明 | probes/probe_machine_daily_truth.js 和真值文件         |
| 验证工具复合键      | verify/compare_paths.js、verify/verify_sql_data.js |

完成后就停止准备工作，直接跑真实案例。

### 四、之后真正要做的事情

### 第一次真实端到端运行

* Plan

    自然语言输入，检查字段和指标识别。

* Create

    生成 ReportSpec、IR 和 CPT。

* Validate

    检查 CPT 结构和数据真值。

* Preview

    在 FineReport 中实际打开，导出 PNG/PDF。

* Modify

    让 Agent 修改标题，验证原报表保留及未修改内容不变。

我的最终判断：这次更新已经把 Golden v1 的方向定对了，但还不是开跑信号。 把上面三个问题收尾后，就不要再继续扩展准备工作了，直接进入第一次真实运行。

审查基准：[`ed7a48a`](https://github.com/ccb1900/fr-agent/commit/ed7a48ae7ca04992f4388f9df7a4d062527361a9)。我检查的是提交后的实际文件；尚未在你的 SQL Server 和 FineReport 环境独立执行探针。
