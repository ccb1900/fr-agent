# r22-golden-scope：Golden E2E Case 审查（基准 fe516b0，2026-11-05）

> 命名说明：审查主题是 golden-case 范围收敛（非 Runtime R22 专项——Runtime 专项 R22 已被 r21b-freeze 裁定禁止）。本文逐字入档用户转交的审查全文；修正行动：只改 docs/golden-e2e-case.md 验收范围 + 准备机台级真值资产（审查明示"不要同时修六七个模块"）。

思考了 5m 7s

看到了。你这次是提交到了 GitHub 仓库，不是上传到聊天附件。我已经定位到最新提交：

`fe516b0` — 2026-11-05

提交内容正好是我们要的第一批 Golden E2E 资产：

* `docs/golden-e2e-case.md`：真实报表端到端案例定义。

* `docs/cpt-samples/`：三份精选 CPT 样张。

* 配套生产模型、数据表结构和真值数据的索引。

* `.gitignore`：为精选 CPT 样张增加明确白名单。

初步判断：方向正确，而且这次不是只提交一份说明文档，已经把真实 CPT 样张纳入仓库。

我接下来要核实的是：文档描述的业务口径是否真的能从数据模型和 CPT 中得到支持，以及这个案例是否选得合适。不能仅凭提交说明就宣布通过。

我把这次提交的文档、三份 CPT、生产模型、Schema、真值文件，以及相关生成、校验和修改代码都对照看过了。

我的裁决是：

暂不通过 Golden E2E 验收定义

资产入库方向正确，但 `docs/golden-e2e-case.md` 目前把几项尚未打通的能力写成了已经可以组合使用的完整案例。 现在不应该让代码 Agent 按这份文档直接开工。

### 一、这次提交做得好的地方

### 1\. CPT 样张选得有价值

| 样张            | 实际价值                | 我的判断 |
| ------------- | ------------------- | ---- |
| 3D翘曲检查数据分析V2  | 生产报表布局、合并表头、字体、参数面板 |      |
| 销售明细          | 基础表格、分组、合计          |      |
| 销售明细_参数面板_api | 参数控件和提交按钮           |      |

3D 翘曲样张有两个 SQL 数据集，使用 `wh_live` 连接名；它适合做生产级版式参考，但不是机台日报的业务模板。

我检查了三份 CPT 的文本内容，没有发现 `password=`、JDBC 连接串或明显的用户名密码组合。这个入库处理是合理的。

### 2\. 语义模型有真实数据依据

`recordToFile` 关系：

```text
laser_aaa.file_key
       |
       | confirmed N:1
       |
laser_files.file_key
       |
       |
laser_files.source_id
       |
       |
     机台
```

这是机台日报最重要的关联路径。

值得肯定的是，项目没有单纯根据字段同名就认定 JOIN 安全，而是有 `i55_relation_unique_truth.json` 数据侧唯一性证据，并且绑定了模型、Schema 和数据源指纹。

这条思路应该保留，不需要重新发明关系验证机制。

### 二、目前有四个实质问题

### P1：机台筛选实际上不支持

Golden Case 写了：

> 按机台过滤到某一台或全部。

但我检查了 `semantic/query/sqlbuilder.js` 的实际实现。

当前筛选逻辑只允许：

* 主实体表的属性；

* 主实体表上的维度。

而 `machine` 维度实际来自：

```text
laser_files.source_id
```

主实体 `InspectionRecord` 则来自：

```text
laser_aaa
```

SQL Builder 明确拒绝跨表筛选：

```javascript
if (!colMeta) {
  E(errs, 'UNKNOWN_REF', fp + '.field',
    'filter 字段非实体表可过滤列(跨表 filter 暂拒): ' + fl.field);
  return;
}
```

所以：

* 按日期分组：支持。

* 按日期和机台分组：有安全 JOIN 路径。

* 按机台过滤：当前实现拒绝。

这不是猜测，是代码明确限制。

