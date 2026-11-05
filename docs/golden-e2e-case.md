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

## 2. 案例选型（推荐；验收范围以 §6.1 GOLDEN v1 为唯一口径——r22b 审查要求消除两套口径）

**主案例：机台生产日报**

- **输入（自然语言，v1 唯一口径）**："出一份激光机台生产日报：固定日期区间 2026-09-13 至 2026-09-22，按业务日期、机台分组；每天每台给计划数（件数）、完成数（score≥0.9 口径件数）、完成率（完成/计划×100，展示层指标不进 SQL）；合计行在最右，版式按生产同款（SimHei、表头加粗、边框全留）"。
- **历史输入草案（仅档案，不作 v1 承诺）**：原设计曾含"按机台过滤、按天 TOP、每日完成数柱状图、阈值可改"——该四项已被 r22 审查证实为未打通能力（sqlbuilder 跨表 filter 拒 / ops 白名单两 op / 真值粒度 / TOP 行级语义与图表绑同 ds1），随 §6.2 移入 v2+，**Agent 不得按旧草案实施**。
- 为什么选它：分组+合计+三口径+JOIN 安全性一次覆盖既有链路强项；§6.2 的 v2+ 项在 v1 基准成立后按审查节奏逐项解锁。
- 版式对标：`docs/cpt-samples/3D翘曲检查数据分析V2.cpt`（生产同款版式学习源：合并组带表头、行高冗余、SimHei 112 全员——AGENTS 排版红线）。
- **配套 modify 回归（v1 唯一承诺的修改）**：第一次生成后，用户口头"把标题改为《生产日报（复核）》"——Agent 走 modify（PatchSpec `replace_cell_value`）**patch 原报表**而非重新生成，验收执行回归逐格不变（除被改格）+ 像素 diff < 5% + 原件保留；阈值修改 v1 不做（§6.2）。

**备选**：纯报表基线可对照 `docs/cpt-samples/销售明细.cpt`（demo 家族源样式）与 `销售明细_参数面板_api.cpt`（管线自产、参数面板/提交按钮代表）；若审查方第二步认为参数面板应入 Golden 主线，再升级。

## 3. 验收口径（四条，全部复用既有工具，不新写框架；口径以 §6.1 v1 为准）

1. **需求→spec 正确**：plan 输出 ready 且字段/口径与用户表达一致；ambiguous 必须反问（requiresConfirmation）不得自动选；unknown 不臆造字段（I3/I4 r2 §3.3/§4.3 原样保留）。
2. **生成可打开**：runresult 11 阶段 passed（含 cpt_validate 回归门）＋ preview 导出 PNG/PDF 落盘＋cpValidate 无 style count mismatch；**人工肉眼过目**由用户执行（AGENTS 惯例：产品验证走文件层，用户决定看什么）。
3. **数据真值对拍（v1=日期×机台级）**：`RESULT_DUMP` 栅格与 **`data/db_laser_machine_daily_truth.txt`** 逐格等值（`verify/verify_sql_data.js` 复合键模式 + `verify/compare_paths.js` 复合键对照——r22b 本轮已补 env 驱动，默认旧路径零漂移）——真值口径（计划=COUNT(*)、完成 score≥0.9、完成率 r×100）与 `models/production/model.json` 一致；真值探针与生产 SQL **同用 INNER JOIN**（join_sanity 另证 LEFT 等价：matched/unmatched/fanout 三计数）。
4. **修改不推倒重来**：modify 走 I6 patch 通道（v1 只改标题格），patch 前后执行回归坐标屏蔽比对（PatchSpec 坐标）、渲染像素 diff<5%、原 CPT 保留（staging 出货）。
（北方口径提醒：数据集受只读闸、部署件凭据自动门、`?` 绑定=FR 后端不支持用受控字面量——均为既定架构边界，不因 Golden 案例翻动。）

## 4. 资产索引（审查方接车地图）

- CPT 样张（**仓库现首次入库，未提交全部 CPT，凭据扫描零命中**）：`docs/cpt-samples/3D翘曲检查数据分析V2.cpt`（生产版式对标）、`docs/cpt-samples/销售明细.cpt`（demo 源样式）、`docs/cpt-samples/销售明细_参数面板_api.cpt`（参数面板代表）。
- 数据结构/口径：`models/production/model.json`（5 实体/15 映射/6 指标/3 维度/3 关系，业务口径已锚真值）、`data/db_laser_tables_prod.json`（生产库结构）、`data/db_tables_profile.txt`/`data/db_br_truth.txt`（历史真值参照）、I2 schema（`data/schema_atom_live_demo.json` 演示库命物；生产库结构见上）。
- 真值对拍锚：`data/db_laser_machine_daily_truth.txt`（day×machine 真值，INNER JOIN 同生产语义 + join_sanity matched/unmatched/fanout 自证；`db_laser_sub_truth.txt` 为日期级历史锚）。
- 工具：`agent/tools/fr_agent.ps1`（verb 契约 docs/agent-tools.md）、`verify/compare_paths.js`（复合键 env `AGENT_GRID_KEYCOLS`）、`verify/verify_sql_data.js`（复合键 env `TRUTH_DAY_MACHINE`）、产物契约 `application/contracts.js`（ReportArtifact/RunResult）。
- 可复现雏形记录：`docs/agent-demo-machine-daily.md`（r7 首次完整演示）、README #58/#59/#61/#62/#82。

## 5. 如实清点：现在还缺什么（等审查方第二步指认）

