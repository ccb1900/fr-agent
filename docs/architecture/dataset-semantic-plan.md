# fr-agent：Dataset 与 Semantic 管理迭代实施规范（修订版 v1.1）

**基线：** `main`，2026-11-09（D0 已完成，见 §8）
**上游用户文档：** 原始规范《Dataset 与 Semantic 管理能力迭代实施规范》v1.0
**修订理由：** v1.0 有 6 处与本仓库既有实现/安全闸冲突，照原文实施会在 D1 就返工。本版把修正写进正文，使其可直接执行。
**不可突破约束沿用 AGENTS §N：** Runtime 冻结、不迁语言、不引大框架、不造新 IR/DSL/协议/抽象层、不把 FR 不支持的能力包装成支持、一次一个问题、铁证 MD5 复核。

---

## 1. 与 v1.0 的差异（先讲清改了什么，为什么）

| # | v1.0 原文 | 与现状的冲突（一手证据） | v1.1 裁定 |
|---|---|---|---|
| 1 | Dataset `query:{kind:'sql',text:'SELECT ...'}` | 自由文本 SQL 被**硬拒**：`lib/spec_validator.js:427`、`lib/report_spec.js:32/72`（§5.2） | Dataset **只存声明式选择**（entity/dimensions/metrics/filters）。SQL 仍由 `semantic/query/sqlbuilder` 从模型生成。资产里出现 `query` 键 → 契约验证器与 validator 双重拒 |
| 2 | 资产目录 `data/datasets/`、`data/sources/` | `data/` 是真值与结构画像目录（AGENTS §4，`db_*_truth.txt`、`schema_*.json`） | 资产放 `models/<domain>/datasets/*.json`，与 `model.json` 同生命周期；`data/` 不混资产 |
| 3 | `domain: "production"` | 现模型 `"domain": "laser_inspection"` 而目录叫 `production` —— 已有两套口径 | **`domain` = 目录与资产 ID 前缀（`production`）**；模型内 `domain` 字段作为业务语义名，不参与寻址。D1 在 `dataset-contract.md` 已按此定 |
| 4 | 新增 7 + 9 = 16 个 verb | `fr_agent.ps1` 现 15 verb；每 verb 都要 RunId 登记、合同行、`nextActions`、产物契约（`docs/agent-tools.md`）；且 `dataset_validate` 与现有 `validate`（报表验收）语义撞名 | 管理面收敛为 **2 个 verb + `-Action`**：`assets`（list/inspect/create/validate/publish）与后续 `semantic`。对外契约面从 15→17 而不是 31；`validate` 一名一义 |
| 5 | §9 测试清单 | 新 JS 必须登记 `verify/fast_parse.js` FILES；新套件必须登记 `scripts/run-fast-tests.ps1`；纯函数层受 `scripts/check-boundaries.ps1` R7 约束 | 写入硬门禁（§6.3）：**未登记 = 不算完成**。D0 已把这条做成自检（套件第 7 节自己断言"是否被登记"） |
| 6 | §11 真实业务验收 | 演示库里 `machine` 只有 `laser3-aaa` 一台、`stage` 只有 `L/R`（`sample_data` 实测 + `data/db_laser_*_truth.txt` 覆盖 2026-09-13~09-22） | 验收库**锁定 `atom_live_demo` + 真值文件**；"按机台分组"只作结构验证不作规模验证；不承诺近 30 天数据（库里 9/22 之后为空，实测 `where biz_date > '2026-9-22'` 返回 0 行） |

### 另外两条补充裁定

7. **列不手写**：`fields` 由 `SqlBuilder` 派生（`baseAliases` role=dim/metric + `derived` role=derived，`semantic/query/sqlbuilder.js:165-166`）。资产若声明 `asserts.fields` 必须与派生**逐项等值同序**（含 role）——否则模型口径变了没人知道。v1.0 把 fields 当输入是第二真相源。
8. **时间窗归报表，不归资产**：`dateRange/sort/topN` 写进资产即拒。复用同一 Dataset 的两张报表若各自不同日期，资产烤死一个窗口 = 静默共享错误口径；且当前实现是编译期定字面量（README #62），资产化会把它固化成不可覆盖的事实。

---

## 2. 目标与边界（v1.0 §1 基本保留）

**产品目标**：从"消费数据出报表"扩展到"帮助用户建设与维护 Dataset / Semantic 资产"。

**明确不做**：数据中台、BI 平台、自研 SQL 引擎、元数据服务器、MCP Server、新 Agent Runtime、新并发调度、低代码建模平台、ETL。**不修改冻结的 FineReport Runtime**（§N）。

