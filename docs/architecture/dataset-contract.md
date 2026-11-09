# Dataset 契约（D0 冻结）

> 状态：**v1 契约冻结**（2026-11-09）。真相在本文；`verify/fast_dataset_contract.js` 只镜像本文键集，改契约先改本文。
> 上游规范：`docs/architecture/dataset-semantic-plan.md`（实施顺序 D0→D4、S1…S4）。
> 本文只定 Dataset；Semantic 侧契约在 S1 前另立 ADR（避免一次定两层）。

## 1. 一句话结论

**Dataset = 一份"声明式选择 + 身份 + 生命周期 + 可追溯性"的资产文件；它的可复用部分恰好是现有 `ReportSpec.dataset(kind:'sql')` 的结构子集，列由现有 `SqlBuilder` 派生，校验由现有三道门分担。**
因此本项目**不需要**新建 Dataset 校验器、SQL 生成器或 Repository 框架 —— 只需把现有装配步骤（`make_api.js:116-168`）识别为 Resolver 并资产化其输入。

## 2. 代码事实（本轮实测，非推断）

| 事实 | 证据 | 对契约的影响 |
|---|---|---|
| `SpecValidator.validate(rs)` 返回**数组** `{code,path,message}` | `lib/spec_validator.js:317-319`；调用方 `make_api.js:102-103` | 验证器按数组长度判定，不看 `.errors` |
| sql 数据集键白名单 = `kind/entity/connection/schema/dimensions/metrics/dateRange/filters/sort/topN/query` | `lib/spec_validator.js:77` | Dataset 的选择键集**从它减去报表级键**得到，不自造 |
| **自由文本 `dataset.query` 被硬拒** | `lib/spec_validator.js:427`；`lib/report_spec.js:32,72`（"自由文本 query 仍拒 §5.2"） | 规范示例里的 `query.text:"SELECT ..."` 必须废弃 |
| `term` 存在性**不**由 spec_validator 管，由 SqlBuilder 的 `UNKNOWN_REF` 管 | 实测：幽灵指标过 validator、被 `SqlBuilder` 拒（`semantic/query/sqlbuilder.js:39` 实体、`metrics[i]` 指标） | 负控必须归对门；不得声称"validator 保证可追溯" |
| 列是**派生**的：`baseAliases`(role=dim/metric) + `derived`(role=derived)，顺序=维度→base 指标→派生 | `semantic/query/sqlbuilder.js:165-166`、`lib/spec_compiler.js:56` | 资产不手写列清单作为真相；`asserts.fields` 只是**断言**，必须与派生逐项相等 |
| `groupDims` = 选择的维度序 | `semantic/query/sqlbuilder.js:208` | `grain.keys` 必须等于 `groupDims`（粒度可机器核验，不说谎） |
| 派生比率不进 SQL（展示层公式） | 实测 `built.sql` 无 `completionRate` | 资产不承诺"按完成率 SQL 排序" |
| 现有 sql 路装配 = model + schema 快照 + evidence + Preflight + `SpecCompiler.compile(rs,{model,SqlBuilder})` | `make_api.js:116-168` | D3 的 Resolver 就是把这段的**输入**资产化，不是新写一段 |
| 原子写现成可用（`.tmp` + `ATOMIC_MOVE`） | `agent/tools/_lib.js:32-45` | 不引入文件锁框架 |
| 模型现存单一 `domain` 口径：`model.domain="laser_inspection"`，目录名 `production` | `models/production/model.json:3` | **命名冲突必须先定**（本文 §4 规则 2） |

## 3. 资产位置与身份

```
models/
  production/
    model.json                       # 现有语义资产（本阶段不改）
    datasets/
      inspection_records.json        # Dataset 资产（v1 落 1 个真样例）
```

不放 `data/`：`data/` 是真值与结构画像目录（AGENTS §4），资产与真值混放会让"数据纪律"和"资产治理"分家。

## 4. Dataset v1 契约（逐字段）

