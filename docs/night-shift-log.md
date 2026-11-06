# Night Shift 工作日志

> 规范见 AGENTS.md「夜间自主工作规范」。每项工作按：目标/代码证据/实施/验证结果/未验证事项/Commit/下一项 记录。

## 2026-11-05（夜间会话开始）

### 环境快照（Step 1）
- 分支 main；最后成功提交 98283b5（r24：并发测试确定性化 + S24c patch 双拒，集成门 S1–S28+ GREEN）。
- Runtime 状态：冻结（r21b 裁定 + r24 正式关闭）；GOLDEN v1 五步闭环已真跑（README #98）。

### 任务一：Runtime 测试收尾 —— 已由 r24 完成，不重复造轮子

### 工作目标
S24b 确定性命中竞态窗口 + compile/patch 并发路径验收。

### 代码证据与实施（r24，commit 98283b5）
- S24b 升级为确定性构造：测试进程持与 Agent 同名 Mutex → 两 wrapper 写 ready 信号 + Set 独立 AutoResetEvent（IT_S24_READY_A/B）→ 等 IT_S24_GATE → 才 spawn fr_agent（持锁窗口内入口检查必过、阻塞排队）；harness 内核 WaitOne 两个 ready 事件（零轮询零 sleep——第一版 100ms 轮询循环被用户当场否决后改为纯事件等待；首跑 wrapper 漏 Set ready 事件被红如实记录，补 Set 后绿）。
- S24c：patch 路径并发双拒（预置 patch.json → 双 modify host 双 RUNID_EXISTS）。

### 验证结果
- 集成门 S1–S28+ 全绿（exec_0534ab5d，2026-11-05）：S24b"确定性命中 Mutex 内复查路径"（恰一 ok:true + 恰一 RUNID_EXISTS + runresult 单份 success=true）、S24c patch 双拒。

### 未验证事项
- 无（该场景已真跑）。

### Commit
98283b5。

### 结论
**任务二（Runtime 正式冻结）随之满足**：r21b 裁定 + r24 关闭记录在案（README #100）。除确定性 P0/P1 外不再打开 Runtime。

---

### 任务三：全局审查 Agent 产品链路 —— 进行中

按优先级 P2 走真实代码调用链（非架构图）。聚焦用户价值主线：修改可靠性（D）、需求理解（A）、生成正确性（C）。发现以证据清单记录，逐项最小修复，不一次改完。

（审查发现与修复记录追加于下方时间条目。）

## 2026-11-05 18:40

### 工作目标（B1，night-shift-backlog 首项）
SQL intent 中的 ambiguous 术语（如双指词"机台"）此前被硬拒（rejected），与内嵌路径的反问行为不一致——用户说"按机台"时 Agent 不反问而是失败。

### 代码证据
- `agent/tools/plan.js:71-72`：TermNorm.normalizeList 对 ambiguous（resolver 非 resolved）**原样透传原文**（r14 P2 有意设计，注释承诺"交 planner 走 unresolved"）。
- `semantic/planner/planner.js` sql 分支：透传原文不在模型成员名（dset/mset）→ 走"维度不在模型，未编造"→ memberMissing++ → **status=rejected**。
- 内嵌（rows）路径 mapTerm 对 ambiguous 是 unresolvedQuestions(requiresConfirmation=true)——两条路径行为不一致；r10-C 注释承诺"ambiguous/unknown 原样透传走 unresolvedQuestions"未兑现。
- 用户影响：双指术语=需求理解核心场景，硬拒 vs 反问直接决定可用性。

### 实施内容
- `semantic/planner/planner.js` sql 分支：未命中成员名时先过 `ctx.resolve`——ambiguous → `unresolvedQuestions.push({kind, term, candidates, requiresConfirmation:true})`（不计 memberMissing）；纯 unknown → 原样 warnings+memberMissing（不编造）；status 判定改为 `ambiguousTerms ? 'ambiguous' : (memberMissing ? 'rejected' : ...)`（混合态反问优先），ambiguous 时 reportSpec=null（与内嵌路径一致）。planner 本体 ~20 行，ctx.resolve 本就注入，无新机制。

### 验证结果
- fast_planner TDD：先红后绿——新增 6 断言（ambiguous→反问/uq 含机台+requiresConfirmation/specNull/纯 unknown 保持 rejected/混合优先反问/规范成员 ready 不回归）全 PASS；全套 FAST 13 套件 GREEN。
- 真通道冒烟：fr_agent plan 走"机台"双指 intent → `status=ambiguous, unresolvedQuestions=1, requiresConfirmation=True, reportSpec=null` ✓。
- SCAN 48 / 边界 R1–R8 / STATIC 0 同步 GREEN。

### 未验证事项
- 多候选 UI 反问交互（plan 输出 JSON 已含 candidates，展示层未涉及）。

### Commit
`6cd0654`（B1 sql intent ambiguous 反问修复；"见下一条"指本条，已回填）

### 下一项工作
B2：patch 失败路径的状态可判定性走查（backlog 进行中项）；之后回到任务三链路审查其余主线（C 生成/E 工具链）。

## 2026-11-06 00:10

### 工作目标（B2 + 双路径对拍可行性评估）
① patch 链失败路径状态可判定性走查（修改可靠性主线）；② 评估"GOLDEN vs 手写 rawIR 路径等价对拍"（P3 生成后自动验收候选）。

### 代码证据
- patch 链全读（patch_main.js 174 行 + patch.js + reader.js）：①校验/源件缺失/命名样式拒/apply 抛 → throw → exit≠0 且 **manifest 不落盘**（S17 的 fail-closed 依赖成立）；②执行/渲染/数据集回归 FAIL → **FAIL=1 且 manifest 照写**（diffClean/execution/render/pixelStats 如实）→ patch.json ok=false → artifact 不验收；③原件在 apply 前 copy 保留（.orig.cpt）；④export 只进 staging；⑤`_r5_verify_*.cpt` 临时读回件落 reportlets 是 **FineReport API 约束**（reader.readCpt 显式拒绝对路径，TemplateWorkBookIO 只认 reportlets 相对名），时间戳命名+finally deleteIfExists 兜底——实查部署目录**零残留**。
- 双路径对拍：`reports/agent_daily_report.js` 是日期级 4 列（无机台维度）；GOLDEN 是 day×machine 5 列——粒度不同属设计使然，等价对拍不成立。

### 实施内容
- 无生产代码改动（B2 结论=正面确认，无 P0/P1；_r5_verify 残留为理论触发面且实查无残留，不造任务）。
- `docs/agent-demo-machine-daily.md` 同步至 r24 终态：§4 并发与隔离改单实例薄执行器语义（Mutex/身份恢复/同 RunId 重入防护 S24a/b/c，删 r12 队列/current.json 词汇）；§6 复现命令补 modify 行与 r22e 单 runId 接力语义。

### 验证结果
- 纯文档；无代码路径变化（STATIC 门无涉）。

### 未验证事项
- 无。

### Commit
`e0ef1c4`（patch 失败路径走查结论；双路径对拍候选否决）

### 下一项工作
评估结论：双路径对拍不成立（粒度差异设计使然）；backlog 剩余项均有外部依赖（B3/B4=审查方解锁）。**按规范停止条件评估：无可信高价值且不依赖外部决定的工作 → 本轮夜间会话在此干净收尾**，最后留置项=任务三综述（E 主线 verb 契约经多轮走查未发现新缺陷）。

## 2026-11-06 00:40

### 工作目标（循环#2/#3）
① sqlbuilder 无 sort 时行序确定性（多机台数据下 day×machine 行序是 MSSQL 未定义行为——真值对拍与报表可复现性受害）；② validate.js 合计行判定与 compare_paths 一致化（防脚注行误报）。

### 代码证据
- `semantic/query/sqlbuilder.js`：`var order = orderBits.length ? ... : '1'`——无 sort 时 ORDER BY 1 只按第一列排；GOLDEN 的 day×machine 分组在多机台数据下"同日多机台"的机台间顺序 MSSQL 无保证。
- `agent/tools/validate.js`：合计行取 `rows[rows.length-1]`（最后一行）——报表带脚注行（presentation.footnote，r8 #68）时取到脚注导致合计自洽误报；compare_paths 的 totalsOf 早已按"合计|总计"判定——两工具不一致。

### 实施内容
- sqlbuilder：无 sort → `ORDER BY 1 + 其余 GROUP 列`（单列组保持 `ORDER BY 1` 历史文本）；有 sort → sort 主序 + 全部 GROUP 列 tie-breaker（冗余排序键合法且消抖）。
- validate.js：合计行按"合计|总计"判定（totalsOf 一致化），明细求和跳过 total 行；numsOf 补回定义。

