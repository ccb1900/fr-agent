# 层间协调一致性（Agent 自然语言 → CPT 生成与验证 → 引擎）2026-11-08

> 本文回答一个问题：**从 Agent 理解自然语言到 CPT 生成、验证、部署、渲染，各层是否真正接上并且互相一致？**
> 口径纪律（AGENTS §N）：已实现 / 已静态审查 / 已自动化测试 / 已真实集成验证 / 尚未验证 五态不混写。
> 本文所有数字都来自机器门输出（`scripts/capability-layer-gate.ps1` 72 项全量扫描 + `verify/fast_layer_coherence.js`），不是印象。

## 1. 结论先行

| 不变量 | 含义 | 机器门 | 现状 |
| --- | --- | --- | --- |
| I1 承诺有实现 | `agentAvailable=true` ⇒ construction/serialization 均 verified | fast_layer_coherence | **72/72 成立**（0 违反） |
| I2 承诺有入口 | `agentAvailable=true` ⇒ 证据点到磁盘上存在的可执行载体（probe/carrier/fast/spec/integration） | fast_layer_coherence + 层门 probe/tool | **50/50 成立**（0 违反） |
| I3 入口有引擎锚 | construction=verified ⇒ 锚到核心 jar 物理存在的类（`data/engine_class_map.json` → `data/jar_class_inventory.json`） | fast_layer_coherence + 层门 jar | **62/65 锚定，3 项为 runtime/tool 层（设计上无引擎类）** |
| I4 Planner 真合同 | planner 层判定来自真实 `ReportPlanner.plan()` 输入→输出断言，且三条负控必被拒 | 层门 selftest | **自测 PASS；47/72 有合同，25 项明确 UNKNOWN** |
| I5 账本不撒谎 | agentAvailable 能力不得有任何层 rejected/pending；jar 清单 missing 为空 | fast_layer_coherence | **成立** |

**一句话**：Agent 承诺的 50 项能力现在全部满足"有实现、有可执行入口、有引擎/工具锚定"；不满足的部分都在账本里明确标为 UNKNOWN/BLOCKED 并写明原因，没有把未验证包装成已接入。

## 2. 层定义与判定来源（11 个机器判定）

| 层 | 判定 | 来源 |
| --- | --- | --- |
| probe | 证据点到的载体文件在磁盘存在 | 文件系统 |
| tool | 工具族（template.patch.* / agent.*）verb 分支 + 实现文件 + 测试载体三件齐（静态接线） | 源码断言 |
| jar | E1 锚定：能力映射到核心 jar 里物理存在的类 | `data/engine_class_map.json` + `data/jar_class_inventory.json` |
| object / cpt / render | manifest v3 四层字段（证据规则由 fast_manifest_evidence 强制） | 账本 |
| ir | 能力 token 是 `Ir.capabilities()` 词表的**精确成员**（nashorn 实时 dump） | 运行期词表 |
| spec | 能力 token 是 `ReportSpec.capabilities()` 表面的**精确成员** | 运行期词表 |
| planner | 真实 `ReportPlanner.plan(意图)` 跑通且**发射出的 spec 路径**含该能力；无合同=UNKNOWN | 真实执行 |
| agent | manifest `agentAvailable`（唯一允许对 Agent 广告的层） | 账本 |
| manifest | 条目在账本 + evidence 非空 + regressionScope 合规 | 账本 |

**2026-11-08 复审修复（去假阳性）**：旧层门用 `sourceText.Contains('presentation')` 判 Planner、用 `Contains(token)` 判 IR/Spec——任何图表能力都会因为源码里出现 "presentation" 这个词而 PASS。现在：IR/Spec 是**运行期词表精确成员**，Planner 是**真实 plan() 的输入→输出断言**，三态 PASS/BLOCKED/UNKNOWN，且层门自带三条负控（rows 顶层 filters、bogus chart kind、sheet 未知键）——负控被接受则全部 planner PASS 作废（selftest FAIL）。

## 3. 72 项能力 × 11 层分布（机器扫描）

数据文件：`logs/layer_sweep.csv`（每项一行，逐层 PASS/BLOCKED/UNKNOWN）。汇总（见 `logs/layer_sweep_summary3.txt`）：

| 层 | PASS | BLOCKED | UNKNOWN | 说明 |
| --- | --- | --- | --- | --- |
| probe | 65 | 7 | 0 | 7 项 blocked 全是 agentAvailable=false（write.submit/verifiers、freezeWeb、cell.sort/poly、databaseDict、template.patch.style） |
| tool | 5 | 2 | 65 | 只有工具族适用；2 blocked = rejected/pending 的设计内条目 |
| jar | 63 | 6 | 3 | 62 个 verified 有引擎锚 + databaseDict(pending 但已锚) = 63 PASS；6 BLOCKED = 设计内无类；3 UNKNOWN = agent.* runtime 层 |
| object | 65 | 7 | 0 | 7 项 pending/rejected |
| cpt | 65 | 7 | 0 | 同上 |
| render | 50 | 22 | 0 | 22 项 = web 交互/静态 PNG 不可见（与官方语料同规则）|
| ir | 44 | 0 | 28 | UNKNOWN = 词表无该 token（工具/运行时族 + validator-only 键） |
| spec | 27 | 0 | 45 | UNKNOWN = ReportSpec 表面无该 token |
| planner | 47 | 0 | 25 | 无 planner 输入输出合同（工具/运行时/部分装饰） |
| agent | 50 | 22 | 0 | 22 项未承诺（manifest 分类见下） |
| manifest | 72 | 0 | 0 | 全部条目在账本且有证据 |