| 字段 | 必填 | 约束 | 真相来源 / 为何这样定 |
|---|---|---|---|
| `datasetVersion` | ✅ | `"1"` | 与 `IR_VERSION`/`PATCH_VERSION` 同规：未知版本拒，不猜语义 |
| `id` | ✅ | `^[a-z][a-z0-9_]{1,40}\.[a-z][a-z0-9_]{1,60}$` | `<domain>.<name>`；**身份不依赖显示名**（规范 §3.2 关键约束保留） |
| `domain` | ✅ | = `id` 前缀 = 路径段 | 三处绑定；杜绝"任意路径输入"与目录漂移 |
| `name` `description` | ✅ | 人类可读 | 报表交付时可直接引用口径说明 |
| `status` | ✅ | `draft\|validated\|published\|deprecated` | 规范 §3.4 生命周期原样采纳 |
| `source.type` | ✅ | v1 只允许 `"database"` | 内嵌 rows 不是可复用资产（它没有外部真相可回溯） |
| `source.ref` | ✅ | 必须 = `model.source` | 数据源标识单点；杜绝资产与模型指向不同库 |
| `source.connection` | ✅ | FineReport **连接名**（非敏感） | 现有 `ReportSpec.dataset.connection` 同义；凭据仍走 `lib/dbpass.js`，**绝不入资产**（验证器断言 `password`/`jdbc:` 零命中） |
| `model.ref` | ✅ | 模型文件路径 | 语义与数据契约绑定，报表侧不再各挑一个模型 |
| `model.modelVersion` | ✅ | 必须等于所加载模型版本 | 版本绑定的机器化：模型口径变了，资产必须显式复核 |
| `selection.entity` | ✅ | 模型内实体名 | 组合进 `ReportSpec.dataset.entity` |
| `selection.dimensions[]` | ✅ | 字符串或 `{term,label,widthPt}` | 项键集沿用 `REF_KEYS`（`lib/spec_validator.js:73`）；`label/widthPt` 属呈现偏好，v1 建议只写 `term` |
| `selection.metrics[]` | ✅ | 同上 | 组合进 `ReportSpec.dataset.metrics` |
| `selection.filters[]` | ⬜ | 受控字面量非日期筛选 | 业务过滤属于"这份数据是什么"的一部分（如仅有效评分），故可入资产；沿用既有 filters 校验 |
| **禁止** `selection.dateRange / sort / topN` | — | 出现即 `REPORT_SCOPE_IN_ASSET` | **时间窗、排序、行数上限是"这张报表要什么"，不是"这份数据是什么"**。写进资产会让两张复用同一 Dataset 的报表静默共享不同口径；且现有实现是编译期定字面量（README #62），锁进资产就等于把日期烤进资产 |
| **禁止** `selection.query` 任意形式 | — | 出现即拒（双重：audit + validator） | §5.2 禁自由文本 SQL 是安全闸，不因资产化而开缝 |
| `grain.description` | ✅ | 人类可读 | "一行代表什么"必须写得出 |
| `grain.keys[]` | ✅ | 唯一、⊆ dimensions、且 **== `SqlBuilder.groupDims`** | 粒度从"文档承诺"升级为"机器核验"，防 fan-out 类误解释 |
| `asserts.fields[]` | ⬜ | `{name,role}`，`role∈dim\|metric\|derived`；与派生列**逐项等值同序** | 列的真相只有 SqlBuilder 一处；此字段是防回归断言（模型被改而资产未复核 → 立即红） |
| `lineage.truthRefs[]` `lineage.verifiedBy` | ⬜ | 指仓库内真实文件 | "四者一致"验收（规范 §11）的可追溯抓手 |
| `review.by` `review.at` | 发布态必填 | `status=published` 时缺失即拒 | 把"Agent 可提议、不得自确认口径"写成机器规则，而非口号 |

## 5. 四向映射（Dataset ↔ ReportSpec ↔ SqlBuilder ↔ Schema）

| Dataset | → `ReportSpec.dataset` | → `SqlBuilder.build(model, sel)` | 回溯落点 |
|---|---|---|---|
| `source.connection` | `connection` | — | cpt 只存连接名（`lib/object.js` v3.5 既定） |
| `selection.entity` | `entity` | `entity` | `model.entities[].name` → `schema.tables[].name` |
| `selection.dimensions[]` | `dimensions` | `dimensions`（`{term}` 归一） | `model.dimensions[].column` → `schema.tables[].columns[].name` |
| `selection.metrics[]` | `metrics` | `metrics`（同） | `model.metrics[].expression.{table,column}` |
| `selection.filters[]` | `filters` | `filters` | 受控字面量（`lib/ir.js` SQL_READONLY） |
| （报表侧）`dateRange` | `dateRange` | `dateRange` | 日期维须带 `rule:'dateNormalize'`（`sqlbuilder.js:76,121`） |
| （报表侧）`sort/topN` | `sort`/`topN` | 同 | 派生比率列不可排序（`sqlbuilder.js` I5.3-A 注释） |
| （派生，非输入） | — | `baseAliases + derived` | = `asserts.fields`（若声明） |

组合规则（D3 Resolver 的全部逻辑，v1 就这 5 行，不新增校验）：

```js
function toReportDataset(ds, reportScope) {
  var out = { kind: 'sql', connection: ds.source.connection };
  Object.keys(ds.selection).forEach(function (k) { out[k] = ds.selection[k]; });
  if (reportScope) Object.keys(reportScope).forEach(function (k) { out[k] = reportScope[k]; });
  return out;                       // 之后照旧走 SpecValidator → SpecCompiler → 现有链路
}
```