### 验证结果
- fast_sqlbuilder：规格增强断言同步（sort/topN 两断言改精确 tie-breaker 文本 + 新增多维无 sort 断言 `ORDER BY 1, laser_files.source_id`）——规格变更的正当同步（非改断言迁就），SELFTEST failures=0；FAST 13 套件 GREEN；边界 GREEN。
- **真引擎复跑 g2**（同 spec，tie-breaker SQL）：truth 哨兵 failures=0 + **G1/G2 明细行逐字节相同**（增强零回归损伤实证）。
- validate 零漂移：g1 validate（真实栅格重构后）ok=true；脚注 smoke（含脚注行栅格）totalRowFound=true、合计仍对 => PASS。
- 首跑 smoke 曾 FAIL——根因是 **smoke 脚本经 stdin 传给 nashorn 时中文正则被编码链路损坏**（工具假象非产品缺陷），改 UTF-8 文件方式后 PASS（记录在案：中文断言的 JS smoke 一律走 UTF-8 文件）。

### 未验证事项
- 多机台真实数据的 tie-breaker 实测（库内当前单台机；逻辑上 GROUP 列全序已证）。

### Commit
b298c28（sqlbuilder+断言）；（validate.js 修复见下一条 commit。）

### 下一项工作
回到链路走查（E 主线 validate.js 已顺带完成）；继续评估 P3 候选。

## 2026-11-06 01:20

### 工作目标（循环#4）
交付三件套自动验收缺口：preview verb 只检 PNG，PDF 无任何自动验收（P3"报表生成后的自动验收"）。

### 代码证据
- `agent/tools/preview.js`：仅 ImageIO 读 PNG；`agent/tools/fr_agent.ps1` preview case 仅传 AGENT_PNG。
- GOLDEN v1 产出 PDF（26558 字节）但全链无一处检查它（%PDF 头/非空）。

### 实施内容
- preview.js 增 PDF 分支（AGENT_PDF env）：exists + bytes>1000 + **%PDF 头（偏移 0 实测）** + 尾段 /Type /Page 或大文件；preview.json 输出 pdfHeader/hasPageObject 字段；PNG 路径行为一字不动。
- fr_agent.ps1 preview case：`-Pdf` 参数 + AGENT_PDF 透传（-Png/-Pdf 二选一）。

### 验证结果
- GOLDEN PDF 实测：exists=True、bytes=26558、pdfHeader=True、hasPageObject=True、blankish=False → ok:true；PNG 回归 ok:true 零漂移；STATIC 0。
- 首跑 FAIL（pdfHeader=False）根因=`FileInputStream.read(JS Array)` 的 J2N 转换不可靠——改 `Files.readAllBytes` + JS 索引（&255 修正符号位）。

### 未验证事项
- PDF 页数/文本抽取（最小验收不涉及；如需可后续接 PDFBox——按规范先不加依赖）。

### Commit
`b298c28` + `a857d48`（sqlbuilder 全序 + validate/compare_paths 合计行口径一致化，两条独立 commit 如实并列）

### 下一项工作
E 主线走查完成（create_report.js/contracts.js 失败路径干净，无新缺陷）。任务三四条主线（A/B/C/D/E）全部覆盖。**停止条件评估达成（剩余候选均依赖审查方解锁或价值边际）——夜间会话收尾。**

## 2026-11-06 07:40（单元2：批B 渲染端四项收案）

### 工作目标
接续 opencode 断点侦察（9 枚 probe_r4* 已入库 214e952），结清批B 渲染端待达四项：stack 渲染/label 显示/条件系列色/vpie 图例 4 见 3；manifest 三能力升 verified。

### 代码证据
- probe_r4m3 头注结案：isStackChart() 只认 vanChartPlotType==STACK；probe_r4m7 D_a 全染实拍：条件系列色正类=AttrBackground+ColorBackground。
- m5 四 L 臂全哑 → 官方 Demo.cpt 536-577 行一手：enabled label 在命名 ConditionAttr（条件属性4）下，DefaultAttr 只有序列化残迹。
- lib/object.js applyChartDeco L518-532（stack 缺 plotType）、L454-463（label 挂 dTag）、L511（seriesColor 用 AttrColor）。

### 实施内容
- object.js 三处：stack 补 setVanChartPlotType(percent?STACK_BY_PERCENT:STACK)；label 改挂命名 lTag('数值标签')+恒真 ListCondition；seriesColor 换 AttrBackground(bgColor(...))。
- capability_manifest：chart.stack/chart.label/chart.conditionalSeries 四层 verified+agentAvailable=true，evidence 引 probe_r4m3/m7/m9+carrier。
- fast_contracts 两断言先行改（三案 verified；扁平名单含 stack 去 tooltip）→ TDD 先红后绿。
- test_vanchart 载体：第一 vpie 臂 170→340pt（图例 4 条全出），第二臂留作截断示警；头注收案口径。

### 验证结果
- 引擎实拍（carrier 全链）：堆叠段白字数值标签+条件全染红+vpie 图例 4 条（A/B/C/D）——PNG 目检四案全绿；m10 组合臂证三件同图互不压制。
- vpie 挂账定性：非实现缺陷=引擎图例区空间法（m11 300pt 全出/m12 170pt 只 2 条且 setMaxHeight 无效/m13 横排 260 仍 3 条）。
- 门：fast 13 GREEN / scan 48+1skip / 负门 5 路 GREEN / 双铁证 CBEB42E3+A8EF39AB 逐字节（carrier 轮后默认 spec 收尾回补×2）/ coverage missing 50→49（AttrBackground 转 full）。
- 事故记档：carrier 引擎轮会回写 demo_api.cpt——每轮后必须默认 spec 收尾（两次执行，铁证完好）。

### 未验证事项
- th.alpha 渲染行为未单独实测（序列化在；manifest evidence 已如实标注范围）。
- 条件系列色的按值判别语义（CommonCondition 全染 vs 逐类判别）未深探——engine 行为=系列级染色，词汇语义注记待批B词汇单元核对。

### Commit
`f21cf94`（preview verb PDF 最小验收；night-shift 循环#4 收尾）

### 下一项工作
单元3：批B 词汇——AttrBorder+tooltip 格式件群（chartDeco 族键补全）。

## 2026-11-06 08:05（单元3+4：批B 词汇+装饰扩容一发）

### 工作目标
chartDeco 族键 AttrBorder 补全 + tooltip 格式件群 + 装饰 7 类（与单元3 共享反射侦察，合并交付）。

### 代码证据
- probe_r4m14/b/c/d/e/f 反射方法面：AttrTooltipContent 富文本路径（setRichTextAttr+setRichText）；ScatterAttrTooltipContent 独有 setX/Y/SizeFormat；AttrBorder CTOR(Color,int)/AttrBorderWithAlpha CTOR(Color,int,double)；AttrEffect(period)；AttrAreaSeriesFillColorBackground(setColorBackground+setAlpha)；AttrMarkerAlpha(setAlpha)；AttrSeriesImageBackground(setSeriesBackground)+ImageBackground(ImageWithSuffix)；Plot.setHotTooltipStyle(AttrContents)。
- 官方语料：常规散点图.cpt（X/Y/Size 在 ScatterAttrTooltip content 内）、各部门反馈情况.cpt（richText+SummaryValue 在 PieCategoryLabelContent）、mapfather/mapson.cpt（areaName/startEnd 属 map 域）。

### 实施内容
- ir.js：TF_KEYS+{x,y,size}（kind 闸）、tooltip.richText 闸、marker.alpha、顶层 hotTooltip/seriesBorder/effect/areaFill/seriesImage 五键形态闸、CAPABILITIES.deco 注记扩容。
- object.js：散点自动切 ScatterAttrTooltip+三格式件；richText 组装；marker.alpha；五新键 DefaultAttr/plot 级接线；hasDeco 扩容；imageBackground helper。

### 验证结果
- m15 五臂一簿 wb.export→13 项 XML 断言全绿（vanChartPlotType 属性值形态"stack"）；carrier 部署 XML 全类命中。
- fast 13 GREEN / scan 48+1 / 负门 5 路 GREEN / 双铁证逐字节 / coverage missing 49→37（12 类销账）/ 归属修正 areaName·mapValue·startEnd→批I。

### 未验证事项
- effect 渲染=web 动画（serialization-only，不外宣）；seriesImage 渲染视觉未单独目检（XML 在=序列化层实证）；vpie 类目标签富文本+summary（PieCategoryLabelContent）留单元6。

### Commit
`8ab7dc1`（批B 渲染端四项收案，README #101）

### 下一项工作
单元5：批B axis 群（VanChartAxis/CategoryAxis/ValueAxis/VanChartAlertValue+AttrLabelDetail 位置域）。

## 2026-11-06 08:15（单元5：批B axis 群收案）

### 工作目标
VanChartAxis/CategoryAxis/ValueAxis/VanChartAlertValue+AttrLabelDetail 位置域 + axisYUnit 渲染定性。