**架构原则（可验证版）**：
1. 复用优先——D0 已证明"Dataset 校验的 4 道门里 3 道已存在"（`dataset-contract.md` §6）
2. 资产与报表分离；FineReport 原生数据集是**运行时实现**，不是资产
3. 语义按业务领域组织；`domain` 寻址口径见 §1 表第 3 行
4. Agent 可提议、可审计、**不可自确认口径**（机器化：`published` 必须有 `review`）
5. 只有校验且发布的资产才进 Planner
6. 可追溯：资产 ↔ 模型版本 ↔ schema 快照 ↔ 真值 四者绑定
7. 先一个领域闭环（`production`），再推广
8. 沿用 Java 8/Nashorn/PowerShell 边界，不引 Node、不迁 TS

---

## 3. 概念与分层（v1.0 §3.1 保留，去掉"第二套"风险）

```
Data Source（物理）        → data/schema_<source>.json（I2 快照，现成）
Business Dataset（资产）    → models/<domain>/datasets/*.json（D0 新增，声明式选择）
Semantic Model（业务口径）  → models/<domain>/model.json（现有，本阶段只增不改）
ReportSpec（一次报表意图）  → 现有，可引用 Dataset
FineReport Dataset（运行时）→ IR → 对象图 → cpt（现有链路，不动）
```

引用方向：`Dataset → schema` 与 `SemanticModel → Dataset`（S3 才建）；**ReportSpec 不直接指向物理表**。

---

## 4. Dataset（v1.0 §3，字段级契约见 `dataset-contract.md`）

- **生命周期**：`draft → validated → published → deprecated`；`published` 必带 `review.{by,at}`；已发布版本不可变，改动开新草稿；旧版本保持可读（追溯）
- **存储**：UTF-8 JSON + 原子写（复用 `agent/tools/_lib.js:32-45` 的 `.tmp + ATOMIC_MOVE`）；**不引入文件锁框架、不引入 DB**
- **身份**：`id` 稳定且与路径/域绑定（防任意路径输入）；同 id 静默覆盖已发布版本 = 拒
- **必备约束**：字段名唯一、类型明确、粒度可说明（且 `grain.keys == SQL GROUP BY 维`）、数据源用非敏感标识、凭据只走 `lib/dbpass.js`

### 能力（v1.1 收敛 verb，v1.0 §3.5 的功能不减）

| 动作（`-Action`） | 功能 | 引擎/锁 |
|---|---|---|
| `assets list` | 列领域下数据集（id/status/version） | 零引擎 |
| `assets inspect` | 资产详情 + 派生列 + 绑定状态 | 零引擎 |
| `assets create` | 写草稿（原子写、非法拒） | 零引擎 |
| `assets validate` | §4 契约 audit + SpecValidator + SqlBuilder 三段报告 | 零引擎（SqlBuilder 是纯函数） |
| `assets publish` | 校验通过 + review 齐备 → 落不可变版本 | 零引擎 |

`dataset_discover` **不新做**：复用 `semantic/schema/inspect_main.js`（I2）与 `agent/tools/sample_data.js`。

### 验证（v1.0 §3.6 拆成"静态/执行"两层，落到已有门）

- 静态：结构、键白名单、字段唯一、id/路径/域绑定、无凭据、无自由 SQL → **D0 验证器已覆盖**
- 执行：可访问、可执行、返回字段与声明一致、参数绑定、采样、行数上限 → 复用 `sample_data`（LIMIT ≤200，只读）与 `create/validate` 的 11 阶段 RunResult；**不默认全表扫描**

---

## 5. Semantic（v1.0 §4，去掉过度字段化）

- 保留 Entity/Attribute/Metric/Dimension/Relationship/Rule + Registry/Resolver/Validator/Planner/SQLBuilder，**不重写语义内核**
- **拆分而非扩写校验器**：`ModelValidator` 现同时管"通用合法性"和"领域完整度"，v1.1 要求把它显式分成两档——草稿只过通用档，`published` 才过完整度档（v1.0 §2 表格已含此意，此处定为验收项）
- 指标必填分两档（避免 v1.0 §4.4 的 14 项一刀切让现存模型直接不合格）：
  - **草稿档（现状即满足）**：`name/label/expression`（+ `format` 可选）
  - **发布档（新增治理项）**：`description`（业务定义）、`aggregation ∈ {additive, semi_additive, non_additive}`、`unit`、`owner`、`status`、`synonyms`
  - 理由：比率/均值不可再聚合是**真风险**（README「均值之均值」坑、`completionRate` 为展示层派生），但现存 `model.json` 没有这些字段——一刀切等于让既有资产全体转 invalid
