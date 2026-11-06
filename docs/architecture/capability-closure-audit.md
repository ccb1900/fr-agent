# 能力闭环审计（最终基线，2026-11-06；只读审计，不改生产代码）

> 审计基准：`241ab2d`（README #108 后）。动机：用户指出"源码命中率提高 ≠ 实际可用能力同步提高"，暂停 vmap/poly 新能力，先对历史已增加能力逐项对账。
> **本轮范围**：只审计、只出差异报告；不写 vmap/poly 生产代码，不改 lib/ application/ reports/ verify/ probes/ 的任何生产文件。
> 审计三层：**L1 Coverage**（类名/token 源码命中）→ **L2 Manifest**（IR/Object/CPT/渲染/回归证据声明）→ **L3 Agent**（能力发现→需求映射→真实生成/修改→FR 预期结果）。三层互不等价。

> **本文件为最终审计基线**（经外部审查修正口径后定稿），可直接指导实施。修正要点：① `regression` 与 `rendering` 各自独立，regression 须**标明覆盖哪一层**，不得因渲染未验就错误降级合理的序列化回归；② vmap 区分"引擎渲染可行性（已证）"与"Agent 生成链路（未接通）"；③ Agent 清单是"能力说明"，非"强制闸门"，但仍经 discover 提供信息。
> **审计覆盖度（诚实标注，勿误读为全表逐项）**：L2 manifest **60 项**四层状态与 evidence 已逐项对账（§2/§4 类别2）；§3 六层矩阵是**关键项逐项 + 其余抽样**，非 60 项每行都填满六层；L1/L3 结论为源码通读 + 三路独立取证交叉，非穷举。本报告不授权 coding agent 直接据此改生产代码——实施须按 §5 顺序另行立项。

## 0. 审计方法（每个状态必须有证据路径 + 测试入口 + 结果）

六层核对维度（用户给定，逐项独立取证，不用家族级状态代替属性级）：

