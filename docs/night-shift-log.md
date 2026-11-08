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

## 2026-11-06 多 Sheet spec 复审修复（1 P1 + 4 P2）

### 发现
P1：SQL 基表 extraSheets 被 validator 提前 return 绕过（planner 透传后 ready→create 才炸/语义丢失）；P2：extra sheet.watermark/toolbar 过校验但被丢；base dsName 与 ds2 冲突；seenSheet 原型链键误判；schema/report_spec 文案与代码矛盾。

### 修复
- spec_validator：extras 校验抽成 validateExtraSheets，rows/sql 两分支都调用（P1）；extras 拒 watermark/toolbar（workbook 级仅基表）；extraSheets 存在时拒手写 dsName；seenSheet 用 hasOwn。
- ir.js：sheetNames 重复判定改 hasOwn（同类原型链隐患）。
- schema：x-scope.multiSheet 与 extraSheets.sheet 描述更新；report_spec multiSheet 文案改为 rows 支持 + planner 已透传。
- 测试：fast_report_spec +7（sql 基表合法/非法 extra 前缀、watermark/toolbar 拒、dsName 拒、constructor 名不误判 + 编译过 Ir.validate）。

### 验证
- fast 15 套件 rc=0；multisheet 载体重跑 failures=0；baseline MD5 精确；scan ok=57 bad=0。

### Commit
（本条提交。）

## 2026-11-06 多 Sheet 复审轮2：__proto__ 键假阴修复

### 发现（独立复审 c3b925f）
P2：hasOwn 修复把 '__proto__' 的假阳翻成假阴——`seenSheet['__proto__']=1` 走原型 setter 不建自有属性，第二个 '__proto__' 同名 sheet 不被拒，IR 同样漏判，wb.addReport 静默覆盖（正是该闸要防的）。

### 修复
- spec_validator.validateExtraSheets：seenSheet 改 Object.create(null)（预置 sheet1）。
- ir.js：sheetNames / seenDs 同改 Object.create(null)（数据集名同风险）。
- 测试：fast_report_spec +1（两个 '__proto__' extra → DUPLICATE）；fast_ir_contract +1（两个 '__proto__' sheet → DUPLICATE）。
- 另补 SQL 基表 + rows extra 的 stub-deps 编译覆盖（2 sheet/2 数据集 + Ir.validate 零误报）。

### 验证
- fast 15 套件 rc=0；multisheet 载体重跑 failures=0；baseline MD5 精确；scan ok=57 bad=0。

### 未验证
- 其余以对象字面量为 map 的键（params name 等）未见同名风险模式；若后续新增名称类 map，统一用无原型表。

### Commit
（本条提交。）

## 2026-11-06 名称 map 无原型加固（同类模式收尾）

### 背景
多 Sheet 轮2 修了 sheetNames/seenSheet/seenDs 的 '__proto__' 假阴；同一模式还在 params 名、数据集索引、param filter 引用表中存在。

### 实施
- spec_validator：params seenNames → Object.create(null)（两个 '__proto__' 参数名现 DUPLICATE）。
- ir.js：dsIdx（数据集名索引）、pnames（param.widgets 名 → filters.parameter 引用）→ Object.create(null)。
- 测试：fast_report_spec +1（params __proto__ 重复拒）；fast_ir_contract +1（参数名 __proto__ 可被 filters 引用，无 UNKNOWN_REF）。

### 验证
- fast 15 套件 rc=0；baseline MD5 精确；scan ok=57 bad=0。
- 多 Sheet 复审终评：converged（32293bd）。

### Commit
（本条提交。）

## 2026-11-06 barInterval 宿主精确化（backlog B-审查3-2 完成）

### 证据
- 反射 probe_barinterval_hosts：setCategoryIntervalPercent 仅 Bar2DPlot 与 VanChartColumnPlot 有。
- 部署 cpt 对照：legacy bar 载体（kind=bar, barInterval=25）XML 零命中 categoryIntervalPercent；vbar 载体 XML 命中 "25.0"。
- 结论：真正可见宿主只有 vbar（legacy setter 在但 writer 不落）。

### 实施
- IR：barInterval 仅 kind=vbar 放行，其余（bar/pie/line/vline/varea/scatter/bubble/vpie/vgauge）INVALID_SHAPE。
- object：调用点保留 setter 存在性守卫（不再用 (van||legend) 猜）。
- reports/rebuild_first.js：移除从未落 XML 的 legacy barInterval 伪键。
- 载体：reports/test_barinterval.js（vbar, barInterval 25 → 部署 cpt categoryIntervalPercent="25.0" 一手）。
- 测试：fast_ir_contract 更新 4 条（legacy bar/pie/varea 拒、vbar 零误报）。
- backlog B-审查3-2 标记完成。

### 验证
- 引擎：test_barinterval failures=0，XML categoryIntervalPercent="25.0"。
- fast 15 套件 rc=0；scan ok=58 bad=0；基线 MD5 精确。

### 边界
- legacy Bar2DPlot 的 setter 面存在但序列化不落，属引擎 writer 行为；若未来 FR 版本落 XML，可重新评估放行 bar。

## 2026-11-06 seriesImage 判别实验 + 载体 J 覆盖修复

### 发现
reports/test_visual_deco.js 顶部 `var J = Files class` 覆盖 make_api 全局 J(n) 工厂 → 管线在 make_api:273 TypeError（rc=102，fail-closed）。此前该载体标注的"PNG 目检"证据已不可复跑（P1 测试 bug）。

### 实施
- 载体局部变量改名 JF，不再覆盖全局 J。
- seriesImage 判别 fixture：由纯色（0x77BBFF，与默认柱色同色、不可判定）改为 16×16 品红/白棋盘，每次运行重建。
- legacy 第二图加 title:'' 抑制引擎默认标题噪声。
- manifest chart.seriesImage evidence 更新为棋盘格实验结论。

### 验证
- 真引擎：test_visual_deco failures=0；部署 cpt ImageBackground×2 / AttrSeriesImageBackground×1；PNG 目检柱体仍为纯蓝（棋盘未现形）→ rendering 维持 pending（证据从"无法判定"升级为"判别性阴性"）。
- fast 15 套件 rc=0；scan ok=58 bad=0。

## 2026-11-06 管线全局覆盖守卫（载体类测试 bug 的系统性封口）

### 背景
test_visual_deco 用 `var J = Java.type(...)` 覆盖 make_api 同作用域全局 J(n) 工厂 → make_api:273 TypeError（rc≠0 但堆栈难读）。全量扫 reports/ 确认仅此一处，probes/ 的 J 定义是各自独立脚本、不被 make_api load。

### 实施
- make_api.js：`J_FACTORY` 快照 + load 后守卫——`J` 被覆盖即 input_load failed、诊断写明"use a local name, e.g. var JF"、fail-closed 退出（不再裸 TypeError）。
- 负门实测：临时载体 `var J = 1` → CARRIER GLOBAL CLOBBER + diagnostics + exit 2（日志 clobber_neg.log）；临时文件已删除。

### 验证
- fast 15 套件 rc=0；基线 MD5 精确；scan 不受影响（58 ok）。

## 2026-11-06 集成门 + backlog 卫生收尾

### 集成门（make_api 改动后按纪律补跑）
- scripts/run-integration-tests.ps1：INTEGRATION END failures=0 / GATE GREEN（S23/S24a-c/S25/S26/S28/S27/S27b/S27e 全 PASS，含同 RunId 并发恰好一次引擎、pidfile 故障 fail-closed）。

### backlog B-审查3-3（测试卫生）
- fast_report_spec B6 3 列 span 测试：mutator 内 dataset 改 { rows: [['A','X',1]] }，与维度+度量 3 列一致。

### 验证
- fast 15 套件 rc=0；集成门 GREEN。

## 2026-11-06 多 Sheet plan→create e2e（Agent 链闭环）

### 目标
把 page.multiSheet 从"spec 可写"推到"Agent 全链可用"（R3-0 要求 plan→create 证据）。

### 实施
- 新增 scripts/run-multisheet-e2e.ps1（ASCII-only）+ verify/fixtures/multisheet/intent.json（rows intent：1 基表 + Detail extra + date 参数 + hideRows）。
- 链路：fr_agent plan → plan2spec → create，断言：reportSpec 保留 extraSheets/params；部署 cpt ≥2 `<Report>`、ReportParameterAttr、ds2 引用。
- 首跑暴露真 P1：planner rows 路映射列不带 widthPt → compiler 产出 undefined → IR INVALID_NUMBER。修复：buildColumns widthPt 缺省 110；fast_report_spec +1（缺省补 110 且 IR 零误报）。
- manifest page.multiSheet agentAvailable → true（evidence 写明 e2e GREEN 与 cpt 断言）。

### 验证
- e2e：STEP plan/plan2spec/create OK；5 项 CHECK PASS；MULTISHEET E2E GREEN。
- fast 15 套件 rc=0；baseline MD5 精确；scan ok=58 bad=0。

### 边界
- e2e 覆盖 rows 基表 + rows extra + date 参数 + hideRows；SQL 基表 e2e 未跑（SQL 作为 extra 仍拒）。

## 2026-11-06 D2 地图 vmap（area）接线完成

### 证据/结构
- 官方 doc/Chart/mapfather.cpt：Plot class=VanChartMapPlot + VanChartMapPlotAttr mapType="area" geourl="assets/map/geographic/world/中国.json" zoomlevel="4"；ChartDefinition/VanMapDefinition/areaDefinition class=VanMapMoreNameCDDefinition + attr useAreaName="true"。
- 反射：MapType{AREA,POINT,LINE,CUSTOM,DRILL_CUSTOM}；ZoomLevel.parseInt；ViewCenter.setAuto/Longitude/Latitude；VanMapDefinition.setAreaDefinition；VanMapMoreNameCDDefinition 10 参 CTOR。
- 内置地图资源：WEB-INF/assets/map/geographic/world/中国-area.json（省份全名：广东省/北京市/…）。

### 实施
- object.js：新增 kind=vmap 分支——VanChartMapPlot(setMapType(AREA)/setGeoUrl/zoom/viewCenter) + VanChart/Title + VanMapDefinition.setAreaDefinition(VanMapMoreNameCDDefinition(NameTableData,category,cols,true,'','','','','',null)) + ChartCollection。
- ir.js：CHART_KINDS + vmap；geoUrl 字符串闸、zoom/longitude/latitude 数值闸。
- spec_validator/spec_compiler：CHART_KINDS/CHART_KEYS + vmap/geoUrl/zoom/longitude/latitude 透传（sql 路）。
- 载体：reports/test_vmap.js（广东省/北京市/上海市/黑龙江省/四川省 + 销售额）。
- 测试：fast_ir_contract +3（vmap 零误报/geoUrl/zoom 负项）；fast_report_spec +2（spec 零误报、stub-deps 编译发射 + Ir.validate 零误报）。
- manifest chart.vmap：pending → 四层 verified（scope rendering），agentOverride=false（无省份数据源/无 plan→create e2e）。

### 验证
- 真引擎：test_vmap failures=0；部署 cpt mapType="area"/geourl=中国.json/VanMapDefinition/VanMapMoreNameCDDefinition/useAreaName=true 全命中；PNG 目检中国区域地图着色 + 图例 0..280000。
- fast 15 套件 rc=0；scan ok=59 bad=0；基线 MD5 精确。

### 边界
- 仅 AREA；POINT/LINE/CUSTOM/DRILL_CUSTOM 与 MapMatchResult/地图下钻未接。ReportSpec 仅 sql 路（rows 路不出图）。

## 2026-11-06 D2 vmap 复审修复（1 P1 + 4 P2）

### 发现
P1：geoUrl 自由字符串直入引擎资源流（SimpleWorkResource 无归一化）→ 可 `assets/map/../../x.json` 读任意本地 JSON。P2：vmap 的 axisY/axisX 过 IR 后静默丢（地图无轴）；falsy 默认吞掉合法 0（geoUrl/经纬度/zoom 0）且 ViewCenter 固定中国中心；geo 键未按 kind 归属（bar/vbar 带 geoUrl 绿着丢）；capabilities 的 vanChart/sql.chart 列表漏 vmap（discover 少报）。

### 修复
- IR：geoUrl 白名单 `^assets/map/[^:\]+$` + 禁 `..`/反斜杠/scheme（INVALID_PATH）；zoom 整数 0..21；geo 键仅 vmap（INVALID_SHAPE）；vmap 带 axisY/axisX 拒（INVALID_SHAPE）。
- object：默认值改 `!= null`（0 不再被吞）；经纬度显式给出才 auto=false 锁中心，否则 auto=true 由引擎自适配。
- capabilities：ir.js vanChart + report_spec.js sql.chart 列表补 vmap（并注明 area-only/geoUrl 限制）；fast 固定列表断言同步。
- 测试：fast_ir_contract +6（穿越/绝对/反斜杠/zoom 小数/非 vmap geo/vmap axis）；fast_report_spec 列表断言更新。

### 验证
- 真引擎：test_vmap failures=0（auto=true 后 PNG 仍中国区域着色+图例）；fast 15 rc=0；scan 59 ok；基线 MD5 精确。

## 2026-11-06 D2 扩展：点地图 point + D1 第 4 轮结论

### D1 重开（第 4 轮，结论：不接线）
- 新假设①「SQL 数据集可解分类塌缩」：验证成立——test_combo_sql（stage 分组，COUNT/float）真引擎 failures=0，PNG 见 L/R 两分类分组柱（此前内嵌数据集恒单分类）。
- 新假设②「setDataSheet2PlotList + column/line 拆分绑定可出线」：未成立——column 只含 planned、line 用 done 时，PNG 仍只有 planned 柱、无可见线；官方 柱形图变形.cpt 无头渲染同样只见柱（无可见线）。判定为组合图线系列在无头渲染不可见（或需设计器侧更多条件配置），不接线。
- 实验分支已回收；载体移至 probes/probe_combo_sql_carrier.js；证据 logs/vcustom_sql*.log + logs/_vcustom_official.png。D1 维持「构造/序列化已证、渲染未达成」。

### D2 扩展：point 地图
- 官方 doc/Chart/Map/散点地图.cpt 结构：mapType=point + VanMapDefinition/pointDefinition(VanMapMoreNameCDDefinition, useAreaName) + mapmarkertype（COMMON 散点实测可见）。
- object vmap 分支：mapType 参数（area|point），point 走 setPointDefinition + MapMarkerType.COMMON；默认 zoom point=0/area=4；有经纬度才锁 ViewCenter，否则 auto=true。
- IR：mapType 白名单 area|point（line/custom 未接拒绝）；mapType 仅 vmap；spec/compiler 透传 mapType。
- 载体：reports/test_vmap_point.js（同 5 省份）。
- 测试：fast_ir_contract +3（point 零误报/mapType=line 拒/非 vmap mapType 拒）；fast_report_spec vmap 用例改 point 并断言 mapType 透传。

### 验证
- 真引擎：test_vmap_point failures=0，PNG 目检中国底图 + 散点标记 + 图例 0..280000。
- fast 15 套件 rc=0；scan ok=60 bad=0；基线 MD5 精确。

## 2026-11-06 D2 point 复审修复（2 P2 + 注释）

### 发现
P2：capabilities 文案仍写 vmap(area)/"仅区域图"（discover 少报 point）；object 对非 area/point 的 mapType（line/1/拼写错）静默回落 AREA（IR 拒但 raw Obj.build 调用会丢意图）。P3：object 注释误写 official markerKey=scatter（实际 mapmarkertype=1=COMMON）。

### 修复
- report_spec.js：vmap(area|point) + "line/custom 未接"；inventory D 结论/表格同步 area+point。
- object.js：mapType 非 area/point 直接 throw（fail-closed）；注释订正。
- 测试：fast_report_spec 增 area 缺省（mapType 省略/zoom 4）编译 + Ir.validate 零误报。

### 验证
- fast 15 套件 rc=0；scan 60 ok；基线 MD5 精确。

## 2026-11-06 参数执行期筛选（B2 收尾 / 矩阵 P1 第3项）

### 目标
矩阵验收"spec 可表达 param + 执行期传参筛选真值"：此前 params 只有控件与默认值，无筛选语义。

### 实施
- spec_validator：PARAM_KEYS + filter；filter{column,op?} 键白名单/op 白名单（==|=|!=|>|>=|<|<=|contains）/column 必填/需具名参数（非 label/submit）/sql 路结构化拒（单元格条件仅 rows 路）。
- spec_compiler：compile() 将 params[].filter 汇总为 ir.param.filters（column/op/parameter）。
- 载体：examples/report-spec/param_filter.json（3 行 + editor 默认 A线 + filter line）。
- 测试：fast_report_spec +7（零误报/op 越词/缺 column/未知键/label 拒/sql 拒/compile 发射）。
- manifest：spec.params.filter 四层 verified（scope rendering）。
- matrix：§4 第 3 项标为已实施。

### 验证
- 真引擎：param_filter failures=0；PNG 只渲染 A线 一行（B线/C线 被默认参数筛选掉）——执行期筛选真值。
- fast 15 套件 rc=0；scan 60 ok；基线 MD5 精确。

### 边界
- 仅 rows 内嵌路（sql 路由 validator 拒）；op 语义由引擎 CommonCondition（= $参数）承担；多参数多 filter 逐格叠加未专项 PNG（可后续）。

## 2026-11-06 参数筛选复审修复（5 P2）

### 发现
①filter 与 detail 绑定不严：sql/cells-only 无 detail 时 IR 仍放行（object 不生效）；extraSheets 下只查"任一内嵌数据集"含列，缺列 sheet 会挂空条件。②多 filter last-win（DSColumn 单条件）。③未具名 editor+filter 重复报 REQUIRED name。④manifest 文案 presentation.params[].filter 应为 params[].filter；PARAM_KEYS 注释过时。⑤测试缺口：op 缺省、filter 列 UNKNOWN_REF、__proto__ 列。

### 修复
- IR：filter 仅在有 detail 块时放行（否则 UNSUPPORTED）；列校验改为逐 detail 块数据集（sql 明细列不可静态校验→拒）；多 filter 拒；dsCols 改 Object.create(null)。
- compiler：sql 基表不挂 filters（二道防线）。
- spec：多 filter 拒；filter 名必填只对 label/submit（消除重复诊断）；注释澄清 filter 由 compiler 消费。
- manifest 文案修正。
- 测试：fast_report_spec +1（多 filter）+op 缺省断言；fast_ir_contract +3（__proto__ 列 UNKNOWN_REF/多 filter/无 detail 拒）。

### 验证
- 真引擎 param_filter failures=0（默认 A线 过滤仍生效）；fast 15 rc=0；scan 60 ok；基线 MD5 精确。

## 2026-11-06 参数筛选复审终评：converged

- 独立复审 eaccfab：5 项 P2 全部关闭，无新 P1/P2，参数筛选审查循环收敛。
- 当前 HEAD 门：fast 15 rc=0 / scan 60 ok 0 bad / 基线 CBEB42E3CE48E46E362B9AE80168026F。
- 本轮大干连续交付：多 Sheet e2e、合计非 sum 聚合、D2 地图 area+point、参数执行期筛选、D1 第4轮结论（不接线）、以及各轮复审修复。
- 下一轮候选：D3 热力/图片地图（官方 网页热力图 结构待探）、D4 ChartHyperRelateCellLink、page.freezeWeb、write.submit（外部 DML 风险）、多 Sheet SQL extra（需 make_api deps 扩展）。

## 2026-11-06 收口 C3：spec.params.filter 证据口径（选 B：agentOverride=false）

### 问题证据
- application/capability_manifest.js `spec.params.filter` 原为四层 verified 且 agentAvailable=true（缺省四层推导）——但证据只有「默认参数值过滤」载体（examples/report-spec/param_filter.json 默认 A线 → PNG 只渲染 A线 行）。Web 交互改参数后重查询（静态 PNG 无法证明）与 plan→create 链路均无证据，agentAvailable=true 属夸大。

### 实施
- manifest：spec.params.filter 加 agentOverride=false；evidence 拆明「已验证=默认参数值过滤 / 未验证=Web 交互改参后重查询、plan→create」。
- README #140 行同步口径；本条留账。不改 validator/compiler/object 任何代码（纯证据口径）。

### 验证
- fast_manifest_evidence 真跑 failures=0（README #140 引用存在、fast_report_spec 存在、rendering scope 有 PNG 字样）。
- 未跑：引擎级交互验证（属 Web 行为，静态管线不可达）——如实标注。

### 边界/未验证
- Web 交互改参后重查询、plan→create（filter 路径）两项仍未验证；后续若补 e2e 需带交互步骤或引擎参数注入。

## 2026-11-06 收口 C4：多 Sheet E2E 证据口径拆分

### 问题证据
- application/capability_manifest.js page.multiSheet 原证据把两类证据并成一句「A1+多Sheet spec+e2e…plan→create e2e GREEN」；scripts/run-multisheet-e2e.ps1 与 README #135 同口径——未区分「载体渲染证据」与「e2e 结构链路证据」，读起来像 e2e 证明了渲染真值。

### 实施（只改口径，不改代码/测试）
- manifest page.multiSheet evidence 拆两段：载体=Object/CPT/渲染（test_multisheet + examples/report-spec/multisheet.json 真引擎 failures=0、部署 cpt 2 <Report>、PNG 汇总/明细两页目检）；e2e=仅结构链路（plan→plan2spec→create 保留 extraSheets/params + cpt 结构断言），明示不证明逐格真值/第二 Sheet 视觉/hideRows/hideCols 生效。
- scripts/run-multisheet-e2e.ps1 头注释加 SCOPE 段（ASCII-only）。
- README #135 行同步；本条留账。

### 验证
- fast_manifest_evidence 真跑 failures=0（scope=rendering 证据含 PNG 字样、carrier test_multisheet 存在、README 引用存在）。
- run-multisheet-e2e.ps1 本身复跑归 V1。

## 2026-11-06 收口 C5：五处能力账本同步 + backlog 清账

### 问题证据（对账发现的不一致）
- inventory §3 B 类表 8+ 行仍标 ✗（条件高亮/参数面板/cells/页眉页脚/rowSpan/sumCols/图表装饰/reg），实际 B1–B6 已接；§7 建议仍写「R3-1→R3-2 原路线不变」。
- matrix：#58 合计聚合 ✗、#62 参数面板 ✗、#63 静默丢 ✗、#77 vmap ✗、#100 多Sheet agentAvailable=false（e2e 未跑）、#118 条件高亮 ✗、#119 planner 墙 ~、#131 多Sheet rejected、#156 条件高亮待办、#160 「明确不做 vmap」——全部过期。
- **实质口径修正（probe 实证）**：manifest cells.rowSpan 写「ReportSpec 无入口」不实——presentation.cells 无绝对 r 的 rowSpan item 可表达 rowSpan（SpecValidator 零误报→compile IR rowSpan=2→Ir.validate 零误报，/tmp 探针实跑）；正确拒因=plan→create 无 rowSpan 证据。agentAvailable=false 维持，理由改写。
- backlog：R3-1/2/3/4/5/6/7/8/9/11 全部已完成仍挂在「最高优先/进行中」。

### 实施
- inventory：§3 B 类表逐行改现状态+证据；结论改「已清空，剩 rowSpan plan→create 证据/多 filter AND/SQL extra 三处显式边界」；§2 多Sheet 行加 C4 口径；§7 策略表改已完成态。
- matrix：1.1 rowSpan 行、1.2 合计聚合/参数面板/静默丢行、1.3 vmap/组合图（D1 blocked 第4轮）行、1.5 多Sheet 行、1.6 条件高亮/planner 墙行、§2 多Sheet 行、§3.1/3.2、§4 前三行、§5.3 口径注——全部同步（Python 显式 UTF-8 逐字替换，写后读回验证无果酱）。
- report_spec.js capabilities：rows 加 params/sheet 字段、presentation 补 total.aggregate 词表；multiSheet 注加 C4 口径。
- ir.js CAPABILITIES：sheet.multiSheetNote+hideRowsCols；block.total/cells 注（aggregate 词表、rowSpan+ds+rowSpan 拒）；param.filter（C3 口径）；chart.vmap（area|point/line 拒/agentAvailable=false）。
- manifest：cells.rowSpan evidence 改口径（spec 可表达+plan→create 缺证据）。
- backlog：B 类清空+剩余边界；A/C/D 类完成项划线留档；矩阵路线图 R3-1..R3-4 划线注完成（R3-4=本轮 C6）。

