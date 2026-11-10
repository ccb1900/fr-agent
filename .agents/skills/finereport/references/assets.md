# 数据与语义资产（十动作生命周期 + 边界）

> 一句话：**assets（Dataset JSON 资产）与 semantic（模型 JSON）各有十动作生命周期**（list/inspect/create/validate/publish/**review/revise/probe_relation**/deprecate/impact），全部零 FR 引擎、不进 Mutex；**发布（publish）必须证据+业务 review 双全，Agent 不得自填 review**。

## 现状（以机器输出与代码为准）

| 层 | 位置 | 状态 |
|---|---|---|
| 结构事实 | `data/schema_<source>.json` | I2 由 `semantic/schema/inspect_main.js` 生成（需连库，人工/回归时执行） |
| 业务模型 | `models/<domain>/model.json` | semantic 十动作管理（S1–S5 + review/revise/probe_relation）；**publish 需 review.{by,at} 人填** |
| Dataset 资产 | `models/<domain>/datasets/*.json` | assets 十动作管理（D2 + review/revise）；publish 需 `validation.samples` 绑定证据 + review |
| 版本快照 | `versions/<version>.json` | publish 时先落不可变副本（Dataset 与 Semantic 同规） |
| 报表引用 | `dataset: { kind: 'catalog', ref: '<domain>.<name>' }` | make_api 经 Registry/Resolver 解析发布态，fail-closed（NOT_PUBLISHED / MODEL_VERSION_MISMATCH 即拒） |
| 契约判定 | `verify/fast_dataset_contract.js` + `verify/fast_assets_read.js`（75 项） | 均在 fast 聚合门内；含换库指纹负控 |

## assets（Dataset 资产，`-Verb assets`）

```powershell
... -Verb assets -Action list                                    # 全部资产清单
... -Verb assets -Action inspect  -Target production.inspection_records
... -Verb assets -Action create   -Doc <draft.json>              # 只产 draft（非法拒写、同 id 拒）
... -Verb assets -Action validate -Target <id>                   # 真库采样执行 + 列对拍 + 绑定证据 → validated（走 SQL classpath，plain JVM）
... -Verb assets -Action publish  -Target <id>                   # 重检全链 + review 齐备 → published（缺即拒）
... -Verb assets -Action review   -Target <id> -ReviewBy "<人名>" # 人审登记（at 工具盖 ISO；由业务人执行或转述人名）
... -Verb assets -Action revise   -Target <id> -Doc <bump.json>  # 版本 bump 入口（datasetVersion 必须 > 当前；拒自带 review；bump 后重 validate→review→publish）
... -Verb assets -Action deprecate -Target <id>                  # 带 deprecation.reason 退役
... -Verb assets -Action impact   -Target <id>                   # 静态影响扫描（examples/fixtures/models 引用面，自排除）
```

契约要点（`docs/architecture/dataset-contract.md`）：声明式选择（entity/dimensions/metrics/filters），**不收自由 SQL**；`dateRange/sort/topN` 是报表 scope 不进资产；粒度 keys 必须是维度子集（grainDrift 拒）。

## semantic（模型，`-Verb semantic`）

```powershell
... -Verb semantic -Action list                                  # 多域清单（models/*/*/model.json）
... -Verb semantic -Action inspect  -Target production           # 结构 + datasetRef 交叉验证（warnings 透出）+ deprecated 标记
... -Verb semantic -Action create   -Doc <model-draft.json>      # 草稿档校验（完整性阈值放宽）落 models/<domain>/model.json（自带 review 拒）
... -Verb semantic -Action validate -Target <domain>             # 离线校验，不改文件；deprecated 拒
... -Verb semantic -Action publish  -Target <domain>             # 完整档 + review.{by,at} ISO + versions/<modelVersion>.json 快照
... -Verb semantic -Action review   -Target <domain> -ReviewBy "<人名>"  # 人审登记（被 PUBLISHED_WITHOUT_REVIEW 拒时的合规通路）
... -Verb semantic -Action revise   -Target <domain> -Doc <bump.json>    # 版本 bump（modelVersion 必须 > 当前；拒自带 review；bump 后必须重审再 publish）
                                                                  #   同版本内容变更拒、版本升高必须配新 review.at
... -Verb semantic -Action deprecate -Target <domain>            # 先在 model.json 写 deprecation:{reason}（人填）再调；不可逆
... -Verb semantic -Action impact    -Target <domain>            # 列出引用该域模型的 Dataset 资产（零引用也是合法答案）
```

confirmed 关系的唯一性证据核对在语义层即**全强度**执行：连接身份与 plan.js 同源（`SQL_DRIVER`/`SQL_URL` env，规范默认=生产连接；纯指纹核对零 JDBC）。换库（env 覆盖）→ 源指纹必不匹配 → 拒——**数据侧证据不跨库消费**。新域可先以 `naming-derived`（需 `requiresConfirmation:true`）登记待确认关系。

## 为什么 Agent 不能自确认口径

指标口径与"这对关系可以 JOIN"是**业务事实**：`status=published` 缺 `review.{by,at}` 直接拒（Dataset 与 Semantic 同规）。Agent 的动作只有：create→validate→提议→交人类 review。测试目录/临时资产的自填 review 仅限测试框架（`AGENT_..._MODELS_ROOT` 指向临时根），生产发布必须人填。

## 变更申请（SemanticChangeRequest）格式

写到 `logs/agent/runs/<runId>/semanticRequest.json`（UTF-8，路径 ASCII）：

```json
{
  "requestVersion": "1",
  "type": "add_metric",
  "domain": "production",
  "term": "返工率",
  "label": "返工率",
  "proposed": {
    "entity": "InspectionRecord",
    "expression": { "kind": "ratio", "numerator": "rework", "denominator": "planned", "scale": 100 }
  },
  "evidence": [
    "data/schema_atom_live_demo.json:laser_aaa.<column>",
    "logs/agent/runs/<runId>/sample.json:<行摘要>",
    "data/db_laser_machine_daily_truth.txt"
  ],
  "assumptions": ["分母沿用 planned（有效评分记录数）"],
  "businessOwnerQuestion": "返工的定义是 score 落在哪个区间？分母是否用计划数？"
}
```

`type` 取值：`add_metric` / `add_dimension` / `confirm_relation` / `change_metric_rule` / `add_dataset`。

规则：

- `evidence` 必须指向**仓库里真实存在**的画像/采样/真值位置；没有证据就写"无证据"，不要造路径
- 派生比率（`kind:"ratio"`）注意展示层派生，不能承诺"按它做 SQL 排序"
- `naming-derived` 关系不得被当作 `confirmed`；JOIN 需唯一性证据（`data/i55_relation_unique_truth.json`，证据指纹绑连接/模型/Schema 身份 + 30 天时效；已发布的 named 关系变化后旧证据即失效，需重跑 `probes/probe_relation_unique.js`）
- 提交后**停止**，等人类确认；发布走 assets/semantic 的 publish 动作，但 review 字段人填

## 采样取证（零引擎 verb，可直接用）

```powershell
# 采样规格文件（entity/columns/limit/where 全走模型白名单，limit<=200，只读）
... -Verb sample_data -Sample "logs/agent/runs/<runId>/sampleReq.json" -RunId <runId>
```

用途：确认某列是否真有值、日期覆盖到哪、枚举有哪些取值。**不要**为验证口径跑全表，也不要拼自由 SQL 取证（`dataset.query` 被硬拒是设计）。