- 关系：继续用 `source/cardinality/confidence` + `confirmed` 必带 `confirmedBy` + **数据侧唯一性证据**（`semantic/model/evidence.js`，30 天时效、三指纹绑定）；`naming-derived` 永不参与 JOIN（`sqlbuilder` 已实现）
- 术语：`resolved/ambiguous/unknown` 三态**不得为自动化率取消**；同名异义按 `domain` 作用域隔离
- 生命周期 `draft → validated → reviewed → published → deprecated`，`reviewed` 只表示"待确认清单已回答"，不建审批系统

---

## 6. 与 Planner / 报表链路的接入（v1.0 §5）

```
Intent → Domain Resolver → published Semantic Model → Dataset Resolver → published Dataset
       → ReportSpec → SpecCompiler → IR → Object → CPT → FR 执行 → validate/preview → 交付
```

- **Planner 不写资产、不发布资产**（v1.0 §5.1 原样采纳）
- 兼容红线（验收级）：现存 `model.json` 可加载、`resolve`/`plan` 三态不变、`kind: rows|sql` 两路不变、create/modify/validate/preview 不回归、**铁证 MD5 不变**
- 版本绑定：`datasetId/datasetVersion/domain/modelVersion` 记入 **`artifact.json`**（现有契约），不塞进 ReportSpec
- 影响分析 v1 只做静态：`Dataset 字段 → Semantic 属性 → 指标/维度 → 引用它的 spec/报表`；先"说清谁受影响"，不做自动修复

### 6.3 硬门禁（v1.1 新增，对应 §1 表第 5 行）

1. 新 JS → 登记 `verify/fast_parse.js`（产品文件）或 `scripts/run-fast-tests.ps1`（套件），**缺登记视为未完成**
2. 新纯函数层 → 过 `scripts/check-boundaries.ps1`（R1–R8；`semantic/*` 禁 `com.fr.*`，见 R7）
3. 新 verb → 更新 `docs/agent-tools.md` + Skill 的 `references/tool-api.md`，并给出 `nextActions` 失败面
   - **D2 附加硬约束**（2026-11-09 审查轮）：`registry.errors` 非空即停（重复 id 不得"报着继续用"）；`assets validate` **自己产生**绑定证据（`{ref,datasetId,modelVersion,sourceRef,at}`）并核对 `ref` 文件真实存在，不接受调用方自报路径；`publish` 需证据 + review 双全；纯文件操作不进 FR 引擎 Mutex
4. 改 `lib/object*.js` → 必跑 `scripts/run-render-regression.ps1`（默认 spec + legacy 图 + Van/cells/装饰，末步回补基线）
5. 新 PowerShell → ASCII-only、无硬编路径（`verify/check_ps1_static.ps1` 自动纳入）

---

## 7. 目录（v1.1 采用"职责先于整齐"）

```
semantic/dataset/          # D1 已落：definition.js(契约审计+组合)、registry.js(按域索引)；两者零 Java/零 IO
models/<domain>/datasets/  # D0 已建（落了 1 个真样例）
agent/tools/assets.js      # 新增（D2/D3）：唯一管理 verb 入口；读目录与原子写(复用 _lib.js)都在这层
#   注：v1.0 设想的 semantic/dataset/repository.js 作废——R7b 只允许 inspector 两个薄壳碰 Java，
#   IO 进 semantic 会自破"离线可测+可换引擎"红线（本轮由边界门发现，详见 dataset-contract.md §7）
```

- **不建** `semantic/catalog/{lifecycle,version,impact}.js` 三件套：v1 生命周期/版本就是 `status` + `versions/<n>.json` 快照，单独文件只为转发（v1.0 §7 自己禁止空模块）
- 影响分析（S4）真需要时再加，位置 `semantic/dataset/impact.js`
- 不为目录整齐迁移成熟代码；业务逻辑不进 `fr_agent.ps1`（它只做参数/环境/进程编排）；JS 业务模块保持纯函数，IO 收敛在工具层（`agent/tools/*` 复用 `_lib.js` 原子写），`semantic/**` 零 Java；继续 ES5

---

## 8. 实施顺序与当前状态