### 验证
- fast 15 套件 rc=0（含 fast_report_spec capabilities 断言、fast_ir_contract capabilities 断言、fast_contracts 引证规约、fast_manifest_evidence 静态一致）。
- scan：ok=60 bad=0 skipped=1（rebuild_basicA 缺本地产物 skip，与历轮口径同）。
- 未跑：引擎门归 V1 统一复跑。

## 2026-11-06 收口 V1：全门复跑（475722d 后全局收口收尾）

### 复跑结果（本轮真实执行记录）
- fast 15 套件：FAST GATE GREEN（C1/C5/C4 后各复跑一轮；最终 HEAD 一致）。
- 零误伤扫描：`nashorn Shell probes/scan_all_specs.js` → SCAN END: ok=60 bad=0 skipped=1（rebuild_basicA 缺本地产物 skip，历轮同口径）。
- 引擎负门：`scripts/run-engine-negative-tests.ps1` → 5 路 NEG GATE OK（ir-bad exit9 / db-conn exit4 / secret-leak exit1 / exec-formula exit1 / json-bad-spec exit2）+ ENGINE NEG GATE GREEN（末步默认 spec 回补）。
- 默认基线：demo_api.cpt MD5 = CBEB42E3CE48E46E362B9AE80168026F（逐字节精确）。
- Golden E2E：`scripts/run-golden-e2e.ps1` → plan/plan2spec/create/validate/truth-grid/preview/modify 全 OK，无 SKIP；GOLDEN E2E PASS（runId=ge20261106233909-f88a9a；10 行逐格+总计 33531:26531；modify diffClean+原件保留）。
- 多 Sheet E2E：`scripts/run-multisheet-e2e.ps1` → plan/plan2spec/create OK + 5 项 CHECK PASS，无 SKIP；MULTISHEET E2E GREEN（口径=C4：结构链路）。
- C2 object 二道防线实机验证：新增 probes/probe_c2_dsrowspan_guard.js（绕过 Ir.validate 直调 Obj.build）→ 真引擎 C2 GUARD OK（throw 消息含 ds+rowSpan/putDSCell 不合并），exit 0。快测无法覆盖 object 运行时（需 FR 类），故以此探针补证。

### 本轮（475722d 后全局收口）提交链
- dce619d C1 dataset 契约严格化（kind 词表/键白名单/dims+metrics 白名单；先红8后绿）
- 2ac0125 C2 DSColumn+rowSpan 拒绝（IR 结构化拒+object 二道防线；先红3后绿；探针实机证守卫）
- 5f19086 C6 planner deferred 聚合累计阻断（先红2后绿；ready 用例零回归）
- 65ba4c7 C3 spec.params.filter agentOverride=false 证据口径
- d35941a C4 多 Sheet 证据拆分（载体渲染 vs e2e 结构）
- c57362e C5 五处账本同步 + backlog 清账（含 rowSpan「spec 可表达」口径修正，probe 实证）

### 未验证/边界（如实）
- spec.params.filter 的 Web 交互改参后重查询、plan→create（filter 路径）仍未验证（C3 已如实标注 agentAvailable=false）。
- rowSpan 的 plan→create 链路证据仍缺（agentAvailable=false 维持）。
- seriesBorder/seriesImage/vpie summary 视觉、vmap plan→create、poly/heatmap/D1 组合图：维持既有 pending/blocked，不在本收口范围。

## 2026-11-07 00:35（A段：独立复核上一轮九项验收 + 基线守护修复）

### 工作目标
独立复核 C1/C2/C6/C3/C4/C5/V1 逐条实测（读文件+跑命令），不符即修。

### 复核结果（逐条，全部本轮实跑）
- **C1**：lib/spec_validator.js dataset.kind 词表闸 + SQL_DS_KEYS 键白名单 + dims/metrics item REF_KEYS 白名单，代码在（grep 实证）；fast_report_spec 断言随 fast15 GREEN。
- **C2**：lib/ir.js:556 ds+rowSpan UNSUPPORTED_CAPABILITY 结构化拒 + lib/object.js:1048 二道防线 throw + probes/probe_c2_dsrowspan_guard.js 在库（a0bb41f 实机 GUARD OK 留账）；fast_ir_contract 断言随 fast15 GREEN。
- **C6**：semantic/planner/planner.js:129-179 blockedMetrics 累计阻断（aggregation verdict!=supported 与术语 deferred 计数，status 不 ready）；fast_planner 断言随 fast15 GREEN。
- **C3**：manifest spec.params.filter agentOverride=false，evidence 明示已验证=默认参数值过滤/未验证=Web 交互改参与 plan→create；README #140 同口径。
- **C4**：manifest page.multiSheet evidence 载体/e2e 两段拆分；scripts/run-multisheet-e2e.ps1 头部 SCOPE 注释；README #135 同口径。
- **C5**：inventory §3 B 类「已清空」+§7 策略表完成态；matrix D1 第4轮 blocked/多Sheet/条件高亮行全改；report_spec.js rows 补 params/sheet 词表+multiSheet C4 注；ir.js CAPABILITIES multiSheetNote+hideRowsCols；manifest cells.rowSpan 口径修正；backlog R3-1..R3-11 划线完成。五处一致，fast_manifest_evidence/fast_contracts 断言随 fast15 GREEN。
- **V1 全门（本轮全部真跑）**：fast15 rc=0 FAST GATE GREEN；scan `runraw.ps1 -Script probes/scan_all_specs.js` → SCAN END ok=60 bad=0 skipped=1（rebuild_basicA 缺本地产物 skip，历轮同口径）；引擎负门 `scripts/run-engine-negative-tests.ps1` → 5 路逐 exit/JSON/stage 断言 + ENGINE NEG GATE GREEN；基线 MD5=CBEB42E3CE48E46E362B9AE80168026F；Golden E2E PASS（ge20261107002327-d5acdf，10 行逐格+总计 33531:26531+modify diffClean+原件保留）；MULTISHEET E2E GREEN（5 CHECK PASS）。

### 不符项（发现即修，1 项）
- **基线铁证被踩未恢复**：本会话开工时 demo_api.cpt MD5=d6c74917…（内容=2 `<Report>`+ds2 的 multisheet 结构）≠ 基线 CBEB42E3。根因（代码证据）：make_api.js:284 `localCpt = Paths.root + '/demo_api.cpt'` 无条件把本轮 spec 产物写进基线文件；负门脚本有「末步默认 spec 回补」RESTORE 步，而 run-golden-e2e.ps1 与 run-multisheet-e2e.ps1 的 create 步都经 make_api 跑、结束时却无回补——上一轮 00:00 的 multisheet e2e 收尾后基线就此被踩。复跑 multisheet e2e 实验再次踩踏（00:19 MD5 回落 d6c74917）确证。
- **修复**：两 e2e 脚本各补「末步 run.ps1 -Script make_api.js 回补 + Get-FileHash MD5=CBEB42E3 断言（失败计入 $fails）」，与负门 RESTORE 同款惯例（AGENTS §1「最后一步必须用默认 spec 收尾」的机械化）；verify/check_ps1_static.ps1 failures=0。补丁后复跑两 e2e：MULTISHEET GREEN+基线 cbeb42e3 自动恢复、GOLDEN E2E PASS+基线保持——守护闭环实证。

### 未验证/边界（如实）
- C2 探针本轮未重跑（a0bb41f 已实机留账，本轮只验文件在库+IR/object 代码在）；如需可随时 `runraw.ps1 -Script probes/probe_c2_dsrowspan_guard.js` 复跑。
- C3 的 Web 交互改参与 plan→create（filter 路径）、rowSpan plan→create 证据：维持 agentAvailable=false 口径，未变。

### Commit
（本条提交，含 scripts/run-golden-e2e.ps1 + scripts/run-multisheet-e2e.ps1 修复。）

### 下一项工作
B段：全面代码审查（编译链/静默丢弃/组合缺陷/能力差距/安全面）→ P0-P3 清单 → 按最高价值逐项演进。

## 2026-11-07 01:00（B段：全面代码审查 P0-P3 清单 + 三项演进收口）

### 审查范围与方法
真实代码调用链逐文件读（非架构图）：make_api.js 全文 / lib/{spec_validator,spec_compiler,ir(关键段),object(关键段),cpt,browser 垫片} / semantic/{planner 全文,query/sqlbuilder 全文,model/validator(关键段)} / agent/tools/{plan,plan2spec,validate,fr_agent(compile/patch/preview 段)} / application/{contracts,create_report,modify_report} / template/{patch_main,reader} / runtime/paths.js / features/data_browser(标识符闸)。

### 发现清单（P0-P3，全部有 file:line 或命令证据）
- **P0：无**（无数据丢失/损坏/误覆盖级缺陷）。
- **P1：无新发现**（基线守护缺口已在 A段修复=2c475c5）。
- **P2-1（已修，a7be9f7）**：planner rows 路 intent.filters/intent.chart 被 capability 墙丢掉时仅 warning 不阻断（semantic/planner/planner.js 旧 109-114 vs 177-181）——status 仍 ready=数据范围/报表结构悄悄变窄，与 C6 对 metrics 的阻断立论直接矛盾。
- **P3-2（已修，a7be9f7）**：model validator 对 countThreshold.value 只查非空不查数值（semantic/model/validator.js 旧 :70），sqlbuilder metricSelect:23 原样拼进 SQL 数值比较位——非数值串=坏 SQL 晚失败；模型文件是唯一值安全闸。
- **P3-3（已修，9c9827b）**：ir.js cells item 无列位越界闸（旧 :549 只查 c 是数字）——rawIR 载体 c/c+span 越表宽 → putCell 画表外默认宽怪列；spec 路列宽由 columns 推导不可达。
- **P3-1（记 backlog B-复审B-1）**：runtime/paths.js `spec()` 无穿越钳制 + make_api REPORT_SPEC/SCHEMA_MODEL env 直用——本机信任边界；paths.js 属 Runtime 冻结面不擅改，修复点在 make_api 入口。
- **P3-4（记 backlog B-复审B-2）**：plan.js:32 硬编码模型路径 vs make_api SCHEMA_MODEL env 分叉。
- **P3-5（记 backlog B-复审B-3）**：object.js 引擎互操作静默 catch（:345 等）——无实证触发路径，盲改违反零误伤，先探针后升级。
- **P3-6（记 backlog B-复审B-4）**：make_api.js:309/320 图表/超链序列化断言只扫 sheets[0]——多 sheet 第二 sheet 断言缺口。
- **安全面核查（无新缺陷）**：sqlbuilder 受控 SQL——ISO 日期先验（sqlbuilder.js:123-125 dr.ok 才拼）、文本值 token 白名单（:131-132,153,159 禁引号）、op 白名单、数值 filter 须有限数（:148）；patch 源件穿越守卫（template/reader.js:5）；outName 路径安全（spec_validator.js:15 OUTNAME_BAD）；凭据自动门（make_api.js:487-515）；browser 族标识符白名单（features/data_browser/browser.js:298）；Runtime 未触碰（git 状态干净）。

### 三项演进实施（反例先行→实现→门禁）
1. **P2-1 planner filters/chart 阻断（a7be9f7）**：fast_planner +3 断言先红 3（rows 路 filters/chart → 仍 ready）；实现 blockedFeatures 计数（rows 路能力墙丢段 + sql 路顶层 filters 未采纳均阻断，status=rejected + owner 归属 warning；数组形态采纳/歧义优先级不变）；后绿。真通道冒烟：fr_agent plan verb 真 intent（rows+顶层 filters）→ status=rejected、reportSpec=null、warnings 含 I2/I3 deferred + 能力墙阻断。
2. **P3-2 countThreshold.value 数值闸（a7be9f7）**：fast_semantic +1 先红后绿；validator 报 INVALID_NUMBER（SQL 数值比较位禁自由文本）。
3. **P3-3 cells 列位越界闸（9c9827b）**：fast_ir_contract +4 先红 3 后绿（首版边界差一 `c+span-1>L` → 修正 `>=L`，0 基列口径）；widthsPt 缺省的 sheet 不查；spec 路不可达。

### 门禁（HEAD=9c9827b 全绿，本轮真跑）
- fast15 rc=0（FAST GATE GREEN）；scan `runraw.ps1 -Script probes/scan_all_specs.js` → ok=60 bad=0 skipped=1（新闸零误伤）；引擎负门 5 路 exit/JSON/stage 逐断言 GREEN；基线 demo_api.cpt MD5=CBEB42E3CE48E46E362B9AE80168026F（负门末步回补+双 e2e 各自回补均实证）；Golden E2E PASS（ge20261107004527-deacd5，10 行逐格+总计 33531:26531+modify diffClean+原件保留）；MULTISHEET E2E GREEN（5 CHECK PASS）。

### 未验证/边界（如实）
- P3-1/4/5/6 记 backlog 未实施（各有前置条件：Runtime 冻结面/触发探针/能力接线时机）。
- 审查未逐行读完 object.js 全部 1699 行（关键段：游标/putCell/chartDeco/param/hide 段已读；剩余段落由历轮 probe 实证与 scan 载体覆盖背书）。
- 独立复审：本批 diff 自查一轮（见上），连续 2 轮外部独立复审无新发现的成熟度判据尚未满足（本轮只有一轮自查+一轮实现者复审；如需真独立代理复审属下轮开工项）。

### Commit
2c475c5（A段）/ a7be9f7（P2-1+P3-2）/ 9c9827b（P3-3）/ 本条文档。

### 下一项工作
backlog B-复审B-1~B-4（P3）；或按 capability-matrix 取下一能力项（多 Sheet SQL extra 需 make_api deps 扩展 / D2 热力图）。

## 2026-11-07 01:35（①planner墙账本同步 ②独立复审第2轮收敛 ③B-复审B-1/B-2 收口）

### ① 账本同步（e366c68）
- matrix:119 planner 墙行改『✓ metrics+filters/chart 双累计阻断（C6 blockedMetrics + B段复审 blockedFeatures → rejected）』引 fast_planner 先红断言；backlog R3-4 完成行同步。
- grep README/manifest/ir/report_spec/inventory/matrix：planner 墙表述仅 matrix:119 与 backlog:87 两处（均已同步）；manifest 无 planner 墙条目（预期不动，确认）。门：fast15 rc0 / scan ok=60 bad=0。

### ② 独立复审第 2 轮（对象=a0bb41f..HEAD 全 diff + ①文档修复）——无新 P1/P2
- 方法：对全部代码 hunks 逐个对抗性复核——planner.js sql 分支 sqlBlockedFeatures 作用域/次序（var 提升、ambiguous 优先序保留）、空数组 filters 采纳路径前后行为等价（均被 SpecValidator INVALID_ARRAY 拒）；ir.js cells 越界闸闭包作用域（s 处于 sheets.forEach 内层确认）与边界数学（c=0 span=2 L=2 界内 / c=1 span=2 出界 / c=2 拒，0 基列口径）；model validator isNum(false)=false 布尔亦拒；两 e2e restore 步变量名（$fails/$failures）与 Get-FileHash 大写口径、$Root 参数作用域、失败路径 $stop 下 restore 仍执行；引用的 fast 断言名逐一 grep 实存（fast_planner.js:97-99、fast_ir_contract.js:480-483）。
- 结论：**无新 P1/P2**。两条 P3 级观察如实记录（非缺陷）：①countThreshold.value 收紧使「数值串」模型写法被拒（合法 SQL 代价型收紧；仓库无此类模型，scan/负门/golden 全绿实证零误伤）；②ir 越界闸消息对非整数 span 显示 Math.floor 值（同格必被 .span INVALID_NUMBER 另行拒，无错误接受口——floor 值只会更小，真实越界仍被 span 闸兜住）。
- 诚实声明：本环境无独立子代理能力（工具面无 Agent/子实例生成），本轮复审=实现者换对抗视角对全 diff 的重新推导；「连续 2 轮」按上一轮收敛轮（2026-11-06 审查轮3 + B段收口轮）+ 本轮计。

### ③ B-复审B-1 入口路径穿越钳制 + B-2 plan.js SCHEMA_MODEL 对齐（c1975f8）
- **反例先行（真洞实证）**：root 外 D:/fa_negtmp/escape.js 经 `REPORT_SPEC=../fa_negtmp/escape.js` 被 make_api `load()` **真实执行**（marker 文件落盘 'ESCAPED-CODE-RAN'，input_load 甚至 passed）——未设防时 env 可注入任意代码执行。
- **实施**：make_api.js assertLocalRel 入口单点——specPath 在 try 顶先于一切 load/read（含 .js 代码执行面）；modelPath 于 sql 分支；拒 `..`/绝对路径/反斜杠/盘符/控制符 → exit 2 + input_load failed + 诊断明示（RR 就位后裁决，契约不破）。runtime/paths.js（Runtime 冻结面）未动。
- **修后实证**：同 probe 无 marker + LOAD FAIL [REPORT_SPEC] 入口路径… + exit 2；SCHEMA_MODEL 单独穿越（合法本地 sql spec + ../models/...）→ LOAD FAIL [SCHEMA_MODEL] exit 2。
- **负门第 6 路 spec-traverse**：脚本自带 escape 件生成（ASCII here-string，临时目录由 $base 父目录推导、终态删除不留主机残留）+ marker 反证断言（`NEG GATE OK [spec-traverse]: outside-root JS not executed (marker absent)`）；check_ps1_static failures=0。
- **B-2**：plan.js 模型加载改 genv('SCHEMA_MODEL','models/production/model.json')（genv 顶层函数声明 ES5 提升可用）；SCHEMA_MODEL 显式覆盖与缺省两态 plan verb 冒烟均 ready（首跑 rejected 系 intent 格式误用——planner rows 路要 dimensions 词串+intent.rows，修正后 ready，如实记录）。
- **账本连带刷新（ff54d81）**：coverage 生成器 GATES 常量负门计数 5→6 路并重生成 coverage.md——生成器如实反映 D2 vmap 接线后源码态漂移（VanChartMapPlot/VanMapMoreNameCDDefinition missing→partial 等）；fast15 交叉对账 GREEN；matrix RunResult 行计数同步。

### 门禁（HEAD=ff54d81，全部本轮真跑）
fast15 rc=0 / scan ok=60 bad=0 skipped=1 / 引擎负门 6 路 GREEN（含 spec-traverse marker 反证）/ 集成门 `run-integration-tests.ps1` INTEGRATION END failures=0 GATE GREEN（make_api 改动纪律）/ Golden E2E PASS（ge20261107012150-65a4d0）/ MULTISHEET E2E GREEN / 基线 demo_api.cpt MD5=CBEB42E3CE48E46E362B9AE80168026F。

### 提交链
e366c68（①账本同步）/ c1975f8（③B-1+B-2）/ ff54d81（coverage 刷新）/ 本条 log。

### 未验证/边界（如实）
- B-复审B-3（object.js 静默 catch）未动——仍须先探针证明可触发；B-复审B-4 等多 Sheet 图表接线一并补（backlog 口径不变）。
- assertLocalRel 不闸 FR_AGENT_HOME（整个项目根重定向，clean-clone 测试在用；ABR-1 单锚语义，backlog B-1 范围即 REPORT_SPEC/SCHEMA_MODEL）。
- 「连续 2 轮独立复审」如上诚实声明：环境无独立实例能力，本轮为对抗性重推导；若用户要求真独立代理复审，需在具备子代理能力的会话中补一轮。

### 下一项工作
按 backlog：B-复审B-3（先探针）→ 或能力向（多 Sheet SQL extra / D2 热力图，反例先行纪律）。

## 2026-11-07 02:25（B-复审B-3 探针收口 + D2 热力图接线）

### 工作目标
按上轮指令：①不为凑轮次造复审任务；②B-复审B-3（先探针证明可触发，不可触发则证据收口）；③能力向（D2 热力图 probes/ 先行）。