- **入口形态**：plan 吃 `-Intent` 文件，不是"用户直接输入自然语言"的服务化界面（工具层未 HTTP/MCP 化——r11/r12 既定）。
- **运行期日期参数**：日期当前走固定字面（受控字面量替代 `${}` 是架构取舍，README #62 有记）。
- **样式覆盖深度**：ReportSpec 表达力到部分样式；A2 对照曾记录 PNG 与旧 JS 的样式差异（#68）。
- **图表通道**：presentation.chart 三型（bar/pie/line）；更多图型走缺口账（coverage.md）。
- 上述皆属"链上补窟窿"，不触碰冻结的 Runtime 五件套。

## 6. GOLDEN v1 范围收敛（2026-11-05，外部审查 docs/gpt/r22-golden-scope.md 裁定"GOLDEN CASE 当前范围不通过"后收敛）

审查对本次资产入库给出的正确性事实——四项能力**尚未打通**、v1 不得组合宣称：
1. **机台跨表筛选不支持**：sqlbuilder 的 filter 只接受主实体（laser_aaa/InspectionRecord）可过滤列；machine 维度实来自 `laser_files.source_id`（跨表）→ 明确 `UNKNOWN_REF` 拒绝（r22 §2-P1）。
2. **SQL 阈值修改超 PatchSpec 能力**：template/ops.js 白名单仅 `replace_cell_value`/`replace_dataset`（后者=EmbeddedTableData 替换，不改原 SQL 数据集条件）；`set_report_title` 未实现（r22 §2-P1）。
3. **现有真值粒度到不了机台**：`db_laser_sub_truth.txt` 是 日期×工序(L/R)；`verify_sql_data.js` 只对拍日期级；`compare_paths.js` 以第一列为键、同日多机台会覆盖（r22 §2-P1）。
4. **TOP-N/图表业务语义未对齐**：`SELECT TOP n ... GROUP BY 日期,机台` 是"行级 TOP"而非"区间内 TOP N 台/每日 TOP N 台"；图表与表格绑同一 ds1、没有"每日总量"独立数据集（r22 §2-P2）。
另两条语义细节记档：术语「机台」双指（Machine.machineId label 与 machine 维度 label 同名 → resolver 候选多；planner SQL 分支对未归一维度走成员缺失=rejected 而非反问，与"模糊需求必须反问"承诺差半步）；`Machine.key=[source_id]` 与 laser_files 真实主键（source_id+collection_date+file_id）不严谨——不阻断 JOIN（走的是 recordToFile 关系，不是按 Machine 唯一行 JOIN）（r22 §3）。

### 6.1 GOLDEN v1（本轮收敛后的第一阶段验收线）

**输入（自然语言，v1 口径）**："出一份激光机台生产日报：固定日期区间 2026-09-13 至 2026-09-22，按业务日期、机台分组；每天每台给计划数（件数）、完成数（score≥0.9 口径件数）、完成率（完成/计划×100，展示层指标不进 SQL）；合计行在最右，版式按生产同款（SimHei、表头加粗、边框全留）"。
**验收线**：固定字面日期区间（I5 既定字面安全）；GROUP BY 日期+机台经 `recordToFile` 安全 JOIN（I5.1 证据指纹绑定）；指标=现有模型三口径；合计行；FineReport 真实预览（PNG/PDF+人工肉眼）；一次**标题**修改走现有 `replace_cell_value`（v1 只承诺标题，阈值修改不做）。

### 6.2 v2+（暂缓清单，基准成立后由审查方点名逐项解锁）

机台跨表筛选（需 sqlbuilder 安全路径扩展）、TOP-N 排名（先定义区间级/每日级业务语义）、每日汇总图表（需独立每日汇总数据集）、SQL 阈值修改（需 I6 白名单扩项，R0 探针先证——README #61 纪律"扩项需探针先证"）。

### 6.3 验收资产增量（r22 §4 明示）

1. **`data/db_laser_machine_daily_truth.txt`**（r22 新增、r22b 升级）：日期 × 机台三段真值（detail day×machine / 逐日小计 / grand）+ **join_sanity 五计数自证段（base/joined/matched/unmatched/fanout）**；主数据段与生产生成 SQL **同用 INNER JOIN**（join_sanity 以 LEFT 语义证明 INNER==LEFT：`33531=33531=33531/0/0`——全部匹配、零未匹配、零放大；fanout=laser_files 侧同键多记录的键数，**不能用左键组行数代替**——多检测记录共用一个文件键是正常业务）；固定区间 2026-09-13~2026-09-22；产线=`probes/probe_machine_daily_truth.js`（只读 JDBC 直查业务库，不启 FineReport，同 probe_dbtruth2 惯例）。
2. **验证工具复合键支持（r22b 完成、r22c 补双向闭合）**：`verify/verify_sql_data.js` 复合键模式（env `TRUTH_DAY_MACHINE=1`）——day@machine 逐行对三值、总计行对 grand 三值、**双侧重复键显式失败 + 双向完整键集合 + 明细行数一致**（r22c 修"只遍历生成侧可假通过"缺口）；`verify/compare_paths.js`（env `AGENT_GRID_KEYCOLS`，**必须连续前缀如 0 或 0,1，非法配置 exit 2**）+ 键重复哨兵 `keyDupsA/B` 计入 equal 判定。两者未设 env = 旧路径一字不动（零漂移）。多机台复合键回归仍属"工具逻辑已证，真实多机数据待后续"（r22b §3 诚实口径）。