### 代码证据
- probe_r4m16/b：VanChartAxis 面（setAxisName/setShowAxisTitle/setTitle/alerts List/Main·SecTickLine/GridLineType/LabelDisplay/AxisLabelDisplay）；VanChartAlertValue（setAlertValueFormula/AlertContent/LineColor/LineStyle）；AttrLabelDetail（TextAttr/BackgroundColor/Border/Align/AutoAdjust/ShowGuidLine）。
- VanChartCategoryAxis 类不存在（CNF）——Van 族类目轴=VanChartAxis 基类实例。

### 实施内容
- object.js：applyAxisCommon 单源（标题/字/色/反转/箭头/网格/显隐/旋转/格式）+ axisY 扩容（max/min/unit+alerts 列表构造 VanChartAlertValue）+ axisX 块 + label 扩容（TextAttr 活引用 setFRFont——首版直塞 FRFont 被真引擎轮 ClassCastException 当场抓，已修）。
- ir.js：checkAxisShape 形态闸（axisY/axisX 键集+alerts 子闸）+ label AL 扩容。
- manifest：chart.axisYUnit 渲染 pending→verified。
- coverage_report BATCH_CLASS：三条 axis 类参考批次注记改'实例配置非构造(README #103)'。

### 验证结果
- m17 PNG 实拍：unit=50 主刻度全渲染（axisYUnit 渲染案收）+ 红预警线@150 + 轴标题（渲染对象=setTitle(new Title)，仅 setAxisName 不渲染——占位名族记档）+ setTitle 后引擎自动降密度（交互事实）。
- carrier 真引擎轮：ClassCastException 抓出 label TextAttr 直塞错（fast/scan 双绿照跑——装载面必跑引擎回归教案）→ 修复后 15574ms failures=0，部署 XML axisName=产量·机型+AlertValue+alertContent 全命中。
- fast 13 GREEN / scan 48+1 / 负门 5 路 GREEN / 双铁证逐字节 / coverage missing 37→34（AlertValue full；VanChartAxis·CategoryAxis partial=实例配置口径）。

### 未验证事项
- axisX 在 legacy 族（CategoryAxis）实例路径未单独渲染目检（Van 族已证；legacy 同 setter 面）。
- LabelDisplay/IntervalBackground 等 VanChartAxis 深水 setter 未全接（频次低，未排）。

### Commit
`3af6493`（批B 词汇+装饰扩容，README #102）

### 下一项工作
单元6：批B 头部类（AttrTooltipRichText label 侧 PieCategoryLabelContent 包名定位+NormalDataModel 180）。

## 2026-11-06 08:25（单元6：批B 头部类收案）

### 工作目标
AttrTooltipRichText label 侧（PieCategoryLabelContent）+ NormalDataModel(180) 判定。

### 代码证据
- jar 清单定位：com.fr.plugin.chart.pie.attr.PieCategoryLabelContent（fine-report-engine）。
- probe_r4m18：PieCategoryLabelContent extends AttrTooltipContent（setRichTextSummaryValueFormat/setSummaryValueFormat）；NormalDataModel 零方法面（AbstractDataModel 直继承）+ 官方 XML `<DataProcessor class=...NormalDataModel/>` 标记形态。

### 实施内容
- object.js label 块：vpie 闸（summary/richText）→ detail.setContent(new PieCategoryLabelContent) + richText 组装 + summary 格式件。
- ir.js：label AL += richText/summary（summary=true|{format} 双形态闸）。
- coverage BATCH_CLASS：NormalDataModel 记'引擎内部 DataProcessor 标记(已在产物流,无构造面)'；AttrTooltipRichText/AttrBorder 记'批B 已收'。

### 验证结果
- carrier 部署 XML：PieCategoryLabelContent×2 + AttrTooltipSummaryValueFormat×6 命中（真管线落地）。
- 我方出口已含 NormalDataModel 标记（m15×5/carrier×11）——引擎保存即写，每图一个。
- fast 13 GREEN / 负门 5 路 GREEN / 双铁证逐字节 / coverage missing 34→33。

### 未验证事项
- vpie label richText/summary 的渲染视觉（serialization 层实证；渲染=vpie 标签文字样式，下一轮目检可顺带）。

### Commit
`ae4facb`（批B axis 群收案，README #103）

### 下一项工作
单元7：批I map 域（VanChartMapPlot/AttrMapLabel/AttrMapTooltip/VanMapMoreNameCDDefinition/AttrCurve/AttrLineEffect+heatmap+ChartHyperRelateCellLink+areaName/mapValue/startEnd 三格式）。

## 2026-11-06 08:30（单元7-13 冲刺收口：漏账清零+批H 定性+批I R0 翻案）

### 工作目标
时间窗收尾：漏账 9 类判定收编、批H 定性、批I R0 探针、总清账准备。

### 代码证据
- probe_r4m19：官方 mapfather.cpt readTemplateWorkBook→execute→ImageExporter **无头渲染成功**（logs/_r4m19_mapfather.png 227KB 目检=区域地图+省份染色+图例）——批I"GIS 底图无轻量通路"前提证伪；九类 map 域方法面已 dump（AttrMapTooltip=area/point/line 三槽）。
- probe_r4m20：漏账 9 类方法面（ChartCommonCondition extends CommonCondition 三 CTOR；VanChartCustomPlot=getCustomPlotList 组合图；MultiFileEditor=FieldEditor 子类文件上传；ExcelTableData=FileTableData 子类等）。

### 实施内容
- coverage_report BATCH_CLASS 九条判定注记（非真缺 3/显式排期 4/待探针 2）。
- README #105 + 批H 定性（SortHeader=web 交互 serialize-only 口径）。

### 验证结果
- coverage 重刷：ALIGN batchAttributed=52 **unattributed=0（漏账清零）**；missing=33 partial=19。
- fast/scan/负门/双铁证维持 GREEN（本轮零生产代码改动）。

### 未验证事项 / 留账（下一轮直续）
- 单元7 vmap 词汇实施：按官方 mapfather.cpt 序列化形态接线（VanChartMapPlot+VanMapMoreNameCDDefinition+MapMatchResult? 层定义），R0 证据已齐（m19 dump+渲染实拍）。
- 单元8 poly：PolyECBlock/PolyWorkSheet 块面 API 未探（README #80 挂账口径不变）。
- 单元9 批F 写回：DML 真提交（隔离临时表写测试）+Verifier 族+write 按钮 8 类+Commit2DBJavaScript。
- 单元10 批D：DatabaseDictionary/DynamicSQLDict 凭据注入（#539）+FineDateFormat。
- 单元11 批G：FrozenState/RepeatAndCollapsible（web 冻结）+Diagonal+stylesOf。
- 单元13 残项：FileAttrErrorMarker 探针确认；ChartHyperRelateCellLink 归 vmap 批热链。
- 审查修复环：首轮外部审查已派出（后台运行中），结果回填后逐条复现修复。

### Commit
`a2c158c`（批B 头部类收案，README #104）

### 下一项工作
按上列留账顺序直续；审查结果先处理。

## 2026-11-06 09:20（审查轮 2：四项收敛，严格限定范围）

### 工作目标
外部审查基准 f21cf94→dd27399：2 项 P1（IR/Object 契约静默丢）+ Golden 栅格回归 + 文档整理；用户裁定不扩 vmap/poly 新能力、不做图表后端重构。

### 代码证据
- P1-A：`label.summary:true` 非 vpie 绕过（ir 只在 isObj 分支查 kind）；P1-B：legacy 无 legend 时 axisY 整块被 `(van||b.legend)` 跳过。
- probe_legacy_axis：legacy Bar2D/LinePlot.getyAxis()=ValueAxis，setTextAttr/setTitle/setFormat/setMaxValue/setMinValue/showLabel 等 setter 全在；PiePlot 无 yAxis。
- 真引擎 test_legacy_axis 部署 XML：TextAttr/FRFont size=80/foreground=-13421773/isShowAxisLabel=true 落 legacy ValueAxis；**`销售额` 零命中 → legacy Axis.setTitle 不序列化**，故 title 归 Van 专属。
- scan 首跑 bad=1：rebuild_first.js（legacy #46 既有用法 axisY.min/max）误伤 → min/max 归公共（setter 面实证），unit/alerts/title 保持 Van 专属。

### 实施内容
- lib/ir.js：summary 闸提到 `!= null` 外层（true/对象都管）；checkAxisShape 按真实 setter 分层（公共 fontPt/color/reversed/arrow/grid*/showLabel/format/min/max；Van 专属 title/unit/alerts），legacy 用 Van 键结构化拒不静默丢。
- lib/object.js：axisY 无条件公共应用（去继承闸）+ applyAxisCommon 增 vanAxis 参数（title 仅 Van）；max/min 公共、custom 开关与 unit/alerts 留 van 块。
- verify/fast_ir_contract.js：9 条 P1 断言（★曾误置于 `print/exit` 之后=假绿，移回后真跑全绿）；reports/test_legacy_axis.js 真引擎回归 spec。
- application/capability_manifest.js：label/stack/conditionalSeries 四层 verified 的 evidence 追加"范围限定"注（不从单 carrier 推导全组合）。
- docs/night-shift-backlog.md：B2 从进行中/候选移除→已完成（e0ef1c4 结论）；8 处 Commit SHA 占位全填真实值；R2-1/2/3 销项；新待办=视觉分层验证+vmap/poly 等顺序后延。
- docs/night-shift-log.md / README / AGENTS / coverage_report.js：措辞统一"**缺口归属清零**（unattributed=0）"≠"能力缺口清零"（missing=32）；coverage.md 头部由生成器补数字含义说明（幂等）。