| 层 | 判据 | 证据形态 |
|---|---|---|
| IR | Schema、合法输入、非法输入、类型约束 | `lib/ir.js` 白名单 + `verify/fast_ir_contract.js` 逐键正反例 |
| Object | 真实 Java 类、构造方式、setter、数据绑定 | `lib/object.js` 单源组装 + 反射探针 probes/ |
| CPT | 序列化结构、重新读取、关键属性保真 | 部署 cpt / `probe_r4m15` 类级 XML 断言 / roundtrip |
| Rendering | FineReport 实际打开、PNG 或浏览器效果 | PNG 实拍（logs/、reportlets/fineagent/*.png）目检记录 |
| Regression | 可重复执行的测试入口，且**必须标明回归了上面哪几层**（IR/Object/CPT/Rendering/Agent） | reports/*.js 载体 + fast/scan/负门 + 专属断言；evidence 点名测试入口 + 覆盖层 |
| Agent | 能力发现、需求映射、真实生成和修改 | discover/plan/create/modify + logs/agent/runs/{runId}/ 产物链 |

**判定纪律**：不能因为能力已投入开发就默认完成；`README 一句完成记录` 不算测试入口；"家族 full"不推导"子属性全验"。
**四层独立原则**：construction/serialization/rendering/regression 各自评估，互不强制相等。`regression=verified` 合法地可以只覆盖序列化层（如 tooltip 的 XML 回归），此时**不得**据此声称渲染已验；也**不得**因渲染未验就把序列化回归错误降级。问题从来不是"regression 该不该等于 rendering",而是"regression 有没有写明它验的是哪一层"。

---

## 1. 体系局限实证：Coverage 不是闭环验收器

一手证据（本轮读源码，非转述）：

| 机制 | 实现 | 实际能力 | 不能证明 |
|---|---|---|---|
| `famStatus()` `probes/coverage_report.js:102-108` | `fam.keys.forEach(classifyToken)`，按 `libAll` 文本命中率算 full/partial/missing | 仅"源码文本里有没有这个 token" | Java 类真实存在、setter 真调用、cpt 序列化、渲染 |
| `classifyToken()` `:39-45` | 全限定名 `indexOf` → 带引号短名正则 → 裸短名(partial) → missing | 字符串命中分级 | 同名注释/字符串常量会被误判 full（分类器自身声明"部分 token 命中"） |
| `SOURCES` `:22-31` | 8 份 lib/application 源码文本 | 静态文本面 | 引擎运行时行为 |
| `carrierHit()` `:145-153` | `reports/` 目录 `listFiles()`，按 `.js` 文件名是否存在打勾 | **只查文件存在** | 该 spec 是否真含对应能力键、是否真跑过引擎、PNG 是否非空白 |
| B 表 GATES `:266` | 一行固定字符串，**每行逐字相同**（已核 coverage.md B 表 40 行） | 把"全套门"名字印在每行 | 逐 family 单独执行/单独收集结果 |
| C 表 `:288-304` | ALIAS→famStatus 取 `worst` | 与 B 表同源 | 独立于 B 表的验证 |

**结论（三路独立取证一致，与用户判断一致）**：Coverage 是**「demo 类频次 × 引擎源码 token 命中」的静态缺口账本与排期索引**（A/C/D 表同源；A 表按 README #81 jar 物理判据圈 noncore，这部分有价值），**不能承担闭环验收**——生成器不执行任何门、不验证 spec 键/Java 类/setter/cpt 序列化/引擎执行/PNG，恒 `System.exit(0)`（`:368`）。B 表标题"组合稳定证据/可稳定组合"（`:262`）与实现不符；B 表 GATES 列、载体列、C 表三色均非证据。

A 路补充实证（超出本轮主线程自查的硬项）：
- **注释也算 full**：`classifyToken` 的 `libAll.indexOf(tok)` 是任意子串，`CellSortAttr` 仅出现在 `lib/ir.js:519-520`、`lib/object.js:353-355` 的**注释**里（无 `setCellSortAttr` 调用），B 表 `sort` 仍标 full（coverage.md:104 自注"#45 受阻断"），而 manifest `cell.sort`=rejected。头部把 full 说成"构造/字符串命中"、partial 说成"部分 token 命中"都不精确：full=任意子串(含注释)，partial=仅裸短名子串。
- `carrierHit()` 的 `f.replace('.js','.js')` 是空替换，纯文件名在库；非 `.js` 描述被静默丢弃（"全部 spec"→`—`、`br_laser_*` 被丢）。
- **B 表 full 的族级实拆**：`funcgroup`(sales_demo.js 内无 FunctionGrouper，实际是 object.js 默认构造)、`chart legacy`(sales_demo_chart.js 只有 `chart:{kind:'bar'}`)、`condition`(test_cellattrs.js 用 IR 键 conditions/when/then 而非 10 个 Java 类键)——三例都是"文件名存在 + 源码 token 命中"，无独立回归入口；唯一通用门是 `scan_all_specs.js` 的离线 compile+validate（零引擎）。
- 「十载体连跑 10/10」只是 `docs/history/README-full-2026-11-06.md:588` 的日志文字，**无提交脚本**；通用入口只有 `run.ps1` + `REPORT_SPEC` env。
- C 表标题写「27 tag」，实际 26 行（`_demo_feature_scan.txt` 前 26 行为正、27-35 为 0）；`0xN` 是 miss 键数不是失败数；D 表 ALIGN 是缺口归属统计不是测试通过数，且 D 表本身没有 ALIGN 列。

数字口径（coverage.md 头部已由生成器写明）：`missing=32 partial=20 noncore=44` = 仍未命中/部分命中的类；`unattributed=0` = **缺口归属清零**，不表示已实现。二者不是一回事。

---

## 2. Manifest 现状：声明表，不是闭环验收表

`application/capability_manifest.js` 共 **60 项 cap**（chart 25 / condition 8 / write 5 / page 9 / product 13；`:25-98`）。四层分布（B 路逐项统计）：construction/serialization/regression = verified 49 / pending 7 / rejected 4；rendering = **verified 38 / pending 10 / serialization-only 8 / rejected 4**；`agentAvailable=true` 恰 **38**（`:11-12` 由四层全 verified 推导，非独立字段）。

**结构性缺陷（B 路实证，口径已按外部审查修正）**：**11 个 rendering≠verified 的 cap 标了 `regression=verified`**（`:38,44-48,58-59,64,67-68`）。这**不是矛盾**——序列化层的 XML 回归（`probe_r4m15`）对 tooltip/hotTooltip/effect 这类 web 交互能力是合法且充分的回归证据，四层本应独立。**真正的问题是 `regression=verified` 没有写明它回归的是哪一层**：读表人容易把它误当成"渲染也回归过了"。修法不是要求 `regression` 与 `rendering` 状态一致（那会把合理的序列化回归错误降级），而是**给每个 `regression=verified` 标注覆盖层**（如 `regression:serialization`）。同理 `seriesBorder/areaFill/seriesImage` 的 `regression=verified` 实为序列化层回归，其 `rendering=pending` + `agentAvailable=false` 是正确分层，无需降级。

| 能力 | 构造 | 序列化 | 渲染 | 回归 | agentAvailable | 判定 |
|---|---|---|---|---|---|---|
| chart.vmap / heatmap / cell.poly | pending | pending | pending | pending | false | 登记未做（诚实） |
| chart.seriesBorder / areaFill / seriesImage | verified | verified | **pending** | verified | **false** | 有构造+XML 断言，无视觉验证 |
| chart.tooltip / hotTooltip | verified | verified | serialization-only | verified | false | web 交互行为，静态 PNG 不外宣 |
| chart.effect | verified | verified | serialization-only | verified | false | web 动画，不外宣 |
| chart.label / stack / conditionalSeries | verified | verified | verified | verified | true | 四层 verified（evidence 已加"范围限定"注） |
| chart.axisYUnit | verified | verified | verified | verified | true | m17 PNG 实拍 |

**结构性缺口（B 路逐项实查）**：
- `regression=verified` 的 49 项里，**21 项 evidence 只有 README 一句、无测试入口**（`:27,28,30,31,32,34,35,42,54,55,56,57,60,73,74,80,87,88,89,90,93`；例 `chart.vgauge` 仅 `"README #46"`、`spec.sql.chart` 仅 `"README #62 ... live"`）；其余多为 `carrier xxx scan`。
- `scan_all_specs.js:2,45-52` **只做 compile+validate（零引擎、零 PNG）**，却被 `:26,29,33,43,53,72,78,79` 当"每轮 scan"证据；`probe_r4m14.js` 自述"零渲染零写入"、`probe_r4m15.js:155-163` 只断言 XML 字符串，却被 `:45,47-48` 的 regression=verified 引用。全仓 `scripts/`、`verify/` **无任何 PNG 像素 diff 回归套件**，PNG 全是一次性产物（且 `probe_r4m3/m17` 无 `System.exit`/断言，只 print 分数靠人工目检，无 runner 引用）。
- `verify/fast_contracts.js:86-137` 是**全局形状/不变量检查**（五段非空、字段类型、推导一致、5 个具名点查、rejected 不广告）；`:120-123` 的 evidence 断言只是 `String.match(/README #\d+|probe_|carrier|integration_runtime/)`——**任意一句 README 即通过**，不查路径存在/文件键/PNG/逐能力证据。`:106-110` 对 stack/label/conditionalSeries 的"载体实跑"断言是**自读 manifest 字段循环自证**。全仓 `verify/`、`scripts/` 零引用 coverage.md。
- `chart.axisYUnit` 载体语义不符：`:43` 称"unit=50 主刻度 0..300 全渲染 + carrier test_vanchart vline 臂"，但 `reports/test_vanchart.js:50` 与 `probe_r4m17.js:47` 都带 `title:'产量'`（正是 evidence 自承"setTitle 后降密度 100 步"的分支），**0..300 全刻度形态无载体/无断言**。
- 用户点名的 `seriesBorder/areaFill/seriesImage`：rendering=pending，其 `regression=verified` 仅覆盖**序列化层**（`probe_r4m15` XML），evidence 自写"视觉未单独目检"——分层本身正确，**只欠 regression 标注 scope**，避免被误读为渲染已验（不是"声明>证据"的降级项）。`chartDeco` 在 coverage 标 full（carrier 空、README 待回填），其 8 个子能力中 3 pending、3 serialization-only、2 verified，**coverage full 覆盖了 3 个未渲染验证项**。

即：manifest 是"一处真相的能力**声明**"，其 verified 的权威来自人工维护的字符串，唯一机器校验只保证"字符串自洽"，不来自机器对账。

---

## 3. 审计矩阵（按用户给定顺序；逐项六层）

> 状态记号：`✓`=有可点名证据且可复现；`~`=仅声明/族级/序列化；`✗`=缺；`—`=不适用（web 交互）。
> "测试入口"列必须给路径；只写 README 编号的判 `~`。

### 3.1 近期新增的图表装饰能力（审计优先级 1）

| 能力 | IR | Object | CPT | Rendering | Regression | Agent | 测试入口 / 证据路径 | 结果 |
|---|---|---|---|---|---|---|---|---|
| chart.stack | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ir `fast_ir_contract` chart 分支；object `lib/object.js:518+`；`probes/probe_r4m3.js` + `logs/_r4m3_stack.png`；carrier `reports/test_vanchart.js` | 单图 STACK 实拍；组合图未验 |
| chart.label | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | `probe_r4m9.js`/`m10` PNG；`test_vanchart.js` 三臂 | 命名条件+恒真已验；复合条件组合未验 |
| chart.conditionalSeries | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | `probe_r4m7.js` D_a 全染 PNG；`m10 C_combo` | 系列级染色（恒真/CommonCondition）已验；任意复杂条件语义未验 |
| chart.tooltip (格式件群) | ✓ | ✓ | ✓ | — | ✓ | ~ | `probe_r4m15.js` 13 项 XML 断言 | 仅序列化；web 交互不静态渲染 |
| chart.tooltip.richText | ✓ | ✓ | ✓ | ✗ | ~ | ✗ | `probe_r4m15` XML；无 PNG 目检 | **有构造与序列化，无视觉验证** |
| chart.hotTooltip | ✓ | ✓ | ✓ | — | ✓ | ✗ | `probe_r4m15` XML（AttrContents） | serialization-only 合理；无 Agent 案例 |
| chart.seriesBorder | ✓ | ✓ | ✓ | ✗ | ~ | ✗ | `probe_r4m15` XML | **rendering=pending，无 PNG 目检** |
| chart.areaFill | ✓ | ✓ | ✓ | ✗ | ~ | ✗ | `probe_r4m15` XML | **rendering=pending，无 PNG 目检** |
| chart.seriesImage | ✓ | ✓ | ✓ | ✗ | ~ | ✗ | `probe_r4m15` XML | **rendering=pending，图片显示效果未验** |
| chart.effect | ✓ | ✓ | ✓ | — | ~ | ✗ | `probe_r4m15` XML | web 动画不外宣 |
| chart.axisY (alerts/unit/title) | ✓ | ✓ | ✓ | ✓ | ~ | ✗ | `probe_r4m17.js` + `logs/_r4m17_axis.png`（预警线@150+主刻度+双轴标题） | Van 路径已验；legacy 公共键有 `test_legacy_axis.js`；轴标题 legacy 实测不序列化（结构化拒） |
| chart.axisX | ✓ | ✓ | ✓ | ~ | ~ | ✗ | m17 Van 双轴标题；`test_legacy_axis.js` 真引擎 | **legacy 路径缺 PNG 目检**（R2-4 留账） |
| chart.label.summary (vpie) | ✓ | ✓ | ✓ | ✗ | ~ | ✗ | 部署 cpt `PieCategoryLabelContent×2 + SummaryFormat×6` | **仅 XML 序列化，无视觉验证** |
| chart.vpie 图例 4 见 3 | — | — | — | ✓ | ~ | ✗ | `probe_r4m11/m12/m13` + `logs/_vpie_final_crop2.png`（340pt 四条全出） | 定性=引擎图例区空间法，非实现缺陷 |

### 3.2 已有完整图表族（审计优先级 2：组合使用）

| 能力 | IR | Object | CPT | Rendering | Regression | Agent | 测试入口 / 证据路径 | 结果 |
|---|---|---|---|---|---|---|---|---|
| chart.bar / pie / line (legacy) | ✓ | ✓ | ✓ | ✓ | ~ | ~ | `reports/sales_demo_chart.js`；README #26 四柱比例+图例实拍 | 单项有 PNG；**组合使用无独立回归载体** |
| chart.vbar/vline/varea/vscatter/vbubble/vpie/vgauge | ✓ | ✓ | ✓ | ✓ | ~ | ~ | `reports/test_vanchart.js` 11 块；README #46/#79 | 同 carrier 多图并存已渲染；**逐图型正反例未独立** |
| chart.trendLine | ✓ | ✓ | ✓ | ✓ | ~ | ✗ | README #72 红趋势线 PNG；`test_vanchart.js` vline 臂 | 有单项渲染，无专属断言 |
| chartDeco 组合（tooltip+label+stack+条件色） | ✓ | ✓ | ✓ | ✓ | ~ | ✗ | `probe_r4m10.js` L_combo/C_combo + `test_vanchart.js` | 互不压制已实拍（m10）；**组合回归只靠一次性探针，未入 fast 套件** |

### 3.3 其他已有能力族（审计优先级 3：找 verified 但无独立回归载体）

B 表 **12 行 carriers=`—` 却标 full**：`sheet / background / writeButtons / chartDeco / jsEvents / reg校验族 / sort / subreport / diagonal / barcode / image / group(自定义分组)`——这些族连"文件存在"级别的载体都没有。

抽样核对"carrier 文件存在但不含对应能力键"（本轮一手 grep，已排除词形假警报）：

| B 表行 | 标的 carrier | 实查键 | 判定 |
|---|---|---|---|
| richtext=full | `reports/test_v41.js` | 仅 `float/toolbar/watermark` 三键，**无 richtext/RichText 相关键** | 载体不覆盖 |
| webpage=full | `reports/test_v41.js` | 无 webpage/WebPage 键 | 载体不覆盖 |
| freeze=full | `reports/db_laser_subtotal.js` | 零 repeat/frozen/header 键 | 载体不覆盖（且 manifest `page.freezeWeb`=pending） |
| condition=full | `reports/test_cellattrs.js` | 有 `conditions/when/then`×3/4/4（词形不同） | **假警报撤回，实际覆盖** |
| float/watermark/toolbar=full | `reports/test_v41.js` | 三键各 1 命中 | 覆盖 |
| dict=full | `reports/test_cellattrs.js` | `dict` 命中 | 覆盖 |

fast 13 套件共 **595 条断言**（IR 183 / template 77 / semantic 54 / planner 52 / report_spec 51 / contracts 39 / …），但断言按模块组织，**没有逐 family 的组合回归断言**；`fast_contracts.js` 39 条中仅 8 条查 manifest 全局形状。即：Coverage B 表的"快速门套件"列对每行印同一串名字，与这 595 条断言的真实覆盖面对不上。

> **覆盖度**：manifest 60 项的四层状态与 evidence 已由 B 路**逐项对账**（见 §2 与 §4 类别2）；本节 3.1–3.3 的六层矩阵是**关键项逐项 + 其余抽样**，不代表 60 项每行都填满了六层证据。

### 3.4 批 I / 批 J（审计优先级 4：机制可靠后再扩）

| 能力 | IR | Object | CPT | Rendering | Regression | Agent | 证据 | 结果 |
|---|---|---|---|---|---|---|---|---|
| chart.vmap | ✗ | ✗ | ✗ | 引擎✓/链路✗ | ✗ | ✗ | `probe_r4m19.js` 官方 mapfather.cpt 无头渲染实拍 `logs/_r4m19_mapfather.png` | **引擎渲染可行性已证，但 fr-agent 生产词汇未接线**；manifest 四 pending 诚实 |
| chart.heatmap | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | 仅登记 | 四 pending |
| cell.poly | ✗ |  | ✗ |  | ✗ |  | `probe_r4m21.js` PolyECBlock/PolyWorkSheet 方法面 | 块面 API 未探全，四 pending |

**vmap 的 Rendering 必须拆成两个问题（外部审查修正，勿混为一谈）**：

| 验证对象 | 当前证据 | 结论 |
|---|---|---|
| FineReport **引擎**能否渲染地图 | 官方 `mapfather.cpt` 无头 execute+ImageExporter 实拍 `logs/_r4m19_mapfather.png`（区域地图+省份染色+图例） | **已验证**（技术风险大幅降低） |
| **fr-agent** 能否从 IR/Object/CPT 生产链生成地图 | 词汇未接线，无 IR→cpt→PNG 产物 | **未接通** |

即：vmap 不是"渲染完全没证据",而是"引擎可行性已验、产品生成链路未完成"。因此未来接线风险低，但**现在仍不应直接开始接线**（先做 §5 的对账机制）。

---

## 4. 五类差异报告（用户给定分类）

> 三路副代理（L1 Coverage / L2 Manifest / L3 Agent）结论已全部回填，逐条给文件:行号。以下均为已实证项；区分逐项核对（L2 全 60 项、L1 生成器逐函数）与抽样（§3 矩阵关键项）。

### 类别 1：Coverage 显示 full，但 Manifest 未完成 / 声明冲突
- `chartDeco`（B 表 full，carriers=`—`）↔ manifest `chart.seriesBorder/areaFill/seriesImage` rendering=pending、`tooltip/hotTooltip/effect` serialization-only（agentAvailable=false）。**命中不等于渲染验收**；8 个子能力里 coverage full 覆盖了 3 个未渲染验证项。
- **`sort`**（B 表 full，自注"#45 受阻断"）↔ manifest `cell.sort`=**rejected**：`CellSortAttr` 只在注释里命中。这是最硬的"full≠可用"反例。
- `freeze`（B 表 full）↔ manifest `page.freezeWeb` pending（"240 demo 零语料"）——幽灵键勘误后家族键改成 `setRepeatHeaderRowFrom`，两表口径需对齐。
- `funcgroup / chart legacy / condition`（B 表 full）↔ 载体 spec 实际不含对应 Java 能力键，只有 IR 键或默认构造；"组合稳定证据"无载体级支撑。
- `map / poly`（B 表 missing）↔ manifest 四 pending——这一对一致，不算差异。

### 类别 2：Manifest 显示 verified，但找不到对应测试证据
（B 路逐项对账，已实证）

- **21 项 README-only**：`chart.pie/line/vline/varea/vscatter/vpie/vgauge/trendLine`、`condition.column/list/then.value/then.style`、`page.templateMarks/repeatHeaderRow`、`cell.groupCustom`、`spec.sql.filters/sort/topN/chart`、`template.patch.dataset`——evidence 无测试入口，全为 `README #NN` 叙述。
- **`regression=verified` 未标注覆盖层 11 项**：`chart.tooltip/hotTooltip/seriesBorder/effect/areaFill/seriesImage`、`condition.then.link/widget`、`write.structure/toolbarButtons/editorReg`（manifest `:38,44-48,58-59,64,67-68`）。**这不是缺陷**——序列化层 XML 回归合法；缺陷是 `regression` 没写明"回归了哪一层",易被误读为渲染已验。修法=标注 scope，**不是**要求与 rendering 一致。
- **scan 被误当渲染回归 8 项**：`chart.bar/vbar/vbubble/axisYUnit`、`condition.formula`、`page.headerFooter`、`cell.subreport/barcode`（`:26,29,33,43,53,72,78,79`）。
- **`chart.axisYUnit` 自相矛盾**：evidence 声称 0..300 全刻度，但唯一载体/probe 都在带标题的降密度分支。
- **循环自证**：`fast_contracts.js:106-110` 对三案"载体实跑"断言只读 manifest 字段；`:120-123` evidence 断言只查"有没有一句 README/probe 字样"。
- 最需补：①`regression=verified` **标注覆盖层**（IR/Object/CPT/Rendering/Agent 哪几层），四层独立、不强制与 rendering 一致（否则错误降级序列化回归）；②21 个 README-only 项各补具名测试载体；③`scan_all_specs` 的 compile+validate 与渲染证据解绑（标明它只证 IR+CPT 序列化，不证渲染）；④coverage full 与 manifest verified 建一表对账断言。

### 类别 3：有构造与序列化，但没有实际渲染
`chart.tooltip.richText`、`chart.seriesBorder`、`chart.areaFill`、`chart.seriesImage`、`chart.label.summary(vpie)`、`chart.hotTooltip`(web 类)、`condition.then.link/widget`(web 类)、`write.structure/toolbarButtons/editorReg`(web 类)。其中后 6 项按 serialization-only 口径**诚实不外宣**，不算缺陷；前 4 项 manifest 已标 pending/serialization-only，需视觉验证才能升层。

### 类别 4：有单项渲染，但没有组合回归
`chart.stack/label/conditionalSeries` 的互不压制只在 `probe_r4m10.js` 一次性 PNG，未进 fast 套件；legacy/Van 各图型"同 carrier 多图并存"已渲染但无逐图型正反例；`chart.trendLine` 无专属断言。

### 类别 5：Agent 声称可用，但真实需求无法完成
（C 路独立审计结论，2026-11-06）

- **discover 的 `agentAvailable` 名单是"能力说明"，不是"强制闸门"**（措辞按外部审查精确化）：`agent/tools/discover.js:34` 输出 `CapabilityManifest.agentAvailableNames()`——它**仍经 discover 向 Agent 提供信息**（Agent 看得到），但全仓 grep 无任何执行链消费者（`create_report.js`/`modify_report.js`/`fr_agent.ps1`/`planner.js` 均不读它做拦截）。真正决定需求能否进入生成的是另一条链：`agent/tools/plan.js:79-80` 注入 `PlannerCapability + ReportSpec.capabilities()`（IR 级 supported/unsupported），`semantic/planner/capability.js` 把非 sum 聚合/multiSheet/chart/filters 判 deferred。**准确说法：Manifest 是能力说明、Planner/Validator 是执行闸门，两套口径无机器级一致性保证**——绕过 plan 手写合法 spec 时，pending/rejected 能力（chart.vmap/heatmap、cell.sort）不被 discover 名单拦，只靠 planner/validator 旁路拦。
- **Golden E2E v1**：磁盘全链实存于 `logs/agent/runs/g1/`（plan ready → reportSpec → compile 11 passed → validate ok → preview PNG 1587×2245 33302B → patch ok → staging .orig+复核件+manifest diffClean=true → runresult success）。grid.txt 13 行含总计 33531/26531/79.1238（本轮另用 `TRUTH_DAY_MACHINE=1` 独立 probe 逐格对拍全绿）。
- **但"外部真值对拍"未固化为 Agent 级可重跑回归**：`g1/validate.json` 的 checks 是内部自洽（合计=明细和、率=done/plan×100），**未带 `-ExpectTotals`**，逐格真值命中是独立 probe + README #98 叙述，不是 g1 产物；`docs/agent-demo-machine-daily.md:53` 只是手动命令清单，无单一 e2e 脚本。g2 仅 compile+runresult；其余 r2026* 多为 plan-only/rejected。
- **诚实拒 ≠ 能力缺口**：磁盘可证 `rejected`（未知业务术语不编造字段/MODEL_SCHEMA_MISMATCH）、`ambiguous`（需反问不自动选）、能力墙（非 sum→deferred、跨表→UNSUPPORTED_CROSS_TABLE）。运行期日期参数/按派生比率排序/条件高亮/HTML5 跨表筛选=manifest pending/rejected 或 golden v1 §6.2 明记不做，属诚实留账。
- **最大缺口**：①清单与 gates 两套口径未机器对齐；②Golden 外部真值对拍不可自动复证（一次性 g1 + README 叙述 + 独立 probe 三分）。
- 结论：**L3 = 部分闭环**（产品链路可信但不可自动复证；discover 是能力说明、非强制闸门，与 planner/validator 执行闸门两套口径未机器对齐）。

---

## 5. 结论与下一步（按证据，不按投入；顺序按外部审查修正）

**核心判断**：fr-agent 当前最大的问题**不是缺少更多 FineReport 能力，而是缺少可信的能力验收机制**。最值得做的是把已有 60 项能力声明变成真正可核验的能力账本——**不要再为了让 Coverage 数字变好而增加实现数量**。三层都未闭环：L1 是静态盘点（职责应正名）、L2 是人工维护的声明（唯一机器校验只保证字符串自洽）、L3 是部分闭环（Golden 链可信但不可自动复证，discover 是能力说明非强制闸门）。用户"停止冲新能力、先逐项对账"成立：**批 I/J 保持 pending，不因 R0 前提被证伪就提前接线**。

**下一步顺序（均为后续立项；本轮只审计、零生产代码改动）**：

1. **修正审计口径 → 本报告即第 1 步定稿**（已完成）：`regression` 与 `rendering` 四层独立、regression 标注覆盖层；vmap 区分"引擎渲染可行性（已证）"与"Agent 生成链路（未接通）"；discover 定性为"能力说明非强制闸门"。落到生产文件时另需：Coverage B 表"组合稳定证据"改名/正名、C 表标题 27→26、头部 full/partial 定义与 `classifyToken` 实际对齐（这些属实施，不在本轮）。
2. **建立最小证据对账机制**（成本最低、暴露面最大，先做）：每项能力的每个 `verified` 必须能指到"该层的测试入口 + 执行结果"——IR 正反例、Object 组装证据、CPT 断言、对应层测试入口；**不再允许一句 README 就算证据**。具体：`regression=verified` 标注覆盖层；21 个 README-only 项各补具名载体/断言；`scan_all_specs` 的 compile+validate 与渲染证据解绑（标明只证 IR+CPT 序列化）；`chart.axisYUnit` 补"无标题 0..300 全刻度"载体或改 evidence 口径；`fast_contracts` 的 evidence 断言从"任意一句 README 正则"改为"路径存在 + 键覆盖 + 结果文件"；coverage full 与 manifest verified 建一表交叉对账（当前全仓零交叉引用）。
3. **先补 Golden E2E 自动复证**（优先于大套 PNG）：把 `g1` 的外部真值逐格校验（`-ExpectTotals 33531:26531` + day@machine）真正接进可重复执行的 Agent e2e 脚本，而非一次性痕迹 + README 叙述 + 独立 probe 三分。这比先做一大套 PNG 比较更能证明产品闭环。
4. **再补近期图表能力的视觉验证**：优先 seriesBorder、areaFill、seriesImage、vpie summary、legacy axisX 逐项 PNG 实拍；stack/label/conditionalSeries 互不压制（现只有 `probe_r4m10` 一次性 PNG）入可重复套件。**PNG 像素回归应带容差与区域（合并格/字体抗锯齿/背景），不做无容差全图 diff**——全图逐像素比较会因抗锯齿/时间戳产生大量假失败。
5. **最后重新评估 vmap**：引擎可行性已证（第 2 步风险已降低），待对账机制可靠后再按官方 `mapfather.cpt` 路接线。**poly、heatmap 继续保持 pending**。

**纪律**：任何能力不因"投入过开发"默认完成；本报告不授权 coding agent 直接据此改生产代码，实施按 1→5 顺序逐项立项。


## 6. §5步4 视觉验证实施结果（2026-11-06，真引擎 PNG 目检）

> 按最终基线 §5 顺序第 4 步实施；只改 manifest evidence + 新增 reports/test_visual_deco.js + 本文档，不动生产装配逻辑。
> 判读方式：真引擎导出 PNG 目检（区域裁片），非无容差全图 diff；稀疏墨量用容差采样。

| 能力 | 真引擎载体 | PNG 目检结论 | manifest 处理 |
|---|---|---|---|
| areaFill | `reports/test_vanchart.js` varea 臂（0x77BBFF alpha0.45） | `logs/_visual_top.png` 第3面板浅蓝面积带可见 | rendering pending→**verified**，agentAvailable=true |
| seriesBorder | `test_vanchart.js` 堆叠臂（0x3355AA alpha0.9） | `logs/_visual_mid.png` 柱缘无可分辨蓝框（抗锯齿吃掉或未渲染） | **维持 pending**，evidence 写明目检结论，不升层 |
| seriesImage | `reports/test_visual_deco.js` vbar 臂 | `能力自检_视觉装饰_api.png` 上图柱体仍纯色，图片未可见渲染（XML 有 AttrSeriesImageBackground×2） | **维持 pending**，evidence 写明"序列化在但视觉未现形" |
| vpie label.summary | `test_vanchart.js` vpie 340pt 臂 | `logs/_visual_vpie.png` 饼四瓣+图例四条全出，但总结文字/数值未可见渲染 | 维持"仅序列化"，chart.label evidence 记录不升层 |
| legacy axisX | `reports/test_visual_deco.js` bar 臂（fontPt:14） | `能力自检_视觉装饰_api.png` 下图 X 轴类目标签字号明显放大 | axisYUnit evidence 补"legacy 路径视觉验证通过" |

**诚实纪律**：5 项里只有 1 项升 verified；3 项序列化在但视觉未现形/不可分辨，维持 pending；1 项(legacy axisX)视觉生效但非独立 cap。绝不因"已有 XML 断言"批量升层。
**环境事故记档**：默认铁证回补时 run.ps1 预检 `COMMIT_LIMIT_LOW free=1610MB need~2100MB`（vmmemWSL 占用），用管线自带 `-Heap 600m` 绕过（need=1500MB）后 `CBEB42E3` 逐字节回补；未擅自关闭用户进程。
**负门未通过（如实标注）**：同轮 `scripts/run-engine-negative-tests.ps1` 5 路全部 `exit=8`（FreeVirtual=1796MB < 2100MB 预检门槛），判据把 8 记为 FAIL——属**环境内存阻塞**，非逻辑失败；本轮不以"逻辑 GREEN"冒充通过，也不改负门脚本参数迁就环境。上一轮 `fa0e04b` 的 ENGINE NEG GATE GREEN 完整终行是逻辑侧最近一次有效记录；待内存释放后复跑负门。