| 阶段 | 内容 | 验收 | 状态 |
|---|---|---|---|
| **D0** | 契约冻结：ADR + 1 个真资产 + 可运行验证器 | `verify/fast_dataset_contract.js` failures=0；4 项故障注入必红；已登记聚合门；旧 spec 兼容断言过 | ✅ **完成（2026-11-09）** |
| **D1** | `semantic/dataset/{definition,registry}.js`（IO 归工具层）+ 套件改为消费生产契约件 | 78 项 failures=0；5 项故障注入全红还原即绿；`lib/*`/`make_api.js`/Runtime 零改动 | ✅ **完成（2026-11-09）** |
| **D2** | `agent/tools/assets.js` + `assets list/inspect/create/validate/publish`（零引擎；IO 与原子写在这层） | ①合法草稿可建 ②非法资产拒写 ③validate 产真实证据非自报 ④无业务确认不能发布 ⑤重复 id/路径不符/版本漂移必拒 ⑥不进 FR 引擎锁 | ⬜ 下一步 |
| **D1.5** | 审查轮收尾（证据绑定、reportScope 白名单、metrics 必填、grainDrift、registry 原型安全） | 契约套件 103 项 + 注入 3 连全红；`==` 双类型一致有测试钉住 | ✅ 完成（2026-11-09） |
| **D3** | Dataset Resolver 接 Planner/ReportSpec + 版本绑定 | 同一 Dataset 被 2 张报表复用，生成的 FR 数据集正确；渲染门全绿 | ⬜ |
| **S1** | 多领域模型（`domain` 寻址统一 + Registry 按域加载 + Validator 两档拆分） | ≥2 领域模型可加载；术语不跨域误匹配；旧模型仍可用 | ⬜ |
| **S2** | `semantic list/inspect/create/update/validate/review/publish` | 一领域完整草稿 + 待确认清单输出 | ⬜ |
| **S3** | Semantic → Dataset 绑定 + Evidence 接入 | 发布态模型引用发布态 Dataset，成功出 SQL 与报表 | ⬜ |
| **S4** | 版本快照 + 静态影响分析 + 废弃策略 | 改已发布指标：旧版可查、报表可溯源、新版不静默覆盖 | ⬜ |

**顺序纪律（v1.0 §13 采纳）**：一次只交付一个阶段；先查现有代码再定新接口；提交说明写明复用了哪些模块、新增为何必要；未达本阶段验收不进下一阶段；架构撑不住时先交证据与最小修正方案，不擅自扩大重构范围。

---

## 9. 第一版真实业务验收（v1.0 §11 收敛）

**领域** `production`，**库** `atom_live_demo`，**真值** `data/db_laser_machine_daily_truth.txt`（日期×机台）、`data/db_laser_sub_truth.txt`（日期×工序 L/R）。

- Dataset：`production.inspection_records`（业务日期×机台，输出 planned/done/completionRate，粒度一行=一天一机台）—— **D0 已落**
- Semantic：指标 检验记录数/完成数/完成率/平均分；维度 业务日期/机台/工序；关系仅用有结构+唯一性证据支撑的（`recordToFile` N:1 confirmed；其余 `naming-derived` 不参与 JOIN）
- 报表：生产检验日报，按日期×机台分组，四指标，合计在最右；日期为**编译期固定区间**
- **验收四对**：Dataset 派生列 == SqlBuilder 列（机器，已实现）；报表合计 == 真值（`validate -ExpectTotals`）；执行栅格 == 逐格真值（`RESULT_DUMP`）；预览 == 用户肉眼过目
- **不写进 v1 验收**：运行期改日期重查询（Web 交互未接，README #62）、按派生比率 SQL 排序、样式/列宽类 patch（白名单外）

---

## 10. 完成标准（v1.0 §12 保留，加两条可机器验证）

数据发现 / Dataset 建验发复用 / Semantic 建校发 / 业务确认 / 三态解析 / 安全 SQL 生成 / 报表复用资产 / 版本治理 / 影响分析 / 兼容性不回归 —— 外加：

1. 每个能力都有**机器门**（不是文档承诺）：D0 已有 `fast_dataset_contract.js`；D1–D3、S1–S4 各自必须新增或扩展一个 fast 套件，并做**故障注入自证**（故意破坏 → 必须红）
2. `lib/*`、`make_api.js`、Runtime 三件套（`run.ps1`/`engine_launch.ps1`/`fr_agent.ps1`）在本次迭代内**零改动**；除 §1.4 的例外（改 `lib/object*.js` 才触发渲染门），任何触碰都需在 ADR 里说明理由

---

## 11. Skill 归属

`finereport`（已建）职责不变。D2/D3 稳定后再拆 `data-management`、S2 后再拆 `semantic-management`；**第一版不预先建空 Skill**（v1.0 §13「不要先开发一堆 Skill」采纳）。三个 Skill 共用同一 `fr_agent.ps1` Tool API，Skill 不直接改资产文件、不绕过 Validator。

---

## 12. 参考

- `docs/architecture/dataset-contract.md`（D0 契约冻结，字段级）
- `verify/fast_dataset_contract.js`（可运行契约验证器 + 负控 + 故障注入）
- `models/production/datasets/inspection_records.json`（首个真资产）
- `docs/agent-tools.md`（Tool API 与 Runtime 现状；r12/r13 段为历史档案）
- `AGENTS.md` §N/§1/§4、`docs/golden-e2e-case.md`