### 验证结果
- P2-A Golden 栅格双路：`TRUTH_DAY_MACHINE=1 GRID=logs/agent/runs/g1/grid.txt` 10 行逐格+总计 33531/26531/79.1238 全绿；四列兼容样例 `总计|33531|26531|79.1238` 旧分支零回归。
- 串行单实例全套门：fast 13 GREEN / scan 49+1skip / legacy 真引擎 failures=0 / 默认铁证 CBEB42E3 逐字节 / **ENGINE NEG GATE GREEN（完整终行捕获，R2-3 关闭）** / coverage missing=32 partial=20 unattributed=0。

### 未验证事项
- vpie label.summary/richText 视觉渲染、tooltip 格式件群、hotTooltip/seriesBorder/areaFill/seriesImage 视觉、axisX legacy 路径——维持 manifest 分层（serialization-only/pending），逐项 PNG 实拍后再升层（新待办 R2-4）。
- 审查轮 3 未启动（本轮无新外部审查输入）。

### Commit
（本条随本轮提交填写。）

### 下一项工作
R2-4 视觉分层验证（逐项 PNG 实拍），之后才按 docs/night-shift-log 留账顺序进 vmap/poly/批F/批D。


## 2026-11-06 12:45（闭环审计 §5 实施：步2/步3/步4）

### 工作目标
用户要求"实施啊"——把审计报告落地为代码，按 §5 顺序：最小证据对账 → Golden E2E 自动复证 → 视觉验证。

### 代码证据
- 审计基线 docs/architecture/capability-closure-audit.md（定稿 dd4bf3a）：regression 四层独立、需标注覆盖层；vmap 拆引擎/产品链路；discover=能力说明非闸门。

### 实施内容
- 步2（6018ad6）：新增 verify/fast_manifest_evidence.js 对账器（硬红线：regression=verified 禁一句 README、引用 probe/carrier 路径磁盘可查、regressionScope 合法）+ 挂 run-fast-tests（14 套件）；manifest 升 v3 加第7参 regressionScope，27 项 README-only 逐项补真实引用（test_vanchart/test_cellattrs/test_hla2/test_write/test_pagehf/test_g/sales_demo_chart/db_laser_subtotal/fast_sqlbuilder/integration_runtime），legacy pie/line 标族级代表不造假。
- 步3（796972e）：scripts/run-golden-e2e.ps1 固化 plan→plan2spec→create→validate(-ExpectTotals 33531:26531)→preview；preview 改 .NET 直读 PNG 绕开 PS5.1 GBK 中文路径果酱 + 容差判读（稀疏报表墨量≥0.2%，非无容差全图 diff）；ASCII-only；真引擎 ge20261106123412 GOLDEN E2E PASS，validate "合计对拍外部真值"=True。
- 步4（9989b4f）：真引擎 PNG 目检 5 项——areaFill 升 verified；seriesBorder/seriesImage/vpie summary 视觉未现形维持 pending；legacy axisX(fontPt:14) 放大生效记入 evidence；新增 reports/test_visual_deco.js。

### 验证结果
- fast14 GREEN / scan 50+1 / 默认铁证 CBEB42E3 逐字节（-Heap 600m 绕开 COMMIT_LIMIT_LOW 预检，未擅关用户进程）。
- **负门未通过（如实）**：FreeVirtual=1796MB<2100MB，5 路 exit=8 预检拒绝；属环境内存阻塞非逻辑失败，不改脚本迁就，逻辑 GREEN 沿用 fa0e04b 终行，待内存释放复跑。

### 未验证事项
- coverage full ↔ manifest verified 交叉对账（§5步2d 增强项，未做）；seriesBorder/seriesImage/vpie summary 视觉维持 pending；vmap/poly/heatmap 保持 pending 不接线。

### Commit
6018ad6 / 796972e / 9989b4f。

### 下一项工作
内存释放后复跑负门；之后才按文档重评 vmap。


## 2026-11-06 13:55（外部审查 v2：修正验证工具自身）

### 工作目标
审查裁定"最大风险从缺少能力变成验证工具可能给出过强通过结论"。按限定三件事：补强证据对账器、完善 Golden 自动复证、视觉 fixture 可重复化。不扩图表/不碰 Runtime/不加抽象层。

### 代码证据
- v1 对账器只查文件存在（chart.pie 自承无独立载体仍 verified）；e2e 只查总计未查逐格；test_visual_deco 依赖 logs/_r4m9_off.png。

### 实施内容
- 对账器 v2（verify/fast_manifest_evidence.js 重写）：KEY_OF 逐能力键覆盖、fast 文件存在、scope 与字面证据一致、README 引用升 FAIL、四层各自证据、Coverage↔Manifest 交叉（sort full vs cell.sort rejected = 硬性冲突）。
- 对账器暴露真缺口：condition.list/page.repeatHeaderRow 载体不含键 → 新增 reports/test_closure_gaps.js 补实；30 项 scope=rendering 但 evidence 无渲染字样 → scope 校正为 cpt（四层状态不动）。
- Golden v2（scripts/run-golden-e2e.ps1 重写 + 新增 verify/fast_golden_closure.js）：validate 后接 verify_sql_data TRUTH_DAY_MACHINE=1 逐格真值（10 行双键闭合+总计三值）；modify 步断言 diffClean/execution/render/.orig.cpt 保留；失败即停；RunId 加 GUID；范围 env 自适应（400m 下限，低于 1300MB 报 ENV_BLOCKED exit 8）。
- 离线核验器 fast_golden_closure 13 条对既有 golden 产物全绿，挂 fast 套件（15）。
- fixture 自给：test_visual_deco.js 按需生成 logs/_visual_fixture.png（实测 74B），不静默跳过。

### 验证结果
- fast 15 GREEN / scan 51+1 / boundaries clean / 默认铁证 CBEB42E3 逐字节（400m heap 实测可跑引擎）。
- **真引擎 e2e 本轮未跑通**：FreeVirtual 2100→1180MB 持续下探（vmmemWSL），400m 下限不满足时脚本明确 ENV_BLOCKED exit 8；引擎侧最近有效记录=ge20261106123412 PASS，逐格真值+modify 已由离线核验器对真实产物验证。

### 未验证事项
- 内存恢复后完整 e2e 复跑一次（create→truth-grid→preview→modify 全链）。
- 负门复跑（同内存阻塞）。

### Commit
（见本条提交。）

### 下一项工作
内存恢复后复跑 e2e + 负门；之后暂停架构改动，整体复审能力账本。


## 2026-11-06 14:15（内存恢复：负门复跑 GREEN，Golden 待数据库）

### 工作目标
用户释放内存后补跑负门与 Golden e2e。

### 验证结果
- 内存 FreeVirtual 1180→4920MB。
- **负门 5 路全 GREEN**：ir-bad exit9 / db-conn exit4 / secret-leak exit1 / exec-formula exit1 / json-bad-spec exit2，`ENGINE NEG GATE GREEN (no false-green; default baseline intact)`，默认铁证 CBEB42E3 逐字节。
- **Golden e2e create 失败根因更新**：不再是内存，而是 `DB CONNECTION FAIL ATOM_LIVE`（jdbc:sqlserver://127.0.0.1:1433 无监听）。该 SQL Server 在 WSL 中随内存清理停止（Windows 服务仅 SQLWriter，Docker 无容器）——用户环境，不代启动。

### 未验证事项
- Golden 全链（create→truth-grid→preview→modify）待 SQL Server 恢复后复跑；逐格真值+modify 已由离线核验器对既有 golden 产物验证。

### Commit
（见本条提交。）

### 下一项工作
SQL Server 恢复后跑完整 e2e；之后暂停架构改动整体复审。


## 2026-11-06 14:20（Golden E2E 全链 PASS）

### 工作目标
SQL Server 恢复后跑完整 e2e 收尾。

### 验证结果
- WSL Ubuntu-26.04 内 1433 已在监听（SQL Server 运行），Windows 侧 TCP 127.0.0.1:1433 连通；`drop_caches` 回收 vmmemWSL（5.2→3.6GB）后 FreeVirtual 恢复到 2512MB。
- **`scripts/run-golden-e2e.ps1` 全链 PASS**（runId=ge20261106141630-ab1f8c）：
  plan OK → plan2spec OK → create OK → validate OK → truth-grid OK（10 行 day@machine 逐格 + 总计 33531/26531）→ preview OK（1587×2245, 33302B, nonWhite 69/9040）→ modify OK（diffClean + execution.pass + render.pass + orig 生产日报GOLDEN_api.orig.cpt kept）。
