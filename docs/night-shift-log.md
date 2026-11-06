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
（见下一条 commit SHA。）

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
（见下一条 commit SHA。）

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
（见下一条 commit SHA。）

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
（见下一条 commit SHA。）

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
（见下一条 commit SHA。）

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
（见下一条 commit SHA。）

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
（见下一条 commit SHA。）

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
（见下一条 commit SHA。）

### 下一项工作
按上列留账顺序直续；审查结果先处理。