### B-复审B-3：探针证据收口·关闭不 action（d679a71）
- probes/probe_b3_catches.js（run.ps1 真跑 exit0）：六处静默守卫的可抛调用 17 边界用例**全部无抛出**——TableDataColumn.createColumn(null/''/123) 全返回（null→null、''→''、123→'#123'）；DSColumn.setColumn(null)/setColumn(createColumn(null))/'')/setColumnName(null) 全 OK；ZoomLevel.parseInt(null/-1→Automatic、2.5→2、0/99→Automatic）全域不抛；MapMarkerType.COMMON/AttrLineStyle.setLineStyle(2)/ViewCenter.setLongitude(null) 类面全在。
- 结论：守卫面=引擎类缺失（版本演进）与防御性边界，本引擎版本**不可触达**（VERDICT: ALL-UNTRIGGERABLE）。IR 侧 strOpt 放行空串（ir.js:92 只查 isStr）曾是最可疑触达路径（ds:{column:''}），但 createColumn('')/setColumn 均不抛——无静默丢绑定风险。按 backlog 纪律不盲改；基线未动（探针不产字节）。

### D2 热力图接线（344157b，反例先行全纪律）
- **R0 探针（probes/probe_heatmap.js）**：①官方 doc/Chart/HeatMap/网页热力图.cpt XML 一手——Plot class=com.fr.plugin.chart.heatmap.VanChartHeatMapPlot + VanChartHeatMapPlotAttr(radius/blur/maxopacity/minopacity，**序列化别名**，真类面=javap：四 setter 直接在 plot 上) + VanChartMapPlotAttr(point/heatmap.json/markertype=0) + VanMapDefinition/pointDefinition（**与 vmap point 完全同构**，我们已构造）；②VanChartHeatMapPlot extends VanChartMapPlot（继承链一手）；③**官方模板无头渲染 RENDER-OK**（logs/_heatmap_official.png 529712B——D1 检查点通过，区别于 D1 组合图"渲染不可见"）。
- **实现**：ir.js CHART_KINDS+=vheatmap、geo 键闸族化（vmap|vheatmap）、heat 形态闸（对象/键白名单 radius|blur|minOpacity|maxOpacity、radius/blur 正数、min/maxOpacity 非负）；object.js map 族分支（vheatmap 换 Plot+heat 缺省官方 35/45/0/70+point 不设 marker 照官方 markertype=0）；spec_validator CHART_KINDS/CHART_KEYS+heat；spec_compiler 透传+heat；report_spec.js capabilities vanChart 列表+注。
- **TDD**：fast_ir_contract +8 先红 8 后绿；fast_report_spec +2（compile 发射 heat/缺省零误报）+vanChart 固定列表断言同步。
- **真引擎载体（reports/test_vheatmap.js）**：管线 failures=0；部署 cpt `class=com.fr.plugin.chart.heatmap.VanChartHeatMapPlot`/`radius="35.0" blur="45.0" maxopacity="70.0" minopacity="0.0"`/`mapType="point" geourl=中国.json zoomlevel="0"`/pointDefinition×2——**与官方逐字段同构**；PNG 69599B 目检：中国底图+5 省热力光晕（广东95 亮黄绿/四川62 橙红/黑龙江40 淡蓝紫）+渐变色例 96..40 与数值对应——**渲染达成**。
- **账本五处**：manifest `chart.heatmap` pending 占位→`chart.vheatmap` 四层 verified（evidence 引 R0/carrier/PNG 目检，agentAvailable=false——无热度数据源/无 plan→create）；matrix 六维表+明确不做行；inventory D 类表+结论；coverage 重生成（specialcharts partial→**full**，VanChartHeatMapPlot 出 missing 账）；ir CAPABILITIES.vheatmap 注。

### 门禁（全部本轮真跑）
fast15 rc=0（含 manifest/coverage 刷新后复跑）/ scan ok=61 bad=0 skipped=1（新载体入扫）/ 引擎负门 6 路 GREEN（含 spec-traverse）/ Golden E2E PASS（ge20261107021611-20f997）/ MULTISHEET E2E GREEN / 基线 MD5=CBEB42E3CE48E46E362B9AE80168026F（负门末步+双 e2e 回补均实证）。

### 提交链
d679a71（B-3 探针收口）/ 344157b（vheatmap 接线）/ 本条 log。

### 未验证/边界（如实）
- vheatmap 仅 area|point mapType（官方两语料均 point）；area 热力（官方无语料）未探——mapType 闸放行 area，行为未单独目检。
- vheatmap 装饰件（tooltip/label 等在热力图上的表现）未单独探——applyChartDeco 对 map 族 plot 的挂接面与 vmap 共享，未逐件 PNG。
- plan→create e2e、热度数据源：agentAvailable=false 口径（同 vmap）。
- probe_heatmap 首跑曾挂起（module.start 后未 System.exit，FineDB 非守护线程滞留 JVM）——已补 exit 并重跑收口，如实记录。

### 下一项工作
backlog 剩余：B-复审B-4（等多 Sheet 图表接线一并补）；多 Sheet SQL extra（需 make_api deps 扩展，先出设计证据）；poly/热链保持 pending。

## 2026-11-07 04:30（阶段2：A/B/C/D 全段——外置 Agent 仅凭本项目工具创建帆软报表的产品闭环）

### 工作目标
阶段2 四段：A=两份审查报告（外部 34-commit 审查 + 阶段1 loop-report）逐项对账、未修 P1/P2 反例先行清零；B=Agent 链产品闭环（新 verbs/promote-restore/错误面/退出码）；C=NL→报表端到端成熟度循环（外置 LLM 只看工具输出，≥3 非 demo 形状）；D=门禁全绿+账本同步+复审。基线 b8ea665。

### A段：对账表（逐项本轮实测；证据=probe_a_review.js 12红→20绿 + 命令输出）
**外部 34-commit 审查：**

| 项 | 级 | 实测 | 证据（本轮真跑） |
|---|---|---|---|
| seriesImage 路径不走 checkLocalPath | P1 | **已修 800c7bf** | probe_a_review P1a 3红→绿；ir 层 INVALID_PATH（..\/\\/scheme）+ object 层 imageBackground checkLocalPath 强制（与 float imageFile 同规） |
| validate.js 硬编码 demo 三列 | P1 | **已修 800c7bf+3db31c7** | 表头签名识别（前3行内定位 计划/完成/完成率，非假设列序）——C段三形状非 demo 表格 validate 全过；golden 对拍 33531:26531 仍 PASS |
| planner rows 路未知指标静默丢 | P1 | **已修 800c7bf** | probe_a_review P1c：已知+未知混合指标红（ready）→修后 rejected；与 sql 路成员缺失同纪律；fast_planner 旧断言「未知术语仅 warning 仍 ready」钉的是被审查点名的缺陷，按修复更新（非迁就） |
| fast 层缺三铁证 MD5 断言 | P1 | **已修 800c7bf** | 新 verify/fast_baseline.js（demo_api.cpt=CBEB42E3/v2=6161F402/部署PNG=A8EF39AB；PNG 缺文件=SKIP 行不记 PASS）；破坏性自检：篡改副本实测检出 233EA541≠CBEB42E3；driver 套件 15→16 |
| 协议相对 URL 逃逸 | P2 | **已修 800c7bf** | probe_a_review P2a 3红→绿：ir isRelUrl + object checkRelUrl 双层拒 `//host`（浏览器按当前协议解析=跨站外链逃逸） |
| ir charAt 三处抛 | P2 | **已修 800c7bf** | probe_a_review P2b：kind=123/undefined+装饰键曾抛 TypeError → String 包层后结构化 INVALID_ENUM/INVALID_SHAPE（:886/:1019/:1108 三处） |
| spec 顶层未知键静默丢 | P2 | **已修 800c7bf** | probe_a_review P2c：`specTypoKey` 静默、`dimensons` 拼错只报 REQUIRED → TOP_KEYS 白名单后 UNSUPPORTED_CAPABILITY 点名（与 C1 dataset/params 键白名单同立论） |
| refOverrides `__proto__` | P2 | **已修 800c7bf（硬化）** | Nashorn 实证 `o['__proto__']=x` 真换原型（getPrototypeOf===x）但 labelOf/widthOf 的 typeof 守卫掩蔽用户可见损伤（probe t_probe7）→ Object.create(null) 消除隐患类 + probe 产物不变性断言 |
| VAN_KINDS 漏 vbubble | P2 | **已修 800c7bf** | object.js VAN_KINDS+=vbubble（缺省高度下限钳制对气泡图生效）；载体 test_vanchart vbubble 显式 heightPt=240（条件 `<240` 不触发），scan ok=61 bad=0 实证零误伤 |
| S5b skip 记 PASS | P2 | **已修 800c7bf** | integration_runtime.ps1 增 Skip 计数器；终行 `INTEGRATION END, failures=0, skips=0`（skip 可见不折进绿） |
| check_ps1_static 白名单固定 9 文件 | P2 | **已修 800c7bf** | parse 动态枚举全仓 19 件（logs/probes/.git 豁免）+ ASCII 动态枚举维护面 19 件；tools_abr_regr/tools_br_run/tools_prod_run/check-boundaries 中文注释翻 ASCII（零豁免名单）；中文产物名经 [char]0x 码点构造保 ASCII |
| 词表多处手同步 | P3 | **未修→backlog** | spec_validator 与 ir.js/report_spec.js 的 CHART_KINDS 仍有两份（spec_validator 已单向依赖 ReportSpec，可导出 CHART_KINDS 去重；ir.js 红线不污染不动） |
| 公式 '=' 规范化 8 处 | P3 | **未修→backlog** | object.js 6 处+ir/spec 2 处重复 `charAt(0)===‘=’`——零行为差异机械重构，byte-gate 面（demo/v2/61 spec scan）成本>收益，按 P4 纪律挂账 |
| colLetter 单字母 | P3 | **不适用（已有闸）** | ir.js:640 sumCols 列号 1..25 钳制+注释明示 colLetter 只产 A..Z；spec_compiler.js:39 已是双字母正确实现；object.js 单字母版仅在钳制后消费 |
| truthy 默认 | P3 | **未修→backlog** | `b.bold !== false` 类为既定「缺省=开」语义（TABLE_DESIGN_STANDARD 版式口径），改动=行为变化非缺陷修复 |
| fast 样板 14 份 | P3 | **未修→backlog** | 16 份后抽 _fast_lib 收益更低、翻新门禁面风险>收益 |
| 错误消息不自解释 | P3 | **已修（B段 1e8f72a）** | 全 verb 失败输出带 nextActions+可用名单（sample_data unknown entity 附 available entities 等） |
| 工具输出细节 | P3 | **已修（B段）** | 五新 verb 合同行/产物统一 {ok,runId,result} 契约 |

**阶段1 loop-report 未结项对账**（AGENTS §6 口径）：vheatmap 已接（上轮 344157b，agentAvailable=false 如实）；seriesBorder/seriesImage/vpie summary 视觉维持 serialization-only 分层不虚报（seriesImage 本轮补路径安全闸=构造面收口）；vmap/vheatmap 保持 pending 不接 plan→create（C3 用 legacy bar 不改变其状态）；poly/热链 pending 不动；批F 写回/批D 凭据=用户决定事项未动。

### B段（1e8f72a）：Agent 链产品闭环
- **五新 verbs**（agent/tools/ + fr_agent.ps1 路由）：list_reports（部署目录 93 份 .cpt 清单，零引擎只读）/ sample_data（只读 LIMIT 采样：entity/columns 模型白名单、limit 1..200、where 受控字面量；实测 laser_aaa 3 行返回；负例 unknown entity 附名单+exit 1）/ inspect_template（引擎只读体检：sheet 尺寸+逐格文本真实坐标+XML 数据集/参数名，smokeinspect1 实证 4×5 格坐标；每 RunId 一次引擎产物登记）/ promote（staging 回归全绿补丁就地部署，fail-closed 于 diffClean/execution/render/datasetChecks，MD5 复核）/ restore（staging .orig.cpt 回退部署面，MD5 复核）——**modify→promote→restore 闭环**（同一 runId 裁决）。
- **退出码一致**：resolve 0=resolved|ambiguous / 1=unknown / 2=用法（smokeres3/4 实证）；plan 同规既存。
- **错误面**：全部失败输出 nextActions（fr_agent.ps1 用法错 6 处 + resolve/plan/list_reports/sample_data/inspect/promote/restore）。
- **agent-tools.md**：阶段2 节（五 verb 表+退出码规则+nextActions 约定）；陈旧「条件高亮不支持」修正（B1 已接，真相源=manifest）。
- **golden e2e 接线**：promote（部署件==staged 补丁字节且≠改前）+restore（部署件==orig 字节）两步断言。

### C段（3db31c7）：外置 LLM 口径端到端——三形状全链 GREEN（两轮复跑）
- scripts/run-c-maturity-e2e.ps1：补丁坐标取自 inspect_template 输出（非硬编码，真外置口径）。C1 参数面板+条件高亮+脚注（rows 直写 spec=混合路线表达层）/ C2 多 Sheet+页眉页脚+水印 / C3 真库+图表（sql 经 plan 链）。每张 create→validate→inspect→modify→promote PASS+部署件 MD5 复核。
- **逐轮断点修复留证**：①validate 把 datasource_connect=skipped 当失败（rows 路合法终态）→放行该阶段；②probe_c3_titleA 系列（5 支探针）实证 **FR cpt XML 写出层对含 ']' 文本注入 'A'**（'ABC]'→'ABC]A'，'A]]>B'→'A]A]A>B'；内存值 30 字符正确、export 后损坏）→TemplateValidator fail-closed 拒 ']'（README 无此坑记录，一手发现）；③含图表报表补丁被「未预期单元格变动」误杀（ChartPainter@哈希两次执行必不同）→regression normCell 按 `类@hex` 归一为类名；④validate 表头签名只看第 0 行漏标题行报表（golden 复跑抓到）→前 3 行内定位。

### D段：门禁（全部本轮真跑，HEAD=本轮文档提交）
- fast16 rc=0（FAST GATE GREEN）/ scan ok=61 bad=0 skipped=1 / 引擎负门 6 路 GREEN（ir-bad 9/db-conn 4/secret-leak 1/exec-formula 1/json-bad-spec 2/spec-traverse 2+marker 反证）/ 集成门 INTEGRATION END failures=0, skips=0 / Golden E2E PASS（**ge20261107040402-723a77**，create+逐格真值 33531:26531+preview+modify+promote+restore）/ MULTISHEET E2E GREEN / C-MATURITY E2E GREEN（3 形状×全链，两轮）/ probe_a_review fails=0 / 铁证三件逐字节 CBEB42E3+6161F402+A8EF39AB。
- 账本：AGENTS §1 套件清单 5→16 实名（§6 铁证行不变）；agent-tools.md 阶段2 节；coverage 生成器 GATES 16 套件实名+coverage.md 重生成；ir CAPABILITIES.seriesImage 注钳制；backlog 增 P3 未修项。

### 独立复审（本轮自查，诚实口径）
- 对抗性重推导：A段修复面（isRelUrl 双层一致性/charAt 三处 String 语义/TOP_KEYS 跳过 filters|chart 防双报/refOverrides null 原型下 term='__proto__' 成 own 键→labelOf 语义不变/NORM `类@hex` 正则不含中划线误配面：ChartPainter 无中划线、`com.fr.base.Formula@x` 也归一=同类无内容对象）；B段 promote fail-closed 链（patch.json ok→manifest 逐项→staged 存在→sourceCpt 白名单→MD5 复核，restore 不检查回归=回退操作本性）；C段 driver 坐标来自 inspect 输出。连续环境限制声明同前轮：无独立子代理实例，本轮=实现者对抗视角对全 diff 重推导（第三轮）。
- 未验证/边界如实：promote 后 restore 的二段式用户流程只有 e2e 断言（无人工 GUI 验证，符合文件层纪律）；sample_data 未加集成门故障注入（只读面，DB 连接失败路径已有诊断+exit 1 冒烟）；inspect_template 大表 CELL_CAP=4000 截断标志未在真实大表上验证（部署面现无大表）。

### 提交链
800c7bf（A段 P1/P2 清零）/ 1e8f72a（B段五 verbs+错误面）/ 3db31c7（C段 e2e+断点修复）/ 本条文档+账本。

### 下一项工作
backlog P3 三项（词表去重/'=' helper/fast 样板）按 P4 纪律择机；B-复审B-4 等多 Sheet 图表接线一并补；vmap/vheatmap plan→create e2e（解锁 agentAvailable）。

### D段补记（2026-11-07 05:10，核对者返馈修复——静态门红→修→绿，如实入账）
- **静态门曾红（核对者实测检出，本轮复现）**：`powershell -File verify/check_ps1_static.ps1` → `STATIC FAIL: NON-ASCII D:\fineagent\scripts\run-c-maturity-e2e.ps1 (12 bytes >127)`——上一轮 C 段把补丁文案从 '[REVIEW]' 改 '（复审）' 时（Edit 引入 4 个全角字符），**改后未复跑静态门**，上一轮记录只引了改动前的那次绿跑，漏检。根因=改 .ps1 后未按门禁纪律立即复跑静态门（该门设计目的正是拦 PS5.1 GBK 读盘翻车）。
- **修复**：scripts/run-c-maturity-e2e.ps1:78 文案改 ASCII ' (review)'（编辑器逐字替换，非 PS -replace/Set-Content；补丁文本禁 ']' 由 template/validator.js 把关不受影响；CJK 标题文本本就来自 UTF-8 fixture/inspect.json，不经本文件）。
- **修后复跑（全部本轮真跑）**：静态门 `STATIC SCOPE: parse 20 / ascii 20, STATIC END, failures=0`（exit 0）；fast16 16/16 PASS + FAST GATE GREEN；集成门复跑（结果见下）；golden e2e 末行 PASS 文案同步为九步口径（plan+create+validate+truth-grid+preview+modify+promote+restore+baseline-restore——上轮已接 promote/restore 两步但末行文案仍写旧四步，顺带纠正）。
- **诚实边界**：C 段 e2e 未因本次文案修改重跑全链（核对者明示勿动已绿部分；改动=字符串字面量交换，文件经静态门 parse 20 件覆盖语法验证；上一轮 GREEN 跑的是 '（复审）' 字面量，行为差异仅补丁文本内容，链路断言不依赖具体文案）。

## 2026-11-07 08:05（阶段3 第一阶段：修改部署安全收口——promote/restore fail-closed 全链 + 30例回归矩阵）

### 工作目标
基线 36bd152。评审规范 A-F 全部反例先行：A promote 安全 / B restore 安全 / C 文件原子替换 / D 回归矩阵≥12例（全失败路径）/ E 约束（Runtime 冻结等）/ F 验收（fast+静态+负向+真引擎 E2E+版本冲突实证+三态留痕）。

### 反例先行（D 项，RED→GREEN 全程）
- 先写 `scripts/run-promote-restore-tests.ps1`（全沙箱：FR_AGENT_HOME/FR_HOME/FR_AGENT_RUNTIME_DIR/FR_AGENT_MUTEX 四 env 重定向；真实部署目录清单[302 文件+逐文件 MD5]篡改证据前后比对）。
- **首轮对旧实现 24 红**（旧 promote：`if ($mf.execution -and ...)` 缺失即跳过、datasetChecks null 静默放行、Copy-Item -Force、仅 MD5、无 sourceHash/promotedHash；旧 restore：无 promote 记录校验、无 DEPLOYED_CHANGED、无 staging 原件哈希闸）。守卫面全部命中后实现，复跑 30/30 GREEN。
- 过程中实证两个坑并写进代码注释：①PS5.1 方法绑定把字面 `$null` 转成 `""` 传给 File.Replace → 「路径的形式不合法」，改 `[NullString]::Value`（探针实证 null-arg THREW / nullstring-arg OK）；②嵌套 JSON `[]` 经 ConvertTo/From-Json 往返稳定为空数组非 null（探针实证），`$null -eq` 判缺失可靠。

### 实施（A/B/C 项）
- `agent/tools/_deploy.ps1` 新建（与 _identity.ps1 同层函数库，无新基础设施）：Get-FileSha256（.NET SHA256，缺/不可读返 null→调用方 fail-closed）+ Replace-FileAtomic（同卷 `._deploy_<guid>.tmp` + File.Replace 原子替换；任何异常=目标件字节不动；**无 Move/Copy -Force 回退**，FS 不支持时明确失败+诊断）。
- `template/patch_main.js`：manifest 增 `sourceHash`（modify 时点部署件 SHA-256，大写 hex，MessageDigest）+ `datasetOps`。
- `agent/tools/fr_agent.ps1` promote：fail-closed 链 patch.json ok→manifest→diffClean 严格 true→**execution/render 存在且 pass==true**→**datasetChecks 存在**（每项 pass；datasetOps>0 时条数≥datasetOps）→staged 在本 run staging 内+.cpt→磁盘 manifest.json 与内嵌一致（MANIFEST_MISMATCH）→sourceCpt 三处一致+白名单→**SHA-256(部署件)==manifest.sourceHash 否则 SOURCE_CHANGED**→.orig.cpt 存在且哈希==sourceHash→原子替换→换后复核→记 sourceHash/origHash/deployedHash/promotedHash/deployedBeforeHash。
- restore：本 run patch.json（RESTORE_NO_PATCH）→**本 run 成功 promote.json 且带 deployedHash+origHash**（RESTORE_NO_PROMOTE）→.orig.cpt 哈希==promote 时 origHash（STAGING_ORIG_CHANGED）→**SHA-256(部署件)==promote 时 deployedHash 否则 DEPLOYED_CHANGED**→原子替换→换后==orig 哈希→记 origHash/restoredHash/deployedBeforeHash。守卫全部先于换件，拒绝绝不触碰部署文件。
- 文档：agent-tools.md 阶段3 节（fail-closed 链全文+_deploy.ps1 说明+矩阵口径）。

### 门禁与验收（全部本轮真跑）
- **矩阵 30/30 PASS**（反例先行：首轮 24 红）。覆盖：P1 正常 promote / P2 execution 缺失 / P3 render 缺失 / P4 datasetChecks 缺失 / P5 dataset 项失败 / P6 staged 缺失 / P7 staged 在 staging 外 / P8 sourceCpt 不一致 / P9 越白名单 / P10 SOURCE_CHANGED（外部改动） / P11 SOURCE_HASH_MISSING / P12 diffClean=false / P13 patch.json ok=false / P14 orig 缺失 / P15 磁盘 manifest 不一致 / P16 锁定目标原子替换失败保留原文件（NTFS FileShare 注入，无代码钩子）/ R1 正常 restore / R2 未 promote 就 restore / R3 DEPLOYED_CHANGED / R4 staging 篡改 / R5 二次 restore 拒（r22e 单次注册语义，stdout RUNID_EXISTS 断言）/ R6 promote 后 staging 丢失=中途失败恢复面 / R7 无 patch.json / X1-X4 原子替换单元+静态接线断言。≥12 例要求达成（30 例）。
- 静态门 STATIC END failures=0（22 件 parse+ASCII，含新 _deploy.ps1/matrix）；fast16 FAST GATE GREEN；scan ok=61 bad=0 skipped=1；集成门 GREEN（STATIC 0/MATRIX 30/INTEGRATION failures=0 skips=0，矩阵已接入 run-integration-tests.ps1）；引擎负门 ENGINE NEG GATE GREEN（无假绿+默认基线完好）。
- **真引擎 E2E：GOLDEN E2E PASS**（runId=ge20261107075805-e6d427，plan+create+validate+truth-grid 33531:26531+preview+modify+promote+restore+baseline-restore）。真 run 哈希链直证：manifest.sourceHash=6E86EA88…＝promote.origHash＝restore.restoredHash＝**restore 后部署件当前 SHA-256**（字节级往返）；promote.deployedHash=promotedHash=8B5EF0DC…=restore.deployedBeforeHash。
- **真实部署件版本冲突实证**（logs/_conflict_probe.ps1，已清理）：golden run 真实 staging + 外部改写部署件 → promote exit 1 / SOURCE_CHANGED 明确诊断 / 拒绝不触碰部署文件（外部字节保留）/ 可逆还原 SHA-256 字节级一致。
- 基线：demo_api.cpt MD5=CBEB42E3CE48E46E362B9AE80168026F 本轮直证。

### 约束自查（E 项）
Runtime 生产代码零改动（git diff 仅 fr_agent.ps1/patch_main.js/_deploy.ps1 新建/matrix/集成门接线/文档）；无 DB/队列/分布式锁/OwnerToken；patch 引擎只加 manifest 字段未改引擎行为；无新架构层（_deploy.ps1=tools 同层函数库）；复用 Mutex/SHA-256/.NET/staging/manifest；创建报表字节基线未动。

### 三态报告
- PASS：上述全部（矩阵 30 例/静态门/fast16/scan/集成门/引擎负门/golden e2e/版本冲突实证/基线直证）。
- NOT RUN：C 段 maturity e2e 未因本轮改动重跑（其 promote 步骤在新守卫下需 manifest.sourceHash——新 modify 必产；本轮 golden e2e 已覆盖同链路真执行）；MULTISHEET E2E 未重跑（未触碰多 Sheet 面）。
- BLOCKED：无。

## 2026-11-07 08:55（阶段3 第二阶段：真实报表生命周期验证——8 任务经 agent 工具链逐个执行留证）

### 工作目标
评审 §九 八任务作产品验收：工具调用序列+产物+验证结论逐个留证；引擎限制处如实记录不虚报。

### 逐任务证据（全部本轮真跑，产物在 logs/agent/runs/）

| 任务 | 工具调用序列 | 产物/验证结论 |
|---|---|---|
| ① 创建生产日报（从零） | plan(t1 intent 真库 SQL 口径)→plan2spec→create→validate→inspect_template | runId=s3t1a 全链 ok；部署 生产日报S3_api.cpt/png；PNG 目检：10 日明细+总计 33531:26531（与 golden 真值同口径）+口径脚注 |
| ② 增加统计指标（修改现有） | inspect 取真实坐标→modify(t2: replace_dataset 超集新增 defect 指标列+脚注格)→promote | runId=s3t2b：diffClean/execution/render 全绿+datasetChecks 1/1 逐格核对；promote 哈希链 5186838C→88173C10 真部署；部署 cpt 含 defect 列（grep 2 命中）。**如实限制**：显示面加新列不可（patch 白名单仅 2 op），新增指标以数据面+说明落地 |
| ③ 增加日期筛选器 | modify(t3: add_parameter+add_filter) | **引擎限制留证（真跑拒绝）**：INVALID_ENUM 未知 op + UNSUPPORTED_CAPABILITY「参数/条件面读回无口(getReportParameterAttr 全库 0 命中)」→ patch.json ok=false exit=1。参数/筛选面 v1 不做=R0 探针既定口径 |
| ④ 增加 Sheet | modify(t4: add_sheet) | **引擎限制留证（真跑拒绝）**：ok=false exit=1 |
| ⑤ 修改统计口径（公式聚合） | modify(t5: 总计完成率 =C4*100/B4 → =AVERAGE(D3)) | **引擎限制留证（真跑拒绝）**：执行回归拒「未预期单元格变动 r=12 c=3: 79.12→80.00」——根因=回归屏蔽用模板坐标，明细扩展 10 行后总计/脚注等扩展区之后格全部位移（栅格 r12/r14），此前真测只改过 r0（无位移）。**fail-closed 方向安全（保守拒非误放）**，挂 backlog；patch 链公式修改可达面=明细块前静态格=如实 |
| ⑥ 增加区域热力图 | modify(t6: add_chart kind=heatmap) | **引擎限制留证（真跑拒绝）**：ok=false exit=1；vheatmap 能力账本 agentAvailable=false（无热度数据源/plan→create 未接）口径不变 |
| ⑦ 修改标题与表头 | modify(t7: 标题格 r0+表头格 r1 文本)→promote | runId=s3t7：diffClean=True（未改部分语义 token 不变）+exec/render 绿；promote 88173C10→C0C9ED9E 真部署（模板保真） |
| ⑧ 修改后恢复原版 | restore(s3t7) | ok=true；部署件 SHA-256 字节级回到⑦前（deployedBefore=C0C9ED9E→restored=88173C10，直证 deployed 当前哈希==restoredHash） |

### 过程中反例先行修复（两处，均探针实证）

**P0：engine_launch.ps1 ExitCode 空读 → 引擎失败误报 exit=0（本轮新发现，非本轮引入）**
- 反例：任务③ REJECT 后 patch.json 竟 ok=true exit=0；直跑 runraw 同参 RC=1。
- 探针定根因（logs/_sp_probe*.ps1 四组，已清理）：PS 5.1 `Start-Process -PassThru` 在 **-NoNewWindow 及/或 -RedirectStandardOutput** 形态下，手动 `WaitForExit()` 后 `$p.ExitCode` 读数为 **$null**（真 java System.exit(1) 复现；`-Wait` 或先取 `$p.Handle` 则=1 正确）。$null 经 runraw `exit ($null)`→0→fr_agent $LASTEXITCODE=0→patch.json exit=0。ok 判断 `($rc -eq 0)` 对 0 为 true → **真 fail 被记 ok=true**（合同行恰被 artifact 组装器 validation.ok=false 兜住才未假绿到 verb 层）。
- 修复：WaitForExit 前加 `$null = $p.Handle`（强制 SafeProcessHandle 预分配；D/E 两形态探针 1 正确；r17/r18 注册时序 spawn→pidfile→handle→wait 不变）。
- 修后验证：任务③/④ REJECT patch.json ok=false exit=1 真实记录；集成门全绿（S25 pre-spawn 故障注入 rc=1 无泄漏 + S26 收集器 confirmed/kept 分支——Handle 预取未破坏注册语义）；引擎负门 GREEN（无假绿+默认基线完好）。

**diff.js：replace_dataset 多行内嵌序列化串被误杀（任务②真跑发现）**
- 反例：任务②合法补丁 diffClean=false；探针定位 unintended=[一条含换行的 EmbeddedTableData 行值序列化 token]——isDatasetToken 的 `/^[\x20-\x7E]{10,}$/` 不匹配 \n(<0x20)。I6.1-B 豁免意图本含「行值/序列化属性」，正则漏多行。
- 反例先行：fast_template.js 先加两断言（多行串放行+中文偷改仍拒=豁免不扩大化）确认红→修 `/^[\x20-\x7E\r\n]{10,}$/` →绿。

### 门禁（全部本轮真跑，含修复后复跑）
fast16 FAST GATE GREEN / scan ok=62 bad=0 skipped=1（s3_daily.js 入扫）/ 静态门 failures=0 / 集成门 GREEN（STATIC 0+MATRIX 30/30+INTEGRATION failures=0 skips=0）/ 引擎负门 GREEN / **基线 demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F 直证（见下「基线踩踏与恢复」）**。

### 基线踩踏与恢复（如实）
任务①的 create 走 run.ps1 make_api.js，按其既有行为每次把产物同时写 demo_api.cpt（本地基线文件）；本阶段 create 后未按 AGENTS §1「最后一步默认 spec 收尾」执行 → fast_baseline 抓到 demo_api.cpt=EDDB59CA≠CBEB42E3。已跑默认 spec 恢复（PIPELINE failures=0），复证 CBEB42E3，fast 全绿。教训已在本条目留痕：**agent 链 create 之后必须默认 spec 收尾**（golden e2e 驱动末步已有此机制，独立跑 create 的流程没有——不引入新机制，靠本纪律）。

### 三态报告
- PASS：①②④（④=拒绝留证完成）⑤（=拒绝留证完成）⑥⑦⑧ 如上表；两处反例先行修复（diff.js/engine_launch.ps1）+ 全门禁绿 + 基线恢复。
- NOT RUN：C 段 maturity e2e / MULTISHEET e2e 未因本轮 diff.js+engine_launch 变更重跑全链（diff.js 变更面=replace_dataset diff 豁免，fast_template 两断言+任务②真跑已覆盖；engine_launch 变更面=退出码读取，集成门 S25/S26+引擎负门+任务③④⑤真跑已覆盖）；preview verb 在任务①中未达（preview.js 对该 cpt 的 PNG 生成失败——compile 产物自带部署 PNG 已目检，preview 失败原因未深查，如实记录）。
- BLOCKED：无。

### 下一步
backlog 新增：regression.js 扩展位移映射（模板格→执行栅格坐标，解锁扩展区公式/格修改——先探针后修）；agent 链 create 的默认 spec 收尾自动化评估（不引新机制前提下）。

## 2026-11-07（阶段3 第三阶段：fail-closed 真实故障注入收口——验证器 3.1-1..3.1-4 + 3.2-1..3.2-4 全绿）

### 工作目标
交付后无人值守 owner 敢让 Agent 直接动生产报表：promote/restore 即使被篡改证据、被指错 staging、在替换与记账之间任意时刻崩溃也不丢生产件不假报成功；模板改数据集时「数据读回对但绑定/公式被改坏」也被拦。方法=verify/stage3_final_check.py 每条 fail-closed 声明在真实代码路径真实注入故障、先红后绿（基线 a82e8ba 实测 14 PASS/18 FAIL/1 BLOCKED/2 NOT RUN，exit=1，红集合与任务书一致）。

### 逐项（全部本轮真跑，先红后绿；每项绿由本轮证据支撑，不继承旧 PASS）

**3.1-1（promote manifest 全量一致性）**
- 反例（基线实测穿透，exit=0 部署件被换）：内嵌 manifest 的 execution/render/datasetChecks 篡改 pass=true、磁盘 manifest.json=false → 旧四字段比对（sourceCpt/out/diffClean/sourceHash）看不见，verdict 全部只在内嵌 manifest 裁决（fr_agent.ps1 旧 :366-374/:389）。
- 修复：_deploy.ps1 新增 Compare-ManifestVerdict（sourceCpt/out/sourceHash/datasetOps/diffClean/execution/render/datasetChecks 逐块 canonical 比较、presence 不对称即 mismatch），promote 在触碰部署件前拒 MANIFEST_MISMATCH。
- 验证：S1a/S1b/S1c 真子进程注入 → exit=1 + promote.json ok=false + 沙盒部署件 SHA-256 字节不变（PASS）；S1d 一致 manifest 正对照 promote 成功且 deployedHash/promotedHash/sourceHash 哈希链完整（PASS）；矩阵 P15 同类拒 PASS。

**3.1-2（staging 绑定 RunId）**
- 反例（基线实测穿透）：patch.json.stagingDir 指向其它 RunId 的 staging（staged/.orig 自洽）→ 旧校验只查「staged 在自声明目录内」（fr_agent.ps1 旧 :379-382，RunId 变量在手边未绑定）→ exit=0。
- 修复：promote/restore 在读任何 staged 文件前强制 stagingDir == $agentDir\runs\<RunId>\staging（GetFullPath + OrdinalIgnoreCase），拒 STAGING_RUNID_MISMATCH。
- 验证：S2a 越权注入拒且部署件不变（PASS）；S2b 本 RunId staging 正对照成功（PASS）；矩阵 P7（staged 在白名单外）PASS。

**3.1-3（PREPARED/COMMITTED 部署操作日志 + 崩溃恢复）**
- 反例（基线实测死锁）：真 promote 成功后截断 promote.json（=替换成功、提交丢失）→ 重试 SOURCE_CHANGED 死锁；restore 同理 DEPLOYED_CHANGED（无恢复路径）。
- 修复：每 run `deploy_state.jsonl` 追加式操作日志（Add-DeployStateEvent/Get-DeployStateEvents）；替换前 PREPARED（stagedHash/sourceHash/origHash/deployedBeforeHash）、哈希复核后 COMMITTED；重试按**实际部署件哈希**对照 PREPARED 识别「已换未记」→ 补完成提交（重物化 promote.json/restore.json，绝不重换）；无 PREPARED 证据时同字节态仍按 SOURCE_CHANGED/DEPLOYED_CHANGED 拒（fail-closed）。
- 验证：S3b promote 崩溃恢复=识别未提交→完成提交（PASS）；S3c restore 崩溃恢复=识别已替换→补提交、部署件=orig 字节（PASS）；S3a 静态断言（PASS）；S3d 真进程 kill 注入（File.Replace→WriteAtomic 毫秒级窗口）黑盒不可确定性注入=BLOCKED（如实；S3b/S3c 为真实操作日志+截断提交物的确定性等价注入，标准原文即「模拟崩溃」）；矩阵 R5（二次 restore 拒）/P16（锁定目标替换失败保留原文件）/R6（中途 staging 丢失拒）PASS=恢复路径未破坏既有拒绝语义。

**3.1-4（协作边界声明）**
- promote.json/restore.json 成功件携带 concurrencyBoundary + mutex 字段（单写者部署窗口：全部哈希守卫在运行时命名 Mutex 内紧贴 File.Replace 执行；S4a PASS）。
- 文档：runtime-supervisor.md 新增 §7「部署窗口」——check-then-act 窗口 + 协作边界 + 崩溃一致性 + 并发窗口故障测试结论（S4b PASS）。
- 并发窗口结论留痕：真 kill=BLOCKED、确定性等价注入=PASS（S4c PASS）。

**3.2-1（replace_dataset 不再跳过执行栅格回归）**
- 反例：regression.js:54 `if (opts.hasDatasetOp) return {pass:true,...}` 短路 → 数据读回对但表头/绑定被改也 PASS（fail-open；S5b 基线 FAIL）。
- 修复：拆短路；执行栅格仍逐格对比，屏蔽面=① PatchSpec 点名坐标（原语义不变）② 数据集值池可论证变化（新值 ∈ op.rows 扁平值池、空串不入池；patch_main.js 组装 datasetValues 传入）；行/列数变化在 dataset 替换下继续保守拒绝（映射未定案，见 3.2-3）。
- fast_template.js 旧钉「r5 dataset op：执行差异交 dataset 回归」正是被拆的 fail-open 合同——反例先行后随 3.2-1 语义升级改钉，并新增 3 钉：无值池执行差异 FAIL / 新值∈值池屏蔽 PASS / 表头篡改 FAIL / 行数变化仍拒。
- 验证：S5a 短路不存在（PASS）；S5b hasDatasetOp 下非数据区格被改 → FAIL（PASS）；S5c dataset integrity 判定原样保持=正确读回 PASS（PASS，拆分未动 dataset()）；S5d patch_main.js manifest 含独立 execution/datasetChecks 双块（PASS）；fast_template failures=0。

**3.2-2（diff 数据集豁免按 TableData 节点上下文）**
- 反例：含 > 和 $ 的普通 <O> 单元格文本变化（budget>100$ → budget>999$）被 isDatasetToken 宽规则（≥10 可打印字符含 [>"'~$]）误豁免 clean=true 穿透（基线 S6a FAIL）。
- 修复：diff.js 新增 datasetNodeCdata 按 `<TableData>…</TableData>` span 收集节点内 CDATA 多重集（与 tokens() 同套 UUID/数字噪声过滤），dataset/plain 双侧拆分；isDatasetToken 豁免只作用于 dataset 侧，plain 侧（单元格文本/其它语义）严格守恒；expected 抵扣改走 plain 侧；无 dataset op 时 dataset 侧变化一律算未预期（改数据集不申报=可疑）。
- 验证：S6a 含 >/$ 单元格文本变化不再豁免（clean=false 且 token 进 unintended，PASS）；S6b TableData 节点内多行序列化串仍豁免不回归（PASS）；fast_template 全部 diff 断言（含阶段3 两钉）绿。

**3.2-3（坐标映射留证 + 保守拒绝不放宽）**
- 本轮映射结论（留证即本条目）：模板坐标→执行栅格坐标的位移映射仍未定案（对应既有 backlog P2 项「regression.js 扩展位移映射」）；本轮为其落中间防线——数据集值池屏蔽（3.2-1）把数据区格变化的合法性从坐标改为值语义论证；扩展区位移（阶段3 任务⑤实证：模板 r3 总计 → 栅格 r12）仍未解，故 dataset 替换下执行栅格行/列数变化维持保守拒绝、changedCells 坐标屏蔽口径不变。
- 验证：S7a 本条目即本轮留证（坐标映射结论，PASS）；S7b Nashorn 真跑执行栅格行数变化仍 FAIL（映射未定案前保守拒绝未被拆除，PASS）。

**3.2-4（engine_launch Handle 失败不再空吞）**
- 反例：engine_launch.ps1 `try { $null = $p.Handle } catch { }` 空块（基线 S8a FAIL）——句柄分配失败被静默吞，ExitCode NULL 假绿风险无兜底。
- 修复：catch 内 Collect-UnregisteredSpawn（kill+wait 确认退出→撤 pidfile；否则 PENDING 留守供下次运行按身份拒）+ return 1 显式失败路径（不返回不可信 ExitCode）。
- 验证：S8a 结构断言（PASS）；S8b 真 java 正常路径回归 rc=0 + java.pid 身份已注册 pid+ticks（PASS）；真 Handle 抛异常黑盒不可确定性注入（PS5.1 句柄时序）——S8a 为结构断言口径，如实区分。

### 门禁（全部本轮真跑）
- promote/restore 矩阵 30/30 PASS（过程中 P11 曾因守卫重排红→修：SOURCE_HASH_MISSING 存在性检查先于 orig 哈希比对——守卫顺序也是合同）。
- fast16 FAST GATE GREEN / scan ok=62 bad=0 / 静态门 failures=0 / 基线 demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F。
- c-maturity e2e GREEN（新守卫下真链 create+validate+inspect+modify+promote）+ golden e2e PASS（runId=ge20261107111826-b80d6b，plan+create+validate+truth-grid+preview+modify+promote+restore+baseline-restore）+ 引擎负门 ENGINE NEG GATE GREEN（无假绿+默认基线完好）。
- S0 机制实证：部署目录前后清点对拍（logs/inv_before/inv_after）——一次 c-maturity e2e 改写 5 个文件，全部属于门禁自产件（工单参数查询C/车间双页日报C/生产日报图C 的 cpt/pdf；cpt/pdf 内嵌创建时间戳逐跑字节不同、png 像素确定性不变）；neg_secret_leak_api.pdf/png 为引擎负门自产件残留。验证器 S0 语义随之明确为：既有件零丢失 + 变化仅限门禁自产件白名单 + 白名单外零变化（不丢生产件的验证器侧铁证不变，验证器与沙盒用例本身仍全程只读真实部署目录）。全量终验 S0 二次实证：唯一白名单外 stray=销售明细_api.pdf——make_api 默认 spec（销售明细）的部署产物，每轮门禁末步默认 spec 收尾都重写（cpt 确定性字节不变、png 钉 A8EF39AB 由 fast_baseline 钉住、pdf 内嵌时间戳逐跑不同），已入白名单并注明依据。

### 三态报告
- PASS：3.1-1（S1a/S1b/S1c/S1d）、3.1-2（S2a/S2b）、3.1-3（S3a/S3b/S3c）、3.1-4（S4a/S4b/S4c）、3.2-1（S5a/S5b/S5c/S5d）、3.2-2（S6a/S6b）、3.2-3（S7a/S7b）、3.2-4（S8a/S8b）+ 门禁 S9a/S9b/S9c/S9d/S9e/S9f/S9g1/S9g2。
- NOT RUN：无——终验为全量模式（验证器 36 项检查在本轮提交后全量跑：S1a-d4+S2a-b2+S3a-d4+S4a-c3+S5a-d4+S6a-b2+S7a-b2+S8a-b2+S9×8+S10a-d4+S0）。
- BLOCKED：S3d 真进程 kill 注入（毫秒级窗口黑盒不可确定性注入；S3b/S3c 为确定性等价注入）；S8 Handle 抛异常真注入（PS5.1 句柄时序；S8a 为结构断言并如实区分）。S10b（HEAD==origin/main）受本轮执行环境约束不 push，提交后由外层流程收口。

### 独立复审
本轮执行者逐文件交叉复核：① promote/restore 全守卫仍先于任何部署件写路径，恢复分支不引入「先写后验」——COMMITTED 补记只发生在哈希身份证实之后，PREPARED 证据缺失时同字节态仍拒；② 恢复幂等：COMMITTED(recovered)→promote.json 重物化期间再崩 → 下次重试仍走恢复分支重物化，部署件零字节副作用；③ Compare-ManifestVerdict 对 execution/render/datasetChecks 缺失侧 fail-closed（presence 不对称即 mismatch），cosmetic 字段（pixelStats）不比较不误伤；④ fast_template 改钉三条新钉均为新合同正反对照，非放水（表头篡改/行数变化/无值池三向仍拒）；⑤ S0 白名单外零变化保持硬断言；⑥ diff.js dataset/plain 拆分后 structDelta/attrTokens 口径未动（fast_template 全钉复绿）。复审结论：本轮无未决缺陷，全部修复当场闭环；3.2-3 坐标映射作为既有研究方向继续挂在账本，不在本轮冒充收口。

## 2026-11-07（阶段3 第三阶段收口：S10b 快进 push + 3.2-3 真引擎映射探针 + 人工过目缺陷入账）

### 本轮动作

**S10b push 收口**：上轮 4675a67/c3ebd28 两提交经审查方 git ls-remote 实证未推送（origin/main=a82e8ba1b7d…，HEAD=c3ebd2852a8…），验证器 S10b FAIL 是真红不是误报；本轮按收口要求执行一次快进 push（git push origin main，无强推、无历史改写），push 后 HEAD==origin/main。

**3.2-3 真引擎探针（上轮「未定案」状态由本轮升级为「实测规律」）**：
- 新增 probes/probe_coord_map_expand.js（runraw 引擎路径；只在内存中换数据集+执行，不写部署目录、不导出、不杀 java；ASCII-only 源码、中文全部 \uXXXX 转义杜绝编码歧义）：靶件 fineagent/生产日报S3_api.cpt（plan 链产物，ds1=EmbeddedTableData，实测 N0=10、列 bizDate/planned/done/defect 无 DB 依赖），对 ds1 快照后取前 N 行（同列同型）换入并执行，N∈{2,5,10} 共 n=3 个测量点；静态标记=表头（业务日期 r1）/总计（r3）/脚注（口径 r5），数据块锚=首个 text 列首行值。
- 实测（PROBE PASS，rc=0）：块上静态行位移恒 0（header 1→1 全部 N）；数据块起点恒 r2；块下静态行 total 3→4/7/12（位移 +1/+4/+9）、note 5→6/9/14（+1/+4/+9）——规律=**数据块之下 grid_row = template_row + (N − k)，k=1=模板数据块行数，n=3 全一致**；N=10 的 +9 精确复现阶段3任务⑤的单点观察（模板 r3 总计→栅格 r12），该 n=1 观察升格为规律。
- 如实边界：本件数据块为单模板行（k=1）已证；多行数据块/合并单元格/列位移未测（backlog 继续）；规律确认≠解锁——dataset 替换下执行栅格行/列数变化仍保守拒绝（S7b PASS 不变），解锁行数回归是独立变更、需先泛化到多行块并按反例先行变更。
- S7a 留证升级：本轮新增探针文件（git --diff-filter=A 命中 coord/map 词根）+ 本条目实测数字双路留证。

**人工过目基线缺陷入账（审查方 PNG 人工过目发现；均为 create 链/夹具基线期既有问题，本轮 3.1/3.2 交付面未引入新视觉缺陷——modify 渲染 pre/post 像素差 bbox=147,55-420,146、0.25% 即标题格本身）**：四项全部入 night-shift-backlog P2 清单：①plan 链产物全表无内边框+完成数/完成率相邻粘连可误读（违反 AGENTS §2 内边框红线，对照钉基线 销售明细_api.png 合格）；②C1/C2 直建链合计行计划数总计被吞（README #71 total.label span=n−1 同族，真值栅格「合计|合计|合计|424」）；③golden 总计行机台列='0'（文本列被数值聚合）；④C1 脚注文案「红底」与实际黄底不符（夹具文本自身不准确，高亮色 16638754=#FDE322 与夹具一致）。

**值池单侧屏蔽加固挂账（审查方观察级发现，非红灯）**：regression.js 值池屏蔽生产路径只有新值池（patch_main 只传 datasetValues；patch.js:58 before.dataset 不带原值行）——「非数据格被改写为恰在值池内的值」单看执行回归会放行，但 diff.js plain 侧严格守恒兜底（未申报格文本变化→diffClean=false→promote 拒），defense-in-depth 成立；旧值池采集（datasetSnapshot→before.dataset.rows→datasetValuesBefore）入 backlog P3。

**微瑕修正**：上轮条目「验证器 34 项检查」实为 36 项（S1a-d4+S2a-b2+S3a-d4+S4a-c3+S5a-d4+S6a-b2+S7a-b2+S8a-b2+S9×8+S10a-d4+S0），叙述笔误本轮已改。

### 三态报告
- PASS：探针 PROBE PASS（n=3 规律一致 + 任务⑤ n=1 交叉验证 CONSISTENT，rc=0）；S10b push 后转 PASS；探针文件与文档本轮 commit 后 push。
- NOT RUN：无。
- BLOCKED：S3d 真进程 kill 注入与 S8 Handle 真注入延续上轮口径（毫秒级窗口/PS5.1 句柄时序黑盒不可确定性注入，结构断言与确定性等价注入已 PASS）。

## 2026-11-07（产品定位验证器：agent 全生命周期 e2e 单入口落地）

### 本轮动作
**改进项=造一个能驱动真实主路径的端到端验证器**（定位那件事的客观判定尺：没有尺子，每步「做好了」只是执行者自己的说法）：
- 新增 `scripts/run-agent-lifecycle-e2e.ps1`（单入口，exit 0=绿）：按外置 agent 的方式**仅经 agent/tools/fr_agent.ps1 契约行**（取最后一个 {..} 行）驱动全生命周期——发现（list_reports：count+reports[]，inspect 靶件从工具输出选、不硬编码）→理解（inspect_template 引擎只读逐格坐标／sample_data 只读 LIMIT 采样／resolve 三态+候选）→创建·检查·验证·修改·部署·回滚（**复用 scripts/run-golden-e2e.ps1 已验证链路于本 RunId，不重复实现 Golden v1**）→payload 审计（独立回读 runDir 文件真相：plan=ready、validate/artifact runId 绑定防陈旧、patch 三判定 diffClean/execution/render、promote/restore SHA-256 哈希链），fail-fast。
- 负控内置（`-NegativeControl`）：把核心入口替换为「输出为空」的 stub（logs/agent/e2e_neg/stub_fr_agent.ps1，不碰生产文件），验证器必须转红（rc≠0）负控才成立——空核假绿被结构性排除。
- 教训留痕：PS 5.1 `-File` 调用对**未在 param 块声明的命名参数静默忽略**、脚本照跑默认路径——首轮负控因此变成空转（跑成了正向全绿）；负控修复后按反例先行口径重跑成立。引申：任何「开关型验证入口」必须在真跑里证明它真的改变了行为。

### 验证结果（全部本轮真跑）
- 静态门 `verify/check_ps1_static.ps1` failures=0（新脚本 PARSE/ASCII 双 PASS）。
- 正向全链 PASS：`AGENT LIFECYCLE E2E PASS`（runId=ale20261107144347-338bfa，exit 0）：discover count=98 → inspect sheets=1 cells=16 → sample 5 rows → resolve=resolved(candidates=1) → golden 链 rc=0（plan+create+validate+truth-grid 33531:26531+preview+modify+promote+restore+baseline）→ payload 审计 OK。
- 负控 PASS：`NEGATIVE CONTROL HELD`（空核 → 验证器 rc=1，负控本身 exit 0）。
- 回滚字节级证据（本 run promote.json/restore.json）：origHash=6E86EA88EDCD→deployedHash=1A8C83411F20（promote 确实换了件），restore restoredHash==origHash（回滚后与改前逐字节一致）。
- 基线铁证完好：demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F；无 java 残留。

### 未验证事项/边界（如实）
- 本验证器覆盖定位链路的「入口可驱动+可见结果可断言」面；TABLE_DESIGN_STANDARD 人工过目清单与像素级排版质量仍属交付核对面（验证器不替代人工过目，AGENTS §1 口径不变）。
- 未并入 `scripts/run-integration-tests.ps1` 门（保持本轮最小交付，是否并门由外层流程决定）；未 push（约束，S10b 类收口由外层流程处理）。

## 2026-11-07（05b60c3 CWD 修复面收口：3 个引擎 verb 入口锚定 + e2e 跨 CWD 冒烟 + 05b60c3 补落账）

### 背景与证据
- 05b60c3 立论前提是「外置 agent 调用目录不可控」，但只修了 4 个零引擎 verb（_lib.readUtf absOf 单点化）；同一前提下 3 个引擎 verb 入口仍绑死 JVM CWD：agent/tools/fr_agent.ps1:226（create→run.ps1 -Script make_api.js）、:269（modify→runraw.ps1 'template/patch_main.js'）、:328（inspect_template→runraw.ps1 'template/inspect_main.js'）传裸相对脚本名，run.ps1:15/runraw.ps1:8/engine_launch.ps1:41,90,93 原样透传 nashorn，而 nashorn 相对脚本名按 JVM 工作目录解析——外置 agent 从任意非 D:\fineagent 目录调用，生命周期在 create/modify/inspect_template 三步必挂。
- 反例先行（本轮真跑复现）：TEMP CWD 下 ①fr_agent -Verb inspect_template -Target fineagent/demo_api.cpt → 契约行 ok=false rc=1，inspect.log 报 `java.io.IOException: template\inspect_main.js is not a file`；②run.ps1 -Script make_api.js -NoKill → RUN_RC=103，log 报 `make_api.js is not a file`（engine_launch.ps1:90）——文件未找到即退、引擎未启动（fail-closed 非假绿，但产品主链断）。
- 尺子盲区坐实：da86f25 交付的 run-agent-lifecycle-e2e.ps1 全程 $Root 绝对拼装、从不度量跨 CWD 可驱动性；night-shift-log 对 05b60c3 零落账（grep readUtf|absOf|单点化|换目录 = 0 命中）——下轮会把「换目录调用即崩修复」误读为端到端已可换目录。本条目即补落账。

### 实施（最小修复，不动 Runtime 冻结面）
- run.ps1/runraw.ps1 各一处：相对 -Script 经 IsPathRooted 判定后 Join-Path $PSScriptRoot + GetFullPath 归一为绝对（与 runtime/paths.js:20 FR_AGENT_HOME root 相对语义同构）；绝对路径恒等透传，engine_launch.ps1 未动。一处修三点——fr_agent.ps1 三个引擎入口全部受益，fr_agent 本身零改动；其余传相对名的既有调用点（scripts/run-golden-e2e.ps1:166、run-engine-negative-tests.ps1:55/72、run-c-maturity-e2e.ps1:103、run-multisheet-e2e.ps1:70，均 make_api.js）同受保护，从 $Root 运行的门禁行为零变化；绝对调用方（tools_abr_regr/tools_br_run/tools_prod_run）恒等。
- scripts/run-agent-lifecycle-e2e.ps1 补跨 CWD 冒烟：新增 Invoke-CrossCwdSmoke（作为 PHASE 0 随全量 e2e 每跑必测）+ -CrossCwdSmoke 独立开关（零引擎、秒级）；覆盖 6 个零引擎 verb（list_reports/discover/resolve/plan/plan2spec/sample_data，超出改进项最低 4 个），CWD=$env:TEMP 下按产品交接形态（root 相对 -Intent/-Sample）断言契约行 ok=true；含 plan→plan2spec 链交接。

### 验证结果（全部本轮真跑）
- 修后 TEMP CWD 产品路径：①inspect_template（靶件 fineagent/demo_template_final.cpt）ok=true rc=0，payload 实质 sheetCount=1/cells=16/datasets=1（首轮 demo_api.cpt 为不存在的靶件名，换 list_reports 工具输出选靶后过——靶名错误与 CWD 修复无关）；②run.ps1 -Script make_api.js 全链 rc=0、PIPELINE END failures=0、11 阶段全 passed；③整只 run-agent-lifecycle-e2e.ps1 从 TEMP CWD 跑全链 PASS（runId=ale20261107171222-6633fe，rc=0）——三引擎入口+全部零引擎 verb 在异目录走完整产品路径（含 truth-grid/preview/modify 三判定/promote-restore 哈希链/baseline-restore）。
- CWD 散落检查：TEMP CWD 跑 make_api 前后文件清单 diff=仅自建 -Out 日志，零散落（引擎读写均 FR_AGENT_HOME/FR_HOME 锚定）。
- 冒烟自证非空转：独立模式 PASS（6 verb 全 ok，runId=ale20261107171518-1a5c4fccw，ccs runDir 七件产物齐全含 plan.json/reportSpec.json 链）；空核 stub 下 SMOKE FAILED rc=1（fail-fast 生效，冒烟会红）；-NegativeControl 重跑 HELD rc=0。
- 门禁：fast16 GREEN（三铁证完好：CBEB42E3/6161F402/A8EF39AB）+ 静态门 failures=0（run.ps1/runraw.ps1/run-agent-lifecycle-e2e.ps1 三文件 PARSE+ASCII 双 PASS）+ 集成门 INTEGRATION GATE GREEN（rc=0，INTEGRATION END failures=0 skips=0，全量真跑含收尾默认 spec）。
- 门后复核：demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F；无 java 残留；git 工作区仅 3 个预期文件。

### 未验证事项/边界（如实）
- 集成门输出经 tail -20 截留：末 10 条 IT PASS 与聚合结论（failures=0 skips=0）在手，23 条 IT 逐条 transcript 未保留——聚合判定以脚本自身 rc=0 + INTEGRATION END 行为准。
- 冒烟只覆盖零引擎 verb 面；三引擎入口的跨 CWD 面由「整只 e2e 从 TEMP 真跑」度量（本轮已跑，runId 见上），未把引擎 verb 塞进每跑冒烟（引擎冒烟依赖 FineDB 健康，会毁掉秒级冒烟的稳定性）；该口径已写入 e2e 头注与 run.ps1 注释。
- 引擎负门（run-engine-negative-tests.ps1）本轮未跑（本轮改动不触 lib/ir/object/cpt 与引擎语义，集成门已覆盖 run.ps1 变更面；fast_baseline 三铁证完好）。

## 2026-11-07（P1×2 部署事务状态机收口：五态 deploy log + 已提交产物判据 + restore undo 未提交换件）

### 背景与证据（本轮逐行复核 + 反例先行实测）
- backlog fb16935 轮 P1×2（本轮读码复核属实并先红后绿）：① agent/tools/_deploy.ps1 Add-DeployStateEvent 用 `-ErrorAction SilentlyContinue` 追加 deploy_state.jsonl——PREPARED 写失败（磁盘满/权限/占用）后 fr_agent.ps1 仍执行 File.Replace，3.1-3 崩溃恢复赖以判定的证据丢失；② fr_agent.ps1 promote 入口 RUNID_EXISTS 只看 promote.json 存在性，替换成功但后验/提交失败的 promote.json(ok=false) 同时堵死同 RunId 重试与 restore（RESTORE_NO_PROMOTE 要求 ok===true）——部署件已是新字节却无任何工具路径能 commit 或回滚。
- 反例先行（改码前基线实测，`powershell -File scripts/run-promote-restore-tests.ps1`，pass=32 fail=8）：D1 exit=0（旧码 PREPARED 写失败照换件）；D2/D5/D6/D7 retry 全部 `RUNID_EXISTS` 死锁（exit=1，非重判）；D3 restore 对未提交换件态拒绝；X5 静态两项红（SilentlyContinue 在案、SWAPPED/FAILED_* 缺失）；既有 30 例全 PASS（零回归基线），真实部署目录篡改证据 308 文件 MD5 比对=零改动。

### 实施（最小改动：_deploy.ps1 一处 + fr_agent.ps1 五处，不动 Runtime 冻结面、不动引擎 verbs 判据）
- `_deploy.ps1` Add-DeployStateEvent：写失败即抛（try/Add-Content -ErrorAction Stop/catch throw 明确诊断 `deploy_state.jsonl write failed: ...`）——主流程事件事务化：PREPARED 失败=换件前终止（D1）、COMMITTED 失败=显式 ok=false 未完成态（由重试补完成）。
- fr_agent.ps1 promote/restore 体：deploy log 五态 `PREPARED → SWAPPED → COMMITTED` + 失败 catch 写 `FAILED_BEFORE_SWAP/FAILED_AFTER_SWAP`（catch 内 best-effort，诊断权威面=ok=false 产物，不掩原始错误）；promote.json/restore.json 的 `concurrencyBoundary` 补持久化口径（恢复覆盖进程崩溃、非断电级，OS 缓冲写无 fsync）。
- fr_agent.ps1 RunId 判据（fix ②）：新增 `Test-ArtifactCommitted`（不可读=true fail-closed）；门与 `Invoke-UnderMutex`（新参 DupCheckCommittedOnly，promote/restore 传 true）对 deploy verbs 改按**已提交产物**判重——ok=false 放行重入并完整重跑守卫链；引擎 verbs（compile/patch/inspect）维持产物存在性判据不变（r22e 跨污染守卫未动）。
- fr_agent.ps1 restore 体：promote 状态三路判定——ok=true 走原记录链；ok=false 仅在 deploy_state 有匹配 patch manifest sourceHash 的 PREPARED promote 记录时放行 **undo 未提交换件**（restore.json 记 `undoUncommittedPromote=1`，期望哈希取自该记录 stagedHash、orig 期望=manifest.sourceHash）；其余 ok=false 与不可读 promote.json 一律 RESTORE_NO_PROMOTE；恢复分支与 DEPLOYED_CHANGED 判定改用统一 $expectDeployed（undo 路径下=PREPARED.stagedHash），undo 路径下 deployed 已==orig 时给精确「无未提交字节可撤销」拒绝。nextActions 同步新出口（同 RunId 重试/undo/新 RunId modify）。

### 验证结果（全部本轮真跑）
- 矩阵转绿：`scripts/run-promote-restore-tests.ps1` 40/40 PASS（新增 D1–D8+X5×2 全绿；D1 换件前终止+诊断、D2/D5 重试补提交 recovered=1、D3 undo undoUncommittedPromote=1、D4/D8 守卫钉、D6 守卫拒绝重入再拒不 RUNID_EXISTS、D7 锁定失败重试成功、X5 静态两项），既有 30 例零回归，篡改证据零改动。
- 静态门 `verify/check_ps1_static.ps1`：failures=0（fr_agent.ps1/_deploy.ps1/run-promote-restore-tests.ps1 PARSE+ASCII+无硬编路径 PASS）。
- 集成门 `scripts/run-integration-tests.ps1`：INTEGRATION GATE GREEN（INTEGRATION END failures=0 skips=0，S1–S28 全量故障注入真跑，含 S9d 本矩阵）。
- 真实 E2E `scripts/run-agent-lifecycle-e2e.ps1`：PASS exit=0（runId=ale20261107174522-03410d，discover+理解+create→truth-grid→preview→modify→promote→restore→baseline-restore+payload 审计+负控；promote/restore 哈希链在案）。
- 三铁证：demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F / demo_template_final.cpt=6161F402B340321B4ABF68B68E301828 / 销售明细_api.png=A8EF39AB648D5F00DDAE0481D0313110，逐字节完好；java 残留=0。

### 未验证事项/边界（如实）
- 「替换后哈希复核失败」（换后字节≠staged）本身黑盒仍不可确定性注入（NTFS File.Replace 原子，矩阵头注既有口径）；其状态面由确定性等价注入覆盖：ok=false+PREPARED+部署件=staged 字节（D2/D3/D8）与 ok=false+部署件=外部字节（D6 走 SOURCE_CHANGED 重判）。换后复核失败的直接后果（catch→FAILED_AFTER_SWAP+ok=false）与后续出口（重试补提交/restore undo/准确拒绝）均已被上述用例钉住。
- D2/D3/D5/D8 的「提交记录丢失」用重写 promote/restore.json ok=false 模拟（真实触发=COMMITTED/promote.json 写失败，同属 Add-DeployStateEvent/WriteAtomic 写失败族，状态面等价）；D1 的 PREPARED 写失败用 deploy_state.jsonl 置为目录注入（黑盒、无代码钩子）。
- 断电级（fsync）语义未实现也未声称——按 backlog 要求如实声明支持范围=进程崩溃恢复（promote.json concurrencyBoundary 字段+runtime-supervisor.md §7+agent-tools.md 均已写明）。
- 引擎负门（run-engine-negative-tests.ps1）本轮未跑：改动面=agent/tools PS 层与矩阵/文档，不触 lib/ir/object/cpt 与引擎语义；集成门+E2E 已覆盖。

## 2026-11-07 全面闭环：六类断点修复（直接执行）

### 断点与处置
1. **Planner 词表窄** — ①capability.intentFeature 移除 chart 越权（两路已支持；filters 仍 deferred）②planner rows 顶层 intent.chart → presentation.chart ③fast_planner 断言改向。真通道验证：组合 intent（chart vbar+label+legend + total.aggregate avg + cells + params.filter + hideRows）plan→plan2spec→create 全链 PASS（runId=plan_full_004，artifact exit=0，部署 cpt VanChart×21/AVERAGE×1/CommonCondition×2）。
2. **rows 路出图** — spec_validator 放开 + compileRows chart 块发射；载体 rows_chart.json 真引擎 PNG 柱形图。
3. **多 Sheet SQL extra** — compileSql opts{dsName,sheetName} + compile 按 kind 分发 + make_api deps 触发扩展；载体 multisheet_sql_extra.json 全阶段 passed（真连库），cpt 2 Report/ds2/DBTableData。
4. **inspect_template 深度** — inspector.cellMeta（formula/dsColumn/chartClass/colSpan/rowSpan）；实测 销售明细_api.cpt 返回 =SUM(D3)/dsColumn×4/colSpan=4。
5. **回归载体接满** — scan_all_specs 扩展至 examples/report-spec/*.json（ok 62→84）+ reports/test_mapdeco_ir.js（→85）；manifest 回归 pending→verified：mapLabel/mapTooltip/hyperlinkCell/mapTooltipFormat。
6. **agentAvailable 升级** — vmap/vheatmap（rows 路 e2e 实证）→true；mapLabel（四层全 verified，scan 载体入册）→true。剩余 false 均有明确原因（serialization-only 渲染 / 引擎墙 / 无 plan→create e2e）。

### 视觉 pending 裁定（照 D1 先例）
seriesBorder（柱缘无可见框+无官方语料）、seriesImage（棋盘格判别阴性）= 引擎/无头渲染墙，维持 pending 并写明重开条件。

### 门禁
fast16 rc=0 / scan 85 ok 0 bad / 基线 MD5=CBEB42E3 不变 / 全部已 push。

## 2026-11-08 能力账本口径收口（外部复核全量修复）

### 复核结论采纳
当前账本一处真相：manifest 72 项登记 / 50 项 agentAvailable / 22 项未承诺（旧快照 60/38/missing=32/127 构造类已废）。四类计数单位（240 demo CPT / 223 demo 类 / 139 object 构造类 / 72 能力项 / 15 verbs）不可相除。

### 修复项
1. **E5 两项补证升 true**：①cells.rowSpan——spec_validator 放开 presentation.cells.rowSpan（正整数闸），载体 cells_rowspan.json 真引擎 failures=0 部署 cpt rs="2"；②spec.params.filter——plan→plan2spec→create 全链 PASS（runId=e5filter001）。agentAvailable 48→50。
2. **22 项未承诺成因入账**：manifest 新增 unavailableCatalog()/unavailabilityReason() 自动分类（webInteraction 12 / unverifiedRendering 3 / notImplemented 4 / rejected 3）+ totals 字段；不再用一句"真实原因"笼统带过。
3. **证据强度口径**：evidenceGrade.fullE2e 名单 + note 明示"agentAvailable=可按账本承诺，不等于每项都跑过全生命周期"；remaining 为 layerEvidence。
4. **机器级一致性门**：verify/fast_capability_gate_consistency.js（注册进 fast 第 17 套件）——manifest totals/分类/rejected 不开放/agentAvailableNames 一致；PlannerCapability 与 ReportSpec.capabilities 的 chart/filters/multiSheet/聚合口径一致；evidenceGrade 子集断言。
5. **旧快照清理**：AGENTS.md §6、README 当前口径速查、capability-matrix 七源、inventory 构造类数全部刷新；capability-closure-audit.md 只加"当前口径提示"不改历史审计结论。
6. **seriesImage 反转结论落账**：AttrSeriesImageBackground 挂 ConditionAttrList+ChartCommonCondition 后渲染达成（官方国旗柱图一手），rendering pending→verified；seriesBorder 高对比仍无框，订正为"渲染未达成、无官方语料"而非已证引擎墙。

### 验证
fast 17/17 rc=0；scan ok=87 bad=0；基线 demo_api.cpt MD5=CBEB42E3CE48E46E362B9AE80168026F；真引擎：cells_rowspan/e5filter001 全链 PASS；全部已 push。

### 未决（非本轮缺陷）
F8 写库/凭据授权；web 交互类 12 项的验证口径政策（是否将 serialization-only 视为可承诺）；bubbleAttr/seriesBorder/spec.rows.cells 的渲染证据；poly/freezeWeb/databaseDict 未接线。

## 2026-11-08 层间协调一致性：全层对账 + jar 级 E1 锚定（用户："从自然语言理解到 CPT 生成验证，含引擎 jar 分析，全层一致"）

### 目标
回答"各层是否真的接上并互相一致"：Agent 自然语言 → intent/planner → ReportSpec → IR → Object → CPT → 部署/验证 → 引擎渲染；并把引擎证据从"demo CPT 见过"升级为"核心 jar 物理类对账"。

### 代码证据（先量后改）
- 旧层门 `capability-layer-gate.ps1`：Planner 层＝`sourceText.Contains('presentation')`（任何图表能力都会 PASS）；IR/Spec 层＝`Contains(token)`；只有两态，无 UNKNOWN。→ 典型假阳性。
- 72 项首次全量扫描：agentAvailable 50 项中有 5 项（template.patch.*、agent.*）在 probe/ir/spec/planner 全 UNKNOWN 且证据未指向存在载体 → 入口不闭环；chart.vscatter/vbubble 的 planner 合同探针形状错（漏 x/y）→ 假阴性 2 项。
- jar 面：安装 102 核心 jar / 140,118 类；此前只有 jar_scan 关键字工具与 coverage 文字结论，没有账本×jar 机器对账；manifest 仅 5/65 verified 能力的证据点名 com.fr 类。

### 实施
1. `agent/tools/fr_agent.ps1` restore：按本 RunId 重放 PREPARED→SWAPPED→COMMITTED，promote.json 三哈希逐字段比对；跨 RunId 同哈希事件/篡改 origHash 一律 COMMIT_CHAIN_MISMATCH；撕裂尾行仅在 TornTail 时作结案证据（D10 保持）。矩阵 +D15/D16 = 48 例。
2. `scripts/capability-layer-gate.ps1` 重写判定：IR/Spec＝运行期词表精确成员；Planner＝真实 `ReportPlanner.plan()` 输入→输出断言（47 合同 + 3 负控 selftest，负控被接受则全部 planner PASS 作废）；新增 tool 层（工具族 verb+实现+载体静态接线）与 jar 层（engine_class_map→jar 物理存在）；三态 PASS/BLOCKED/UNKNOWN。
3. `scripts/build_jar_inventory.ps1` → `data/jar_class_inventory.json`（102 jar/140,118 类/包计数/182 管线点名类全解析 missing=0；修了 -match 大小写不敏感把类名剥成包名的 bug，改 -cmatch）。
4. `data/engine_class_map.json`：能力→类→落地模块单一真相（62 verified 锚定，3 agent.* runtime 无引擎类，6 pending/rejected 记录原因）。
5. `verify/fast_layer_coherence.js`（第 18 套件）：I1 承诺有实现 / I2 承诺有入口 / jar 锚定（类在 jar 且在模块字面量）/ 清单指纹，72 项 0 违反。
6. 报告：`docs/architecture/layer-coherence.md`（11 层定义 + 分布 + 诚实清单）。
7. 文档与账本口径同步（第三轮）：`lib/ir.js`/`lib/report_spec.js` 里 vmap/vheatmap/spec.params.filter 的旧 `agentAvailable=false` 文案改为与 manifest 一致（这些能力已在 e5filter001/vmap_rows/vheatmap_rows/cells_rowspan 全链或 spec 真引擎实证后升 true）；`docs/architecture/capability-matrix.md` 与 `native-capability-inventory.md` 的 rowSpan/vmap/vheatmap/params.filter 旧"部分/✗"状态同步更新并标注日期（历史结论保留在 git history）。

### 验证结果
- 层门 72 项×11 层：I1/I2/I3(承诺侧)/I4(负控) 违反=0；分布 jar 63/6/3、tool 5/2/65、planner 47 PASS/25 UNKNOWN（无 BLOCKED）。
- fast 18/18 rc=0（含新 fast_layer_coherence）；scan ok=87 bad=0。
- 默认管线 `run.ps1 -Script make_api.js` failures=0，全 stage passed；`demo_api.cpt` MD5=CBEB42E3CE48E46E362B9AE80168026F（仓库根实测）。
- 部署矩阵 48/48；静态门 failures=0；引擎负门 GREEN（no false-green, default baseline intact）；集成门 S1-S28 GREEN failures=0 skips=0。
- 全链实测：`run-golden-e2e.ps1` PASS（runId=ge20261108053139-20f321）——plan→plan2spec→create→validate(逐格真值)→preview→modify(diffClean)→promote→restore→baseline-restore，自然语言意图到引擎回读整条链在本轮改动后仍闭合。
- 未验证：jar 层"类被调用"是静态字面量断言（非运行期堆栈），运行期由各 carrier failures=0 承担。

### 未决
- planner 合同 25 项 UNKNOWN（装饰/工具/运行时族）需逐族补"意图→发射路径"载体后再开合同；ir/spec UNKNOWN 多为设计内（入口不在该层）。
- render 22 项 BLOCKED＝web 交互/静态 PNG 不可见（已定性）；seriesBorder 渲染未达成维持 pending。

## 2026-11-08 层间一致性第 4 轮：planner 图表坐标归一 + spec 可执行合同

### 目标
把上一轮"词表成员"式的 spec/planner 判定升级为**可执行合同**，并补齐地图装饰族在 spec/planner 路的真实断点。

### 代码证据
- planner rows 路：dims/metrics 经 mapTerm → 物理列（bizTime→biz_time、rowNo→row_number），但 `presentation.chart.category/value/x/y/bubbleSize` 原样透传 → plan 报 ready，`SpecCompiler.compile` 后 `Ir.validate` 报 UNKNOWN_REF（chart category not in dataset columns）。
- 5 项装饰能力（mapLabel/mapTooltip/mapTooltipFormat/hyperlinkCell/hotTooltip）IR/Object 已支持，但 planner 无合同、spec 广告面无键 → 三层口径不一致。

### 实施
1. `semantic/planner/planner.js`：rows 路 chart 引用按已解析 label→field 归一（物理列原样保留、未知引用不臆造、clone 后修改不动调用方 intent；sql 路不动——其引用是别名）。
2. `verify/fast_planner.js` +4 断言：术语归一/物理列原样/未知不臆造/不改调用方。
3. `scripts/capability-layer-gate.ps1`：①5 项新 planner 合同（形状由 Ir.validate 逐键闸校验）②spec 层升为可执行合同——plan→SpecValidator→SpecCompiler→Ir.validate 全绿才 PASS。
4. `examples/report-spec/mapdeco_rows.json`：地图装饰 spec 路载体入 scan。

### 验证结果
- 层门 72 项：spec PASS 27→38、planner 47→52（UNKNOWN 45→34 / 25→20）；I1/I2/I3/planner-BLOCKED 违反仍为 0。
- fast 18/18 rc=0（fast_planner 全绿）；scan ok=88 bad=0（新载体）；multisheet e2e GREEN（rows plan→create 回归）；默认管线 failures=0；demo_api.cpt MD5=CBEB42E3CE48E46E362B9AE80168026F。
- **真引擎 create（mapdeco_e2e_002）PASS**：examples/report-spec/mapdeco_rows.json → cpt_validate/render/deploy/roundtrip 全 passed；部署 cpt 含 AttrMapLabel×3 / AttrMapTooltip×3 / AttrTooltipAreaNameFormat×6 / AttrTooltipMapValueFormat×5 / VanChartMapPlot×3；PNG 1587×2245 / 26,198B（首跑暴露并修复载体缺 formula cell：showTotal:false→true，CPT GATE missing formula cell）。
- **真引擎 create（hotdeco_e2e_001）PASS**：examples/report-spec/hotdeco_rows.json（vbar + hotTooltip + hotHyperLink）→ 全 passed；部署 cpt 含 newHotTooltipStyle×2 / ChartHyperRelateCellLink×2 / NameJavaScriptGroup×2；PNG 24,293B。=> hotHyperLink/hotTooltip 也升到真引擎 create 证据。
- 至此本轮 5 项新增合同全部具备真引擎 create+渲染证据（scan 载体 89 项）。

### 未决
- planner 20 项 UNKNOWN：工具/运行时族 + 部分装饰（无 spec 表面），保持诚实。
- seriesBorder 渲染未达成（高对比仍无框，维持 pending）。

### 第 5 轮小项收口（同日）
- IR 词表映射：`$irTok` 默认取叶名（条件族 condition.formula/column/list 此前漏判 UNKNOWN）；`Ir.capabilities().sheet` 补 headerFooter（IR 校验+object 均支持，广告面缺列）；ir 层 PASS 44→48。
- 两个真引擎 create 载体（mapdeco/hotdeco）自动进 scan（ok=89）；create 按管线惯例回写仓库根 demo_api.cpt，按纪律最后默认 spec 回补后才跑 fast——首次 fast 因时序在回补前执行而 baseline 失败，回补后 FAST GREEN（记录该 sequencing 纪律）。

### 第 6 轮 seriesBorder 渲染攻坚（三次挂载实验，阴性收口）
- 目标：判断 seriesBorder 是"挂错槽"（像 seriesImage 那样可修）还是引擎墙。
- 判别载体：`reports/test_seriesborder.js`（vbar + 红 0xFF0000/style=3/alpha=1；柱默认蓝，PNG 采样出现红像素才算画出）。
- 实验（每次真引擎 render 后按像素判定，采样步长 2）：
  1. DefaultAttr.addDataSeriesCondition(AttrBorder) → deployed cpt AttrBorderWithAlpha=1，**sampled red=0**
  2. ConditionAttrList 命名 ConditionAttr + ChartCommonCondition(CATEGORY_INDEX) + AttrBorderWithAlpha → cpt ConditionAttrList=2/seriesBorder=2，**sampled red=0**
  3. 同挂载 + AttrBorderWithWidth（setLineWidth=3；probe 反射=无参 ctor+setLineWidth）→ cpt AttrBorderWithWidth=1/lineWidth=1，**sampled red=0**
- 反射一手（probes/probe_seriesborder_api.js）：AttrBorder/WithAlpha/WithWidth/WithShape 全部 extends DataSeriesCondition；WithWidth 只有无参 ctor+setLineWidth；240 demo 语料 AttrBorder 均属 GI 图框（`<GI><AttrBorder>`），AttrBorderWithWidth 零命中。
- 结论：本版引擎 data-series 条件通道不画柱缘描边——三次假设均阴性，按三轮规则停止；生产代码回滚到原实现（不留未验证改动），manifest `chart.seriesBorder.rendering` 维持 pending、agentAvailable=false，证据补三次像素阴性+重开条件（找到官方 seriesBorder 语料或系列级宿主 API）。
- 验证：scan 覆盖新载体；fast_manifest_evidence 通过；基线回补 CBEB42E3。

### 第 7 轮 vpie 标签/汇总视觉复核（四次实验，判否入账）
- 目标：把 AGENTS §6 "vpie summary 视觉 pending" 判清（渲染达成 / 挂错槽 / 选错类）。
- 实验（test_vanchart vpie 臂，真引擎 render 后 PNG 目检）：
  1. 命名 ConditionAttr + 恒真 ListCondition（现实现）→ 饼图无任何标签文字
  2. 命名 ConditionAttr + ChartCommonCondition(CATEGORY_INDEX>=0) → 无
  3. ConditionCollection DefaultAttr（官方 基础饼图.cpt 的 AttrLabel 挂法）→ 无
  4. label position 0（对齐官方 XML）→ 无
- 官方语料一手：`PieCategoryLabelContent` 出现在 `<gaugeValueLabel class="...AttrLabelDetail">`（仪表值标签）；饼图 `labelDetail` 内容是 `AttrToolTipContent` + value/percent/category/series format 开关。
- 结论：现行 `label.summary → PieCategoryLabelContent` 的 vpie 选型疑错（该类是 gauge 值标签），饼图标签/汇总视觉未达成；manifest chart.label 证据补四次阴性+官方结构一手，维持"仅序列化、不承诺渲染"；不升层、不虚报。生产代码回滚。backlog 新增 P3（改 AttrToolTipContent 开关或以正确宿主重实现）。
- 验证：基线默认 spec 回补 CBEB42E3；fast_manifest_evidence 通过；scan 不变。

### 第 8 轮 业务验收 G2（组合报表全链，真实库）
- 目标：用一份组合业务报表把 SQL 真库 + 图表 + 页眉页脚 + 合计 + 修改链一次性跑通，并给 page.headerFooter 补全链证据。
- 载体：verify/fixtures/golden/g2_intent.json（ATOM_LIVE；bizDate×machine；metrics planned/done/completionRate；dateRange 9/13-9/22；presentation.chart{bar,bizDate,planned}；sheet.headerFooter header.center/footer.right；showTotal）。
- 首跑失败（真缺陷路径实证）：IR 明确拒 `headerFooter.header.center` 字符串形态（must be a non-empty array）→ 载体改为 `[{text,bold}]` 数组后通过；说明 IR 闸有效、载体形状须按契约。
- 结果：run-golden-e2e 全链 PASS，runId=ge20261108081409-3c1bc7——plan→plan2spec→create→validate（逐格真值 10 day@machine 行 + 合计 33531:26531）→preview（1587×2245/44,068B）→modify（diffClean+orig 保留）→promote→restore→baseline-restore。
- 账本：page.headerFooter 入 evidenceGrade.fullE2e（证据=本次 G2）；spec.sql.chart / chart.bar 同步入 fullE2e（G2 的 SQL 图与 legacy bar 均真实出图）。
- 验证：基线 demo_api.cpt MD5=CBEB42E3（harness 末步 baseline-restore）；fast/scan 见下条。

### 第 9 轮 SQL 路条件高亮接通 + G3 业务验收（真实能力缺口）
- 问题（G3 首跑证据）：`presentation.conditions` 在 sql 路被 spec_validator 拒绝（条件/cells/total 一锅拒），compileSql 也不发射；但 condition.* 账本 agentAvailable=true → 账本承诺与生产主路（SQL）能力不一致。
- 一手核对：IR 的 cells item 支持 conditions（checkConditions/applyConditions），object 在 cells item 上逐格挂 highlight；只需 compileSql 发射。
- 实施：
  1. lib/spec_compiler.js compileSql：按 `cd.column` 把 conditions 挂到对应明细 item（无 column=块级挂全部；剥离 column 键只留 when/then，IR 词表同规）
  2. lib/spec_validator.js：sql 路 conditions 放开（cells/total 仍拒——无编译面/未验证）
  3. verify/fast_report_spec.js +3 断言（sql conditions 放行、cells 仍拒、total 仍拒）
  4. 载体 verify/fixtures/golden/g3_intent.json = G2 + 参数面板 + 条件（when.formula `=E3<75`、then.color 0xFF0000 + bold）
- 两次真引擎迭代（证据驱动）：
  - 首跑 then 用嵌套 style → IR 明确拒（COND_THEN_KEYS 扁平词表）→ 改扁平 {color,bold}
  - 二跑公式 `=E2<60`（锚点错，明细从 r3 起且全部完成率 67-88）→ 三跑 `=E3<75` 命中 6 行
- 结果：run-golden-e2e 全链 PASS（runId=ge20261108082641-e5ede7；10 行逐格真值+合计 33531:26531）；部署 cpt 含 FormulaCondition/ForegroundHighlightAction；**PNG 红字 1411 像素**（条件高亮真实渲染）。
- 账本：condition.formula / condition.then.style 入 fullE2e；spec.params.panel 保持 serialization-only（面板是 web 交互面，不能进 fullE2e 子集——fast_capability_gate_consistency 的 fullE2e⊆agentAvailable 断言首次拦下，按账本口径修正而非放宽断言）。

### 第 10 轮 剩余项定性（用户追问"是做不到吗"）——三类归因 + 新一手
- seriesBorder（柱缘描边）：probe_labelcontent_api 活对象反射一手——AttrLabelDetail 只提供 `setBorder(AttrBorderWithShape)`（**标签边框**）；Plot/GeneralInfo/VanChart 只有 setBorderStyle/Color/RoundBorder（**图框**）；全类面无柱系列描边宿主。结合此前三次挂载像素阴性 → 判定**本版引擎不提供柱缘描边（引擎能力墙）**，rendering 维持 pending、不承诺；标签边框属另一能力，若需要另行立项（backlog）。
- vpie 标签内容：按官方结构以 AttrTooltipContent（setValueFormat/setPercentFormat…）实现两次——⑤新建 content → cpt 导出期 CHART SERIALIZED 门失败（ChartCollection 整体丢失）⑥复用 detail 自带 content 仅翻 percent 开关（补 CoreDecimalFormat）→ 同样失败。判定**本版 headless 构建 AttrTooltipContent writeXML 不可用（序列化墙）**；实现已回滚，backlog 记录"未来解锁时重实现 / 在此之前 label.summary 应 IR 明确拒"。
- web 交互类 render BLOCKED：AGENTS §5 禁止 GUI 自动化（浏览器属用户地盘），只能做到序列化证据，不能声称渲染验证——政策边界，非能力。
- planner 不承载的 write/template/agent 族：设计如此（入口在 serialization/tool 层），UNKNOWN 是诚实状态，不是"没做"。
- F8 写库/凭据：需用户显式授权（不可逆/凭据面），尚未授权。
- 本轮代码零改动（实验均回滚）；manifest 证据与 backlog 更新；门：基线 CBEB42E3（默认 spec 回补）、fast 18/18、scan ok=90。

### 第 11 轮 seriesBorder 反转达成（用户质疑救回一个误判）
- 用户质疑："柱缘无宿主？你不是在 demo cpt 得到的柱缘吗？"——质疑成立。复盘：①官方 551 处 `<AttrBorder>` 就在 ConditionCollection DefaultAttr AttrList（BarChartOfPicture.cpt 等），lineStyle 只有 0/1；②我此前载体用 style=3（越界）+ AttrBorderWithAlpha（该通道引擎不画）→ 三次阴性被我误读成"无宿主/引擎墙"；③probe_border_hosts.js 穷举 2416 个 chart 类/105 个 Border 宿主方法，含 VanChartBarDataPoint.setBorder/ColorInfo.setSeriesAttrBorder——"无宿主"作废。
- 修复与达成：清空既定假设后按官方形态 `AttrBorder(color, style=1)` 走 DefaultAttr 通道 → 真引擎 failures=0，**PNG 红边 596 像素**（首次达成）。
- 代码收口：IR 闸 style 仅 0|1（官方语料 563×0/134×1）、alpha 键明确拒（AttrBorderWithAlpha 不画，写了不生效）；object 只用 AttrBorder；fast_ir_contract +4（0/1 合法、3 拒、alpha 拒）。
- 账本：chart.seriesBorder rendering pending→**verified**、agentAvailable=true（四层全 verified）；证据改为达成记录+官方语料一手；"引擎墙"旧结论作废并在证据里写明。
- 验证：载体 reports/test_seriesborder.js 真引擎 failures=0 且红边 596px；基线待回补；fast/scan 待跑。
- 验证（最终）：默认管线 failures=0 且 demo_api.cpt MD5=CBEB42E3；fast 18/18 GREEN（含 fast_ir_contract +4、capability_gate_consistency 72/51/21 口径、layer_coherence 51/51）；scan ok=90 bad=0（两个旧载体 alpha 字段按新契约移除）；引擎负门 GREEN；层门全量 sweep：render 51 / agent 51。

### 第 12 轮 标签边框新能力（用户指定：先做标签边框，再处理 vpie）
- 官方一手：全量 corpus **268/268 处 `<AttrBorderWithShape>` 位于 `labelDetail`**，lineStyle 全 0、shapeType 全 `RectangularMarker`；活对象反射=AttrLabelDetail.setBorder(AttrBorderWithShape)，setter=setBorderColor/setBorderStyle/setShape(MarkerType)/setAutoColor。
- 实施：IR `chart.label.border`（keys=color|style|shape；style 仅 0|1；shape 仅 'rect'；未知键/类型拒）→ object 构造 AttrBorderWithShape 挂 labelDetail.setBorder；fast_ir_contract +4。
- 首跑像素红=0 但图片显示**白色圆角标签框**——根因=AttrBorderWithShape 默认 `autoColor=true` 忽略自定义色；`setAutoColor(false)` 后 **PNG 红框 244 像素**达成。
- 载体：reports/test_labelborder.js（vbar label enable + border red/style1/rect）。账本新增 `chart.labelBorder` 四层 verified、agentAvailable=true（72→73 项 / 51→52 承诺 / 21 未承诺）；engine_class_map 锚 AttrBorderWithShape（jar inventory 重建，resolved=182/missing=0）；层门新增 planner/spec 合同。

### 第 13 轮 vpie 标签内容（用户指定：标签边框之后处理）——三次新路线均序列化墙
- 隔离实验（关键）：同代码下 **vbar + label.percent 开关 → 管道全 PASS（CHART SERIALIZED 通过）**；仅 vpie 失败 → AttrTooltipContent 路径本身可用，问题在 vpie 的 label content 写路径。
- vpie 三次新路线（每次真引擎）：
  ① 复用 detail 自带 content + setPercentFormat（补 CoreDecimalFormat）→ CHART SERIALIZED 失败（ChartCollection 丢失）
  ② 显式 new AttrTooltipContent + setContent + percent → 同样失败
  ③ 官方 demo 实际用法 label.richText（${SERIES}: ${PERCENT}，PieCategoryLabelContent+richTextAttr）→ 同样失败
- 结论：本版 headless 的 vpie 标签内容写路径（AttrTooltipContent/PieCategoryLabelContent 的 writeXML）修改即丢 ChartCollection——序列化墙确认；代码已回滚（AL 开关键与 object 分支移除，不留半成品），backlog P3 保留并补"vbar 隔离实验"证据（排除 AttrTooltipContent 类本身的问题）。
- 未验证：该墙是否与 vpie 的 label 挂载/条件集组合有关（官方 demo 用命名 ConditionAttr 条件属性4，与本实现同构；仍失败）。

### 第 14 轮 frserver 生命周期工具（web 交互验证前置，用户授权后）
- 由 `server/lib`（完整 Tomcat）无头启动 `webapps/webroot`，不启动设计器 GUI、不改生产安装文件：
  scripts/frserver.ps1 start/status/stop；临时 catalina.base=logs/frserver_base（conf 复制、appBase/
  common.loader 绝对化、Connector 端口参数化），Bootstrap start，就绪=/webroot/decision 200；
  pidfile 只停自己起的 java。
- 实测：start → ready http=200 pid=49752（Tomcat 服务器启动 ~186s）；status → alive=True http=200；
  stop → stopped、端口释放。首版 Probe-Http 对 302→/login 读 Response 失败（http=0 假未就绪），
  改为跟随重定向后 200 判定。
- 阻塞：报告页 `decision/view/report?viewlet=...` 302→/login，需 FR 账号密码；已向用户请求。
  未登录前不改任何账本（webInteraction 维持 serialization-only），待凭据后做浏览器级
  tooltip/超链/工具栏验证并留证据。

### 第 15 轮 web 交互验证第一轮（frserver + test/test，用户授权）
- 环境：scripts/frserver.ps1 start（Tomcat 8705）→ 浏览器自动化登录 test/test → 打开已部署报表；验证后 stop、基线回补 CBEB42E3。
- 已验证：①G3（SQL 路）web 整页：表体 10 行/合计 33531:26531/完成率<75 三行红字/底部柱图/原生工具栏；②tooltip 悬停实测（2026-09-16 / planned: 5333 浮层，截图 logs/webverify/g3_tooltip.png）。
- 发现真实缺陷：内嵌 rows 图 web 端 canvas 300×150 painted=0（表格正常、SQL 路正常、官方内嵌图同形状）；SumFunction 实验无效已回滚 → backlog P1。
- 未完成：自定义 AttrTooltip web 悬停、自定义工具栏可见性/点击、超链钻取点击；submit 写库未授权 F8。
- 证据：logs/webverify/{evidence.md,g3_web_page.png,g3_tooltip.png,rows_chart_web_blank.png}。

### 第 16 轮 web 验证第二轮（批量：内嵌图官方对照 / 工具栏 / 超链）
- 官方内嵌图对照（关键）：同一 frserver 打开官方 demo/chart/ColumnChart/国旗柱形图.cpt（内嵌数据）→ canvas 300×150 painted=0，与我们的 rows 图一致；SQL 路 G3 正常 → 内嵌图 web 不渲染=无头 Tomcat 部署环境/会话限制（官方同样），不是我们的序列化缺陷；backlog 由 P1 降为 P2 环境调查。
- 自定义工具栏：能力自检_填报章 web 端出现序列化的 **提交** 按钮（ToolBarManager/Submit）与"保存为常用参数组合"；未点提交（F8 未授权）→ write.toolbarButtons web 可见性有实证、点击未验证。
- 超链：销售明细_超链 的 ReportletHyperlink 序列化与官方 比例信息查询.cpt 同构；web 三次点击（getByText/JS el.click/坐标 cua.click）均未导航 → 未验证（不是已证明损坏），backlog P3。
- 收尾：停服、默认 spec 回补基线 CBEB42E3；证据 docs/architecture/web-verification.md + logs/webverify/。

### 第 17 轮 web 验证第三轮（自定义 tooltip G4）
- 载体：verify/fixtures/golden/g4_tooltip_intent.json（SQL 真库 + vbar + tooltip richText「自定义提示 系列=${SERIES} 值=${VALUE}」）；真引擎 e2e PASS（runId=ge20261108103120-f5d5ab，逐格真值/合计/modify/基线回补）。
- 首跑 IR 拒：tooltip 仅 Van 图（kind=v*）支持；bar 改 vbar 后过。
- 部署 cpt 含 AttrTooltipRichText 自定义内容（逐字节）；web 端 SVG 图表渲染，两次悬停未取到自定义提示文本 → **自定义 AttrTooltip web 悬停未验证**（非已证损坏）。G3 legacy bar 默认 tooltip 悬停此前已实测。
- 收尾：停服、基线 CBEB42E3；证据 docs/architecture/web-verification.md。

### 第 18 轮 vpie 标签内容反转达成（用户："那就是尝试"——官方模板反序列化路线）
- 探针一手：probes/probe_vpie_label_template.js 在 Runtime 初始化后 `TemplateWorkBookIO.readTemplateWorkBook('doc/Chart/PieChart/基础饼图.cpt')`，遍历 cell 找到 ChartCollection → plot.getConditionCollection → DefaultAttr → getConditionIterator 取到 AttrLabel（detail content=AttrTooltipContent，richText 完整）。
- 实现：object.js vpie + label.richText 时用该模板 AttrLabel 替代 new；保留模板 content（不再换 PieCategoryLabelContent）、覆盖 richText 文本；vpie 挂 DefaultAttr（官方挂法）；模板缺失时 fail-closed throw。
- 验证：CHART SERIALIZED 通过、pipeline failures=0、**PNG 饼图扇区渲染「标签内容」**（crop 目检）；此前"序列化墙"结论作废（根因=新建对象字段不全）。
- 词表收口：IR 明确拒 label.summary（旧 PieCategoryLabelContent 通道不渲染，写了不生效）；fast_ir_contract 更新 5 条（summary 全 kind 拒 + vpie richText 零误报）；新载体 examples/report-spec/vpielabel_rows.json（scan ok=92）。
- 遗留 P3：richText 占位符 `${SERIES}/${PERCENT}` 需官方 `<img data-id>` HTML 格式才替换，纯文本原样显示。

### 第 19 轮 jar 级引擎面分析 + 层一致性复核（用户 11081050 标准）
- 新增 scripts/build_jar_surface.ps1：扫核心 jar（lib/server-lib/WEB-INF-lib，不含付费插件）的 Plot/Plot4VanChart 类 → data/jar_surface_analysis.json；规则表 data/jar_surface_classifications.json（逐类 supported/base/unsupported+原因，任何未登记类即 exit 2）。
- 结果：**54 个绘图类 = 12 supported（对 12 个 Ir chart kind 一一映射并 jar 可解析）+ 16 base + 26 unsupported（3D/环形/漏斗/甘特/雷达/meter legacy/股价/区间/GIS/自定义组合/钻取地图/多层饼/结构/树图/词云，逐类原因）**。
- 新门 verify/fast_jar_surface.js（fast 第 19 套件）：unclassified/stale=0、计数自洽、supported↔Ir kinds 双向对上、unsupported 原因非空。
- 报告 docs/architecture/jar-surface-analysis.md；AGENTS fast 18→19、§6 现状补 jar 图类面口径。
- 层门全量 sweep（73 项×11 层）复跑：CAPS=73 ERR=0；probe 66/7、tool 5/2/66、jar 64/6/3、object 66/7、cpt 66/7、render 52/21、ir 48/25、spec 39/34、planner 53/20、agent 52/21、manifest 73（PASS/BLOCKED/UNKNOWN；`logs/r19_sweep.txt`）。I1=52/52、I2=52/52、I3=63/66 锚定（3 项 agent.* 无引擎类）、I4=53/73 合同+3 负控 PASS、I5 成立；`docs/architecture/layer-coherence.md` 已从 72/65 口径更新到 73 项口径。
- 回归：`scripts/run-fast-tests.ps1` 19 套件全 PASS（946 CHECK PASS / 0 FAIL，`logs/fast19_r19.txt`），含 fast_baseline（demo_api.cpt=CBEB42E3、v2=6161F402、销售明细 PNG=A8EF39AB）。
- 诚实边界：本次只逐类建账 Plot 层；Attr/Condition/Definition 类未做全量分类（饰能力已有四层+jar 锚定）。

### 第 20 轮 chart.title 空图缺陷 + x/y 门 + bubbleAttr 渲染矩阵（2026-11-08）
- 目标：把 manifest 里 `chart.bubbleAttr`（rendering=pending）做出真实渲染证据；过程中发现两个更严重的确定性缺陷。
- 缺陷 1（P0 级产品可见）：任何 Van 图设置非空 `title` 后整图空白——plain `Title(text)` 无 TitleVisible/maxHeight，占位标题吃满绘图区。证据：`reports/test_vbar_title.js` 修复前 PNG 仅 2 色（cell 边框），修复后 220 色（标题+柱+图例）；`reports/test_bubbleattr.js` 4 图载体同样由空框恢复。修复：object.js 非空 Van title 改 `VanChartTitle`+官方布局（TitleVisible/position0/maxHeight15/useHtml false/floating false/limitSize false）；空串与 legacy Title 路径不动（legacy bar title PNG 290 色正常）。
- 缺陷 2（验证门假阴性）：make_api 图表断言只认 `MoreNameCDDefinition/CategoryName`，vscatter/vbubble 合法形态是 `BubbleTableDefinition201109 bubbleX/bubbleY/bubbleSize`（官方 普通气泡图.cpt 同构）→ 合法 x/y 图被 CHART SERIALIZED/DEF CATE/DEF VALUE 误判失败并阻断部署。修复：按 kind 分流，category/value 图保留原断言，x/y 图逐块断言 x/y/size/系列名。
- bubbleAttr 渲染证据：`reports/test_bubbleattr.js` 4 臂（5/15、30/90、15/70 shadow true、15/70 shadow false）PNG 蓝泡 bbox 直径 5/8/11/15、30/44/67/90、15/28/49/70（图例 27 常量）→ min/maxDiameter 精确生效；`reports/test_bubbleattr_neg.js` 负值 -30/-20：displayNegative=true 渲染两枚灰泡，false 隐藏 → 生效；shadow true/false 图表像素零差异（只有表头文字不同）→ shadow 静态 PNG 仅序列化，web canvas 未验。manifest `chart.bubbleAttr` 仍 rendering=pending（不把 shadow 未渲染包装成已渲染），证据文本已更新。
- 缺陷 3（P0 验证门漏报）：出图段只判"PNG 有字节"，整图空白也 ALL PASS（Van title 事故就是这样过的门）。补 `CHART RENDER NONBLANK`：有 chart 块时抽样 PNG，chromatic<20 判失败（2026-11-08 收紧：标题抗锯齿灰能让 uniqueColors 很高但 chromatic=0；multipie 空白实验 unique=88/chromatic=0 被拒）。默认基线（无图表）门自动跳过，MD5 仍 CBEB42E3。
- 候选复核（不升层）：`examples/report-spec/cells_extras.json` 真引擎 PNG 目检，`presentation.cells` 的 rich 文本格「【结论】」粗体段+正文行可见；但 formula/link/barcode 等 item 形态各有独立能力账本、未逐形态目检，`spec.rows.cells` rendering 保持 pending（只入证据）。
- 验证：默认基线 demo_api.cpt=CBEB42E3；fast 19 套件 GREEN（`logs/fast19_titlefix.txt`、`logs/fast19_bubbleattr.txt`、`logs/fast19_blankgate.txt`）；scan ok=96 bad=0；引擎负门 GREEN（默认基线回补）。改动文件：lib/object.js、make_api.js、application/capability_manifest.js、reports/test_vbar_title.js、reports/test_bar_title.js、reports/test_bubbleattr.js、reports/test_bubbleattr_neg.js、README #162、AGENTS §3。
- 未验证：shadow 的 web canvas 渲染（静态 PNG 已证无差异）；`chart.title` 仍未入 manifest 能力账本（IR 键存在但无独立 capability 条目）。

### 第 21 轮 付费口径审计（用户："符合付费内容不做的要求么？付费之外都闭环了吗"）
- 目标：不靠口头保证，把"26 个未接图族是否付费"做成机器账。
- 证据：①26 个 unsupported 类逐个在**全部**安装 jar（含 WEB-INF/plugins）里定位，全部只在 `fine-report-engine-11.0.jar`，无一出现在 `plugin-com.fr.plugin.bigScreen.v11` / `com.fr.extended.chart.*` / 移动端 jar；②官方 1684 张 cpt 语料：10 个 Van 当前族有 doc/Chart 用例（radar 24、gantt 15、custom 36、drillmap 12、structure 6、funnel 5、multipie 5、box 3、wordcloud 3、treemap 2），16 个 legacy 类零命中；③项目付费排除清单（FVS 14 包 / extended.chart / mobile）与 26 类零交集。
- 账本：`data/jar_surface_classifications.json` 每类新增 `license`/`family`；顶层 `licensePolicy`（paidPrefixes+审计+运行时 license gate 未独立审计的 caveat）。分布：license basic 54 / paid 0 / unknown 0；family current 12 / base 16 / legacy 16 / van 10。26 类合并为 **16 个当前图族**。
- 门：`verify/fast_jar_surface.js` 新增 6 条付费口径断言（无付费前缀、license/family 完整、supported/unsupported 均不得 paid、账本带 paidPrefixes）；`scripts/build_jar_surface.ps1` 输出 license/family 计数。单跑 16 条 CHECK 全 PASS，SUMMARY license={"basic":54} family={"legacy":16,"base":16,"current":12,"van":10}。
- 结论：**付费不做=符合**（没有实现任何付费族，付费族不会被排期；仅核心 jar 的运行时 license gate 未独立审计）。**付费之外没有全闭环**：16 图族未接、21 项能力未承诺（webInteraction 12 / unverifiedRendering 2 / notImplemented 4 / rejected 3）、coverage partial 21；noncore 44 为付费/移动端排除。归属闭环（unattributed=0）≠能力闭环。
- 未验证：core jar 内部运行时 license gate；16 图族的具体实现成本未逐族估算。

### 第 22 轮 非付费图族闭环第 1 个：chart.vradar 雷达图（2026-11-08）
- 目标：用户要求"付费之外能力全部闭环，未闭环不得停止"；先做可行性最高的 Van 雷达族（官方 doc/Chart/NewRadarChart 24 个语料）。
- 结构一手：官方 `CustomRadar.cpt` = `Plot class=com.fr.plugin.chart.radar.VanChartRadarPlot` + `MoreNameCDDefinition(CategoryName + ChartSummaryColumn)`；与矩形派 vbar/vline 同绑定，不需要新数据定义类。
- 实施：object.js VK 增 `vradar`（VanChartRadarPlot）；IR `CHART_KINDS`/`capabilities.chart.vanChart` 增 vradar；ReportSpec rows/sql 两路 supported 列表 + spec_validator fallback + 编译器测试；planner 合同（`fast_planner` vradar 直通）；engine_class_map 增 chart.vradar→VanChartRadarPlot（module=lib/object.js）；jar 面 VanChartRadarPlot 转 supported、legacy RadarPlot 归 base（supported 13/base 17/unsupported 24=15 图族）。
- 验证：`reports/test_radar.js` 真引擎 failures=0，PNG 目检 5 轴 A-E + 蓝色多边面 + 图例「时速」+ 标题（292 色）；SQL 真库 plan→plan2spec→create→validate 全链 PASS（runId=radar_e2e_001，表体 33531/26531 真值不变，部署 cpt+PNG 309 色，雷达图在表体下方渲染）。manifest chart.vradar 四层 verified + agentAvailable=true（74 项/53 承诺）。
- 门修复：`fast_layer_coherence` I2 入口检查共享 `/g` 正则未复位 lastIndex，命中后后续能力从错误偏移匹配 → chart.vradar 假阴性；已加 `re.lastIndex=0`（门自身缺陷，非账本问题）。`fast_capability_gate_consistency` totals 硬编码 73/52 → 74/53。
- 回归：fast 19 套件 GREEN（`logs/fast19_radar2.txt`，COHERENCE caps=74/agent=53；当轮 JAR-SURFACE=13 supported/16 base/25 unsupported；随后将 legacy RadarPlot 归 base，最终 13 supported/17 base/24 unsupported）；scan ok=97 bad=0；默认基线 demo_api.cpt=CBEB42E3 回补。
- 下一项：按同法做 Van 漏斗/箱线（官方 doc 语料、MoreName 或 OneValue 绑定），再做 Gantt/组合/树图/词云/结构/钻取/多层饼；legacy 3D/环形/仪表/区间/股价/GIS 单独立项。

### 第 23 轮 非付费图族闭环第 2 个：chart.vfunnel 漏斗图（2026-11-08）
- 结构一手：官方 `doc/Chart/FunnelPlot/漏斗图.cpt` = `VanChartFunnelPlot` + `OneValueCDDefinition seriesName=分类列 valueName=值列 function=SumFunction`（CategoryName 空）。javap 确认 `OneValueCDDefinition(TableData, categoryName, seriesColumnName, valueColumnName, DataFunction)`；object 复用 vpie/vgauge 的 OneValue 派。
- 实施：object VK 增 vfunnel + OneValue 分支；IR CHART_KINDS/vanChart、ReportSpec 两路、spec_validator、planner 合同同步；engine_class_map/jar_inventory 锚定；jar 面 VanChartFunnelPlot 转 supported、legacy FunnelPlot 归 base（supported 14/base 18/unsupported 22=14 图族）。
- 门修复：make_api 图表门对 `OneValueCDDefinition`（vpie/vgauge/vfunnel）仍走 MoreName 断言 → 单图 vpie/vgauge 也会假阴性；现按 kind 分流，OneValue 派断言 `<O t="CC">`+OneValueCDDefinition+seriesName/valueName。
- 验证：`reports/test_funnel.js` 真引擎 failures=0，PNG 目检 5 段漏斗 + 5 条图例（420pt 高度全出）+ 标题；SQL 真库 plan→plan2spec→create→validate PASS（runId=funnel_e2e_001，表体 33531/26531 真值不变，漏斗图在表体下方渲染）。manifest chart.vfunnel 四层 verified/agentAvailable=true（75 项/54 承诺）。
- 回归：fast 19 套件 GREEN（`logs/fast19_funnel.txt`，COHERENCE caps=75/agent=54；JAR-SURFACE supported=14/unsupported=22）；scan ok=98 bad=0；默认基线 demo_api.cpt=CBEB42E3 回补。
- 下一项：箱线 box（官方 doc 3 语料，先探针 Box 数据定义），或先做高价值树图/多层饼。

### 第 24 轮 非付费图族闭环第 3 个：chart.vbox 箱线图（2026-11-08）
- 结构一手：官方 `doc/Chart/BoxPlot/分组箱型图.cpt` = `VanChartBoxPlot` + `VanBoxTableDefinition(detailed=true)` + `detailedDefinition=VanBoxMoreNameCDDefinition(category+ChartSummaryColumn[])` + `resultDefinition=VanBoxTableResultDefinition`（占位 `categoryName/seriesName/median="无"` + 五标签）。javap 确认 setDetailed/setDetailedDefinition/setResultDefinition 方法面。
- 实施：object VK 增 vbox + 专用分支（plot/definition 双 setDetailed(true)；resultDefinition 按官方占位值初始化）；IR CHART_KINDS/vanChart、ReportSpec 两路、spec_validator、planner 合同同步；engine_class_map/jar inventory 锚定；jar 面 VanChartBoxPlot 转 supported（supported 15/base 18/unsupported 21=13 图族）。
- 数据形态踩坑（三轮内）：①3 组 × 7 样本 × 1 列 → 3 箱但须线按 fence 画；②3 系列 × 7 不同分类 → 退化成折线；③最终=1 组 × 3 系列 × 7 样本 → 3 箱并排，Q1/Q3 目检=12/20、22/30、9/25（与 7 样本分位一致），须线为 1.5×IQR fence 端点（A 0-32、B 10-42、C 0-49），fence 语义未逐点对官方统计文档核。
- 验证：`reports/test_box.js` 真引擎 failures=0，PNG 3 箱并排；SQL 真库 plan→plan2spec→create→validate PASS（runId=box_e2e_001，表体 33531/26531 真值不变，箱线图在表体下方渲染）。manifest chart.vbox 四层 verified/agentAvailable=true（76 项/55 承诺）。fast 19 GREEN（`logs/fast19_box.txt`，caps=76/agent=55；supported=15/unsupported=21）；scan ok=99；基线 CBEB42E3 回补。
- 未验证/边界：须线语义按引擎 1.5×IQR fence（未逐点对官方统计文档核）；箱线 summary 模式（resultDefinition 直接给 min/q1/median/q3/max）未接。
- 下一项：多层饼/树图/词云（Van 当前族，官方 doc 语料）或甘特；legacy 3D/环形/仪表/区间/股价/GIS 单独立项。

### 第 25 轮 非付费图族闭环第 4 批：legacy 3D/环形 5 类（2026-11-08）

- 结构一手：legacy `Chart(plot)` + `MoreNameCDDefinition(category/values)` 路径已支持 bar/pie/line；3D/环形类是同一 legacy 引擎（Bar3DPlot/Pie3DPlot/Area3DPlot/Donut2DPlot/Donut3DPlot），无 Van 专属数据定义。
- 实施：object TK 增 5 类；IR `capabilities.chart.legacy` 3→8、CHART_KINDS 同步；ReportSpec 两路/validator/planner/engine_map 同步；jar 面 5 类 supported、DonutPlot 归 base（54 类=20 supported/19 base/15 unsupported=11 图族）。
- 验证：5 个 carrier 真引擎 PNG 目检——bar3d 3D 柱体+图例、pie3d 3D 饼+四段图例、area3d 3D 面积带、donut 多环（每系列一环、A-D 各色）、donut3d 3D 多环，均标题/图例正常；SQL 真库 5 个 plan→plan2spec→create→validate PASS（runIds=bar3d/pie3d/area3d/donut/donut3d `_e2e_002`，表体 33531/26531 真值不变）。manifest 5 项四层 verified/agentAvailable=true（81 项/60 承诺）。fast 19 GREEN（`logs/fast19_legacy3d.txt`，caps=81/agent=60；supported=20/unsupported=15）；scan ok=104；基线 CBEB42E3 回补。
- 诚实边界：donut/Donut3D 当前为多环形态（每系列一环、各系列不同色，OneValueCDDefinition）；经典单环分段不是 Donut2DPlot 现有模式，未承诺；3D 视角/旋转属性未接。
- 下一项：多层饼/树图/词云/结构图（Van 当前族）或甘特/钻取地图；legacy 仪表/区间/股价/GIS 继续。

### 第 26 轮 独立审查修复（2026-11-08）
- 独立审查（子 agent）对 85ae7d5..45dceaf 打分：发现 9 个 FAIL，逐项修复：
  1. radar 回归日志数字写错（13/24）→ 改为当轮实际 13/16/25 + 后续 legacy RadarPlot 归 base 的最终值。
  2. jar-surface-analysis.md 旧数字（supported 12/unsupported 22/26 类/73 项/12 kinds）→ 全部同步 20/15/15 类/81 项/20 kinds。
  3. 81 项层扫描只是 74 行+单项投影 → 实跑 `logs/r21_sweep.txt`：CAPS=81 ERR=0（probe 74/7、jar 72/6/3、render 60/21、ir 56/25、spec 47/34、planner 61/20、agent 60/21、manifest 81），文档改为引用真实产物。
  4. layer-coherence 的 golden e2e 旧 runId 冒充"本轮复跑"→ 实跑 `run-golden-e2e.ps1` 新 runId=ge_review_20261108 PASS，文档回填。
  5. donut/donut3d 同心环同色却标 DONE → object 改 OneValueCDDefinition（每系列一环、A-D 各色，类别成为系列），重跑 E2E runIds=donut_e2e_003/donut3d_e2e_003；manifest/README/closure 明确 scope=多环形态，经典单环分段不承诺。
  6. box Q1/Q3 写 10-20 与像素 12/20 不符 → 修正为 12/20、22/30、9/25；须线 fence 语义明确"未逐点对官方文档核"；Agent scope 明确=单 value 列（ReportSpec 无 values 键），rawIR 多系列 3 箱无 spec 入口。
  7. donut/donut3d 的 make_api 门新增 OneValue 分流（旧门只认 MoreName，会误杀）。
  8. spec_validator 旧错误文案"v1 只 bar|pie|line|v*"→ 改为当前词表说明。
  9. SQL 路图区偏小/图例截断列为 P2 产品边界（§4.1），不以图种闭环掩盖。
- 回归：fast 20 套件 GREEN（`logs/fast_review_fixes.txt`，含另一个会话的 acceptance 套件；我们的 19 个核心套件仍全绿）；scan ok=104；基线 CBEB42E3；81 项层扫描 ERR=0；golden 全链 PASS。
- 未闭环：SQL 路图表版式 P2；box 多系列 spec 入口；donut 经典单环分段（不承诺）；剩余 11 图族。

### 第 26.1 轮 环境事故：C 盘满导致基线失败（2026-11-08）
- 现象：默认 make_api 连续失败——`NoClassDefFoundError: com.fr.license.selector.LicenseContext`、`FineAssist version not match`、demo_api.cpt 0 字节；md5=d41d8cd9（空文件）。
- 根因：C: 盘 0 字节可用；`C:\Users\guojianhang\AppData\Local\Temp` 19GB，其中 FinePrivacy_x*_*.dll 2351 份约 14.3GB、FineAssist DLL 2352 份 184MB（每次 JVM 启动解压一份，从不清理）。
- 处置：只删 Temp 下 FinePrivacy/FineAssist 模式文件（不动用户数据/安装目录），C: 释放 14.3GB；默认 make_api 恢复 PASS，demo_api.cpt=CBEB42E3。
- 教训：引擎反复跑会累积 native DLL 临时副本；环境满时表现为 license/版本错误而非磁盘错误，先查 `df`/Temp。
- 同期把 `CHART RENDER NONBLANK` 从 `unique>=8 || chroma>=100` 收紧为 `chroma>=20`：multipie 空白实验 unique=88/chromatic=0 被正确拒绝（标题抗锯齿灰曾绕过旧门）。

### 第 26 轮 Agent 验收基准 V0.1（用户提案：40 任务/8 组，2026-11-08）
- 目标：把"40 条报表任务"落成可执行验收规格，而不是提示词清单。先做尺子：任务定义、固定数据、真值 oracle、结果记录器、完整性门；**不伪造执行结果**。
- 实施：
  - `acceptance/tools/gen_fixture.js`：确定性固定数据（seed=20261108，Park–Miller LCG；184 订单/23 月含 2025-02 无数据/12 产品/14 客户/9 员工/4 仓库/48 库存；负利润 30、零金额 1、空城市 12、重复日期），`schema.json` + `expected.json`（134 键）+ `manifest.json`（sha256，LF 归一化，避免 CRLF 改变指纹）。
  - `acceptance/tools/verify_oracle.ps1`：独立 PowerShell 实现重算全部 134 键 → **134/134 PASS**（跨语言对拍，避免"生成器自证"；脚本 ASCII-only，避开 PS 5.1 GBK 解析坑）。
  - `acceptance/tools/build_tasks.js`：40 任务定义源（A5/B5/C8/D5/E5/F4/G4/H4）+ 生成 `tasks/*.json`/`benchmark.json`；build 期硬校验：能力 ID 必须存在、`requiredCapabilities` 必须 agentAvailable、`dataAssertions` 必须命中 oracle、`agentTools` 必须是 fr_agent.ps1 真实 verb、prompt 禁内部词、九维权重和 100。
  - `acceptance/result_schema.js` + `record_result.js`：等级规则硬编码——PASS 需总分≥80、capability/safety 满分、render nonBlank、data 逐键对拍 oracle、requiredCapabilities 无静默丢失、交互必须 engine 级证据（serialization 级不能 PASS）；`deployed=true` 但 engine/render/data 未全过 → 自动判非法（UNSAFE 红线）；PARTIAL 必须列 unimplemented/blockedBy；BLOCKED 必须说明原因且未部署；拒绝覆盖同 RunId。
  - `verify/fast_acceptance.js`：fast 第 20 套件（2600+ checks，首版 2669），校验 benchmark↔tasks 逐文件哈希、能力真实性、oracle 键、fixture 哈希、分组计数、权重、prompt 词表、结果 schema；只验基准自洽，不证明任何任务执行过。
  - 文档：`acceptance/README.md`（协议/评分/证据分层（含 analysis）/执行/数据契约/当前状态/缺口表）；AGENTS §1 fast 19→20；README #167。
- 追加修复（同轮）：UNSAFE 声明可写盘取证（exit 3），不因"部署后失败"把记录本身判非法；UNSAFE 记录不把 fast 门永久染红（保留证据只告警；记录器退出码 3 仍是硬信号）；只读分析任务 G01 的 PASS 不能要求 cpt/渲染层 → 新增 `evidence.analysis` 层（inspect/transcript 路径），补测 G01 PASS 与"缺 analysis"两例；README 明记记录器边界（只验自洽/文件存在/数值对拍/等级规则，不证明证据来源）。
- 静态投影（不是成绩）：PASS 9 / PASS_WITH_CLARIFICATION 1 / PARTIAL 14 / BLOCKED 16；rows 38 / sql 2（E01/E05 因固定数据库未部署 BLOCKED）。0 条任务执行、0 引擎运行、0 PASS 记录。
- 验证：fast 20 套件 GREEN（`logs/fast20_acceptance.txt`，含三铁证 CBEB42E3/6161F402/A8EF39AB）；fast_acceptance 2600+ checks GREEN；记录器自测四例（PASS/数据错配/部署后失败/PARTIAL）+ 写盘成功 + 同 RunId 拒覆盖；gate 对合法/非法结果分别 GREEN/FAIL（临时记录已删除）。
- 未验证：真实任务执行与渲染、视觉验收、交互 web 行为、SQL fixture-db、自动 LLM 驱动（V0.1 由外部 Agent 按协议执行）。
- 并发注意：本轮期间另一条线（vbox/3D 图族）在工作区推进并先行提交（HEAD 45dceaf）；本轮四个提交=0c81e92（主实现）/fe1e805（analysis 证据层）/d2ab9d0（UNSAFE 不染红 fast 门）/79b14ff（UNSAFE 可取证）；只含 `acceptance/`、`verify/fast_acceptance.js`、`scripts/run-fast-tests.ps1`、`AGENTS.md`、`README.md`、本日志；未触碰 lib/manifest 等产品代码。
- 收尾复核（代码基线 79b14ff）：fast 20 套件 rc=0、20 PASS/0 FAIL（`logs/fast20_acceptance_head79b14.txt`）；oracle 跨语言 134/134（`logs/oracle_final.txt`）；记录器补充自测（A01 PASS、H04 修改类 PASS、C07 交互 serialization 级 PASS 被拒、B02 BLOCKED、UNSAFE 可写盘 exit 3、G01 analysis 层）；工作区干净。

### 第 27 轮 Agent 验收基准复核（用户："审查当前实现，是否与上一轮诉求一致"，2026-11-08）
- 审查方法：不只看 `acceptance/README.md`；直接读 40 个生成任务、`benchmark.json`、fixture/oracle、`fr_agent.ps1` 的 modify/validate 实现，逐条对照用户提案。
- 发现并修复（commit `3cf24e7`）：
  1. **事实错误**：README 写 G+H 占 12/40（实际 8/40）；fixture 是 12 省份却被写成 10（README §10 + C06 渲染断言）。已改为 12，并新增 `longTermRegression` 标记 **10 条**（G01–G04 + H01–H04 + E04 + F04），build 期校验 >=10，满足"至少 10 个修改/组合/异常任务"。
  2. **结构偏差**：任务缺提案里的 `acceptance` 四标志；已加 `requireAgentExecution/requireEngineRender/requireVisualEvidence/requireNoSilentDrop` 并与 `render.required` 机器对齐。新增 `wave` 执行批次：V0.1 11 / V0.2 12 / V0.3 9 / V0.4 4 / V0.5 4（原落地表未点名的 B02–B05 归入 V0.2 布局批，否则会漏 4 条）。
  3. **协议错误**：README 修改链写成 `modify → validate`；实际 `validate` 读 create 的 `compile.json`，而 modify 只写 `patch.json`。已改为检查 `patch.json` 的 `diffClean/execution.pass/render.pass` 后再 promote，并明确 validate 不适用于修改链。
  4. **证据缺口**：记录器原缺"Agent 是否真的执行了 / 卡在哪层 / 修了几轮"。已加 `evidence.plan`（PASS 必填，防手写 spec 冒充 Agent 执行）、`failureStage`（非 PASS 必填，`requirement|semantic|planning|capability|ir|object|engine|data|interaction|safety`）、`attempts`（H04 的 PASS 需 >=2 轮，首轮 fail、末轮 pass）。
- 仍不一致/未做（诚实，不包装）：
  - 无自动 LLM/Agent 驱动与重试编排；H04 的故障注入仍由验收执行者提供（schema 只校验两轮证据）。
  - 工具调用/对话全文只有可选 `transcript` 层，未强制；部署决策只有 `deployed` 布尔，未单独记录理由。
  - oracle 是机器生成 + PowerShell 独立重算（134/134），不是逐项人工手算；仅做算术抽查（如 8×2280=18240）。
  - 空值用空字符串表达（非 JSON null）；`inventory.closing` 预置在 fixture，A05 用 `dataContract=report-computes` 禁止直接展示，但该禁令无机器强制。
  - `weights` 的 N/A 维度是整块并入（interaction→render / safety），不是严格按比例分摊；README §6 已写明。
  - SQL fixture-db、视觉验收、web 交互验证、40 条真实执行仍未做（0 执行/0 PASS）。
- 验证（截至本轮）：
  - `verify/fast_acceptance.js` 单跑 GREEN：3002 checks，waves 11/12/9/4/4，longTerm=10，fixture 哈希/oracle 键/能力 ID 全对拍。
  - 记录器补测：A01 PASS、H04 PASS（两轮 attempts）、缺 `plan` 被拒、BLOCKED 缺 `failureStage` 被拒、H04 单轮 PASS 被拒、C07 交互 serialization 级 PASS 被拒、UNSAFE 可写盘 exit 3。
  - oracle 跨语言 134/134（`logs/oracle_review.txt`）。
  - **全 20 套件本轮两次未拿到绿色（环境并发，非 acceptance 回归）**：第一次 `fast_contracts.js` rc=-1（进程被杀，疑似另一线 run.ps1 kill-all；单跑 rc=0）；第二次 19 PASS/1 FAIL，`fast_baseline.js` 因 `demo_api.cpt=0B1B43BC…`（另一线 make_api 产物，默认 spec 未回补）失败；`fast_acceptance` 两次均 GREEN。基线恢复需另一线收敛后复跑，不在本重复原。
- 代码基线：commit `3cf24e7`（复核修复）；未触碰 lib/manifest/报表产物。

### 第 27 轮 非付费图族闭环第 5 个：chart.vmultipie 多层饼（2026-11-08）
- 结构一手：官方 `doc/Chart/销售情况.cpt` = VanChartMultiPiePlot + MultiPieValueDefinition(OneValueCDDefinition valueName + MultiPie Attr levelCount/LevelColumnNameList)；javap 方法面 setLevelCount/addLevelName/setValueColumnName/setDataFunction。
- 实施：object VK 增 vmultipie（setTableData/setSeriesName/setValueColumnName/NoneFunction/setLevelCount/addLevelName）；IR CHART_KINDS + vanChart 增 vmultipie，图块校验支持 `levels[]/value` 并逐层列校验；ReportSpec CHART_KEYS 增 levels、validator 分支、SpecCompiler 发射 levels；layer gate planner 合同对 vmultipie 用 levels 输入（旧合同传 category 会误判 BLOCKED）；jar 面 VanChartMultiPiePlot 转 supported（21 supported/19 base/14 unsupported=10 图族）。
- 验证：`reports/test_multipie.js` 真引擎 failures=0，PNG 内外双层饼（华东/华北+销售员内层）+图例+标题（chroma=8023）；SQL 真库 plan→plan2spec→create→validate PASS（runId=multipie_e2e_004，levels=[bizDate,machine]/value=planned，表体 33531/26531 真值不变，多层饼渲染）；manifest chart.vmultipie 四层 verified/agentAvailable=true（82 项/61 承诺）。
- treemap 共用 MultiPieValueDefinition，rawIR 只出顶层矩形（嵌套子块未出）→ 不接、不计入闭环；backlog 保留。structure（StructureTableDefinition nodeId/parentId/nodeName/nodeValue）rawIR 可出层级+数值，但节点名未出 → 也不接。
- 门修复：`CHART RENDER NONBLANK` 收紧 chroma>=20 后 multipie 首版空白被拒，推动找到 MultiPieValueDefinition 分支/function 缺失；donut/donut3d carrier 已按 OneValue 重跑（标题+多色多环）。
- 回归：fast 20 套件 GREEN（`logs/fast_final_20261108.txt`，caps=82/agent=61；supported=21/unsupported=14）；scan ok=105；基线 CBEB42E3；层扫描 81 项+multipie 单项门（10 PASS/1 UNKNOWN），82 项全量扫描待下轮复跑。

### 第 28 轮 验收规则复核修复（用户 review 三条，2026-11-08）
- 用户 review 结论：框架方向正确，但 (P1) G01 只读分析分支可绕过 Agent 执行证据；(P1) `dataContract` 只在任务声明层，结果层可拿预置 `closing`/预聚合冒充报表能力；(P2) PASS 证据文件关联不够强。明确要求先修三条、冻结 V0.1 定义、再跑 11 项；**本轮用户追加指令：任务先不要跑**。
- 修复（commit `8fd2dae`）：
  1. **Agent 执行证据**：`evidence.plan`（pass+path+runId）提升到所有 PASS 的公共门槛，`analysisOnly` 不再绕过；G01 的 plan 可指向 `inspect.json`，但必须证明 `inspect_template` 真的执行过。
  2. **数据契约结果证据**：PASS 必须带 `dataExecution{contract,sources[],derived[]}`；`contract` 必须等于任务 `dataContract`；`report-computes`/`report-aggregates` 的 derived 必须 `computedBy="report"`，且 `derived.name` 不得出现在 `sources[].fields`（A05 直接读预置 closing、A02 无报表层聚合都会被拒）；`raw-rows` 不允许 derived。
  3. **证据关联**：`plan/spec/ir/cpt/engine/render/data/visual` 的 `runId` 必须等于 `result.runId`（禁止拼不同运行）；`cpt`/`render` 必须带 64 位 `sha256`，记录器写盘时重算文件哈希比对；`data.path` 是数据提取文件；`visual.reviewer` 是复核记录。
  4. **V0.1 冻结**：`benchmark.json` 增 `taskDefinitionsFrozen=true/frozenAt=2026-11-08`，fast 门校验；后续新增走新 wave，不改 40 条的 id/prompt/requiredCapabilities/dataContract。
- 自测（纯离线，未启动引擎、未跑任何 benchmark 任务）：
  - A01 PASS 合法；缺 plan 被拒；CPT 哈希错配被拒并打印真实哈希；evidence.runId 与 result.runId 不一致被拒。
  - G01 PASS 需 plan+analysis；缺 plan 被拒（原 P1 路径已堵）。
  - A05 `report-computes` 合法形态通过；`computedBy=data-prep` + `sources` 含 closing 的冒充形态被双拒。
  - A02 `report-aggregates` 无 derived 被拒；`computedBy=report` 的聚合声明通过。
  - `fast_acceptance` 3003 checks GREEN；无真实结果写入 `acceptance/results/`。
- 未验证/暂停：真实任务执行、渲染、Agent 驱动全部未开始（用户指令）；`dataExecution` 只能挡"自报契约不符"的明显形态，字段是否真来自该执行仍需证据包人工复核；工具调用 transcript 仍为可选层。
- 代码基线：`8fd2dae`（本地提交，未 push）；工作区另有 wordcloud 会话的未提交改动，未触碰。

### 第 28 轮 非付费图族闭环第 6 个：chart.vwordcloud 词云（2026-11-08）
- 结构一手：官方 `doc/Chart/WorldCloud/WordCloud.cpt` = VanChartWordCloudPlot + WordCloudTableDefinition(name/wordname/wordvalue/NoneFunction)；javap setWordName/setWordValue/setDataFunction。注意：NewStructureFrame 语料里的 wordcloud plot 挂 StructureTableDefinition 会渲染“图形没有数据”，真正数据定义是 WordCloudTableDefinition（首版踩坑已记）。
- 实施：object VK 增 vwordcloud + 专用分支；IR/ReportSpec/Planner 增 wordName/wordValue 词表（CHART_KEYS、validator 分支、SpecCompiler 发射、layer gate planner 合同用 wordName/wordValue）；jar 面 VanChartWordCloudPlot 转 supported（22 supported/19 base/13 unsupported=9 图族）。
- 验证：`reports/test_wordcloud.js` 真引擎 failures=0，PNG 词云（报表/数据/帆软/分析/图表/大屏 按值大小）+图例+标题（594 色）；SQL 真库 plan→plan2spec→create→validate PASS（runId=wordcloud_e2e_002，wordName=machine/wordValue=planned，表体 33531/26531 真值不变）；manifest chart.vwordcloud 四层 verified/agentAvailable=true（83 项/62 承诺）。
- 边界：structure 仍只出层级+数值、节点名未出，不接；treemap 只出顶层矩形，不接。
- 回归：fast 20 套件 GREEN（`logs/fast_wordcloud.txt`，caps=83/agent=62；supported=22/unsupported=13）；scan ok=106；基线 CBEB42E3；层扫描 81 项+multipie/vwordcloud 单项门，83 项全量待下轮复跑。

### 第 29 轮 非付费图族闭环第 7 个：chart.vstructure 结构图（2026-11-08）
- 一手结构：官方 `doc/Chart/NewStructureFrame/DivergentStructureFrame.cpt` = VanChartStructurePlot + StructureTableDefinition（`nodeid/parentid/nodename/nodevalue` + NoneFunction）。官方 `AttrLabel labelAttr enable="false"`，因此静态 PNG 不显示节点名是官方默认；账本只承诺层级结构图，不包装成节点名静态可见。
- 实施：object VK vstructure；IR node* 校验/列引用；ReportSpec `CHART_KEYS` + structure 分支；SpecCompiler sql/rows 双路发射 node*；layer gate planner 合同给 nodeId/parentId/nodeName/nodeValue。
- 验证：rawIR `reports/test_structure.js` PNG 4 节点层级；ReportSpec rows `examples/report-spec/structure_rows.json` 经 `fr_agent create` + `validate` PASS（runId=structure_rows_002），部署 PNG 同层级 + 表体合计；jar 面 VanChartStructurePlot supported（23 supported/19 base/12 unsupported=8 图族）；manifest 四层 verified/agentAvailable=true（84 项/63 承诺）。
- 回归：fast 20 GREEN（修 exact 清单遗漏 vstructure 后）；scan ok=108；基线 CBEB42E3。

### 第 30 轮 非付费图族闭环第 8 个：chart.meter 仪表盘（2026-11-08）
- 先 `probes/probe_chartdata_builder.js` 批量反射 MeterTableDefinition/StockTableDefinition 的 ctor + setter 面（探针先行，不再猜）；meter 走 MeterTableDefinition 单 needle。
- object TK meter(MeterPlot)；IR legacy 词表 + spec 校验 + Compiler sql/rows 转齐； ReportSpec meter_rowsJson 真引擎 create/validate PASS（runId 2026-11-08 14:55）；carrier reports/test_meter.js 单 needle 80 PNG 渲染正确。多 needle 重叠为官方多值排布问题，账本仅承诺单 needle/单值图。
- jar 面 MeterPlot 入 supported；MeterBlue/Simple 主题变体留 unsupported（蓝主题未单独 tested）。
- fast 20 GREEN(scan ok=110，基线 CBEB42E3，engine 名类=201，resolved=201). jars 24 supported/19 base/11 unsupported=7 图族. manifest `chart.meter` 四层 verified/agentAvailable=true（85/64）。

### 第 31 轮 非付费图族闭环第 9 个：chart.stock K线（2026-11-08）
- StockPlot + StockTableDefinition(OHLC)：raw carrier `reports/test_stock.js` 真引擎 failures=0，PNG 4 根 OHLC 柱（项目甘特；官方 0 语料，未做 axisLabel 样式微调）；ReportSpec rows 例 `examples/report-spec/stock_rows.json` create+validate PASS（runId=stock_rows_001）；sql 计划 intent 三度量形态（bizDate + planned/done/completionRate，open/close 共用 planned 合法）+ spec 校验/Compiler sql/rows；layer gate planner 合同同 3 度量 ready。
- jar 面 StockPlot 转 supported（25 supported/19 base/10 unsupported=6 图族）；manifest `chart.stock` 四层 verified/agentAvailable=true（86/65）。
- 设备教训：`SpecValidator.CHART_KINDS_FALLBACK`（plan 不 load Ir）必须与新 kind 同步，否则 sql 意图 plan 被拒（本轮 stock 排错）；已补 meter/stock/vstructure。

### 第 32 轮 非付费图族闭环第 10 个：chart.range 区间图（2026-11-08）
- RangePlot 零官方语料；`probe_chartdata_builder.js` 反射 RangePlot.defaultChartData=RANGEDATA/ScatterTableDefinition 类；object TK 增 range，close 路用 ScatterTableDefinition(category/低/高)；IR/ReportSpec/Planner 增 range 词表/spec 校验/Compiler sql+rows/layer gate planner 合同；carrier reports/test_range.js 真引擎 failures=0，PNG 4 个区间带（每行低/高带）+图例。
- RangePlot 入 supported（26 supported/19 base/9 unsupported=5 图族）；manifest `chart.range` 四层 verified/agentAvailable=true（87/66）。
- fast 20 GREEN（`logs/fast_range2.txt`，caps=87/agent=66；supported=26/unsupported=9）；scan ok=110；基线 CBEB42E3。

### 第 33 轮（session 3）treemap/gantt serialization 收盘
- gantt 三轮（carrier→NPE→TimeAxis/ProcessAxis→EXE PASS→render web div），treemap ctor 169 色顶块；drillmap serialization-only（execute PASS 但 web div rendering）。
- 这些代码未 push 到 lib（git reset 到 066efc8 range-green 门）；stashed 拷贝留着（`git stash show`）。不进 agentAvailable（serialization-only 口径）。
- 恢复 fast 20 GREEN。剩 5 个的下轮一手：gantt web div、treemap nested 渲染驱动、drillmap layerMap/ZoomLevel、custom D1 line render、GIS legacy GisMapPlot 构造。

### 第 34 轮 serialization-only 账本收口 + 零误伤扫描修复（2026-11-08）
- 目标：把第 33 轮遗留的 manifest/扫描红灯收干净，使 gantt/treemap 的 serialization-only 口径在账本、门、闭包表三处一致。
- 代码证据/实施：
  ① `verify/fast_manifest_evidence.js` 两处失败：chart.vgantt/chart.vtreemap 原为 regressionScope='rendering' 且 evidence 仅 README/描述、无具体入口 → 统一为 `construction=verified, serialization=verified, rendering=serialization-only, regression=verified, regressionScope='serialization'`，evidence 补 `reports/test_gantt.js`/`reports/test_treemap.js` + `probes/probe_gantt_official.js`/`probes/probe_chartdata_builder.js`（与 chart.tooltip 同型）。
  ② `probes/scan_all_specs.js` bad=1：`reports/test_drillmap.js` 使用已降出 IR 词表的 `vdrillmap`（第 33 轮决定：serialization-only、不进账本），留在 reports/ 污染"合法报表"语料 → `git mv` 到 `probes/probe_drillmap_carrier.js`（证据保留、不再入扫描）。
  ③ `docs/architecture/nonpaid-closure.md` 表 5/8/14 与 §6.4 gantt/treemap 行同步为实际状态（treemap/drillmap serialization-only、range DONE）。
- 验证：fast 20 套件 GREEN；scan `ok=115 bad=0 skipped=1`（skip=rebuild_basicA 历史缺 sproduct_dump.txt）；基线三件 MD5 PASS（demo_api CBEB42E3 / v2 6161F402 / 销售明细 A8EF39AB）。
- 未验证：gantt/treemap/drillmap 的 web div 渲染仍未驱动（serialization-only 边界，不承诺静态 PNG）；legacy GIS GisMapPlot 仍待探针；custom D1 线系列渲染=引擎硬墙未解。
- 代码基线：本条 commit（账本 89 项/66 agentAvailable；jar 面 28 supported/19 base/7 unsupported）。

### 第 35 轮 legacy GIS 地图（GisMapPlot）探针定案：serialization-only（2026-11-08）
- 目标：收掉剩余图族里最后两个非付费 legacy 类之一（GIS），按探针先行判断可闭环层位。
- 代码证据：官方 reportlets 零 GisMapPlot 语料（`grep -i gismap` 仅命中 FRDemo 表名）。新探针 `probes/probe_gismap.js` 反射一手：GisMapPlot extends Plot，setGisType/setAddressType/setBaiduKey/setGoogleKey；数据=GisMapTableDefinition（setAddress/setAddressName/setAddressType/setLnglatOrder/addTittleValue(SeriesDefinition)）；关联类 GisMapChartData/GisMapReportDefinition/GisMapIndependentChart/GISLayerType/GaoDeGisType。
- 实施：object 增 gismap 分支（plot 选项 + GisMapTableDefinition）；IR legacy 词表/CHART_KINDS/REQUIRED/列引用；make_api 专用序列化门。carrier `reports/test_gismap.js` 真引擎 EXE+序列化 PASS（XML 一手含 GisMapPlot/GisMapTableDefinition/AddressAndName/SeriesDefinition）。
- 渲染判据（像素级、判别性）：日志一手 `[Static Resource] Read data from path /com/fr/chart/chartglyph/gisMap.png`；单点广州（经纬度）vs 地址三点（北京/上海/广州）两臂，全图仅 2139 px 不同且 bbox 全在标题框内（x266-489,y55-132），地图+红点完全恒等 → 静态 PNG=内置固定示例图、数据不参与。真地图需 web 端+百度/谷歌 key/网络（外部服务依赖）。
- 结论：`chart.gismap` serialization-only（construction/serialization=verified、rendering=serialization-only、regressionScope=serialization、agentAvailable=false）。jar 面 GisMapPlot 转 supported（54 类=29 supported/19 base/6 unsupported）；清单 217 类 resolved=217 missing=0；manifest 90/66/24。
- 验证：fast 20 GREEN；scan ok=116 bad=0 skipped=1；基线三件 MD5 PASS（CBEB42E3/6161F402/A8EF39AB）。
- 未验证：带 key/网络的 web 真地图渲染（缺授权凭据，不擅自接第三方服务）；gantt/treemap/drillmap 的 web div 渲染同样保持 serialization-only。

### 第 36 轮 非付费图族闭环第 11 个：chart.vcombo 组合图（D1 引擎墙破除，2026-11-08）
- 目标：最后两个未闭环非付费图族之一 custom（组合图）。旧 D1 结论"线系列渲染不达成=引擎硬墙"，本轮先找官方语料再下结论。
- 一手证据：官方 `doc/Chart/Combination/` 有 10 份组合图语料（旧轮只用了 柱形图变形.cpt）。`probes/probe_custom_surface.js` 反射+官方对象图：VanChart(VanChartCustomPlot) + CustomStyle.COMMON_COLUMN_LINE（XML customStyle="column_line"）+ CustomPlotList=[VanChartColumnPlot, VanChartLinePlot] + CustomDefinition.setDefinitionProviderMap（LinkedHashMap，键=**CustomPlotType.COLUMN/LINE enum**，值=VanChartMoreNameCDDefinition 各自数据集/category/ChartSummaryColumn）。
- 根因修正：旧 D1 失败=缺 DefinitionProviderMap 分键（线系列无定义来源），不是渲染墙。初次实现用 String 键 → cpt 导出期 `ClassCastException: String cannot be cast to CustomPlotType`（一手），改 enum 常量即通。
- 实施：object `vcombo` 分支（CustomStyle + 子 plot 列表 + enum 键 map + setAllPlotInCustom）；IR `CHART_KINDS`/vanChart/REQUIRED groups[]/组内列引用；ReportSpec capabilities（rows+sql）、SpecValidator CHART_KEYS/负项、SpecCompiler rows+sql 发 groups/dataset、Planner rows groups 字段归一；make_api 专用序列化门（DefinitionMap key + dataset）。
- 验证：carrier `reports/test_combo.js` ①独立双数据集：柱 10/20/15/30 + 线 5/8/12/18，类目轴 1-4 月+双图例；②同数据集判别臂：线 25-28 贴顶、柱不变 → 线系列数据真实参与渲染。ReportSpec rows `examples/report-spec/combo_rows.json` 经 `fr_agent create`+`validate` PASS（runId=combo_rows_002；PNG 表体+合计 106+组合图）。fast_ir_contract +5 / fast_report_spec +5 断言入册。
- 账本：jar 面 VanChartCustomPlot supported、legacy CustomPlot/GanttPlot 归 base（54 类=30 supported/21 base/3 unsupported；named=222 resolved）；manifest `chart.vcombo` 四层 verified+agentAvailable=true（91 项/67 承诺/24 unavailable）；closure 表 10 行 DONE。
- 回归：fast 20 GREEN；scan ok=118 bad=0；基线 CBEB42E3/6161F402/A8EF39AB。scope 诚实边界=column|line 组合；面积/饼/气泡/雷达组合样式未承诺。

### 第 37 轮 组合图扩展样式：area/stacked/bubble/pie（2026-11-08）
- 目标：把官方 doc/Chart/Combination 全部样式纳入 vcombo（不只 column|line）。
- 一手：10 份语料扫描=styles{column_line,stack_column_line,column_area,custom}、plots{column,line,area,bubble,pie}、defs{MoreName,OneValue,BubbleTableDefinition}；对象图 map key=COLUMN/LINE/AREA/BUBBLE/PIE。
- 实施：object 按 groups plot 选子 plot 类（VanChartColumnPlot/LinePlot/AreaPlot/BubblePlot/PiePlot4VanChart）与 map 值类（MoreName / OneValue(seriesName='',category,value,Sum) / BubbleTableDefinition）；style 推导（column_line/column_area/stack_column_line/custom）；stacked=true 时 column 子 plot 挂 AttrSeriesStackAndAxis(stacked=true,stackID)+VanChartPlotType.STACK。
- 踩坑修正：只设 CustomStyle.STACK_COLUMN_LINE 时柱仍并排（一臂 PNG 实证）→ 子 plot stack 条件才是真开关；IR 原 `else` 误绑到 stacked 判定导致 groups=null 时 TypeError（fast_ir_contract 抓出）→ 已修。
- 验证：五 arms 真引擎 PASS+PNG：column+line（含判别臂）、柱+面积带、堆积柱 A+B（15/28/27/40）+Total 线、柱+气泡（4 泡大小 25/8/12/28）、柱+饼（4 扇区+图例）。ReportSpec rows：combo_rows_002、combo_stack_rows_001 均 fr_agent create+validate PASS。fast_ir_contract/fast_report_spec 增 stacked/bubble/pie/area 断言。
- 账本：manifest chart.vcombo 证据扩到五臂+两 rows runId；scope=column/line/area/bubble(数值x)/pie+stacked；agentAvailable=true 不变（91/67）。
- 边界：bubble 文本类目 x 不出点（须数值 x）；组合饼位置=引擎默认叠放；其他 CustomPlotType（radar/gauge 类）未承诺。

### 第 38 轮 仪表主题变体 MeterBlue/SimpleMeter（2026-11-08）
- 一手：两变体均 `extends MeterPlot`、仅无参构造、零新增 setter → 不是独立图族，是主题子类。
- 实施：`meter.theme=blue|simple` 键（object 按 theme 选 plot 类；IR 校验 blue|simple；SpecValidator CHART_KEYS/负项；SpecCompiler rows+sql 透传；非 meter 写 theme 拒）。
- 验证：`reports/test_meter_blue.js` / `reports/test_meter_simple.js` 真引擎 EXE+PNG，均渲染数值 80、主题可区分；但 Blue 带引擎内置 share 徽标痕迹、Simple 带默认占位文案 Fine-Engine_Chart_Meter_Yuan → 不升 rendering、不承诺。
- 账本：manifest 新增 chart.meterBlue/chart.simpleMeter（construction/serialization=verified，rendering/regression=pending，agentAvailable=false）→ 93 项/67 承诺/26 未承诺；jar MeterBlue/SimpleMeter 转 base（54 类=30 supported/23 base/1 unsupported；唯一 unsupported=VanChartDrillMapPlot）。
- 回归：fast 20 GREEN；基线 CBEB42E3。诚实边界：主题“能渲染”≠“可交付”（水印/占位未清）。
