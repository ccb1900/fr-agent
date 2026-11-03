# ABR-1 依赖方向规则（docs/architecture/dependency-rules.md）

> 依赖的唯一合法方向：业务 → Feature → Core（IR→Backend→Artifact）→ Runtime（仅经 runner 编排）。
> 强制检查：`powershell -File scripts\check-boundaries.ps1`（R1–R5，exit 0 = 通过）。

## 允许的依赖

| 依赖 | 说明 |
|---|---|
| make_api.js → runtime/* | 加载顺序：paths → bootstrap → datasource → lib 三件 → spec |
| make_api.js → lib/*（经 load） | 收敛在 make_api 内，业务层不直接加载 |
| reports*/*.js → features/data_browser | spec 只需要 feature 的 `spec/MODULES/env` |
| reports*/*.js → lib/dbpass.js | 凭据外围件（非后端，指针在 data/db_local.js） |
| runtime/bootstrap.js → 全局 Paths | 路径单点（paths.js 先于一切加载） |

## 禁止的依赖

| 依赖关系 | 结论 |
|---|---|
| lib/ir.js → Java.type / com.fr.* | 禁止（R2：IR 必须零运行时依赖） |
| lib/* → features/ | 禁止（R1；唯一豁免 lib/browser.js 兼容垫片） |
| runtime/* → 报表业务知识（reports/、BROWSER、laser 字样） | 禁止（R3） |
| reports*/*.js → lib/object.js|cpt.js|ir.js 直接 load | 禁止（R4） |
| make_api.js → features/data_browser 直接 load | 禁止（R5） |
| lib/* → runtime 反向调用 | 禁止（core 不初始化环境，只消费） |

## 事实契约（迁移时不得改动签名）

| 模块 | 现有接口 |
|---|---|
| Ir | compile(spec) / validate(ir) |
| Obj | build(ir)（返回含 wb） |
| Cpt | validate(xml, options) / assertRoundTrip(xml, spec) |
| BROWSER | spec(config) / MODULES / env / fullSql / pagedSql / metaSql / dateExpr |
| Runtime | initialize() / DataSource.register(connections, {stamp, check}) |
| Paths | root / frWebInf() / demoDeployDir() / lib() / feature() / runtime() / spec() |

## 垫片政策

lib/browser.js 只许 `load() → features` 一行转发 + Node require 转发；不允许新逻辑。
ABR-2 评估撤垫（届时同步更新全部历史引用）。
