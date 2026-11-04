# ABR-1 依赖方向规则（docs/architecture/dependency-rules.md）

> 依赖的唯一合法方向：业务 → Feature → Core（IR→Backend→Artifact）→ Runtime（仅经 runner 编排）。
> 语义层（semantic/）是独立旁路：只依赖 java.sql+dbpass+纯 JS，不属上述主链，未来换报表引擎可整体复用（I2 起）。
> 强制检查：`powershell -File scripts\check-boundaries.ps1`（R1–R7，exit 0 = 通过）。

## 允许的依赖

| 依赖 | 说明 |
|---|---|
| make_api.js → runtime/* | 实际加载顺序：paths → lib 三件 → spec → bootstrap → datasource（spec 先载 = fail-fast：SPEC 缺失 exit 2，env 未启动） |
| make_api.js → lib/*（经 load） | 收敛在 make_api 内，业务层不直接加载 |
| reports*/*.js → features/data_browser | spec 只需要 feature 的 `spec/MODULES/env` |
| reports*/*.js → lib/dbpass.js | 凭据外围件（非后端，指针在 data/db_local.js） |
| runtime/bootstrap.js → 全局 Paths | 路径单点（paths.js 先于一切加载） |
| semantic/schema/* → java.sql + lib/dbpass.js + runtime/paths.js | I2 语义层：inspector 薄壳用 java.sql 直连元数据；入口经 dbpass 取凭据、Paths 解析路径（皆非后端） |

## 禁止的依赖

| 依赖关系 | 结论 |
|---|---|
| lib/ir.js → Java.type / com.fr.* | 禁止（R2：IR 必须零运行时依赖） |
| lib/* → features/ | 禁止（R1；唯一豁免 lib/browser.js 兼容垫片） |
| runtime/* → 报表业务知识（reports/、BROWSER、laser 字样） | 禁止（R3） |
| reports*/*.js → lib/object.js|cpt.js|ir.js 直接 load | 禁止（R4） |
| make_api.js → features/data_browser 直接 load | 禁止（R5） |
| lib/* → runtime 反向调用 | 禁止（core 不初始化环境，只消费） |
| semantic/* → com.fr.* / FR 激活链 / 真 load 后端三件 | 禁止（R7a：语义层独立于引擎与主链；词表刻意不含裸 Java.type——R7 与 R2 不同是有意的，防"统一词表"误杀 inspector 的 java.sql） |
| semantic/schema core 三件 → Java.type | 禁止（R7b：metadata/relation/serializer 零运行时依赖，java.sql 只在 inspector/inspect_main 薄壳） |

## 事实契约（迁移时不得改动签名）

| 模块 | 现有接口 |
|---|---|
| Ir | compile(spec) / validate(ir) |
| Obj | build(ir)（返回含 wb） |
| Cpt | validate(xml, options) / assertRoundTrip(xml, spec) |
| BROWSER | spec(config) / MODULES / env / fullSql / pagedSql / metaSql / dateExpr |
| Runtime | initialize() / DataSource.register(connections, {stamp, check}) |
| Paths | root / frWebInf() / demoDeployDir() / lib() / feature() / runtime() / semantic() / spec() |
| SchemaInspector | inspect({url,user,password,like,source}) → {source,dialect,tables[],relations{structural,fk,unconfirmedNaming},errors[]}（I2；行对象抽入后由零-java 核心 SchemaMeta/SchemaRelation/SchemaSerializer 处理） |

## 垫片政策

lib/browser.js 只许 `load() → features` 一行转发 + Node require 转发；不允许新逻辑。
ABR-2 评估撤垫（届时同步更新全部历史引用）。

## R6：Runner 接线断言（2026-11-04 外部审计后增补）

R1–R5 只查"禁区"，证明不了"接线"。R6 把 Runner 与 Runtime 的实际调用链变成机器断言：

| 断言 | 内容 |
|---|---|
| R6a 必含 | make_api.js 必含 `Paths.runtime('bootstrap.js')`、`Paths.runtime('datasource.js')`、`Runtime.initialize()`、`Paths.lib(`、`runtime/paths.js`（实际顺序 = paths → lib 三件 → spec → bootstrap → datasource；spec 先载为有意 fail-fast） |
| R6b 必不含 | make_api.js 不得内联 FR 激活链/连接注册（`ActivatorToolBox` / `SimpleWork` / `DatasourceManager`）——这些只属 runtime/* |
| R6c 必不含 | make_api.js 不得出现 `load('D:…` 硬编码绝对路径（路径单点收在 runtime/paths.js + FR_AGENT_HOME） |

边界说明：
- R6 证明"接线存在"，不证明"运行时各模块签名互通"——后者由字节门回归承担（默认 CBEB42E3/A8EF39AB + br 六栅格 + prod staging 基线）。
- CORE 门面（lib/index.js）是增量命名糖（其头注已声明 Ir/Obj/Cpt 原全局名 = 事实契约），runner 暂经 `Paths.lib()` 直载三件，R6 不强制 CORE 消费；runner 若改走门面，请同步下移 R6a 的 `Paths\.lib\(` 断言。
