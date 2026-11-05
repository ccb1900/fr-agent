# Golden E2E Case 定义（第一个真实报表端到端验收资产）

> 定位（2026-11-05，Runtime r21b 冻结后的转向）：不再扩 Runtime 架构（docs/gpt/r21b-freeze.md 裁定），回到 fr-agent 核心目标——让 Agent 稳定地生成、修改和验证 FineReport 报表。本文是第一个 Golden E2E Case 的正式定义与资产索引：一个真实业务报表，从自然语言需求到生成、预览、真值对拍、一次 modify 回归的全链验收。审查方第二步的"真实调用链核查 + 唯一断点指认"以本索引为接车文档。

## 1. 一切已在链上的事实（先亮底，再找断点）

该链在 r10 端到端真跑通过（README #59：仅凭自然语言→语义 spec→管线→`RESULT_DUMP` 总计 33531/26531/79.12 逐格命中独立真值、0 retry；README #82：三场景闭环零人工 JSON）。本案例是把它**升级为持证验收资产**，不是从零起步。

| 环节 | 仓库位置 |
| --- | --- |
| Agent 收需求/理解 | `agent/tools/plan.js` + `plan2spec.js`（`-Intent` JSON 文件；preflight 统一检查 + 术语归一） |
| 语义层字段匹配 | `semantic/schema`（I2 Schema Inspector，四文件 core 零 java）＋`semantic/model`（I3 vocab/registry/validator/resolver，三态 resolved/ambiguous/unknown，未知不臆造） |
| ReportSpec 产生 | `semantic/planner`（I4 三态分派：ready/ambiguous→反问/rejected）＋`spec_validator`/`spec_compiler`（I1/I5） |
| ReportSpec→IR→CPT | `lib/ir.js`（IR 契约）→`lib/object.js`（API 对象图）→`lib/cpt.js`（v2 校验器） |
| 调 FineReport | `run.ps1`→`engine_launch.ps1`→JVM（r21b 冻结的薄执行器） |
| 预览/成功判断 | runresult 11 阶段 + `RESULT_DUMP` 栅格 + `agent/tools/preview.js` + `artifact.json` 契约（r10） |
| 用户修改（不推倒重来） | modify verb = PatchSpec → `template/{ops,validator,locator,diff,reader,inspector,patch}.js`（I6；staging 隔离、原件保留、执行回归+像素 diff） |

## 2. 案例选型（推荐）

**主案例：机台生产日报**
- 输入（自然语言示例）："给我出一份激光机台的生产日报：按机台汇总昨天及近几天的计划数、完成数、完成率（比率用完成/计划百分数），按机台过滤到某一台或全部，完成数取检测合格分≥0.9 的件数口径，要按天分组、按机台 TOP、最后放一张每日完成数柱状图；样式按生产同款（SimHei，表头加粗，合计在最右）"。
- 为什么选它：覆盖**多字段多口径（COUNT/score≥0.9/ratio×100）、分组+合计、参数筛选、TOP N、柱状图**——最能一次打中 sort/topN/filters/presentation.chart（I5.3 三项+图表均已引擎 live 端到端验证）。
- 版式对标：`docs/cpt-samples/3D翘曲检查数据分析V2.cpt`（生产同款版式学习源：合并组带表头、行高冗余、SimHei 112 全员——AGENTS 排版红线）。
- **配套 modify 回归**：第一次生成后，用户口头"把标题改为《生产日报（复核）》、把合格分阈值口径改为 ≥0.8"——Agent 走 modify（PatchSpec）**patch 原报表**而非重新生成，验收执行回归逐格不变（除被改格）+ 像素 diff < 5% + 原件保留。

**备选**：纯报表基线可对照 `docs/cpt-samples/销售明细.cpt`（demo 家族源样式）与 `销售明细_参数面板_api.cpt`（管线自产、参数面板/提交按钮代表）；若审查方第二步认为参数面板应入 Golden 主线，再升级。

## 3. 验收口径（四条，全部复用既有工具，不新写框架）

1. **需求→spec 正确**：plan 输出 ready 且字段/口径与用户表达一致；ambiguous 必须反问（requiresConfirmation）不得自动选；unknown 不臆造字段（I3/I4 r2 §3.3/§4.3 原样保留）。
2. **生成可打开**：runresult 11 阶段 passed（含 cpt_validate 回归门）＋ preview 导出 PNG/PDF 落盘＋cpValidate 无 style count mismatch；**人工肉眼过目**由用户执行（AGENTS 惯例：产品验证走文件层，用户决定看什么）。
3. **数据真值对拍**：`RESULT_DUMP` 栅格与独立真值逐格等值（`verify/verify_sql_data.js` 哨兵 + `verify/compare_paths.js` 三线对拍，缺真值 SKIP 不假绿）——真值锚定 `data/db_laser_sub_truth.txt` 与 `models/production/model.json` 的业务口径（计划=COUNT(*)、完成 score≥0.9、完成率 r×100、平均分全加权）。
4. **修改不推倒重来**：modify 走 I6 patch 通道，patch 前后执行回归坐标屏蔽比对（PatchSpec 坐标）、渲染像素 diff<5%、原 CPT 保留（staging 出货）。
（北方口径提醒：数据集受只读闸、部署件凭据自动门、`?` 绑定=FR 后端不支持用受控字面量——均为既定架构边界，不因 Golden 案例翻动。）

## 4. 资产索引（审查方接车地图）

- CPT 样张（**仓库现首次入库，未提交全部 CPT，凭据扫描零命中**）：`docs/cpt-samples/3D翘曲检查数据分析V2.cpt`（生产版式对标）、`docs/cpt-samples/销售明细.cpt`（demo 源样式）、`docs/cpt-samples/销售明细_参数面板_api.cpt`（参数面板代表）。
- 数据结构/口径：`models/production/model.json`（5 实体/15 映射/6 指标/3 维度/3 关系，业务口径已锚真值）、`data/db_laser_tables_prod.json`（生产库结构）、`data/db_tables_profile.txt`/`data/db_br_truth.txt`（历史真值参照）、I2 schema（`data/schema_atom_live_demo.json` 演示库命物；生产库结构见上）。
- 真值对拍锚：`data/db_laser_sub_truth.txt`（栅格真值哨兵源）。
- 工具：`agent/tools/fr_agent.ps1`（verb 契约 docs/agent-tools.md）、`verify/compare_paths.js`、`verify/verify_sql_data.js`、产物契约 `application/contracts.js`（ReportArtifact/RunResult）。
- 可复现雏形记录：`docs/agent-demo-machine-daily.md`（r7 首次完整演示）、README #58/#59/#61/#62/#82。

## 5. 如实清点：现在还缺什么（等审查方第二步指认）

- **入口形态**：plan 吃 `-Intent` 文件，不是"用户直接输入自然语言"的服务化界面（工具层未 HTTP/MCP 化——r11/r12 既定）。
- **运行期日期参数**：日期当前走固定字面（受控字面量替代 `${}` 是架构取舍，README #62 有记）。
- **样式覆盖深度**：ReportSpec 表达力到部分样式；A2 对照曾记录 PNG 与旧 JS 的样式差异（#68）。
- **图表通道**：presentation.chart 三型（bar/pie/line）；更多图型走缺口账（coverage.md）。
- 上述皆属"链上补窟窿"，不触碰冻结的 Runtime 五件套。
