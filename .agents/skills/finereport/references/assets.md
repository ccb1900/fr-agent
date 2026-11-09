# 数据与语义资产（现状与边界）

> 一句话：**资产层已有契约、尚无 Agent 可用的管理入口**。技能能可靠做的是"发现缺口 + 提交带证据的变更申请"，不是自己改口径。

## 现状（以机器输出与代码为准）

| 层 | 位置 | 状态 |
|---|---|---|
| 结构事实 | `data/schema_<source>.json` | I2 由 `semantic/schema/inspect_main.js` 生成（需连库，人工/回归时执行） |
| 业务模型 | `models/production/model.json` | 人工维护；`ModelValidator` 回溯 + `SemanticPreflight` 证据/时效把关；**无写入口** |
| Dataset 契约 | `semantic/dataset/definition.js` | D1 已落（纯函数，零 Java/零 IO） |
| Dataset 索引 | `semantic/dataset/registry.js` | D1 已落 |
| Dataset 资产 | `models/<domain>/datasets/*.json` | 首个真样例在位；**管理 verb 未开（D2）** |
| 契约判定 | `verify/fast_dataset_contract.js` | 78 项，含 5 连故障注入自证 |

## 为什么 Agent 不能自确认口径

指标口径（"完成数 = score>=0.9"这类）是**业务事实**，不是技术细节。自动确认会造成两类无法回放的损失：报表数字静默变化；两张复用同一资产的报表口径分叉。因此契约把这条写成机器规则：`status=published` 缺 `review.{by,at}` 直接拒。Agent 的动作只有：提议、取证、交人确认。

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
- `naming-derived` 关系不得被当作 `confirmed`；JOIN 需唯一性证据（`data/i55_relation_unique_truth.json`，有时效）
- 提交后**停止**，等人类确认；不要顺手改 `model.json` 或手写 Dataset

## 采样取证（零引擎 verb，可直接用）

```powershell
# 采样规格文件（entity/columns/limit/where 全走模型白名单，limit<=200，只读）
... -Verb sample_data -Sample "logs/agent/runs/<runId>/sampleReq.json" -RunId <runId>
```

用途：确认某列是否真有值、日期覆盖到哪、枚举有哪些取值。**不要**为验证口径跑全表，也不要拼自由 SQL 取证（`dataset.query` 被硬拒是设计）。
