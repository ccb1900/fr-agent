# A2 前置：五类报表新旧路径对照（r8 §十一 A2 启动条件）

> 目的：在决定"哪些 JS Feature 迁到 ReportSpec"之前，先用**同一数据、同一口径**跑两条路径对比。
> 结论先行：**数据等价已有硬证据**（日报类）；**结构差异只剩文案层**；浏览器族与 VanChart 属能力缺口，不迁。
> 方法可复跑：`verify/compare_paths.js` + 下文的命令；不是"看着差不多"。

## 1. 对照矩阵

| # | 报表 | 旧路径（JS Feature / rawIR） | 新路径（ReportSpec） | 数据 | 结构 | 渲染 | 结论 |
|---|---|---|---|---|---|---|---|
| 1 | `sales_demo`（内嵌 rows） | `reports/sales_demo.js` | `examples/report-spec/sales_demo.json` | 等价 | **IR JSON 全等** | 字节铁证 `A8EF39AB…` | **已迁移（等价）** |
| 2 | 生产日报（SQL 单实体） | `reports/agent_daily_report.js`（手写 SQL rawIR） | `examples/report-spec/daily_report.sql.json` | **逐日+合计完全相等** | 仅标题/表头文案/脚注行不同 | PNG 不同（结构差异导致） | **可迁移**（需对齐文案） |
| 3 | 机台生产日报（JOIN 双维） | 无（新能力） | `examples/report-spec/machine_daily_demo.json` | 33531/26531 对真值 | — | PNG 1587×2245 | **ReportSpec 独有**（新增能力，无旧路径） |
| 4 | 浏览器族 24/25 张 | `reports/br_*.js` + `features/data_browser/browser.js` | 无 | — | — | — | **不迁移**（缺 SQL 分页/参数面板/机台过滤/TOP） |
| 5 | 图表 | `reports/test_vanchart.js`（VanChart 6 图种） | `presentation.chart` 仅 legacy bar\|pie\|line | — | — | — | **部分**：legacy 可迁；VanChart 不迁（登记缺口） |

## 2. 硬证据（日报双路径）

命令（两条路径各自跑一次，栅格 + RunResult + PNG 全留）：

```powershell
# A: ReportSpec
$env:REPORT_SPEC='examples/report-spec/daily_report.sql.json'; $env:RESULT_DUMP='logs/agent/a2_spec_grid.txt'; ...
# B: JS rawIR
$env:REPORT_SPEC='reports/agent_daily_report.js';       $env:RESULT_DUMP='logs/agent/a2_js_grid.txt'; ...
# 对照（零引擎）
java -cp nashorn.jar jdk.nashorn.tools.Shell verify/compare_paths.js
```

结果（`logs/agent/a2_compare.json`）：

- 两条路径 RunResult 均 `success=true`、11 阶段全 passed；
- **10 个日期明细逐格相等**（planned/done/rate 均 0 差），差异列表为空；
- **合计相等**：`[33531, 26531, 79.1237958903701]` vs `[33531, 26531, 79.1237958903701]`；
- 结构差异仅 3 处：标题后缀（`·I5 语义自撰`）、表头文案（`业务日期` vs `加工日期`、`完成率` vs `完成率(%)`）、JS 路多一行口径脚注（13 行 vs 15 行）；
- PNG 不一致（SHA-256 不同）：属上述结构差异，不是数据差异。

## 3. 能力缺口登记（不迁移的原因，不是 bug）

| 缺口 | 影响 | 现状 | 若要做的前提 |
|---|---|---|---|
| SQL 分页（`sqlPaging` + `WebPage` page/size 参数） | 浏览器族 24 张 | Feature 专责（README #38–44） | ReportSpec 增加分页/参数契约；FR 参数面板读回探针 |
| 运行期日期/机台筛选（参数控件） | 日报"支持日期筛选"的完整语义 | 仅编译期 `dateRange` 字面量 | 同上（参数面板读回/写回证据） |
| 机台过滤 + 按天 TOP + 多列工具条 | 浏览器族交互 | Feature 专责 | ReportSpec 表达 filters/topN 之外的 UI 与联动 |
| VanChart 插件族（vbar/vline/varea/vscatter/vpie/vgauge） | `test_vanchart` 类报表 | IR 已支持，ReportSpec 无入口 | `presentation.chart` 扩 kind 白名单（需 cpt 断言补形态） |
| 条件格式/高亮 | "低于 80% 标红" | IR 有 conditions 能力，ReportSpec 未暴露 | ReportSpec presentation 增加条件表达式 + 渲染断言 |
| 按派生比率排序 | 完成率降序 | sqlbuilder 只允许 SQL 别名 | 允许 ORDER BY 派生表达式或物化列（需 SQL 安全评审） |

## 4. A2 迁移决策（基于上表）

1. **立即可迁（低风险）**：日报类（#2）——先对齐标题/表头/脚注文案，再以"数据逐格相等 + PNG 结构差异清单"为验收；不动旧文件，双跑并存。
2. **已等价**：`sales_demo`（#1）——保持现状，作为回归对照。
3. **暂不迁移**：浏览器族（#4）与 VanChart（#5）——先补能力，不能为迁移牺牲现有交互。
4. **无旧路径**：机台日报（#3）——作为 ReportSpec 的增量能力继续演进。

**结论**：ReportSpec 足以承担"新建报表 + 日报类结构化报表"的长期契约；浏览器族/交互式报表仍由 Feature 承担。
下一步 A2 若继续，按 #2 做文案对齐并双跑验收；其余等能力补齐后再谈。

## 5. 复跑入口

- 对照工具：`verify/compare_paths.js`（纯离线，读栅格/RunResult/PNG，数值十进制规范化比较）。
- 产物：`logs/agent/a2_compare.json`（含逐格 diff、合计、PNG SHA-256）。
- 说明：PNG 不一致不作为失败条件（结构差异已知）；数据不等或运行失败即 `ok=false`。