- e2e 踩了 demo_api.cpt 中间件 → 默认 spec 回补 `CBEB42E3` 逐字节 ✓。

### 未验证事项
- preview.json 不在 e2e 产物内（v2 改 .NET 直读 PNG 绕开 PS GBK 中文路径）；PNG 验收由 e2e 直读断言承担。

### Commit
（见本条提交。）

### 下一项工作
三件 P1/P2 收口完成；暂停架构改动，整体复审能力账本。


## 2026-11-06 14:35（删 run.ps1 提交额度预检，用户拍板）

### 工作目标
用户质疑"帆软能启动，预检有必要？"。查 #46/#47 一手证据：预检的原始理由是**未限堆 6G 默认堆 + j2v8 原生大提交 → 原生 AV 崩（hs_err×7，不报 Java OOM）**；#47 同批已加 `-Xmx1200m` 限堆——限堆才是主修复，预检是配套兜底，事故前提已消失。

### 实施内容
- run.ps1 删除提交额度预检整段（约 15 行：FreeVirtualMemory 轮询 + COMMIT_LIMIT_LOW exit 8），保留 `$Heap`/`-Xmx` 上限与 engine_launch 统一启动。
- 注释如实记录删除理由（用户决定 + 误拦证据：提交剩余 1776MB 时 -Xmx400m 正常跑）。
- e2e 脚本 heap 自适应保留（资源优化），注释更新为"预检已删、ENV_BLOCKED 仅 400m 下限触发"。
- README #111 索引、AGENTS §3 事实（防重新引入固定常数预检）。

### 验证结果
- run.ps1 冒烟（默认 spec，-Heap 400m）：PIPELINE END failures=0，铁证 CBEB42E3 逐字节。
- fast 15 套件 GREEN。
- **集成门 S1–S28 全 PASS**（`INTEGRATION END, failures=0` + `INTEGRATION GATE GREEN`）：含 S5b/S14/S6/S16/S8/S15/S17/S20(真宿主崩溃)/S21(x10)/S22/S23/S24a·b·c/S25/S26/S27/S27b/S27e/S28。

### 未验证事项


### Commit
（见本条提交。）

### 下一项工作
集成门结果；之后暂停架构改动整体复审。


## 2026-11-06 15:10（验证入口可靠性四项收口，外部审查终轮）

### 工作目标
按审查限定的四项：① Golden 真值缺失必须失败；② Fast Golden 用入库 fixture；③ Manifest 检查器定位修正；④ 视觉 fixture 根路径。

