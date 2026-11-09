# 能力规则（唯一依据 = capabilityManifest）

能力真相只有一处：`application/capability_manifest.js`，经 `discover` 输出。README 编号条目、旧文档里的"支持/不支持"列表、Agent 的印象都**不是**能力账本。

## 1. 先 discover，再承诺

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File agent/tools/fr_agent.ps1 -Verb discover
```

`discover.json` 里四组与能力相关的字段：

| 字段 | 含义 |
|---|---|
| `capabilities` | `ReportSpec.capabilities()`：表达层词表（可写什么键） |
| `capabilityManifest` | 四层 + regressionScope 账本：`construction` / `serialization` / `rendering` / `regression` |
| `agentAvailable` | 扁平名单：**只有这里列出的能力才可对外承诺** |
| `capabilityManifest.unavailable` | 未承诺能力及原因分类 |

`agentAvailable=true` 的定义：四层状态全 `verified`（或账本里显式 override）。当前账本规模由机器门给出（`verify/fast_layer_coherence.js`：caps=94 / verified=86 / agentAvailable=69），**不要写死这些数字**，以每次 `discover` 的实际输出为准。

## 2. 证据强度：agentAvailable ≠ 全生命周期

`capabilityManifest.evidenceGrade` 把承诺分成两档：

- `fullE2e`：有端到端工具链实证（plan→create→preview→modify→promote→restore 全链中真实跑过的项）
- 未列入 `fullE2e` 的 `layerEvidence`：四层状态 + 回归证据，≠ 已跑全生命周期

回答用户时说"支持"要带这个口径：

- ✅ "这个能力在 `agentAvailable` 里，且全链证据已记录" 
- ✅ "这个能力在 `agentAvailable` 里，证据层级是四层 + 回归（未列 fullE2e）"
- ❌ "都支持，随便用"（把 layerEvidence 说成 fullE2e）

## 3. unavailable 原因分类（照抄，不美化）

`unavailableCatalog()` 的分类（`capability_manifest.js` build() 的 legend）：

| 原因 | 含义 | 对用户怎么说 |
|---|---|---|
| `webInteraction` | 浏览器行为，静态 PNG 不可验 | "静态导出验不了交互；Web 端行为不承诺" |
| `unverifiedRendering` | 渲染未达成 | "对象/序列化有，但实际渲染没达成，不能用" |
| `notImplemented` | 未接线 | "尚未接入，别写这个键" |
| `rejected` | 明确不做 | "明确不支持，原因见账本" |
| `e5Evidence` | 四层全证但缺 Agent 全链 | "底层有证据，Agent 全链还没跑过" |

## 4. 高频边界（写进交付说明）

这些是项目里反复踩过的口径，答复用户时按账本 + 证据说：

- **运行期交互筛选**：日期范围在编译时写成受控字面量；Web 端改参重查询不承诺（README #62）。别把"有参数面板控件"说成"能运行时筛选"。
- **图表范围**：`agentAvailable` 里列名的图 kind 才可用；未列名/Partial 的图型（如某些组合图历史挂账）不能承诺渲染。
- **条件高亮**：跨列判断用 `when.formula` 相对公式（`=E3<60`）；`when.column` 只对本格值求值，写错会全列染色/全空。
- **合计聚合**：合计格与 span 合并区不能重叠（v2 spec 总分列必须最右），否则引擎丢格；`validate` 会查栅格自洽。
- **Web 翻页**：参数面板 page/size + 查询提交是既定路线；自造工具条超链导航会撑大请求头（Tomcat 400），不承诺。
- **数据字典 / 富文本 / 悬浮元素 / 水印 / 工具栏**：只按 `agentAvailable` 实际列名使用；账本未列名即不承诺。
- **PatchSpec 白名单**：只有 `replace_cell_value` / `replace_dataset`；样式、列宽、增删列、筛选、参数默认值、标题对象均 UNIMPLEMENTED（`template/ops.js`）。

## 5. 能力咨询的回答模板

1. 跑 `discover`（不取锁，快）。
2. 在 `agentAvailable` 里找能力名；找不到就查 `unavailable[name]` 的原因。
3. 回答三段：**状态**（支持/未承诺）、**证据层级**（fullE2e / layerEvidence / 无）、**限制与替代**（交互边界、渲染边界、可换哪个能力）。
4. 不把"IR 有字段"当"FR 支持"：五层模型里 IR 只是语义接口层；更不能把 FR 不支持的能力包装成支持（AGENTS §N）。

## 6. 账本与代码漂移时

`verify/fast_manifest_evidence.js`、`verify/fast_layer_coherence.js`、`verify/fast_jar_surface.js`、`verify/fast_capability_gate_consistency.js` 是机器对账门。若 `discover` 输出与文档/技能不一致：**以 discover 为准**，把差异当文档问题报告，不擅自改账本、不降低门的标准。

本文件不复制能力清单。清单会随实现变化，复制一份就会漂移——这是刻意的设计。
