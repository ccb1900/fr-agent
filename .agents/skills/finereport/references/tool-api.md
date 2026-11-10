# Tool API（fr_agent.ps1 17 个 verb 的精确契约）

事实源：`agent/tools/fr_agent.ps1`（参数/分支）、`agent/tools/*.js`（产物形状）、`docs/agent-tools.md`（历史叙事）。本文件只写**当前可调用形态**；与代码冲突时以代码为准。

统一调用：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 `
  -Verb <verb> [-Spec ...] [-Patch ...] [-Term ...] [-Png ...] [-Pdf ...] `
  [-Intent ...] [-ExpectTotals ...] [-Target ...] [-Sample ...] [-RunId ...]
```

合同行（stdout，一行 ASCII JSON）：

```json
{"ok":true,"runId":"<id>","result":"logs/agent/runs/<id>/<verb>.json"}
```

详细结果在 `result` 指向的 **UTF-8 文件**。部分 verb 额外带 `"artifact":"logs/agent/runs/<id>/artifact.json"`。退出码：`0` 可向前走 / `1` 失败或未决 / `2` 用法错。`create` 与 `compile`、`modify` 与 `patch` 是别名，行为一致。

## 参数（入口 param 块，共 15 个：verb/action/spec/patch/term/png/pdf/intent/expectTotals/target/sample/doc/domain/reviewBy/runId）

| 参数 | 用于 |
|---|---|
| `-Verb` | 必填，15 选 1 |
| `-Spec` | `create`/`compile`：ReportSpec JSON 路径 |
| `-Patch` | `modify`/`patch`：PatchSpec JSON 路径 |
| `-Term` | `resolve`：业务词 |
| `-Png` / `-Pdf` | `preview`：至少一个 |
| `-Intent` | `plan`：Intent JSON 路径 |
| `-ExpectTotals` | `validate`：外部真值，如 `计划:完成` |
| `-Target` | `inspect_template`：部署相对名 `fineagent/<name>.cpt`；`assets`/`semantic`：资产 id / 域名 |
| `-Sample` | `sample_data`：采样 JSON 路径 |
| `-Doc` | `assets`/`semantic` 的 create/revise：草案 JSON 路径（semantic probe_relation 也可传=以草案指纹重绑证据） |
| `-Domain` | `semantic`：域名（与 -Target 同义别名） |
| `-ReviewBy` | `assets`/`semantic` 的 review：业务人名（由人执行或明确转述，不发明名字） |
| `-RunId` | 所有 verb 可传；一条链必须复用同一值 |

## Verb 全表

| Verb | 参数 | 产物 `logs/agent/runs/<runId>/` | 引擎/锁 | 说明 |
|---|---|---|---|---|
| `discover` | — | `discover.json` | 否 | 模型实体/维度/指标/关系 + `capabilities` + `capabilityManifest` + `agentAvailable` |
| `resolve` | `-Term` | `resolve.json` | 否 | 三态 `resolved`/`ambiguous`/`unknown`；`ambiguous` exit 0 但需反问 |
| `plan` | `-Intent` | `plan.json`（带 intentHash=意图 MD5） | 否 | `ready`/`ambiguous`/`rejected` + `reportSpec`/`assumptions`/`unresolvedQuestions`（含能力级提示）/`validationWarnings`；失败可同 RunId 直接重跑（零引擎幂等） |
| `plan2spec` | `-RunId` | `reportSpec.json` | 否 | 把同 run 的 ready plan 落盘为 `-Spec` 文件 |
| `compile` / `create` | `-Spec` | `compile.json` + `artifact.json` + `runresult.json` + `grid.txt` | 是 | ReportSpec→CPT/PNG/PDF；`compile.json` 带 `cptPath`/`pngPath`/`pdfPath` |
| `validate` | `-ExpectTotals` | `validate.json`（刷新 `artifact.json`） | 否 | 11 阶段 + 产物存在 + 栅格自洽 + 可选真值对拍 |
| `preview` | `-Png`/`-Pdf` | `preview.json` | 否 | 尺寸/字节/疑似空白；PDF 查 `%PDF` 头 |
| `patch` / `modify` | `-Patch` | `patch.json` + `staging/` + `artifact.json` | 是 | 白名单 op，写 staging、跑结构/执行/渲染回归，原件保留 |
| `list_reports` | — | `list_reports.json` | 否 | 部署目录 `.cpt` 清单（名称/字节/mtime/伴随 PNG/PDF） |
| `inspect_template` | `-Target` | `inspect.json` | 是 | sheet 尺寸、逐格文本真实坐标、数据集/参数名；只读 |
| `sample_data` | `-Sample` | `sample.json` | 否（plain JVM 驱动） | 模型白名单实体只读 LIMIT 采样（≤200） |
| `promote` | `-RunId` | `promote.json` | 是（部署态变更） | staging → 正式部署件，SHA-256 全链 fail-closed |
| `restore` | `-RunId` | `restore.json` | 是 | 用同 run 的 `.orig.cpt` 撤销 promote |
| `assets` | `-Action list` / `-Action inspect/create/validate/publish/review/revise/deprecate/impact -Target <id>`（create/revise 加 `-Doc`；review 加 `-ReviewBy`） | `assets.json` | 否（validate 走 SQL classpath plain JVM） | Dataset 资产十动作生命周期：validate 自采样产绑定证据（≤200 行），publish 需证据+review.{by,at}，deprecate 需人填 reason |
| `semantic` | `-Action list` / `-Action inspect/create/validate/publish/review/revise/probe_relation/deprecate/impact -Target <domain>`（create/revise 加 `-Doc`；review 加 `-ReviewBy`；probe_relation 可加 `-Doc`=以草案指纹重绑数据侧证据） | `semantic.json` | 否 | Semantic 模型十动作生命周期：publish 版本纪律四态（同版本内容变更拒/新版本须新 review.at/ISO at/必给 modelVersion），create 拒自带 review 的草稿，deprecate 需人填 deprecation.reason，impact 列模型引用面 |

`sample_data` 的 `-Sample` 文件形如 `{ "entity": "InspectionRecord", "columns": ["..."], "limit": 20, "where": {"property":"...","op":">=","value":0} }`；`entity`/`columns` 走模型白名单，`where` 值面受控字面量，禁引号/分号/注释。

## 关键产物字段（读过再判断）

**`compile.json`**：`ok` / `exit` / `outName` / `spec` / `runResult` / `gridPath` / `cptPath` / `pngPath` / `pdfPath` / `cptExists` / `pngExists`。

**`validate.json`**：`{ runId, tool:"validate", ok, checks:[{name,pass,detail}] }`；`ok` 为所有 `checks.pass` 的合取。

**`preview.json`**：`exists` / `bytes` / `width` / `height` / `blankish`（PDF 时另有 `pdfHeader` / `hasPageObject`，宽高为 -1）。

**`artifact.json`**（`application/contracts.js`）：`artifactId = sourceType:outName@runId`，含 `execution` / `validation` / `preview` / `diagnostics` / `spec|patch|staging` / `acceptance`。`acceptance.ok` = 执行 ok + 无 `severity=error` 诊断 + `validation.ok !== false`。`validate.json` / `preview.json` 的 `runId` 与本 run 不一致时不会并入（防陈旧验收）。

**`patch.json`**：`ok` / `exit` / `patch` / `stagingDir` / `manifestPath` / `manifest`。`manifest` 里看 `diffClean` / `execution.pass` / `render.pass` / `datasetChecks[]` / `pixelStats` / `sourceCpt` / `out`。

## 错误面

失败输出带 `nextActions`（可执行下一步）和 `reason`/`error`。常见：

| 现象 | 含义 | 处理 |
|---|---|---|
| `RUNID_EXISTS` | 该 run 已有引擎/部署产物 | 新报表/重试用新 RunId；撤销部署用同 RunId 的 `restore` |
| `RUNTIME_BUSY` | 另一 FR JVM 持有互斥 / 哨兵身份不可确认 | 等待后重试；**不要清哨兵、不要删锁** |
| `QUEUE_TIMEOUT` | 等互斥超时 | 等待后重试 |
| `exit 2` | 参数缺失/RunId 非法/Intent 不可读 | 按 `nextActions` 补齐 |
| `plan` `ambiguous`/`rejected` | 语义未决 / 能力不支持 | 问用户或如实告知，不绕过 |
| `UNSUPPORTED`（PatchSpec） | 非白名单 op | 告知用户不支持，给替代 |

## 不要做的事

- 不直接调 `run.ps1` / `runraw.ps1` / `make_api.js` / `lib/*` 来完成报表任务：那是管线内部路径，会绕过 RunId 与互斥。
- 不删 `active.json` / `java.pid`、不并发提交同 RunId 的引擎 verb。
- 不把合同行的 `ok` 当数据正确性证明：数据靠 `validate` 与真值对拍。
- 不用中文路径作为 `-Spec`/`-Intent`/`-Patch`/`-Png` 参数值（PS 5.1 GBK 会打乱）；产物名可中文，路径用仓库内 ASCII 相对路径。
