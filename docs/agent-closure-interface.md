# fr-agent · 报表创作端到端闭环（I5，r2 §5；2026-11-04）

> 面向**现成 Agent**（ZCode/Codex/Claude）的闭环协议。本文不实现 Agent，只把已存在的确定性件（I2 schema + I3 model + I4 planner + I1 runner + I5 sqlbuilder/loopguard）串成"自然语言 → 真实 CPT"的可复现回路，并固化 r2 §5.2 的失败修复上限。**未经真值对拍不得声称报表正确（AGENTS §1）**。

## 0. 分工：哪步归 Agent、哪步归确定性件

```
自然语言需求
  │  ← Agent（现成 LLM）：唯一"创造性"一步
  ▼
结构化意图 intent（业务术语，不写 SQL/IR）
  │  ← ReportPlanner.plan（I4，确定性；越权/歧义/未知三分流）
  ▼
语义 ReportSpec.json（model 实体/维度/指标引用 + 日期范围；无一行 SQL）
  │  ← SpecValidator(I1) + SpecCompiler(I1) → SqlBuilder(I5 模型→SQL) → cells IR
  ▼
make_api.js（I1 runner）→ CPT + PNG/PDF + RESULT_JSON +（RESULT_DUMP 栅格）
  │  ← LoopGuard(I5) 判决：done / retry-fix-spec(≤N) / reject
  ▼
数据真值对拍（栅格总计/逐日 vs 独立真值文件）→ 交付
```

Agent 只做「NL → intent / 语义 ReportSpec」；**SQL、IR、执行、校验、数据都对真值**全是确定性件。

## 1. Agent 产出物：语义 ReportSpec（禁手写 SQL/IR/JS）

真实生产报表（模型驱动 SQL 数据集）形态（`examples/report-spec/daily_report.sql.json` 为参考靶）：
```json
{
  "specVersion": "1",
  "report": { "name": "激光生产日报（计划/完成/完成率）" },
  "outName": "生产日报_自动",
  "dataset": {
    "kind": "sql", "connection": "ATOM_LIVE", "entity": "InspectionRecord",
    "dimensions": ["bizDate"],
    "metrics": ["planned", "done", "completionRate"],
    "dateRange": { "from": "2026-09-13", "to": "2026-09-22" }
  },
  "presentation": { "type": "table", "showTotal": true }
}
```
可用名（取自 `models/production/model.json`，**不许自造**）：
- entity：`InspectionRecord`(laser_aaa) / `LaserFile`(laser_files) / `Machine` / `Stage` / `ScoreResult`
- dimensions：`bizDate`(带 dateNormalize 规则) / `stage` / `machine`
- metrics：`planned`(COUNT) / `done`(score≥0.9 计数) / `completionRate`(完成/计划×100) / `avgScore`(全加权) / `totalScore`(SUM) / `fileCount`
写错名 → planner/validator 结构化拒（UNKNOWN_REF/模型缺口），**不编造**。连接只填**名**；驱动/URL/密码由 runner 从本机 dbpass 注入，绝不进 spec/cpt（AGENTS §4）。

## 2. 跑（一次）

```powershell
$env:REPORT_SPEC='examples/report-spec/<你的>.json'
$env:RESULT_DUMP='logs/<name>_grid.txt'      # 真值对拍要开
.\run.ps1 -Script make_api.js                 # 连库+execute 期 FR 查数；会杀 java
```
读 `RESULT_JSON`（stdout 末行 / `logs/last_run.json`）+ `logs/<name>_grid.txt`（计算后栅格）。

## 3. 判决 + 有界自修（r2 §5.2 上限）

`LoopGuard.nextAction(result, {attempt, elapsedMs}, {maxFixCount, deadlineMs, modifiableFields})` →
- `done`：`success && exit==0` 且**真值对拍通过**（见 §4）才可判成，不看 validate 绿就交=假绿（AGENTS §1）。
- `retry-fix-spec`：失败段可修 + 有定位字段 + 未越 `maxFixCount`/`deadlineMs` → 只改 `modifiableFields` 白名单内的**语义 spec** 字段（改的是业务术语/日期，**不是** SQL），重跑。
- `reject`：环境/连接/部署类失败（非 spec 可修）、超 maxFixCount、超时间、或 input_load 无白名单可修 → **停手交人工**，不无限循环。
- 建议默认上限：`maxFixCount=3`、`deadlineMs` 单轮 ~180s、`modifiableFields=['dimensions[*]','metrics[*]','dateRange.*','presentation.*','outName']`。SQL 查询范围/凭据由 `ir.js` SQL_READONLY + 凭据门 + outName 路径闸既有承担。

## 4. 真值对拍（数据正确性，最后一闸，不可跳）

拿 `logs/<name>_grid.txt` 的**总计行 / 逐日行**对独立真值：
- 日报（2026-09-13～22，laser_aaa，score 非空）：总计 计划 **33531** / 完成 **26531** / 完成率 **79.12**；首日 计划 4238/完成 2854（`data/db_laser_aaa_truth.txt`、`db_laser_sub_truth.txt` grand_total，README #52 已校验）。
- 口径：计划=有效评分记录数 COUNT(*)；完成=score≥0.9；完成率=完成/计划×100；平均分=SUM(score)/COUNT 全加权（**禁"均值之均值"**，README 坑；本引擎无 SUMPRODUCT）。
- 数值不符 = sqlbuilder/planner/spec 语义错 → 按 §3 修语义 spec（非 SQL），仍不符则 reject 上报，**不硬凑数、不改真值文件**。

## 5. 边界（诚实）
- v1 模型驱动 SQL 覆盖"单实体分组 + 模型已声明指标 + 日期范围"；跨实体 JOIN（如机台经 file_key 关联多表）当前由 `entity` 单表 + 模型指标表达，多表 join 的模型驱动生成是后续项。
- 不做自由文本 SQL / NL 直翻；不做图表（I5 chart）；不改已有 CPT（I6）。
- 演示库须在跑；连不上判 datasource_connect reject（环境类，非 spec 可修）。

> 已验证闭环样张：`examples/report-spec/daily_report.sql.json` → 总计 33531/26531/79.12 与 #52 独立真值逐格一致（README #59）。