**怎么读 UNKNOWN**：UNKNOWN 不是"没做"，是"这一层不是该能力的入口，或者本门没有合同可验证"。
例：`chart.mapLabel` 的 ir=PASS（Ir.capabilities().chart.deco 有 mapLabel）、spec=UNKNOWN（ReportSpec 表面不列它）、planner=UNKNOWN（planner 不承载装饰键）、jar=PASS（AttrMapLabel 在核心 jar）；这些能力由 manifest 四层 + 载体 + jar 锚定背书，不靠某一层凑绿。工具族（`template.patch.*` / `agent.*`）在 ir/spec/planner 三列都是 UNKNOWN 属设计内——它们的入口是 tool 层（verb 接线）+ integration S-cases。

## 4. 引擎分析：demo CPT 不是引擎面，jar 才是（E1）

**问题**：官方 240 个 demo CPT 只覆盖引擎类的一部分；把"demo 里见过"当成"引擎支持"会让账本漏掉/误判。
**做法**：直接扫安装的核心 jar（`lib/`、`server/lib/`、`WEB-INF/lib/`，**不含付费插件 jar**），建立物理清单：

- `scripts/build_jar_inventory.ps1` → `data/jar_class_inventory.json`
- 扫描结果：**102 个核心 jar / 140,118 个类**；`com.fr.*` 顶层包计数（chart 536、report 1,113、form 809、base 605、data 1,268、van 907、io 464、third 57,370 为三方库）
- 管线（lib/*.js、template/*.js、agent/tools/*.js、manifest 证据、engine_class_map）点名的 **182 个 com.fr 类全部在核心 jar 中解析成功，missing=0**——即"我们驱动引擎用的每个类都真实存在"
- `data/engine_class_map.json`：能力 → 类 + 落地模块（一处真相）；`verify/fast_layer_coherence.js` 同时断言"类在 jar 里"与"类字面量确实出现在实现模块里"，防止映射漂移

这套东西补齐了过去的空档：此前只有 `probes/jar_scan.ps1`（按关键字 grep jar）和 coverage.md 的文字结论，没有**账本 × jar 的机器对账**。

## 5. 各层"协调一致"还差什么（诚实清单）

1. **planner 合同覆盖 47/72**：25 项没有合同 = 装饰类（mapLabel/tooltip 变体）、工具/运行时族、以及 spec 表面不承载的族。要提升不是硬凑绿，而是逐族补"输入意图 → 发射路径"的合同（先写载体，再开合同）。
2. **ir 词表 32/72**：40 项 UNKNOWN 中大多数是 product/write/template/agent 族——它们的入口本就不在 IR 词表（write 走 ReportWriteAttr 序列化、template 走 patch ops、agent 走工具链）。这些已由 tool/jar/object/cpt 层背书。
3. **spec 表面 26/72**：46 项 UNKNOWN 同上（res ReportSpec 只承载表/图/参数/合计/多 sheet 这批）。
4. **render 50/72**：22 项 BLOCKED 是 web 交互/静态 PNG 不可见——这是**已定性**的（与官方语料同规则），不是缺陷；其中 seriesBorder 的渲染仍未达成（维持 pending，写明重开条件）。
5. **jar 锚定 62/65 verified**：3 项 agent.* 是 runtime/tool 层，设计上无引擎类（map.none 记录原因）。

## 6. 机器门清单（本文引用的证据）

```powershell
# 单项：11 层判定 + 负控自测
scripts\capability-layer-gate.ps1 -Capability chart.vbar
# 72 项全量扫描（层分布 + CSV）
powershell -File logs\layer_gate_sweep.ps1     # 侦察工具，非门
# 常驻不变量（18 套件之一）
verify\fast_layer_coherence.js                 # I1/I2/I3/I5 + jar 清单指纹
# jar 清单重建（升级 FineReport 后跑）
scripts\build_jar_inventory.ps1
```

**五态标注**：以上 I1/I2/I4/I5 已自动化测试并真实运行（nashorn 真实执行 plan()，真实 jar 扫描）；I3 的 jar 存在性是真实扫描，但"类被调用"仅静态字面量断言，不是运行期堆栈证明——运行期证明由各 carrier 的引擎 failures=0 与部署 cpt 承担（见 manifest evidence）。

**全链实测（2026-11-08，本轮变更后复跑）**：`scripts/run-golden-e2e.ps1` PASS（runId=ge20261108053139-20f321），链路=plan→plan2spec→create→validate（含逐格真值 grid）→preview→modify（diffClean）→promote→restore→baseline-restore；即自然语言意图→ReportSpec→IR→Object→CPT→引擎渲染→回读验证整条链在本轮改动后仍闭合。
