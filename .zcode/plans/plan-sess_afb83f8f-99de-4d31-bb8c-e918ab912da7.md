# I5.1「模型驱动 SQL 正确性加固」实施计划（r3.md §四；先修正确性、不加新功能）

## Context
r3 对当前 main 静态审查提了 5 问题；我已对源码逐条复现，**P1–P4 属实**（P5 是正确的架构边界说明，不改；r3"I6 尚未开始"过期——I6 已于 `c4fe924` 落地，其"探针冻结/不猜"哲学恰与 r3 一致）。r3 结论与我一致：下一步不加新功能，先把 I5 模型驱动 SQL 与 Planner 的正确性洞修掉，才值得向多表 JOIN/图表迈进。已拍板：**dateRange 严格双边+日历有效性**、**P3 启动时 ModelValidator 对 schema 校验、对不上即拒（不每次重扫库）**。

四条待修洞（均为"表面合法、结果错误/语义未决却 ready"的假成功类）：
- P1 sqlbuilder：维度/指标 `col.split('.').pop()` 后一律挂 `ent.table`、`count` 不看 `e.table` → 跨表字段（machine=laser_files / fileCount=laser_files）被拼成 `... FROM laser_aaa` 不 JOIN 不报错、静默出错。
- P2 planner SQL 分支：状态只由 `validateSpec`（校形状不校成员存在）决定 → 模型不存在的幽灵维度/指标仍 `ready`。
- P3 make_api SQL 生成路径不跑 `ModelValidator.validate(model, schema)` → 库结构漂移不能及时发现。
- P4 dateRange：spec_validator 逐字段"有才查"（{from 无 to} 放过），sqlbuilder 要 both；两处都只做字符串正则、不校验日历有效性（`2026-99-99` 都放过）。

## 单元（红→绿；每洞先写"必然失败"的复现测，再修根因）

**T1 · 日期单点（P4，一处真相）** 新建 `lib/isodate.js`（纯函数零依赖，仿 ir.js）：`validate(s)`→日历有效性（月 1-12、日按月份天数含闰年、格式 `yyyy-MM-dd`）+ `range(from,to)`→{ok,errs} 要求 **from/to 同时存在**。`lib/spec_validator.js` sql 分支 dateRange 与 `semantic/query/sqlbuilder.js` 的日期分支**都改调它**（消除两处不一致）。红：单边、`2026-99-99`、`2026-02-30` 现放过；绿：全拒。
- 边界：`semantic/*` 载入 `lib/isodate.js` 不违 R7（isodate 非后端三件、纯函数、无 Java.type/com.fr）；`check-boundaries` 复跑。

**T2 · 跨表拒绝闸（P1）** `semantic/query/sqlbuilder.js`：维度要求 `d.table === ent.table`、指标要求 `e.table === ent.table`（count/sum/weightedAvg/countThreshold 均有 table），否则 `E('UNSUPPORTED_CROSS_TABLE', path, '当前查询不支持跨实体表字段（JOIN 属 I5.2）')` 并**不产该 SQL**。红（fast_sqlbuilder）：entity=InspectionRecord + dimension `machine` 或 metric `fileCount` → 现会生成错 SQL；绿：返回 UNSUPPORTED_CROSS_TABLE、无 sql。

**T3 · planner 语义未决不 ready（P2）** `semantic/planner/planner.js` SQL 分支：模型成员缺失记入计数 → 状态判定改为「有缺失成员 → 不能 ready」（并入 validationWarnings/或 unresolvedQuestions，status `rejected`/`deferred`）。红（fast_planner）：`dimensions:['ghostDim']`/`metrics:['ghostMetric']` 现可能 ready；绿：非 ready、幽灵项不入 spec。

**T4 · ModelValidator 接生成链（P3）** `make_api.js` SQL 分支：`SpecCompiler.compile` 之前 `load(Paths.semantic('model/validator.js'))` + 读 `Paths.data('schema_<source>.json')` → `ModelValidator.validate(modelObj, schema)` → 有 errs 则 `input_load failed`+`SPEC ISSUE`+`finishRun` 非零（对不上即拒，不连库）。schema 缺失 → 明确报错提示先跑 I2 inspector（不静默放行）。红：给一个引用了 schema 中不存在列的 model（合成）→ 生成链现在会放行；绿：拒。默认 `schema_atom_live_demo.json` 与现 model 对齐 → 正常日报仍过（回归）。

**T5 · 指标参数严格校验（r3 任务5）** `semantic/model/validator.js`：`ratio` 必 numerator+denominator、`scale` 若给须有限数、`countThreshold` 的 `op∈OPS 白名单`+`value 有限数`、`weightedAvg/sum` column 必填；越界结构化错。红：scale 非数、op 乱写、value 缺 → 绿：拒。

**T6 · SQL 结果数据回归（r3 任务6，防"表面合法结果错"复发的哨兵）** 新建 `verify/verify_sql_data.js`（纯 Node/Nashorn，零引擎）：读 `logs/i5_auto_grid.txt`（I5 端到端产出的 RESULT_DUMP）→ 逐格对 `data/db_laser_sub_truth.txt` 的 grand_total/逐日 subtotal（33531/26531/79.12 等）。缺文件则跳过并提示（不假绿）。**并跑一次引擎端到端**（ZCode 授权）产新 grid 再对拍；跨表请求走 T2 拒（引擎实测 machine 维度→clean reject 不出错报表）。

## 验证与红线
- 离线：`scripts/run-fast-tests.ps1` 全 12 套件 GREEN（含新断言）+ `check-boundaries` R1–R8 + `scan_all_specs` 42/43。
- 引擎：I5 自产日报端到端复跑总计仍 33531/26531/79.12（T4 校验对已存在 schema 不误伤）；machine 跨表请求 = 干净 UNSUPPORTED_CROSS_TABLE 而非错报表；默认 `run.ps1 make_api.js` 收尾双铁证 CBEB42E3/A8EF39AB 不变（T4 动了 make_api 装载面，必跑）。
- 负门复跑（改了 make_api/装载面）。每单元一 commit、红→绿留证；README #61（I5.1）+ AGENTS §6 状态更新为"I5.1 正确性加固完成；跨表=拒、JOIN=I5.2 未做"、r3 P1–P4 关闭、P5 记为架构说明。
- 全程：TDD 红先行（每洞一个"当前必失败"的复现测），Fix Root Causes（改判定/拒绝，非加 try 掩盖）；不加 JOIN/图表/新功能（守 r3"先别做新功能"）；不碰 I1 内嵌 sum-only 与既有基线。

## 明确不做（守 r3 + 防提前抽象）
不实现多表 JOIN（T2 是**拒绝**跨表，JOIN 留 I5.2）；不做图表/非日期筛选/排序/TopN（I5.3）；不动 ReportIR/Semantic Model 分层（r3 §五架构原则）；不内置 Agent 执行器（loopguard 仍是纯判决件，外部 Agent 驱动不变）。