## 6. 校验责任分配（谁保证什么）

| 层次 | 保证 | 已有/新增 |
|---|---|---|
| 本文 §4 的 `audit()` | 资产自一致：身份/路径/状态/键集/粒度/断言形状/发布需确认 | **新增（纯函数，仅 Dataset 用）** |
| `SpecValidator` | 键白名单、呈现词表、`dataset.query` 拒 | 复用 |
| `SqlBuilder` | term 存在性、JOIN 安全基数、只读单语句自检 | 复用 |
| `ModelValidator` + `SemanticPreflight` | 模型↔schema 回溯、关系唯一性证据与时效 | 复用（编译期已在跑） |
| `SpecCompiler` + IR + FR 执行/渲染 | 产物正确性 | 复用（铁证 MD5） |

**只有第一行是新的**，且它不做任何 SQL/语义判断 —— 这是"不新建第二套校验器"的可验证承诺。

## 7. v1 明确不做（写下来防止顺手扩）

- 不做 `kind:'catalog'` 新数据集种类：`ReportSpec.DATASET_KINDS` 仍是 `rows|sql`，验证器有断言守着。资产在**组合进 ReportSpec 之后**才进入现有链路。
- 不做多 Dataset 单报表、跨 Dataset JOIN、参数化时间窗（`dateRange` 引用参数）。
- 不做 Dataset 独立 DB/索引/审批系统；文件 + git 即版本管理。
- 不做变更影响分析（S4）；`lineage` 只是抓手，不是图数据库。
- 不让任何 verb 写 `model.json`（模型侧仍是人工 + `preflight`/fast 门把关）。
- Dataset 纯文件操作**不进** FineReport 单实例 Mutex（规范 §10.2 采纳：读=list/inspect，写=create 走原子写；validate 需要 SqlBuilder 但零引擎，仍可无锁）。
- **IO 不进 `semantic/`**：`scripts/check-boundaries.ps1` 的 R7b 只给 `inspector.js`/`inspect_main.js` 两个薄壳例外（`semantic/**` 禁 `Java.type`，保证离线可测 + 可换引擎）。因此原规范 v1.0 §7 的 `semantic/dataset/repository.js` **作废**：读目录/原子写属工具层（`agent/tools/assets.js` 复用 `agent/tools/_lib.js` 的 `atomicWriteUtf`），`semantic/dataset/` 只留 `definition.js`（契约）与 `registry.js`（索引），两者零 Java、零 IO——由契约门第 0 节文本断言守住。

## 8. 验证与运行

## 7b. D1 落地状态（2026-11-09）

契约已进入生产代码，门不再自证：

- `semantic/dataset/definition.js`：键集/身份/引用/选择/粒度/断言/生命周期审计 + 绑定检查 + 组合规则（纯函数）
- `semantic/dataset/registry.js`：按域/id/状态索引 + 重复 id 检出（纯函数）
- `verify/fast_dataset_contract.js`：**消费上两件**（78 项），不再复刻契约
- 门的两次真收获：① `columnsOf` 里 `built.errors` 为 `[]` 被当真值 → 派生列恒空（JS 经典陷阱，被门抓住后修）；② 契约件自身注释含 `com.fr.` 字面量触发 R7a 文本门（假阳性，改述解决——门按文本判定是既定设计，不放宽）
- 故障注入 5 连全红（塞自由 SQL / 无 review 假装发布 / 粒度脱钩 / 版本漂移 / 手写列改错），还原即 `failures=0`

```powershell
# 契约验证器（零引擎，秒级）
"D:\software\FineReport_11.0\jre\bin\java.exe" -cp "D:\software\FineReport_11.0\jre\lib\ext\nashorn.jar" `
  jdk.nashorn.tools.Shell verify/fast_dataset_contract.js
# 已登记进 scripts/run-fast-tests.ps1 聚合门（现 21 套件）；套件内自断言登记状态并自检语法
#   （verify/fast_parse.js 的 FILES 只收录产品文件，verify 套件按惯例不收录，故此处靠第 7 节自检）
```

套件第 7 节自我检查"是否被登记进门"——正是我 2026-11-08 拆分 `object.js` 时漏登记 `fast_parse` 白名单、导致语法门出现盲区的教训固化。

## 9. 兼容承诺

- 不改 `models/production/model.json` 一字节；不改 `lib/*`、`semantic/*`、`agent/tools/*` 任何现有文件。
- 旧 `kind:'sql'` 与 `kind:'rows'` 报表 spec 继续通过校验（套件第 6 节断言 3 个真实 spec）。
- 铁证不变：`demo_api.cpt = CBEB42E3CE48E46E362B9AE80168026F`。