参考：[sqlbuilder.js](https://github.com/ccb1900/fr-agent/blob/fe516b0b672a1a021291c3498616e3235a4711b/semantic/query/sqlbuilder.js)

### P1：修改案例超过了现有 PatchSpec 能力

Golden Case 设计了这样一次修改：

> 把标题改为《生产日报（复核）》，把合格分阈值从 ≥0.9 改为 ≥0.8。

我检查了 `template/ops.js`。

当前白名单只有两个操作：

```javascript
var WHITELIST = {
  replace_cell_value: { args: ['sheet', 'cell', 'value'] },
  replace_dataset: { args: ['name', 'columns', 'rows'] }
};
```

其中：

* 标题如果是普通单元格，可以通过 `replace_cell_value` 修改。

* SQL 中的 `score >= 0.9` 不能通过现有 PatchSpec 安全修改。

* `replace_dataset` 是替换为 `EmbeddedTableData`，不是修改原 SQL 数据集的查询条件。

* `set_report_title` 也明确列为未实现。

因此，标题修改可以作为第一次 Modify 回归，但阈值修改不能冒充现有能力。

参考：[ops.js](https://github.com/ccb1900/fr-agent/blob/fe516b0b672a1a021291c3498616e3235a4711b/template/ops.js)

### P1：现有真值文件无法证明机台级数据正确

这是我认为最需要重视的问题之一。

你现在提交的：

`data/db_laser_sub_truth.txt`

其明细粒度是：

```text
日期 | 工序(L/R) | 计划数 | 完成数 | ...
```

不是：

```text
日期 | 机台 | 计划数 | 完成数 | ...
```

现有验证工具也有相同限制：

* `verify/verify_sql_data.js` 按日期读取结果，只支持日期级真值对拍。

* `verify/compare_paths.js` 使用第一列作为明细键。

例如同一天有十台机台，`compare_paths.js` 会把相同日期的记录覆盖，无法逐台比较。

所以现在即使报表总计是 33531 / 26531，也不能证明每台机台、每天的数值都正确。

参考：

* [db_laser_sub_truth.txt](https://github.com/ccb1900/fr-agent/blob/fe516b0b672a1a021291c3498616e3235a4711b/data/db_laser_sub_truth.txt)

* [verify_sql_data.js](https://github.com/ccb1900/fr-agent/blob/fe516b0b672a1a021291c3498616e3235a4711b/verify/verify_sql_data.js)

* [compare_paths.js](https://github.com/ccb1900/fr-agent/blob/fe516b0b672a1a021291c3498616e3235a4711b/verify/compare_paths.js)

### P2：TOP N 和图表的业务含义还没有对齐

当前 SQL Builder 的 TOP N 实现是：

```sql
SELECT TOP n ...
GROUP BY ...
ORDER BY ...
```

如果同时按日期和机台分组，TOP N 限制的是日期—机台组合的结果行，不是整个日期区间内 TOP N 台机台，也不是每天 TOP N 台机台。

这三种业务含义不同。

图表也有类似问题：`SpecCompiler` 将图表绑定到同一个 `ds1` 数据集。

如果表格按日期、机台分组，图表却要求每日总完成数，那么同一天会有多台机的数据。当前图表通道没有单独的每日汇总数据集，不能直接证明它会得到正确的每日总量。

参考：[spec_compiler.js](https://github.com/ccb1900/fr-agent/blob/fe516b0b672a1a021291c3498616e3235a4711b/lib/spec_compiler.js)

### 三、还有两个语义层细节

第一，中文术语「机台」存在歧义。

模型中：

* `Machine.machineId` 的业务标签是「机台」；

* `machine` 维度的业务标签也是「机台」。

`ModelResolver` 会产生多个候选，`TermNorm` 对 ambiguous 不做自动选择。

但 SQL Planner 对未规范化的维度名称最终走模型成员缺失检查，可能直接 rejected，而不是返回真正的待确认问题。

这与文档中"模糊需求必须反问"的承诺不一致。

第二，Machine 实体的 key 不够严谨。

模型声明：

```json
"key": ["source_id"]
```

但 `laser_files` 的 Schema 主键实际是：

```text
source_id + collection_date + file_id
```

`source_id` 并非单列唯一键。作为机台维度使用它没有问题，但不能把它当作 `laser_files` 这张表的唯一行标识。

这项暂时不阻断本案例的 JOIN，因为当前查询使用的是 `recordToFile` 关系，而不是把 `Machine` 当成唯一行来 JOIN。

### 四、我建议下一步怎么做

不需要现在扩展 Runtime，也不需要重写 Agent 或 Patch 框架。

我建议把第一个 Golden Case 收敛成一个真正能验收的版本：

### Golden E2E v1

建议作为第一阶段目标

保留：

* 固定日期区间：2026-09-13 至 2026-09-22。

* 按业务日期、机台分组。

* 计划数、完成数、完成率。

* 使用现有 `recordToFile` 安全 JOIN。

* 完成数按 `score >= 0.9` 计算。

* 合计行和实际 FineReport 预览。

* 用户修改报表标题，走现有 PatchSpec。

暂时移出第一阶段：

* 机台跨表筛选。

* TOP N 机台排名。

* 每日汇总图表。

* 修改 SQL 中的完成阈值。

然后只补两项验收资产：

* 新增独立的 `db_laser_machine_daily_truth.txt`，保存日期 × 机台的真值。

* 让现有验证工具支持复合键（日期 + 机台），而不是再造一套测试框架。

这样才能真正证明 Agent 生成的每一台机、每一天的数据都正确。

### 最终裁定

| 项目               | 结论          |
| ---------------- | ----------- |
| CPT 样张入库         | 通过          |
| 语义模型基础           | 基本通过，存在细节问题 |
| 机台日报案例选择         | 合理          |
| Golden Case 当前范围 | 不通过         |
| Runtime          | 继续冻结        |
| 是否需要大规模重构        | 不需要         |

我建议这轮只让代码 Agent 修改 `docs/golden-e2e-case.md` 的验收范围，并准备机台级真值资产。不要同时修六七个模块。

等这个基准规格成立，再跑一次完整的 `plan → create → validate → preview → modify`。这才是从无尽修复转向真正产品能力的第一步。

我没有在你的 Windows FineReport 环境里实际执行这些 CPT，因此以上是基于指定 commit 的代码和资产审查，不把静态检查冒充成引擎实测。