### 代码证据
- verify_sql_data.js 缺 grid/真值时 SKIP exit 0（第 21/27 行）；e2e 只查 grid 存在/rc/CHECK FAIL 不查 SKIP → 缺真值可能假 PASS。
- .gitignore 排除 logs/ 整体；fast_golden_closure 硬编码 logs/agent/runs/** → 干净 clone 不能过。
- fast_manifest_evidence 四层共用 concrete、Coverage 交叉硬编码、键覆盖是字符串检查。
- test_visual_deco fixture 路径硬编码 D:/fineagent。

### 实施内容
- verify_sql_data.js：加 REQUIRE_TRUTH=1（缺 grid/真值 → CHECK FAIL exit 1）+ TRUTH_FILE env 覆盖（fixture/负向测试）。
- run-golden-e2e.ps1：truth-grid 步前置查 grid + truth 存在且非空；REQUIRE_TRUTH=1；输出含 SKIP 亦 FAIL。
- 新增 verify/fixtures/golden/：grid.txt（干净 UTF-8，10 行 day@machine + 总计）、patch.json（真实 g1 产物）、staging/生产日报GOLDEN_api.orig.cpt。
- fast_golden_closure.js：改读 fixture；新增负向测试（spawn java：REQUIRE_TRUTH=1 + TRUTH_FILE 不存在 → 期望非零，实测 rc=1）。
- fast_manifest_evidence.js：头部+输出改名"静态证据引用与声明一致性检查器"，三条已知限制明示。
- test_visual_deco.js：fixture 根路径支持 FR_AGENT_HOME。

### 验证结果
- fast 15 GREEN（fast_golden_closure 14 断言含负向 rc=1）/ scan 51+1。
- **干净 clone 模拟**：仅 fixtures + data/truth + 两个 js，FR_AGENT_HOME 指临时目录 → failures=0。
- **真引擎 e2e 复跑 PASS**（ge20261106150630-a8693e，fail-closed 真值检查生效后正常路径不受影响）；默认铁证 CBEB42E3 逐字节。

### 未验证事项
- 无（四项均有对应断言/实跑）。

### Commit
（见本条提交。）

### 下一项工作
按审查建议：暂停架构改动，重新做一次全局审查（生产代码/能力账本/Golden 产物/测试入口一致性）。


## 2026-11-06 15:25（干净 clone 复验 + CRLF/.gitignore 两处修复）

### 工作目标
证明确实"干净 clone 能过 fast 15"（外部审查 P1 第 2 项的验收口径）。

### 代码证据
- `git clone` 到临时目录（core.autocrlf=true）后跑 fast_golden_closure：**truth 解析 0 行** → 逐格断言全假失败。根因=正则 `## name
...` 只认 LF，clone 出 CRLF。
- clone 里 `verify/fixtures/golden/staging/.orig.cpt` 不存在：`.gitignore` 的 `*.cpt` 全排除规则命中。

### 实施内容
- `.gitignore` 加 `!verify/fixtures/golden/**/*.cpt` 例外（fixture 是 logs/ 被排除后唯一受版本控制的 golden 证据副本）。
- verify_sql_data.js 两处 section 正则、fast_golden_closure.js 一处 → `
?
` 兼容 CRLF。

### 验证结果
- 本地 LF：fast_golden_closure 14 断言全绿；fast 15 GREEN。
- **真 clone（logs=NO）**：14 断言全绿（含负向 rc=1）；fixture 三件（grid.txt/patch.json/staging/.orig.cpt）均入库可读。

### 未验证事项
- 无。

### Commit
bcdfd13（.gitignore 例外）+ d21fde7（CRLF 正则）+ 本条文档。

### 下一项工作
按审查建议：暂停架构改动，重新做一次全局审查（生产代码/能力账本/Golden 产物/测试入口一致性）。

## 2026-11-06 16:00（能力矩阵路线图 + 第一项实施：合并行/多层表头）

### 工作目标
用户纠正"用两个讨论过的技术点绑架路线图"，要求六维评分+七源对账的能力矩阵，选前三项：第一实施、后两待办。

### 代码证据
- IR：`lib/ir.js` CAPABILITIES 词表 + cells item 仅 `span`（列合并）；`object.js:303` 已支持 setRowSpan（缺口只在 IR 键）。
- 真实频次：240 demo `rs>1` **1364 处**、`cs>1` **5757 处**（年度财务分析报告单张 rs36+cs331）；3D翘曲 `rs=2/cs=4`。
- Agent 墙（独立取证）：spec_compiler 零 param；detail 硬写 conditions:null；footnote 过校验不发射；rows 只取 rows；planner deferred 仅 warning 不阻断；patch 仅 2 op。

### 实施内容
- 新增 `docs/architecture/capability-matrix.md`：七源对账（coverage/manifest/IR/object/cpt/引擎样本/Agent 链路）、六领域矩阵、六维评分、两项排序、前三项（1 合并行已实施；2 ReportSpec 条件高亮+静默丢弃；3 ReportSpec 参数面板；4 非 sum 聚合）。
- 第一项实施：`lib/ir.js:545` cells item 加 `rowSpan` 白名单；`lib/object.js` cells 分支传 `it.rowSpan`（putCell spanR）+ 按 item.r 计算多行游标/逐行行高；新增载体 `reports/test_merge_header.js`。
- backlog 新增 R3-1~R3-4。

### 验证结果
- scan 52+1（merge_header 过 validate）；部署 cpt `rs="2"`×2 + `cs="2"`×1 + `cs="4"`×1；PNG 目检：生产线/良率跨两行、生产情况跨两列、数据行对齐。
- fast 15 GREEN；负门 5 路 GREEN；默认铁证 CBEB42E3 逐字节（载体轮后默认 spec 回补）。

### 未验证事项
- 第二/三项（ReportSpec 条件高亮/参数面板/非 sum 聚合）仅入待办，未实施。

### Commit
（见本条提交。）

### 下一项工作
R3-1 ReportSpec 条件高亮 + 静默丢弃修复（P1）。

## 2026-11-06 16:20（R3-0：rowSpan 正确性与能力证据修正）

### 工作目标
外部审查 P1：初版 rowSpan 游标只按显式 r，未计入 rowSpan；IR 校验过松；Agent 可用证据不足；矩阵两处口径待修正。

### 代码证据
- 复现（缺陷实测）：`rowSpan=2` + 后续 item 无 r → 下一 block 落 row2 覆盖合并区；实测 cpt 里 `r1 c0`（rs=2 合并格）**整格丢失**，`r2 c0` 被副表头占据。
- 原游标：`cellsMaxR` 只按 `r - rowCursor`；IR 侧 `numOpt` 只查有限数字。

### 实施内容
- object.js：块占用 = max(r 相对 + rowSpan - 1)；块内区域重叠/`r` 倒退 → 结构化抛错（绝对行兜底）。
- ir.js：rowSpan/span 正整数、r 非负整数；块内「显式 r 之间」「无 r 同行之间」重叠 → DUPLICATE 静态拒；`Array.isArray` 守卫（抗炸门抓到 items 非数组崩溃）。
- fast_ir_contract：+10 条 R3-0 断言（行 Span=2 无 r / 3+r 混合 / 0·-1·1.5 拒 / r 拒 / 重叠拒 / 单行零回归）。
- 新增 reports/test_rowspan_cases.js（真引擎载体：rowSpan=2 无 r + 紧随 cells 块 + detail + total）。
- 矩阵修正：cells 多行合并表头 vs header block 多层表头拆行；rowSpan Agent 可用改「待验证」；频率改 **103/240 文件（42.9%）+ 1364 单元格**。

### 验证结果
- 修复后 cpt：`r1 c0 rs="2"` + `r3 c0`（副表头在合并区下方）+ detail r4 起，无重叠；PNG 目检一致。
- scan 53+1；fast 15 GREEN；负门 5 路 GREEN；默认铁证 CBEB42E3 逐字节。

### 未验证事项
- Agent 可用（plan→create 自然语言到带合并表头的 cpt）无证据，矩阵已标待验证。

### Commit
（见本条提交。）

### 下一项工作
R3-1：ReportSpec 条件高亮 + 静默丢弃修复（P1）。

## 2026-11-06 16:40（Native Capability Inventory：五层差集与 A/B/C/D 清单）

### 工作目标
用户指出：不能因为 IR 没字段就认为 FR 不支持；需要盘点"FR 已有、fr-agent 未开放"的能力，并调整开发策略（先盘点原生/底层，再补 IR/Agent）。

### 代码证据（一手）
- object.js 构造 FR 类 **127 个**；ir.js 显式结构化拒 **3 条**（multi_sheet/cell.sort/write.verifiers）。
- **A 类确证**：多 Sheet——object.js:786 `wb.addReport(sIR.name, sheet)` 在 sheets 循环内已支持，ir.js:469 硬闸拒（注释"object.js v3.2 预留 throw"已过时）。
- **B 类确证**：spec_compiler 字段面仅 dataset{kind,connection,entity,dimensions,metrics,rows,dateRange,filters,sort,topN}+presentation{chart,footnote,heightsPt,showTotal}；IR 已有的 param 13 控件/condition 8 族/cells 族/页眉页脚/水印/浮动/纸型/装饰族/rowSpan 全部无通路。
- 生产参考 3D翘曲 14 类中 object 未构造 3 个：TemplateInfoAttrMark（与已构造 Id/Theme 同族）/WidgetDisplayEnhanceMarkAttr/StrategyConfigsAttr；NoneReg 属 REGF 族"零触碰默认"，非缺口。

### 实施内容（只审计，不加功能）
- 新增 `docs/architecture/native-capability-inventory.md`：五层模型（Engine/CPT+Object/IR/ReportSpec/Agent）+ 五层总览统计 + **A/B/C/D 四份清单**（含证据与置信度）+ 待逐项核实 4 项 + 下一阶段策略。
- 能力矩阵加五层指针（明确矩阵只答"已接入能力的成熟度"，不答"还有多少没开放"）。
- backlog 增 B 类清单（R3-5~R3-8）+ A 类 R3-9 多 Sheet + C 类 R3-10/11。
- AGENTS 增架构原则（不做 FR 重实现，只做语义接口层；新增能力默认顺序=查原生→Object/CPT→IR→spec/planner）。

### 验证结果
- 纯文档轮，零生产代码改动；不涉门禁。

### 未验证事项
- object.js 消费键与 ir.js 白名单逐项可达性（宽松校验，置信高未逐项跑）；FR 隐藏行列 API 未研究；官方 API 文档未联网抓取（以 demo 账本+生产 CPT+jar 类面为证据源）。

### Commit
（见本条提交。）

### 下一项工作
B 类优先：R3-1 ReportSpec 条件高亮 + 静默丢弃修复。

## 2026-11-06 C1/C2（A/B/C/D 顺序执行 · C 类）

### 目标
C1 与已构造的 TemplateId/Theme 同族补 TemplateInfoAttrMark；C2 隐藏行列研究 API+实现+验证。

### 代码证据
- C1：probes/probe_ti.js 反射 `com.fr.base.iofile.attr.TemplateInfoAttrMark` → ClassNotFoundException；生产参考 3D翘曲 cpt 实际 class=`com.fr.plugin.cloud.analytics.attr.TemplateInfoAttrMark`（cloud 插件包）。按范围圈定（com.fr.plugin.cloud.*=插件配置类，noncore）→ **非缺口，不实现**。
- C2：初版将 hide 应用在块构建前 → 引擎 DIAG RowHeight[1]=304800（被 header 块 setRowHeight 覆盖）；改为 sheet 构建末应用后 RowHeight[1]=0。

### 实施
- lib/object.js：每 sheet 块循环结束后，对 sIR.hideRows/hideCols 执行 setRowHeight/setColumnWidth(FU.getInstance(0))。
- lib/ir.js：sheets[].hideRows/hideCols 非负整数数组闸。
- lib/spec_validator.js + spec_compiler.js：SHEET_KEYS 加 hideRows/hideCols + makeSheet 直通。
- 载体：reports/test_hidden.js（rawIR）、examples/report-spec/hidden.json（spec）。
- verify/fast_report_spec.js：+4 断言（零误报/非整数拒/非数组拒/compile 直通）。

### 验证结果
- rawIR 载体：failures=0，全阶段 passed，RowHeight[1]=0、ColumnWidth[1]=0；PNG 目检表头行与「计划」列消失。
- spec 载体：failures=0，全阶段 passed，RowHeight[1]=0、ColumnWidth[2]=0；PNG 目检一致。
- 门：fast 5 套件 rc=0；scan_all_specs ok=55 bad=0 skipped=1；默认 spec 基线 MD5=CBEB42E3CE48E46E362B9AE80168026F。

### 未验证事项
- 列表按行号（0 基）语义，与 cells item r 一致；Excel 式"隐藏后仍参与打印边界"未专项验证（PNG 已证视觉消失）。
- C1 的 cloud 插件类未做运行时构造（范围外，无实现意图）。

### Commit
（本条提交。）

### 下一项工作
C3 cell.sort/verifiers 诚实拒记录 → D1 组合图结构探针。

## 2026-11-06 C3 + D1（A/B/C/D 顺序执行 · C3 裁定 / D1 阻塞）

### 目标
C3 cell.sort/verifiers 诚实拒落账；D1 组合图 VanChartCustomPlot 打通到渲染。

### 代码证据
- C3：ir.js 已结构化拒（cell.sort：墙已破但 SortHeader 组合面缺官方语料；write.verifiers：VerifyItem≠Verifier）。240 demo 无 cellSortAttr 非空语料（此前账本）。→ 维持诚实拒，不盲写。
- D1：官方语料 demo/analytics/柱形图变形.cpt 结构 = Plot class=VanChartCustomPlot + VanChartCustomPlotAttr customStyle + CustomPlotList(子 plot) + ChartDefinition/CustomDefinition/DefinitionMapList/DefinitionMap key=column|line。反射得 API：setCustomStyle/setCustomPlotList/setDefinitionProviderMap；DefinitionMap 键为 CustomPlotType 枚举（String→CCE 一手）；CustomDefinition.setCategoryName 存在。

### 实施（实验后回收）
- 依次尝试：①共享 MoreName+VanChart → 部署 cpt 落 MoreName；②CustomDefinition 被 applyChartAttrs 覆盖 → 调整顺序；③String 键 CCE → 改 CustomPlotType.COLUMN/LINE；④categoryName 补齐；⑤column 定义含全列（照抄官方）。部署 cpt 最终与官方结构同构（CustomDefinition/DefinitionMap×3 组/OneValue×2/MoreName×2），但渲染恒为单分类（4 行数据被画成 1 类 6 系列），无线；⑥外层 plain Chart → PNG NPE。
- 按三轮规则暂停并回收生产分支（object.js 留阻塞注释）；载体移至 probes/probe_combo_carrier.js，探针 probe_customplot/2、probe_customtype、probe_customdef/2 留档。

### 验证结果
- D1：构造/序列化 = 部署 cpt XML 与官方同构（静态证据）；渲染 = 未达成（PNG 单分类，见 logs/d1_combo*.log）。
- C3：无代码改动（既定结构化拒 + 本段裁定）。
- 门：fast5 rc=0；scan ok=55 bad=0；基线 MD5=CBEB42E3CE48E46E362B9AE80168026F（回收后复跑）。

### 未验证事项
- D1 重开需「子图系列分配 ConditionCollection(AttrSeriesStackAndAxis)+分类 Present」的可运行语料；D2 vmap 需地图数据模型整包（MapType/MatchResult/GisLayer），本轮只抓 API 面未接线。

### Commit
（本条提交。）

### 下一项工作
D 类封存后进入「审查-修复循环」：独立审查 A/B/C 全量 diff → P1/P2 修复 → 门 → 循环。

## 2026-11-06 审查轮1（独立代理审 A/B/C 全量 diff → P1/P2 修复）

### 审查范围
独立代理（只读）审 A/B/C 提交与 `lib/{ir,object,spec_validator,spec_compiler,report_spec}.js`、verify、examples、schema、docs。返回 2 P1 + 9 P2。

### 修复（本轮处置）
- **P1-A sql 路 conditions/cells/total 静默丢**：spec_validator 对 sql 路三键结构化拒（此前过校验、编译器不发射）。
- **P1-B total.sumCols label 合并区吞 SUM 格**：compiler `span = min(sumCols[].col)`（≥1）；B6 载体重新真引擎跑通，部署 cpt 校验：`合计` c0 无 cs、c1=`SUM(B3)`、c2=`SUM(C3)`，无重叠。
- P2 散点/气泡：validator 改为必需 x/y（category/value 拒），compiler 发射 x/y/bubbleSize，schema 同步 anyOf。
- P2 legend/barInterval 无 IR 闸：IR 新增 legend 键白名单+类型、barInterval 数值闸。
- P2 params 词表宽于编译器：新增 PARAM_KEYS 白名单（与 buildParam 转发面一一对应）、values 数组+标量闸、submit 文案必需；buildParam 补 url/bold/sizePt/allowDecimals/maxValue/minValue 转发。
- P2 total.label 被硬编码、未知键静默：aggregate 分支改用 label；TOTAL_KEYS 白名单；showTotal=false + total 拒。
- P2 多 sheet 契约：IR sheet 名必填唯一（DUPLICATE）；多 sheet + write 结构化拒（挂点不明确）。
- P2 paper 无校验：IR 对 width/height/top/left/bottom/right 数值闸。
- P2 presentation.cells 绝对 r 陷阱：spec_validator 前置拒（块按块序追加，r 必撞游标）。
- P2 声明面漂移：schema 补 params/sheet/conditions/cells/total/chart Van 族与 deco 键；report_spec capabilities 更新（sql chart Van、rows presentation、multiSheet 说明）；IR CAPABILITIES.multiSheet 改纯 token + note；fast_ir_contract 恢复精确等值断言；fast_report_spec 更新 capabilities/镜像 schema 断言并新增 9 条负项。
- P2 docs 事实错误：inventory 隐藏列说明改「完成」列；capability-matrix 隐藏行列/多 Sheet/明确不做 三处更新。

### 验证结果
- fast 15 套件 rc=0（含新增审查轮断言，零 CHECK FAIL）。
- 引擎：sumcols_reg（P1-B 后）failures=0 + cpt 校验无合并重叠；params.json failures=0；默认基线 MD5=CBEB42E3CE48E46E362B9AE80168026F。
- 零误伤扫描：ok=55 bad=0 skipped=1。

### 未验证/延后
- manifest 未新增 hideRows/hideCols/conditions/params/cells/sumCols/rowSpan 行（对账器 KEY_OF 同步属同一改动，避免半接线）→ 记 backlog。
- vscatter 的 spec→compile 全链未在 fast 离线覆盖（需 deps 模型桩）；validator/IR 闸两侧已覆盖。

### Commit
（本条提交。）

### 下一项工作
审查轮2：复审本轮修复 diff（重点 spec_validator SQL 拒与 compiler labelSpan、IR 新闸），确认无新 P1/P2。

## 2026-11-06 审查轮2（复审 2cf7fce，新独立代理）

### 审查结论
5 项 P2（1 项残留），无 P1。空断言 1 项、新静默丢面 2 项、schema 契约不精确 1 项、散点编译无 fast 覆盖 1 项。

### 修复
- sumCols col=0 与合计 label 同格：IR + spec_validator 前置拒（UNSUPPORTED_CAPABILITY）。
- 空断言：B6 span 断言改用 3 列（2 维+1 度）spec，断言 span===1 且 ≠n-1（2 列下新旧同值，无法区分）。
- 非散点 kind 的 x/y/bubbleSize：spec_validator 结构化拒（编译器只在散点分支发射）。
- schema chart：anyOf → if(kind in vscatter|vbubble)/then(require x,y)/else(require category,value)。
- 散点编译链：fast_report_spec 用 stub deps{model,SqlBuilder} 编译并断言 x/y 发射、无 category/value、产物过 Ir.validate 零误报。
- 残留：legacy barInterval 无 legend 时 object 会丢 → IR INVALID_SHAPE 拒；带 legend 零误报断言。

### 验证结果
- fast 15 套件 rc=0；默认基线 MD5=CBEB42E3CE48E46E362B9AE80168026F；scan ok=55 bad=0。

### 未验证
- 散点 spec 的真实 SQL 引擎链（stub deps 只覆盖编译形状；IR validate 已零误报）。

### Commit
（本条提交。）

### 下一项
审查轮3：复审本轮 5 项修复是否引入新问题；若无 P1/P2 则审查循环收敛。

## 2026-11-06 审查轮3（收敛轮）

### 结论
复审 084985d：轮2 的 5 项 P2 全部关闭（含空断言已可失败、sumCols col0 双闸无重复报错、barInterval 与 object 真值一致、schema if/then/else 方向正确、stub-deps 散点编译真正走 isScatter 分支）；**未发现新 P1/P2，审查循环收敛**。残留 3 项为宽松/测试卫生级别，记 backlog（B-审查3-1/2/3），不属缺陷。

### 验证
- fast 15 套件 rc=0；scan ok=55 bad=0；基线 MD5=CBEB42E3CE48E46E362B9AE80168026F（084985d 时点）。
- 补跑 B1/B3 载体：hl_conditions / cells_extras 真引擎 failures=0。

### 状态
- 工作区干净；最后提交 084985d（本轮仅文档 backlog/log 追加后再提交一次）。
- 下一轮可直接续：manifest 补 7 行（B-审查1-1）→ D1 重开需子图系列分配语料；D2 独立工单。

## 2026-11-06 backlog B-审查1-1：manifest 补 B/C 新能力行

### 目标
消除能力权威表对 B/C 新能力的沉默（审查轮1 P2 的收尾项）。

### 实施
- application/capability_manifest.js 新增 6 行：
  - sheet.hideRowsCols（四层 verified/scope rendering；evidence test_hidden + PNG 目检 + hidden.json + fast C2）
  - cells.rowSpan（四层 verified/scope rendering；agentOverride=false——ReportSpec 无入口）
  - spec.rows.conditions（四层 verified/scope rendering；hl_conditions PNG）
  - spec.rows.cells（construction/serialization/regression verified，rendering=pending——未专项目检）
  - spec.rows.sumCols（四层 verified/scope rendering；部署 cpt 无合并重叠 + PNG 合计 120/105 目检）
  - spec.params.panel（rendering=serialization-only——面板为 web 交互；scope serialization）
- verify/fast_manifest_evidence.js KEY_OF 同步 6 键。
- backlog 移除该项（标记完成）。

### 验证结果
- fast 15 套件 rc=0；首跑暴露 scope=rendering 缺渲染证据（sumCols evidence 无 PNG 字样）→ 补真 PNG 目检后转绿（非改断言迁就）。

### 未验证/边界
- spec.rows.cells 的渲染层仍 pending（本轮未看 cells_extras PNG）；spec.params.panel 静态 PNG 不现形（官方同口径）。

### Commit
（本条提交。）

### 下一项
D 类：D1 重开需子图系列分配 ConditionCollection 语料；D2 vmap 需地图数据模型整包（独立工单）。或按 coverage/backlog 取证下一项。

## 2026-11-06 路线图第 4 项（P1）：合计行非 sum 聚合

### 目标
按 capability-matrix §4 第 4 项：IR aggregate.fn 白名单扩展 + object 构造 + 合计行 PNG 真值对拍。

### 实施
- lib/ir.js：AGG_FNS = sum|avg|count|min|max|ratio；ratio 形态用 {num,den}（禁列 0，label 占 c0）；sumCols 逐格 fn 白名单 sum|avg|count|min|max（ratio 走 formula）。
- lib/object.js：total 分支函数映射 SUM/AVERAGE/COUNT/MIN/MAX；aggregate ratio 生 =SUM(num)/SUM(den)；sumCols 按 sc.fn 选公式（sc.formula 优先）。
- lib/spec_validator.js：presentation.total.sumCols[].fn 白名单。
- 载体：reports/test_total_agg.js（avg/count/min 三列）、reports/test_total_ratio.js（ratio 两列）。
- 测试：fast_ir_contract +9（正/负/ratio 形态）、fast_report_spec +3（fn 零误报/越词表拒/编译直通）。
- manifest 新增 spec.rows.totalAgg 行（四层 verified，scope rendering）+ KEY_OF "type: 'total'"。

### 验证结果
- 真引擎：两载体 failures=0；部署 cpt 公式 =AVERAGE(B3)/=COUNT(C3)/=MIN(D3) 与 =SUM(B3)/SUM(C3)。
- PNG 像素：合计聚合行 60.0 / 2 / 35；比率行 1.14（120/105）。
- fast 15 套件 rc=0；scan ok=57 bad=0 skipped=1；基线 MD5=CBEB42E3CE48E46E362B9AE80168026F。

### 未验证/边界
- 仅覆盖合计行聚合；ReportSpec metrics.aggregation 词表仍 sum（明细列聚合语义未扩，非本项验收面）。
- ratio 合计用 num 列 format（比率列格式需业务侧在 num 列或 sumCols formula 上控制）。

### Commit
（本条提交。）

### 下一项
matrix §3.1 剩余：chart.seriesBorder/seriesImage/vpie summary 视觉验证（P3）；或 D2 vmap 独立工单。

## 2026-11-06 Planner 链路收尾：params/sheet 透传

### 目标（P2 Agent 真实链路）
检查新 spec 字段能否从 plan 动词到达 reportSpec。证据：semantic/planner/planner.js 两分支只透传 presentation，`intent.params`/`intent.sheet` 被静默丢——Agent 走 plan 时 B2 参数面板与 C2 隐藏行列不可达。

### 实施
- planner.js rows/sql 两分支：`intent.params`/`intent.sheet` 原样透传进 spec（形状仍交 SpecValidator；非法键→rejected，不静默）。
- verify/fast_planner.js +6：rows params/sheet 透传且 ready、非法 params/sheet→rejected、sql params 透传且 ready。

### 验证
- fast_planner failures=0；fast 15 套件 rc=0。

### 未验证
- plan→create 端到端产物（golden e2e intent 未含 params/sheet）未跑；契约层已证。

### Commit
（本条提交。）

### 下一项
剩余大项：多 Sheet 进 ReportSpec（P2 高成本）、跨数据集关联（P2）、D2 vmap（独立工单）、D1 重开（缺系列分配配方）。

## 2026-11-06 复审修复：合计聚合 6 P2 + spec 通道补齐

### 复审发现（独立代理，0402cfc/4c879b6）
6 项 P2：列号非整数/0 未统一拒；fn+formula 静默忽略；sumCols 重复列未拒且测试反成反例；ratio 格式依赖分子列头（整数格式吞小数）；total 前无 detail 时公式引用 B0 假绿；manifest 称四层 verified 但只有 rawIR 载体、ratio 无 spec 通道。

### 修复
- IR：aggregate/sumCols 列号 0→UNSUPPORTED、非整数/越界→INVALID_NUMBER、重复列→DUPLICATE、fn+formula→互斥、sumCols+aggregate→互斥、aggregate.format 字符串闸。
- object：total 前无 detail 抛错；aggregate.format 优先于表头格式。
- spec：TOTAL_KEYS 加 aggregate；sumCols item 键白名单 {col,fn,formula,format,align,bold,bg,sizePt}；aggregate 同 IR 词汇（sum|avg|count|min|max|ratio，ratio={num,den,format}）；互斥/重复/列号同闸。
- compiler：total.aggregate 直通 + span=聚合落点最小列（label 不吞格）。
- 新 spec 载体：examples total_agg.json（sumCols fn=avg→=AVERAGE(B3)，PNG 平均 60.0）、total_ratio.json（aggregate ratio→=SUM(B3)/SUM(C3)，PNG 1.14）；rawIR ratio 载体改用 aggregate.format 并把表头格式还原 #,##0，证明格式来源。
- 测试：fast_ir_contract 负项扩到 12（col0/小数/越界/重复/fn+formula/互斥/format 类型）；fast_report_spec +8（aggregate 零误报/未知键/互斥/重复/fn+formula/编译直通）。
- manifest：spec.rows.totalAgg evidence 补 spec 载体与 PNG；KEY_OF 改 "fn: '"（可检 fn 回归）。

### 验证
- 四载体真引擎 failures=0（raw agg/ratio、spec agg/ratio）；部署 cpt 公式与 PNG 如上。
- fast 15 套件 rc=0；scan ok=57 bad=0；基线 MD5=CBEB42E3CE48E46E362B9AE80168026F。

### 未验证
- ratio 分母为 0 的运行期行为（引擎除零显示）未专项探针；业务侧应保证 den 非零或加条件。

### Commit
（本条提交。）

## 2026-11-06 复审轮2 修复：spec aggregate 通道 2 P2

### 发现（独立复审 1f69589）
A. compileRows 的 span/落点未受表宽约束：2 列表格写 aggregate col=2 会 ready 并产出表外合计格。
B. 形态互斥键被静默忽略：fn:'ratio' 带 col、非 ratio 带 num/den、raw IR 的拼写错键（fromat）都绿着不生效。

### 修复
- lib/ir.js：aggregate 键白名单 {fn,col,num,den,format}；ratio 禁 col；非 ratio 禁 num/den。
- lib/spec_validator.js：同形态互斥闸（AGK 白名单已在）。
- lib/spec_compiler.js：sumCols.col / aggregate 落点 >= n（表宽）编译期抛错；aggregate span = max(1, min(落点, n-1)) 不越界。
- 测试：fast_ir_contract +3（未知键/ratio+col/非ratio+num）；fast_report_spec +4（同比 + 两条编译期超宽拒）。

### 验证
- fast 15 套件 rc=0；spec 两载体重跑 failures=0；scan ok=57 bad=0；基线 MD5=CBEB42E3CE48E46E362B9AE80168026F。

### Commit
（本条提交。）

## 2026-11-06 复审轮3 收敛 + 前置宽度校验

### 结论
独立复审 db8510a：无新 P1/P2，合计聚合审查循环**收敛**。唯一非阻塞观察：落点超表宽在 SpecValidator 通过、create 期才抛（与 chart 列检查同型，fail-closed）。

### 顺手闭环
- lib/spec_validator.js：rows 路表宽 = 维度+度量数；sumCols/aggregate 落点 >= 表宽 → INVALID_NUMBER（plan 期即拒，不再 ready→create 才炸）。compile 期 throw 保留为二道防线。
- fast_report_spec +2（spec 前置拒）。

### 验证
- fast 15 套件 rc=0；三个 spec 载体重跑 failures=0（total_agg/total_ratio/sumcols_reg）。

### Commit
（本条提交。）

## 2026-11-06 多 Sheet 进 ReportSpec（A1 产品化）

### 目标
A1 后端多 sheet 已通，但 ReportSpec/Planner 无入口（manifest page.multiSheet agentAvailable=false）。补 rows 路 spec 入口。

### 实施
- ReportSpec 新键 `extraSheets[]`（rows-only）：每项 {name, dimensions, metrics, dataset:{rows}, presentation, sheet}。
- spec_validator：extraSheets 数组/对象/未知键/name 必填唯一（保留 sheet1 给基表）；sql extra 结构化拒；内部复用主校验（合成 spec 递归 + 错误路径前缀 extraSheets[i].）。
- spec_compiler：compileRows 支持 opts{dsName,sheetName}；compile 合并 extraSheets → 追加 sheet + 独立数据集 ds2..，块 dataset 引用随 dsN；extra 标题缺省用 sheet name（否则 IR title text 空被拒——首跑实测）。
- planner：rows/sql 两分支透传 intent.extraSheets（非法形态仍由 SpecValidator rejected）。
- schema：extraSheets 镜像；report_spec capabilities 更新；ir.js CAPABILITIES.multiSheetNote 更新。
- 载体：examples/report-spec/multisheet.json（汇总+明细）。
- 测试：fast_report_spec +8（零误报/重名×2/sql 拒/内部未知键前缀/extra 未知键/编译两 sheet 两数据集+Ir.validate）；fast_planner +2（透传 ready / 重名 rejected）。

### 验证
- 真引擎：multisheet.json failures=0；部署 cpt `<Report>`×2、WorkSheet×2、ds2 引用；PNG 目检「汇总」「明细」两页。
- fast 15 套件 rc=0；scan ok=57 bad=0；基线 MD5=CBEB42E3CE48E46E362B9AE80168026F。

### 未验证/边界
- SQL 基表 + extraSheets 不受理（extra sql 拒），SQL 基表 + rows extra 组合未单测（编译器支持，基表 sql 的 deps 链未跑）；plan→create e2e 未跑，manifest page.multiSheet 仍 agentAvailable=false（R3-0 口径）。

### Commit
（本条提交。）
