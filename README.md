# FineReport 无头渲染管线（D:\fineagent）

不打开设计器，直接用 FR 自带 jar 把模板渲染成 PNG/PDF 的完整闭环。
**v3.0 已上线：API 对象图后端——报表 = 组装 FR 内存对象图，XML 由 FR 自己序列化产出。v2 字符串生成器保留为回归门。**
**2026-10-27 字号单位大更正：FR11.5 size attr = pt×2（旧 #12/#19 的"pt×4"经 font_ruler 标尺实验证伪）。新基线铁证：demo_api.cpt = D3E3C2A0300ED1DF9A112DBBDFA6AD10、销售明细_api.png = B24BE26C36AC6E9D0DDA122F9D6727FE。**

**agent 开工先读 `AGENTS.md`**（行为约束 + 硬性回归门 + 排版红线清单）；本文档编号条目 #1 起 = 一手实证事实库。

## ABR-1 模块边界（2026-11-03，架构变化、报表一张不变）

```
reports*/（业务 spec）→ features/data_browser/browser.js（业务生成器，spec/IR 词汇）
                       → lib/ir.js（Spec→IR）→ lib/object.js（IR→FR 对象图）→ lib/cpt.js（回归门）
                       → runtime/paths.js（FR_AGENT_HOME/FR_HOME 路径单点）+ bootstrap.js（FR 激活链）+ datasource.js（连接注册）
                       → make_api.js（Runner：只编排）
```

- lib/browser.js = 兼容垫片（旧路径 load 继续可用，ABR-2 撤垫）；`scripts/check-boundaries.ps1` 每轮交付前跑一次（R1–R5，exit 0）。
- 事实契约不动：Ir.compile/validate、Obj.build、Cpt.validate/assertRoundTrip、BROWSER.spec/MODULES/env、IIFE 全局名 Ir/Obj/Cpt/BROWSER；新门面 `CORE=lib/index.js`。
- 环境口子：FR_AGENT_HOME（项目根）/ FR_HOME（FR 安装根）两分——不要混配。
- 迁移记录/验收门/越界清单：`docs/architecture/migration.md`；规则与边界：`docs/architecture/{dependency-rules,boundaries}.md`。

## 架构（每张新报表只写需求，不写 XML）

```
reports/xxx.js   ← 报表规格：标题/列定义/数据（人只管这一层）
lib/object.js    ← v3.0 后端：spec → FR API 对象图 → wb.export()（真源在此）
lib/cpt.js       ← v2 字符串生成器 + 校验器（validate/assertRoundTrip = 回归门）
make_api.js      ← v3 runner：对象图→自序列化→执行→导出→校验器过门
make_report.js   ← v2 runner（回归对照，仍然可用）
```

- v3 产物：`demo_api.cpt` + `reportlets\fineagent\销售明细_api.{png,pdf,cpt}` + `diag_api.cpt`
- v2 产物：`demo_template_final.cpt` + `reportlets\fineagent\销售明细.{png,pdf,cpt}`

## 目录结构（2026-10-26 整理）

```
D:\fineagent\
  README.md / GENERATOR_DESIGN.md / TABLE_DESIGN_STANDARD.md   ← 文档（经验库）
  make_api.js / make_report.js / make_verify.js / make_pixel_diff.js  ← runner 家族（入口都在根）
  run.ps1 / runraw.ps1 / tools_br_run.ps1                       ← 运行编排工具
  demo_api.cpt / demo_template_final.cpt                        ← 双基线产物（默认路径重跑必须逐字节还原）
  lib\       ← 引擎：object.js(v3 后端) ir.js(编译) cpt.js(v2 校验器) browser.js(数据浏览器构造器)
  reports\   ← 全部报表 spec（sales_demo_* / db_laser_* / br_laser_* / rebuild_*）
  data\      ← 真值与画像（db_*_truth.txt、db_tables_profile.txt、官方模板 dump/cpt 拷贝）——改动需经 probe 直查复核
  verify\    ← 逐格验证器（require('fs') 风格独立脚本；读 data\ 真值 + logs\ 结果栅格，逐格穷举核对）  probes\    ← 一次性探针脚本（历史考古证据，按 README 编号条目对得上号）
  logs\      ← 运行日志（*_run.txt）、结果栅格 dump（*_grid.txt）、普查表、临时脚本——只增不改，可随时清空
  shots\     ← 渲染 PNG / 裁切 / 像素 diff 热图（人工过目材料）
  verify_png\← 官方 demo 全量普查 PNG（make_verify.js 产物，证据勿删）
  semantic\  ← I2/I3/I4 语义层（独立旁路，只依赖 java.sql+dbpass+纯 JS）：schema/{inspector(唯一触库),metadata,relation,serializer,inspect_main}→data\schema_*.json；model/{vocab,registry,validator,resolver}→读 models\*.json+I2 schema；planner/{capability,planner}→意图→ReportSpec（ctx 注入 I1/I3，零 load）
  schemas\   ← I1 ReportSpec 声明式机器契约（report-spec.schema.json；权威执行者=lib/spec_validator.js）
  examples\  ← I1 report-spec/*.json（等价靶 sales_demo.json 等）
  models\    ← I3 业务领域模型（production/model.json：实体/指标/维度/关系，validator 回溯 I2 schema、resolver 歧义不自动选）
  template\  ← I6 已有 CPT 受控修改：core{ops,validator,locator,diff}零 java + 薄壳{reader,inspector,patch,patch_main}（runraw）；白名单 R0 探针冻结；写回只进 logs/template_staging，原件保留、不碰基线
```

注意：
- `demo_api.cpt` 会被**每一轮** make_api.js 覆盖（含 REPORT_SPEC 轮）——基线铁证以"默认路径重跑后 MD5=101700BB…"为准，别拿中间状态当基线
- 历史 README 条目里提到的 probe/verify 文件已分别移入 `probes\`、`verify\`、真值移入 `data\`、运行日志与栅格移入 `logs\`

## v3.0 API 后端实证

- 无 XML 编写：cpt 是 `wb.export()` 的输出；考古类 bug（公式=前缀、样式默认化、标签顺序）从构造层面消失
- 数据集自包含（EmbeddedTableData 直入对象图），无需部署后注数
- **决定性证据**：API 对象图路线与 XML 字符串路线渲染 PNG 的 MD5 完全相同——两条独立路径，同一份字节
- 尺寸全部精确命中规格：行高 1041400=82pt、列宽 3048000=240pt（EMU=pt×12700 实证成立）

## 确定性机制（v3 继承全部 v2 机制）

1. **枚举封死**：对齐（CENTER=0/LEFT=2/RIGHT=4）、FRSize=pt×4、EMU=pt×12700、边框分级（deep=黑/L=浅灰-3417120）
2. **回归门**：v2 校验器对 API 导出产物再跑一遍（validate 落盘 + assertRoundTrip 读回）
3. **退出码** = 失败数：非 0 即管线中断
4. **实证**：v2/v3 双路径 PNG MD5 一致；两轮 v2 运行 MD5 一致

## 产出新报表的唯一入口

```
1. 复制 reports/sales_demo.js 改内容（列、数据、标题即可，dsName 默认 ds1）
2. $env:REPORT_SPEC='reports/xxx.js' 后跑 make_api.js（v3；make_report.js 为 v2 对照）
3. 渲染图人工过目 + TABLE_DESIGN_STANDARD.md 检查清单收尾
```

## 复现命令

```
D:\software\FineReport_11.0\jre\bin\java.exe -Djava.awt.headless=true ^
  -cp "nashorn.jar;tools.jar;lib\*;server\lib\*;WEB-INF\lib\*" ^
  jdk.nashorn.tools.Shell D:\fineagent\make_api.js
```

关键经验（谁再想抄这条管线，这是我踩过的坑）：

1. FR 11 引擎启动需完整类路径（抄 `bin\designer.bat` 的那串）：`jre/lib/tools.jar` 必须有（attach 机制），`.install4j`，`lib`，`server/lib`，`WEB-INF/lib`。
2. 环境激活链：`ActivatorToolBox.simpleLink(BaseDB, Configuration, StateService, ReportBase, Restriction, Report, Chart)` + `SimpleWork.supply(CommonOperator, CommonOperatorImpl)` + `SimpleWork.checkIn(WEB-INF)` + **显式 `module.start()`**。
3. `TemplateWorkBookIO.readTemplateWorkBook(String)` 读的是 **reportlets 里的模板名**，不是文件系统路径；写文件用 `wb.export(OutputStream)`。
4. ≠FR 文档旧写法：单元格公式 XML 是 `<O t="XMLable" class="com.fr.base.Formula"><Attributes><![CDATA[=SUM(D3)]]></Attributes></O>`（子元素 `Attributes`，带 `=`。`<Formula>` 写法会被静默读成空公式 → `Fine-Engine_Null_Formula`）。
5. 数据集注入：`wb.putTableData("ds1", new EmbeddedTableData())`，`addColumn(名, Class)` + `addRow(Arrays.asList(...))`。
6. 执行：`wb.execute(paramMap, new com.fr.stable.PageActor())`（分页预览）/ WriteActor 填报。
7. 导出：`com.fr.io.exporter.ImageExporter.export(os, resultWorkBook)` / PDFExporter 同形。
8. Nashorn 跑法：`jre\bin\java.exe -Djava.awt.headless=true -cp "nashorn.jar;tools.jar;...;WEB-INF/lib/*" jdk.nashorn.tools.Shell script.js`
9. 没有 JDK 也没关系：Nashorn 反射（`Class.forName` + `getMethods`）就是 javap。
10. 错误信息会被混淆类吞掉堆栈：用 `Throwable.printStackTrace(PrintWriter)` 抓。
11. **样式元凶**：`<Style style_name="xxx" full="true">` 的命名样式在 `readTemplateWorkBook` 读取时会被默认化（simhei 72），改用 `<Style imageLayout="1">` 无名索引式（照抄真实 V2 模板格式）即可完整保留字体/加粗/背景色/边框。
12. 布局尺寸单位：行高/列宽 EMU（1pt=12700），字号 size=pt×4（10.5pt → size=42）。
13. `readTemplateWorkBook` 支持工作区子路径：`readTemplateWorkBook('fineagent/xxx.cpt')` 直接读 reportlets 子目录，产物可整体收进子目录。
14. 字体规格：全表 `FRFont name="SimHei"`（黑体）、10.5pt；标题/表头/合计 style=1 加粗。simhei/SimHei 均可被引擎识别。
15. 锁库故障：管线中途异常未退出会残留 java 进程锁死 FineDB（HSQL）。处置：`Stop-Process` 杀 java + 删 `WEB-INF\embed\finedb\db.lck`，重跑即恢复。
16. **对齐枚举（反文档）**：`horizontal_alignment` 的真实值是 CENTER=0 / LEFT=2 / RIGHT=4 / DEFAULT=-1，来自 `com.fr.nx.cell.attr.style.type.HorizontalAlignType`——网上常见"0左1中2右"说法是错的，渲染验证三变体+反射枚举双证实。
17. 排版标准：见 `D:\fineagent\TABLE_DESIGN_STANDARD.md`（用户下发规范 + FR 实现映射 + 出报表前检查清单）。
18. **API 后端构造通路（v3 关键坑）**：`java.lang.reflect.Constructor.newInstance`（varargs 路径）在"env 启动 + load() 上下文"下二次调用会抛 `argument type mismatch`，即使 int/int/String 参数全对。**解法：Java.type 结果赋变量后直接 `new CellT(...)`**（beans linker 正规通路），全程稳。裸 `new J('x')(...)` 依旧禁止。
19. **FRFont 字号单位（反直觉）**：`FRFont.getInstance(String,int,float)` 的 float 参数**不是 pt**（传 10.5 得 FRSize=84=21pt，字放大一倍）。正道：`getInstanceFromFRSize(name, style, FRSize)`，FRSize = pt×4（10.5pt → 42）。`getFRSize()` 即 XML size 单位。
20. **API 层边框语义**：`deriveBorder{Top,Bottom,Left,Right}(style, Color)` 的深色边要显式给 `new Color(-16777216)`（黑）；浅色给 `new Color(intVal, true)`（32bit ARGB 原值直通，FR 序列化 FineColor color=同值）。style=1 细实线。
21. **API 层 DSColumn**：`new DSColumn()` + `setDSName/setColumnName/setGrouper(new FunctionGrouper 列表模式)`；展开方向 `CellExpandAttr.setDirection(0)`（向下）。样式/扩展与 XML 层完全同构。
22. **条件属性（API 层全组合）**：`new DefaultHighlight()` + `setName/setCondition(new CommonCondition(列名, 运算符int, 值))` + `addHighlightAction(new BackgroundHighlightAction(bgColor(int), 0))` + `ce.setHighlightGroup(new HighlightGroup(Highlight[]))`（无 add 方法，用数组构造）。运算符一手实证：0=等/1=≠/2=＞/3=≥/4=＜/5=≤/10=contains（来源 com.fr.data.core.Compare 静态字段）。scope=0 = 本格生效。注意：`J()` 只收**类名**不收包名（`java.lang.reflect` 要写 `java.lang.reflect.Array`）。
23. **IR 化验收法**：重构改 lib 时，跑默认 spec 后 MD5 必须与重构前一致（demo_api.cpt=101700BB…，PNG=E2391200…）——IR 层引入即用此法证零漂移；条件属性扩展后同样回归一次。
24. **参数面板（API 层全组合，官方 GettingStarted.cpt 语料同构）**：`wb.setReportParameterAttr(ReportParameterAttr)` + `rpa.setShowWindow/setDelayPlaying/setAlign/setWindowPosition/setParameterWindowTitle/setParameterUI(FormParameterUI)/setUseParamsTemplate(false)`。组装链：`new FormParameterUI(WParameterLayout)` 一次性构造（`()` 空构造 + setLayout 亦可）+ `fpi.setDesignSize(Dimension)`。**布点铁律：显式 `new WAbsoluteLayout$BoundsWidget(widget, rect)` 再 `wlayout.addWidget(bw)`——直接 addWidget(裸 widget) 会 ClassCastException（内部把子件强转 CRBoundsWidget）**。控件三件套：Label（`setWidgetValue(new WidgetValue(文本))` + `setVerticalCenter(true)`，文本走 widgetValue 不在 setText；官方语料还带 WidgetName）；EditorHolder（**不包内嵌编辑器，本身就是控件**，`setWidgetName(参数名)` 即参数 key，widgetValue 为默认值）；FormSubmitButton（`(String)` 构造 + `setText`，序列化自带 Hotkeys enter）。校验器精化：SimHei 规则要摘掉 `<ReportParameterAttr>` 段再查（控件默认字体 SimSun 不属单元格管辖）。
25. **参数过滤（DSColumn 绑 $参数）**：`dsc.setCondition(new CommonCondition(过滤列, opInt, new Formula('=$参数名')))`——**逐列挂同一条件**（明细各列独立扩展，只挂一列会行错位）；参数值不进 Formula 而是执行时送：runner 从 IR.param 编辑器默认值组 HashMap `pmap.put(编辑器名, 值)` 传出给 `wb.execute(pmap, PageActor)`。实证：编辑器默认 '华东' → 渲染只剩华东 4 行、合计 10,680（=2370+4410+1800+2100，全表 26420 不符即失败；上一轮注释误写 9780 属心算错，数据零误）。
26. **图表（API 层全组合，官方 WorkBook3 语料同构）**：`cell.setValue(ChartCollection)`（ChartCollection 继承链 < Object 非 Widget）；`new Chart(new Bar2DPlot())`——**BarPlot/AreaPlot 祖族是抽象类**（abstract 实证），bar 用 Bar2DPlot、pie 用 PiePlot、line 用 LinePlot；数据绑定走官方形态 `MoreNameCDDefinition(TableData, categoryName, ChartSummaryColumn[])`，ChartSummaryColumn(值列名, 自定义名, SumFunction)；**TableData 必须包 NameTableData(数据集名) 命名引用**——直给 EmbeddedTableData 执行期 ClassCastException（"表"与"引用"不同层）。图表格序列化是缩写标记 `<O t="CC">`（非 <ChartCollection>），校验器摘段 regex 按此写。Nx 陷阱：`Array.newInstance` 收 Class 对象（cls()），不收 J() 的 StaticClass（README #18 同款连环）。实证：四地区预聚合数据（10680/3720/10480/1540，合计=26420 账平）→ PNG 四柱比例正确 + 图例/标题齐全。
27. **超链（API 层，最小家族）**：`ce.setNameHyperlinkGroup(new NameJavaScriptGroup(new NameJavaScript(名, new ReportletHyperlink(reportletPath))))`；组亦可用 `addNameHyperlink` 件数不限；ReportletHyperlink(String path) 直构造 + setTargetFrame/setParameters 可扩展（官方 WorkBook3 语料：Cell 上 NameJavaScriptGroup 内 ChartHyperPoplink + Formula('=E2') 传格值）。超链是浏览器行为，静态 PNG 不现形；验收 = 序列化同构（NameJavaScriptGroup/ReportletHyperlink/路径/链接名）+ roundtrip。Nashorn 没有 ES6 Array.find——runner 里只用 some/every/filter/forEach（ES5 面）。

（2026-11-03 乱码修复批注：#28–#35 原文在入库前已损毁——中文字符被批量置换为 U+FFFD、机械反演不可逆（probes/_readme_moji_probe1–5 定性：逐字节 hex + 四通道解码实验，过程存证在 logs/_moji_probe*_out.txt）。以下按幸存 ASCII 锚点逐字保真重建（类名/文件名/数值一律不动），并与工件交叉校验：make_verify.js 源码、logs/verify_table.txt 普查表实测、data/ 真值文件、reportlets/fineagent/ 部署实名、AGENTS.md 沉淀口径（若干事实在乱码前已被 AGENTS.md 收编）。句式为修复期重写；〔失考〕= 无存证的细节，不臆造。）

28. **v3.3 全翻查首轮（官方 21 demo，2026-10-26）：三路验证法立线**
- `make_verify.js` 对官方 cpt 逐张三检：A 引擎读回（`TemplateWorkBookIO.readTemplateWorkBook`）；B 自序列化回环（`wb.export()` 两次导出 MD5 相等 = 序列化自洽）；C 渲染等价（两次独立读回对象各自 `execute+ImageExporter` 渲 PNG，MD5 相等 = 渲染等价）。
- 一手路径语义：readTemplateWorkBook 收"相对 reportlets 根"的模板名（`demo/basic/x.cpt` 形态可用）；绝对路径或带 `reportlets/` 前缀 → TemplateFileNotFoundException；env 未启用时报 "EntityDao can not be used before ConfigurationActivator starts!"（激活链顺序问题）。
- 首轮 21 demo 结果：读取回执 21/21 全过，写回环 17/21，渲染级 14/21。4 张官方模板（3D 翘曲分析系/WorkBook3/〈采集系〉2 张〔个别词失考〕）二次读回再导出字节数即不同——**官方模板序列化含非确定字段（`<UUID>`）**；MD5 字节确定性只适用于自建模板（demo_api.cpt=101700BB 不受影响）。
- 7 张官方 demo 渲染失败（3D 查询系/地图系/采集表系），官方模板需配套"影响文件"（GettingStarted=WorkBook1；diag=〔失考〕）；翻查循环第二轮起修正口径：异常统一 catch 归类 READ_FAIL，关键节点留自检印记。

29. **v3.3 全翻查全量（官方 demo 全 240 cpt，fvs 排除；普查表 logs/verify_table.txt 实测存档）**
- 结构级 240/240，渲染级 221/240（92%），序列化回环 selfOK 153/240（64%）；分布：form 15/15 双通、basic 25/26、other 3/3、parameter 13/13 渲染级通过；DataReport 6/6 self=false 但渲染 6/6 通。表尾实测：`VERIFY TABLE END selfOK=153 renderOK=221 renderMismatch=19 readFail=21 total=261`（21 张顶层绝对路径喂入全 READ_FAIL = #28 路径语义的负样本留痕，普查表按原样收档）。
- **回环非稳定定界**：UUID 类字段致重复读回导出字节漂移；渲染级不受 IR 重建锚影响〔措辞重写〕。19 张 render=false 分类：3 硬伤（NewbieGuide 主子跳转/报表块 `Image_Export_Error_Info`；financial2/公式编辑器 `DeathCycleException`），16 张 png1/png2 各异。
- **幂等补救**：同源直读法——同一文件重复读回对象 MD5 全等（probe 实证）；Phone/tabular 族与 chart/special 族双跑 + 像素验证（官方 XML 不变）〔措辞重写〕。
- 动态值教训：NOW(/TODAY(/Refresh 类装置随模板加载时刻取值，重复执行结果漂；静态数据集重建后固定值、时间稳。普查表 verify_table.txt 逐行实时落盘：print 走 buffered stdout 会憋到进程退出，改用 BufferedWriter.flush 实时。

30. **v3.3 官方 demo 重建唯一案 PASS（demo/NewbieGuide/第一张报表，diff 3.79% < 5%；spec=reports/rebuild_first.js）**
- 像素验收：官方 PNG vs 重建 PNG 同页 1587×2245，diff=134958/3562815=3.79% PASS（v1 为 5.68%）。按全表粗对+图表摆位（setTitle 杀默认占位）曾到 5.71% → 表头字号 24→22pt + axisY 0-1000 + legend 12pt + 边距 40 → 收敛 3.79%。
- 数据面独立验证：`DBTableData.createDataModel(Calculator)` 一次执行官方模板 ds1（FRDemo `SELECT * FROM` 销售明细表）dump 45 行真值（data/frdemo_sales_dump.txt，ROWS=45 COLS=6，COLNAMES=地区|销售员|产品类型|产品|销量|英文简称）；5 销售员×5 产品交叉；行合计与总合计 9818 与官方渲染逐格对合。
- 字号单位实证（官方 XML 语料，FRSize 口径）：s=1（斜线标题格）=96(24pt)/s=2(表头)=88(**22pt**)/s=3(正文)=84(21pt)/大字=128(32pt)——此前表头一直按 24pt 处理造成约 2% 残差；页面 fit 比例 0.25，页宽 595pt，页高 1780.79pt；官方预览缩放 737.5px≈纸面 891.6pt（全页≈890.4/2），**全像素整页对齐**〔措辞重写〕。
- 度量工具族（本批沉淀）：bbox 精确法（bbox_probe 扫描行/列投影对齐 bbox，实测 w=266 h=42 px=5443 验证字号精确）；"边缘不参与"（AA 抗锯齿带）口径；make_pixel_diff（32 通道分级+24 位统计+品质热图 heatmap.png）+ crop_diff/bbox_probe/colscan。**分页路径注意：CR_*/PD_* 行列标记会丢**（分页边界单元格标记丢失）；colscan 读边框色（AA 带内取值）。
- engine v3.3 布局引擎扩容（lib/object.js；回归双证字节不变：demo_api.cpt=101700BB、PNG=E2391200）：font(bold,sizePt,colorInt)+setForeground；style(st) 支持含 st.color/st.border；palette 统一边框色〔浅色系句失考〕；putChartCell（values，ChartSummaryColumn[]）+legend+axisY(max/min 用 Formula("=N"))+barInterval(setCategoryIntervalPercent)+legend.setFRFont+noBorder；putBiasCell(BiasTextPainter(String)+setIsBackSlash(false)，斜线|分隔空格文本)；header corner 占位+标题；detail 级 align/bold/bg/format 参数（format 空串=不过滤格式〔措辞重写〕）；total sumCols 合计+labelSpan/labelAlign/labelSizePt+留 space 空块。
- lib/ir.js compile 头部 spec.IR 直通，rawIR 重建路（默认 compile 路未启用〔半句失考〕，API 同一单位）；**图表锚：挂在 Plot 级——chart.getPlot().getLegend()（Chart.getLegend 不存在）**；Axis.setMaxValue/setMinValue 用 Formula；Legend.setFRFont(FRFont)；BarPlot.setCategoryIntervalPercent(double)；rawIR 段贯通（make_api.js/lib/cpt.js）；styleCount 允许 null（同式合并 11→7 自动去重）；skipFormatOrder；Format/FRFont 复用 v2 封装。图表区残差 17-34% 属 Van vs legacy 结构差（网格线/Y 轴 auto 算法/图例布局）+官方图表双写未解，压轴不追〔措辞重写〕。

31. **v3.4 二遍精修（demo/basic 重建：基本明细汇总表A 源）PASS 0.30%（门槛<5%；比首轮 3.79% 更紧；spec=reports/rebuild_basicA.js）**
- 官方 11 段版式（r0 标题栏 135pt/r1 表头 108pt/r2 总计第二段 99pt/r3 小计 93pt/r4 明细 99pt + r5〔段名失考〕/r6 r7 尾注 57pt）；20 式样式（s0-s19）字号细信号 72/80/88/144=18/20/22/36pt；8 列宽 288-360pt。
- 数据面：ds1=FRDemo 销售 77 行真值 dump（类别序 1,2,7,6,8,4,3,5 与官方 PNG 一致）；DictPresent 字典翻译属 pre-join 语义（非 API 层职责）；修复前 55.43% 差异主源 D0ECFA 底色 + 16.06% 〔行高/其他细节失考〕（修复后 0.30%）。
- 页头重复：HR F=0 T=1（官方每页重复 r0 标题+r1 表头；API=com.fr.page.stable.ReportPageAttr.setRepeatHeaderRowFrom(0)+setRepeatHeaderRowTo(1)；fresh getReportPageAttr()=null 时需新建式设定）。
- v3.4 engine 扩容（lib/object.js 全探针实证）：font 增 name 参（SimHei 非唯一官方选型）；style 增 borders 支持 [styleInt,colorInt] 透明（官方线型 1 细/2 中粗/3 粗/5 点〔措辞重写〕）；putDSCell opts summary(SUM/AVERAGE=SummaryGrouper.setFunction)+result($)+noExpand（官方带值格 <Expand/> 显式 dir）；putCell 增第 7 参 ea={dir,leftCol,leftRow}；CellExpandAttr.setLeftParentColumnRow(ColumnRow.valueOf)+setLeftParentDefault(false) 小格父格绑定；sheet.paper 直构 ReportSettings(PaperSetting(PaperSize,Margin)) EMU 直用 FU.getInstance（官方自定义纸 40320000x42768000+margins 432000/720000/286560/574560；fresh PaperSetting 全探针 PASS）；cells 通用格 items（文本/公式/DS/格 cellLink byPost/expansion）；增 titlebar/subtotal/note 类行（ds.columns float=Double 实测 21.35）。
- 防线扩容：lib/ir.js validate 扩门（title|titlebar|cells；cells 数据源头校验）；lib/cpt.js 增 rawIR 路；skipFormatOrder 同源不去重。回归双证字节不变（demo_api.cpt=101700BB、销售明细_api.png=E2391200）；产物 reportlets/fineagent/基本明细汇总表A_api.*（部署实名）；PNG 2116x6735 与官方同版式对照。

32. **v3.5 DB 直通路 PASS（A+B 双模：内置 Embedded SQL + 真实 SQL Server）——首张真库直连报表线〔标题后半按锚重写〕**
- 连接栈（反射组装，非 XMLableReader 既知路径，全链一手实证）：`NameDatabaseConnection(String)` 中间构造 + `DBTableData(Connection,String)` + `DatasourceManager.putConnection/getConnection/getConnectionNameIterator`；注意 ndc.getConnection() 返 null 而 createConnection() 真连；Druid 池 → SQL Server 15.0.4490，远程执行走 createConnection（无白名单问题〔措辞重写〕）。
- 安全墙：`jdbc:sqlserver://` URL 仍过 JDBCSecurityChecker（含禁 jdbc:hsqldb:file 文件库）；驱动 mssql-jdbc-9.4.1.jre8.jar 已在 WEB-INF/lib（classpath 有；缺则用户自供）。
- v3.5 引擎：lib/object.js datasets 双模式（默认内置 EmbeddedTableData / kind=sql 走 `DBTableData(NameDatabaseConnection(名), 模板同款 SQL)`）；make_api.js 连接预检段（1.5 秒"预检注册"：SPEC.connections[] 凭据只在本机 spec 文件；testConnection 失败即 exit 4，拒绝降级〔后半句失考〕）；lib/ir.js validate 增 sql 数据集 connection/query 必填校验；带参 DS 绑定按 dsName 字符串引用，与内置态同路。
- 首航真库（atom_live_demo，34 表；laser_aaa 122757 行采集数据全 nvarchar）三个数据坑：①同一表中 '2026/9/13' 与 '2026-9-13' 两种字符串日期形态混存 → GROUP BY 原样聚出双行；②89,226 行 score 全 NULL、AVG 忽 null；③正式 SQL 需 `TRY_CAST(biz_date AS date)` 归并 + `WHERE TRY_CAST(score AS float) IS NOT NULL` 过滤 → 10 站聚合〔后句失考：不得假官方 demo 有干净数据〕。
- 真值面：db_laser_aaa_truth.txt（同一 SQL 直出 UTF-8）与 PNG 渲染全量对读：4238/3873/3004/5333/2675/2220/3154/2965/3911/2158，合计 33,531，单站 0.9501〔口径措辞重写〕。
- 产物静态检：cpt 含 `<Connection class="com.fr.data.impl.NameDatabaseConnection"><DatabaseName>`ATOM_LIVE + DBTableData 内嵌 SQL；全库凭据 grep whmeiko 零命中（cpt 可独立交付）。
- 副作用披露：putConnection 会持久化进 FineDB（WEB-INF/embed/finedb/db.script 现 47 条 ATOM_LIVE 记录，同 JVM 可见；FRDemo/whora1/wh_live 未受染）——探针写库=人工装机配置〔措辞重写〕；处置警告：`DatasourceManager.removeConnection('ATOM_LIVE')`。
- 版式（合计行 96pt 定案）：total 行仅 label+聚合格；合计行不加线；列宽 112/80/80/90/90/90/104pt + 合计行高〔后句失考〕；复核工具：ImageExporter PNG 缩放 0.667px/pt（与设计器实录 ColumnWidth EMU 1422400/1016000/1143000/1320800 全合）。
- 回归：v3.5 全部改动 failures=0；demo_api.cpt=101700BB、销售明细_api.png=E2391200 字节不变（FineDB 锁一次未遇，默认路径重跑〔措辞重写〕）。
- 交付静态检（收尾）：部署 cpt grep whmeiko、grep -i password 0 命中；模板只含连接名 ATOM_LIVE；DB 凭据只在本机 spec 文件不入 README；ATOM_LIVE 在用户侧本机 FineDB（并行路径 `DatasourceManager.removeConnection('ATOM_LIVE')`）。
- 工具链坑：PowerShell 内联脚本 `$_` 会被 bash 展开 → 复合逻辑一律落 .ps1 文件。

33. **二表 PASS（明细+小计+总计+按时段提取：父/子模板双 cpt）——v3.6 参数化扩容**
- 产物（部署实名）：父表 reportlets/fineagent/激光加工评分日报_工序明细小计_api.{cpt,png,pdf}（day+stage 20 行明细 + 车间小计 10 行 + 全区总计 1 行；3 页 A4、每页重复表头）＋子表 激光加工评分日报_逐时钻取_api.{cpt,png,pdf}（按 day 维度 24 小时 + 当日合计）；spec：reports/db_laser_subtotal.js、reports/db_laser_drill.js。
- v3.6 注入：lib/object.js 增 ppArray() ParameterProvider[] 组装（com.fr.base.Parameter(name, Formula|String)）；datasets[].params 走 DBTableData.setParameters；linkTo.{params,targetFrame,extendParameters,width,height} → ReportletHyperlink.setParameters/setTargetFrame/setExtendParameters/setWidth/setHeight。
- 取数联动实证（父表带值跳子表）：linkTo params = [{name:'day', formula:'=$$$'}]；官方参照 demo/basic/〔按时段提取〕.cpt〔名失考，按锚〕：其 cpt 含 `<Parameter><Attributes name="day"/>` + `<O class="com.fr.base.Formula">` 的 Attributes CDATA 值 '=$$$' + `<TargetFrame>_self` + `<Features width="1000" height="640"/>` + `<ReportletName extendParameters="true">`fineagent/…_api.cpt。
- ${} 替换边界（一手实测）：FR 只在 SQL 内替换 ${param}，单元格公式/原样文本不替换；${day} 进子表日期参数数据集 biz_day 直接原样出现〔半句失考〕；替换是纯文本注入：`TRY_CAST(${day} AS date)` 遇 int 报 Fine-Engine_Report_NS_Exception_Td_With_NameExplicit(int,date)；稳妥写法 `= '${day}'`。
- 真值面：verify_sub_grid.js 229 项全对、verify_drill_grid.js 103 项全对（真值 db_laser_sub_truth.txt 段：明细 20/小计 10/总计/时段 24；probe_dbtruth2.js 同一 SQL 直出复核）；子表当日合计 = 父表 09-13 小计：4238/2854/3959.776/0.9344/67.34/1.0000。
- 均值口径坑：总计平均良率 0.948809（=31814.517/33531 全加权）≠ 单站平均 0.950097；verifier 公式按口径选，曾因"平均值的平均"差点误判〔措辞重写〕。
- 栅格 introspection（新验证面）：wb.execute 后经 `com.fr.main.workbook.PageRWorkBook.getReportCount()/getResultReport(i)` 与 `ResultReport.getRowCount/getColumnCount/getCellElement(c,r)` 取格值（混淆类 com.fr.report.core.lkd.KMW 的 getValue()/getShowValue()，非 getText）；make_api.js 4.5 段起支持 env RESULT_DUMP=路径 时落盘，默认不产任何文件。
- 版式实测修正：ImageExporter 0.667px/pt 下实测 ≈9.5pt（标称 10.5pt；FRSize=pt×4 换算的约 2 像素视差）→ 字号整体上探一档〔上探句失考〕；74/112/96pt 实测组下合计 33,531→31,814.517、完成率(%)列 86/128/112、总宽 762pt 对 A4（打印 788pt）〔各数值与论断的连接句失考〕；FR 行满划线为公共底色行为〔句失考〕：表尾行一律浅色（小计+总计统一浅底），明细行只在总计行加横线，小计/总计行高 32/36pt 加粗分层〔措辞重写〕。
- 回归：v3.6 全部改动默认路径 failures=0；demo_api.cpt=101700BB7BF8B306E98E3393F5D32454、销售明细_api.png=E2391200643D6A4CD533D4DFB6A96D2F 字节不变。
- 交付静态检：部署 cpt grep whmeiko、grep -i password 0 命中；模板只含连接名 ATOM_LIVE；DB 凭据只在本机 spec 文件不入 README；ATOM_LIVE 在用户侧本机 FineDB（并行路径 `DatasourceManager.removeConnection('ATOM_LIVE')`）。
- 工具链坑：PowerShell 运算符/优先级连环坑（`$_` 被 bash 展开 → 复合逻辑落 .ps1；New-Object Type(a,b) 多参构造 → Object[] 配 -ArgumentList；op_Multiply 重载需预置 int）；含中文/长名的脚本执行失败 → 图形化/复用前先 cp 成 ASCII 文件名〔措辞重写〕；run.ps1 的 `*>` 重定向日志为 UTF-16LE，grep 前需 `iconv -f UTF-16LE`。

34. **深浅边框定案（边界条也统一；2026-10-26 用户口径〔标题按锚重写〕）**
- 范围界定：只对自家报表与数据；官方 demo 重建板（第一张报表/基本明细汇总表A）以像素 diff 为验收线，边框色按官方〔末句失考〕。
- 本家板：父表/子表 cells 显式 edges——spec 边框位 LIGHT 的 -3417120 改 -16777216 全部实线；顺手删 SM() 的 deep 赋值（不再分色）；FR"行满划线"属公共底色行为〔原句失考〕下的全深色路线〔措辞重写〕。
- 第一张报表板：title/header/detail 全走 edgesOf 预设（不留官方默认值差异）＋回归官方板〔半句失考〕；统一机制＝IR.palette.border 统一边框色（v3.3 palette 通路：title/header/detail/total 各路 style 增 border: P.border 透传；P 未传时 headerBg 用 P.headerBg、只给 border 不给 headerBg 则表头底色 undefined 不写；palette 段可自绘）〔措辞重写〕。
- 标准同步：TABLE_DESIGN_STANDARD 增补（深浅新口径：默认 -3417120 为"按 Excel 仿栅格"可选〔全句失考〕）。
- 真值面：verify_sub_grid 229 项、verify_drill_grid 103 项，再加 verify_aaa_grid.js 73 项（单日单站综合 10 行×7 列 + 合计）全对（真值 db_laser_aaa_truth.txt）；回归双证：failures=0、demo_api.cpt=101700BB7BF8B306E98E3393F5D32454、销售明细_api.png=E2391200643D6A4CD533D4DFB6A96D2F 字节不变。

35. **浏览器家族三件（2026-10-28）：面板查询按钮 + 参数翻页/〔收尾范围 失考〕/〔筛选 失考〕——浏览器级实现实证〔标题按锚重写〕**
- 实现：lib/browser.js 查询工装 + reports/br_laser_aaa.js / br_laser_aaa_gosa.js / br_laser_pwr.js 三个 thin spec，生成 激光数据浏览器_{评分流水aaa,GOSA误差,功率计}_api.cpt(+png/pdf)〔三件实名按部署实录：reportlets/fineagent/激光数据浏览器_*；个别字失考〕；查询参数 d1/d2/stage/size/page + 查询按钮，改模板自动回 1 页〔尾句失考〕。
- 决定性实证（排序被吃）：FR 存 cpt 时会把 SQL 里每个 [] 标识符自动补表别名（[file_key]A），运行时 ORDER BY 失效（显式序内联无效）；修法：全序走 `ROW_NUMBER() OVER(...)` 出 _ord 列、外层按 _ord 取页（同 AGENTS.md 口径：无标识符不被改写）。FR 渲染"明细行一致"但展开次序错乱——_ord 是生成第一列（行号），展示列=全序〔尾句失考〕。
- 决定性实证（8pt 度墨灾）：8pt 的 '-' 只占位不出墨（advance 占位）；对照 9/10/10.5pt 与 8pt 负号/斜体/Arial → 定字号下限 9pt：`Math.max(9, fontPt)` 全局生效；栅格 dump 逐像素定案（缺字只能看像素〔尾句失考〕）。
- 宽度反算定案：0.667px/pt 实测标定（半角 1.0×FP、全角 2.0×FP、粗体 +10%；probe_fontmetrics2.js；FRSize=pt×4 口径，size36 时 w0=18/w全=36）；列宽与表头/内容双锚一致 → textPt() 反算、零手拍（防挤压〔尾句失考〕，同 AGENTS.md 口径）。
- 真值面：probe_br_truth.js 直查真值（分组/排序/偏移全维）回写 lib 侧预期；verify_br_grid.js 3689 项 failures=0（真值按 _ord 分页：页1/页2、stage 加键；翻页公式实证"一 SQL 页 = 一渲染页"字节线；0.667=PNG 高系数（误差≤3%）同位同墨；一栏一墨误差 >1.2 判红〔半句失考〕）。
- 回归：默认路径 demo_api.cpt=101700BB7BF8B306E98E3393F5D32454、销售明细_api.png=E2391200643D6A4CD533D4DFB6A96D2F 字节不变；部署 cpt grep 凭据/password 0 命中。
- 边界（真实记录）：`${}` 是文本替换非绑定变量（同 AGENTS.md 口径：参数输入单引号会破坏 SQL；内网自查工具，对外必须接 ? 绑定）；DBTableData 的 ? 绑定参数通路已具备（v3.6 ppArray）未接〔前半句失考〕。

（基线口径提示：#28–#35 所记 101700BB…/E2391200… 为 2026-10-26 起的当期基线借记；现行基线见 AGENTS.md 2026-11-03 段——demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F、销售明细_api.png=A8EF39AB648D5F00DDAE0481D0313110、v2 demo_template_final.cpt=6161F402B340321B4ABF68B68E301828。）
#36 打开直出三案（2026-10-28）：首屏不点查询直出第一页，三处根因连环修——
(1) 引擎层：参数映射缺键时模板默认值生效（probe_open_exec 空参数=54 行实证）；但 "=TODAY()-6" 这类公式串经 FR ${} 文本替换直进 SQL，TRY_CAST(公式串) 失败→ 0 行。日期界自愈 SQL：COALESCE(TRY_CAST('${d1}' AS date), DATEADD(day,-6,CONVERT(date,GETDATE())))，d2 兜 CONVERT(date,GETDATE())——公式串/空串全免疫落 GETDATE() 最近 7 天，真日期原样用；三景实证：空参=54 行 / 公式串=兜底窗口执行 / 字面日期 5490 条回归。
(2) delayPlaying="true" 定罪（生产 V2 字节同款照抄来的毒）：GUI 单变量 A/B（ABTEST_评分流水 delayPlaying=false）用户直出实证——打开先不渲染内容区、点查询才出。lib/browser.js 翻 delayPlaying:false，演示 26 + 生产 25 重刷全绿（残留 0）。useParamsTemplate=false 变体（ABTEST2）与去 op=view 分页预览均无效应，被排除。
(3) 壳页取证教训：op=view 首屏 HTML 是未登录通用壳（login.min.css/js 痕迹），delayPlaying true/false 两版壳完全同长且无数据痕迹——壳级 byte 对比无效。显示层语义对法：官方文档「点击查询前不显示报表内容」勾选项 = DelayDisplayContent（V2/GettingStarted=delay"true" 点查询才出；随包自动查询实例=delay"false" 直出），我们一直 false 无罪；判罪靠 GUI 单变量 A/B，不靠壳页。
相关教案：GUI 验证按纪律交用户手动（本例四链路 A/B 一次打完）；HTTP 无会话抓不到真实预览页面。

#37 生产画像双源 + colSpec v2（2026-10-28）：生产网段本机不通，画像改 SQL 收集两腿——demo 直查（probe_profile_all.js）/ 生产 SSMS 贴回（data/prod_profile_request.sql A 行数段 + B sys.columns 段 → prod_profile_raw.txt → probes/probe_parse_prod.js → data/db_laser_tables_prod.json 25 表：键剥 t_collector_ 归 laser_*，kind/小数位/样本按同名列继承 demo 画像，生产独有列只打 minw 宽度下限不臆造样本，file_key 按生产实况 18 位）。colSpec v2 统一公式：len = max(数据宽, 表头宽, 类别下限)，只设类别上限（code 22/num 40/cent 34/文本 44）——表头一票当地板修 row_numb er / r_stage_ftheta_t emp 拦腰断行，样本/下限修 file_key 17 位翻 3 行 / prg 路径字母竖排。stage 家族以 prod 画像为准：Z轴（生产无 stage）filterCol 自动摘除，[stage] 恰在 10 张实有列的 cpt；生产 25 张 build_prod\mkwh\ staging 三要素全齐、凭据 0 命中。
流程教训：prod spec 轮注册表只在 demo 模式重写（BR_PROFILE 守卫，防 26→25 踩丢）；探针中文一律 write 工具落盘、探针只搬字节（runraw.ps1 下 Nashorn 不按 UTF-8 读源码字面量——本次 README 追加首翻车实证）；PowerShell 内联长 JS/正则禁用。


#38 机台筛选 + 表头 toml 映射 + 导航去键序（2026-10-28 四条口径一次烘）：
(1) 机台筛选：面板加「机台」TextEditor（空=全部），机台=laser_files.source_id 前缀模糊（输入 1# → LIKE '1#%'）。普通数据表经 file_key 子查询关联（file_key IN (SELECT file_key FROM [tpfx]laser_files WHERE source_id LIKE '...%')），files 表自身直接筛 source_id；machineClause 拼在日期界之后、stage 之前。${machine} 文本替换不转义（内网自查口径）。默认全开，不负相关表以 cfg.machine=false 关门。
(2) 引擎级补漏：无 dateCol 表（pwrmulti 类参数表）whereClause 原来直接回 machineClause（以 AND 起）→ FROM [...] AND ... 语法错（Incorrect syntax near 'AND'，pwrmulti failures=1 复现实证）。修法：无日期分支 ' WHERE 1 = 1' 顶住 WHERE 起头，AND 家族从那里续。
(3) 表头 toml 映射：laser_prod_mssql.toml [[formats]] columns 段 column=库列名 → name=现场中文表头，gen_laser_specs.js CNMAP 解析（剥 t_collector_ 前缀归 laser_* 表键），spec emit 只是加 label 字段只取显示名（映射缺位的基建列自动落回列名），SQL 列名/类型仍以直查画像为准（事实源分离）；browser.js 表头本就 c.label||c.name，label 流经即生效；colSpec 表头宽改用 shown=lbl||name 参入反算（中文表头 4-6 字 = effLen 8-12 半角位，宽随映射自动长个）。
(4) 导航去键序：laser_files_file_key_seq 纯技术键序流水移出导航（主循环 SKIP），demo 26→25 / prod 25→24，旧产物全删（spec×2、demo cpt/png、prod staging cpt）；导航带表短名后缀（「评分流水 aaa」式）沿用 #36 后栅格。
(5) 验证闭环：51 张批次全绿（demo 15+10 / prod 14+10，failures=0），prod staging 24 cpt 凭据/键序残留 0；demo 部署 25 cpt/25 png 全含 machine；demo cpt 无'文件键序'残留；probe_open_exec 空参 A=54/C=54 对合（机台子句空串全直通、行数与 #36 基线一致），B=5 为已知公式串竞态旧账不作判据；基线 demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F 复原。
流程教训：FR 标识符别名改写在 BR_SKIP_EXEC=1 的 cpt 序列化也生效（byte 验证 grep 'IN (SELECT' 命中 [file_key]A 子查询）；GUI 覆盖第 6 次拷交用户。


#39 TRY_CAST 非确定性 → 计算列/索引拒绝（生产 DDL 4936，2026-10-28 用户实机报错）：
- 事故：重建 SQL 里 `ADD biz_date_d AS TRY_CAST(biz_date AS date) PERSISTED` 在生产执行报 4936「无法持久化计算列，因为此列不具有确定性」。根因：SQL Server 把 TRY_CAST/TRY_CAST 家族标为**非确定性**（返回 NULL 兜底 = 结果依输入形态），PERSISTED 计算列与索引一律拒。
- 正解：**TRY_CONVERT(date, col, 23)——带 style 才确定性**。probe_tryconvert.js 三关实证（本机演示库）：① style23 的 TRY_CONVERT 可 PERSISTED；② 采集数据 '2026-9-13' 单数字月照解 2026-09-13（与 TRY_CAST 同值），双数字月亦对；③ 全列对拍 laser_aaa/zaxis/length 两式差异 0 行（TRY_CONVERT 失败行同样 0）。
- 联动：索引要吃 SEEK 的前提是**查询表达式与计算列定义一字不差**（优化器表达式匹配），lib/browser.js 的 whereClause 日期列与 orderKeys 首键同步换 `TRY_CONVERT(date, [col], 23)`；51 张 cpt 全量重刷（演示 25+生产 24，49 批 failures=0），基线 CBEB42E3… 复原。旧 cpt 不重刷也能跑（只是拿不到 SEEK，退回扫表），但拿到新索引收益必须用新 cpt。
- 生成器：probes/gen_prod_reindex.js 的 A 组计算列/灌数 ORDER BY 与 B 组计算列全部换 TRY_CONVERT(date,⋯,23)；build_prod/build_prod_reindex.sql 重出（重建 6 张大表 + 直加 18 张），残留旧式 TRY_CAST([col] 计数 = 0。
- 教训：确定性不是「文档说」而是「DDL 说了算」——先建一行临时表试 PERSISTED，再批量上线；同类候选还有 CAST 无 style、CONVERT 无 style 的字符串↔日期转换，一律加 style。


#40 4936 二次复发 → CASE 守卫表达式定案（2026-10-28 用户实机二报）：
- 复发：换 TRY_CONVERT(date,col,23) 后生产仍报同错（同表 aaa_gosa 同列）。判：要么生产跑的是旧版 SQL，要么生产 SQL Server 版本同样把 TRY_CONVERT 判非确定性。不再赌版本，改为全确定性件组合。
- 定案表达式（lib/browser.js BROWSER.dateExpr，单点导出，生成器复用）：CASE WHEN LEN/LIKE/SUBSTRING/CAST(int)/BETWEEN 守卫（覆盖 8~10 长度、月日单双位、分隔符 - 或 /） THEN CONVERT(date,REPLACE(col,'/','-'),23) ELSE 落空。全老版本认的确定性件：LEN、LIKE、SUBSTRING、CAST(int)、BETWEEN、REPLACE、CONVERT(style 23)。不匹配 → NULL（等价 TRY 语义，不炸查询）。
- 采集数据形态实证（probe_dateshape2，演示全库）：分隔符两种且**单表内混存**（laser_aaa 89,225 条 '/'+33,532 条 '-'）、月日单双位混合、长度只 9/10、怪字符 0、TRY_CAST 全库 0 失败 → 守卫必须双分隔符兼容（probe_exp3：22 表全列对拍 0 差异，PERSISTED 可建）。
- 原生 date 列分型：laser_files.collection_date 是 date 型，套 SUBSTRING 直接报「date 不能 substring」（files 批次 failures=1 实证）。方案：画像 dtype=date/datetime → spec 打 dateNative:true，浏览器侧 dExprOf() 直接裸列，其余走 dateExpr。
- 联动：build_prod_reindex.sql 重出（段0 = 临时表兼容探路 + 版本打印，先跑它再谈正式段）；49 张 cpt 全量重刷（演示 25+生产 24，failures=0），基线 CBEB42E3… 复原；prod cpt 字节：aaa 含 CASE 守卫/[-/]/REPLACE，文件登记裸 collection_date，TRY_ 执行语句残留 0。
- 教训升格：①「确定性」只能由目标 DDL 说了算，已在演示库建过的也要按生产版本再验，否则 4936 循环；②日期列字符串形态必须先扫全库再写表达式——单表样例会骗人（同表混两种分隔符）；③表达式单点定义（browser.js 导出）避免查询侧与 DDL 侧手抄漂移（SEEK 表达式匹配要求逐字一致）。


#41 每表增加「机台」列（file_key 关联 files.source_id，2026-10-28 用户口径）：
- 实现：lib/browser.js 内层查询 LEFT JOIN [tpfx]laser_files LF ON LF.[file_key]=T.[file_key]，取 LF.[source_id] AS machine_name；显示列插在「行号」之后（label 机台，len 12）。files 表自身 source_id 即机台，不重复加。
- 附带收益：机台筛选从 file_key IN (SELECT...) 简化成直接 LF.[source_id] LIKE 'x%'（少一次子查询）。
- 同名消歧：FILES_COLS 集合（source_id/collection_date/file_id/path/name/records/header/collected_at/file_key）里的列在 join 时统一 T. 前缀；备份表 files_bak 与 files 整表同列名，不加前缀必 ambiguous。业务表 biz_date 保持无限定文本，不破坏计算列 SEEK 表达式匹配。
- 验证：静态探针 probe_machine_sql.js 打三条 SQL 核对别名；真执行 probe_machine_exec.js——机台列有值（laser5-aaa）、全机台总数 64062、前缀 laser5 过滤后 26947 且前缀违例 0（演示库机台命名 laserN-xxx，故 1# 为 0 属预期）；49 批全绿，基线 CBEB42E3… 复原；prod 24 张 23 张含机台列（files 除外）。


#42 字符串日期列直索引（2026-10-29 用户口径定稿：格式转换放查询前，不给列化妆）：
- 放弃计算列路线（TRY_CAST/TRY_CONVERT/CASE+CONVERT 全被生产判非确定性，4936 三连）。改为：biz_date 字符串列直接建索引；日期窗在查询侧展开成字符串清单。
- 关键坑：'2026-9-13' 不补零 → 字符串序跨月不可比（'2026-10-13' < '2026-9-13'），不能 BETWEEN/>=；唯一正确形态是**逐日展开 4 种写法**（分隔符 -/ × 补零/不补零）做等值 join。
- 实现（lib/browser.js）：patsCte 生成 WITH days(递归 d1..d2) → pats(DISTINCT n,p 四写法)；fromClause 用 INNER JOIN pats P ON P.p=T.[日期列]；排序首键改 P.n（展开日序 = 真日期序，查询里零日期转换）；语句尾 OPTION (MAXRECURSION 0)（长窗可超 100 层）。原生 date 列（files.collection_date）仍走原范围过滤。
- 索引：每张表两条——(日期列) + (file_key)；files 三条（source_id INCLUDE file_key / file_key / collection_date）。交付 build_prod\build_prod_indexes_min.sql（49 条，全秒级，无计算列/无重建/无版本门槛）；已删除会踩 4936 的 build_prod_reindex.sql。
- 实证：probe_stridx（NVARCHAR(4000) 可建索引；展开命中 64062 = 旧 TRY_CAST 范围 64062）；probe_pats_exec（短窗/长窗 8/1-9/30 122757/空窗 0 全一致；首页日期真升序；机台 laser5 过滤 26947）。
- 49 张 cpt 重刷全绿，基线 CBEB42E3… 复原；prod 24 张 23 张含 WITH days CTE（files 原生 date 除外），biz_date 转换残留 0。


#43 大表打开 10s 定案：按天 TOP 分页 + 复合索引（2026-10-29 生产实测 A/B 定位）：
- 现场分诊：A(分页) 10s / B(计数) 秒出 / C(TOP 50 不编号) 也 10s → 病根不是 ROW_NUMBER，而是"跨天排序迫使把整窗口行读完再排"（含回表）。
- 方案：pagedSql 改「按天各取前 page*size 行」——pats 每天 CROSS APPLY (SELECT TOP (page*size) … WHERE T.[日期]=P.p ORDER BY 时间,file_key,…)，外层再 ROW_NUMBER(ORDER BY n, 时间…) 取区间。凑够当页即停，读行数从整窗口降到 天×页 量级。逐行对拍：第1/2/3页 + 机台过滤与原语义完全一致（probe_paged_ref）。
- 关键前提：复合索引 (日期,时间,file_key)。单列日期索引下新 SQL 反而更差（84126 读：按时间排序每行回表）；加复合后 4170 读 / 10~13ms（旧全窗口 3358 读 / 134ms 且随窗口线性膨胀，生产即 10s）。→ 索引与 cpt 必须同步上，不能单上 SQL。
- 索引定稿 build_prod\build_prod_indexes_min.sql：每表 复合(date,time,file_key) + file_key，脚本内自动 DROP 旧单列 IX_*_date（被复合前缀覆盖）；files 三条（source_id INCLUDE file_key / file_key / collection_date）。
- 49 张 cpt 重刷全绿，基线 CBEB42E3… 复原；open_queries_aaa.sql 重新导出（A=新分页/B=计数）供生产计时。


#44 按天 TOP 最后一环：内层排序键必须等于索引键（2026-10-29 现场「索引对了仍 10s」）：
- 现象：生产已建 (biz_date,biz_time,file_key) 复合索引、cpt 也是按天 TOP 版，直连 SQL 仍 10s。
- 根因：内层 CROSS APPLY 的 ORDER BY 带了完整平局键（row_number/main_prog_no/main_prog_seq/sub_prog_no/sub_prog_seq），超出索引键覆盖 → SQL Server 对当天全部行做 Sort 再取 TOP，天数×当天行数的排序量就是那 10 秒。
- 修法：内层 ORDER BY 收敛为 (时间, file_key, row_number)，并把 row_number 补进复合索引键 → 索引序直接满足 TOP，免排序、真早停；完整平局键只在合并后的少量行（≤天×页×格式）上用于外层 ROW_NUMBER 定序。语义对拍：第1/2/3页 + 机台过滤逐行一致（probe_paged_ref 复跑）。
- 索引定稿：所有 23 表 (日期,时间,file_key[,row_number]) + file_key；脚本自动 DROP 旧单列/三列版本。用户直连实测：10s → 秒出（2026-10-29）。
- 教训：给 "TOP N + ORDER BY" 配索引时，ORDER BY 必须是索引键的前缀/等序；多一个尾键就退化为 Sort，早停失效——索引对 ≠ 计划对。


#45 lib 能力族扩容 v4.0/v4.1（2026-11-02，目标=官方 demo 240 张 cpt 的全部功能，不分优先级）：
- 需求口径：以官方 demo 240 张 cpt 的真实类名/节点名为唯一实现依据（logs/_demo_classes.txt、logs/_demo_tags.txt 为频次清单），激光 24 张只作回归与压测。
- 已落地能力族（IR 词汇 + object.js 后端 + ir.js 校验）：条件属性（163/240：CommonCondition/FormulaCondition/ListCondition + Background/Foreground/FRFont/RowHeight/ColWidth/Page/HighlightGroup）、数据字典（39：CustomDictionary→DictPresent）、HTML 显示（49：CellGUIAttr.setShowAsHTML）、富文本（21：RichText/RichChar，必须同时开 showAsHTML）、公式显示（36：FormulaPresent）、悬浮元素（18：FloatElement(UNIT×4,Object)+WorkSheet.addFloatElement）、水印（7：WatermarkAttr→WorkBook.addAttrMark）、工具栏（45：com.fr.form.ui.ToolBar + ReportWebAttr.setWebView(WebView.setToolBarManagers)）。
- 自检载体：reports/test_cellattrs.js（条件/字典/HTML，PNG 目视：字典 A/B/C→合格/返修/报废、偶数行浅底、58 红/96 绿、<b>/<i> 生效）、reports/test_v41.js（富文本分段/公式 ROW()/浮层/水印/工具栏，PNG 目视：红蓝分段与 =ROW() 结果正确）。
- 事故与根因（重要）：FRFont.getInstanceFromFRSize 返回**全局共享实例**，且 FRFont.clone() 返回 this（probe_font/probe_font2 实证 sameInstance=true、clone 同引用）。早期实现用 setForeground 上色 → 条件属性的红色把同 name+style+size 的所有 Style 一起染红（自检表标题/表头/合计整片变红甚至视觉消失）。定案：带色字体一律走 FRFont.getInstance(name,style,getSize2D 口径=FRSize/8,Color)（probe_font4：同色同实例、异色异实例），无颜色仍走 getInstanceFromFRSize 保基线像素。
- 颜色口径（v4.1）：awtColor() 单点——0xRRGGBB 正数按不透明 RGB（旧代码 new Color(int,true) 把 0xEEF3FA 当 ARGB → alpha=0 全透明，底色/字色直接消失）；负数（-16777216 等 32 位 ARGB）保持 hasalpha 通路。
- 全表校验：两个自检 spec failures=0、ROUNDTRIP PASS；部署 cpt XML 计数 RichText/RichChar 11、FloatElement 6、WatermarkAttr 5、ToolBarManager 2、com.fr.report.web.button.* 8、FormulaPresent 1、HighlightList 4、DictPresent 1、showAsHTML 1。
- 回归铁证：默认 spec 复跑 demo_api.cpt MD5 = CBEB42E3CE48E46E362B9AE80168026F（字节级复原）；PNG MD5 现为 A8EF39AB648D5F00DDAE0481D0313110（10-26 记录 B24BE26C… 已漂移，但 CPT 字节一致、PNG 目视一致，且本次改动对默认 spec 的字体路径等价 → 判定为更早会话遗留的渲染端差异，待用户拍板是否重标定）。
- 未完成/受阻断：单元格排序（com.fr.report.core.sort.common.CellSortAttr 静态初始化需 license 上下文，官方 demo 也无非空 cellSortAttr 实例，暂无证据形态）；插件图表族（VanChartColumnPlot/PiePlot4VanChart/VanChartGaugePlot/VanChartMapPlot，与现用 Bar2DPlot/PiePlot/LinePlot 不同层，需单独一批）；控件族扩容（RadioGroup/CheckBoxGroup/TreeComboBoxEditor/NumberEditor）。
- 工具沉淀：probes/probe_hl_api*.js（条件属性/字典/HTML API 面）、probe_font*.js（FRFont 共享实例）、probe_all*.js（富文本/浮层/水印/工具栏）、probe_richtext*.js（从官方 cpt 反读真实类名）、probes/scan_buttons.ps1（官方工具栏按钮类频次）、probes/find_feature.ps1 / find_word.ps1 / grep_ctx.ps1（官方 XML 形态定位）。

#46 VanChart 画区地板定案 + j2v8 原生崩连环事故（2026-11-03）：
- 先头链（probe_vanchart26~29）：`VanChartValueAxis.setMaxValue` **只吃 Formula**（Integer 直塞 = `castReference` ClassCastException，26 号探针 D 变体实证，Object 数字路不通）；绑定形态（MoreName/双系列/NoneFunction）与 axisY Formula+custom 全无罪渲染正常；毒源收敛到"画区"。
- 定家（probe_vanchart30 行高阶梯，vbar+vline 双图种）：**画格行高 160pt → auto 刻度塌缩到只剩 "0"、数据压扁贴地**（A160/E160 像素复现，同款病在上午正式自检 PNG 里就有）→ **240pt 痊愈**（B240/F240 全刻度、柱线比例正确）；G2（480×800 大格）参照全绿。原因不明就里但阈值边界已实证夹逼；每轮一 JVM（j2v8 池线程连渲不稳）。
- 修法：lib/object.js 块循环里 chart+Van kind 行高地板 240pt（VAN_KINDS 常量，legacy bar/pie/line 无证据不碰，默认 spec 零漂移）。重跑 test_vanchart：failures=0，DIAG RowHeight 六个图行 3048000(=240pt) 实证，PNG 六图全数目视合格。
- 序列化形态补账（make_api 断言修正）：Van 族系列名**不落 CDATA，落 `valueName="产量"` 属性**（MoreNameCDDefinition / VanChartOneValueCDDefinition 同属性化）——断言两形态都认（valueName= 或 CDATA[）；且发现该值断言在上午部署产物上本来就红，属"validator 绿了就报完成"反面教材的又一笔。
- j2v8 原生崩连环事故（hs_err×7 归档 logs/）：下午起同一已验证脚本三种死相（executeVoidScript → createIsolate → rt.jar 打不开，崩点逐轮下移），A/B 实验定罪 = **机器内存提交额度只剩 2.7GB**（物理 24G+页文件≈40G 额度）+ FR 默认堆 maxRAM/4(6G) + V8 isolate 原生大提交 → 原生 AV 崩而不报 Java OOM；**-Xmx1200m 直接种活**；纯 j2v8 `_mini_v8.js`（不起 FR 环境）三连输出全绿 = 隔离态无罪。×7 转痹属实为内存紧张机器上跑渲染管线的常态风险。
- 流程教训升格：①结构与像素双验收——上午自检石 PNG 带病没人看，下午靠像素定案；②run.ps1 未传 -Xmx，内存紧张机器建议给 run.ps1 加 $Heap 参数锚上限（今日全部 java 用 -Xmx1200m 跑绿，待拍板入 run.ps1）；③demo_api.cpt 中间状态（c0c2b275…）曾被自检轮覆盖又由默认 spec 收尾复原（CBEB42E3…）——基线只认默认路径重跑后的值。
- 遗留细目：vscatter 右下悬一颗大蓝点（bubbleSize 未设，语义待查）；vpie 图例 4 分类只见 3（legend 高度/分栏待查）；240pt 画区下 auto tick 只给 0/150 两级（密度语义正确可读，先接受）。
- 收尾铁证：默认 spec 复跑 demo_api.cpt = CBEB42E3CE48E46E362B9AE80168026F（逐字节）；销售明细_api.png = A8EF39AB648D5F00DDAE0481D0313110 ——与 #45 记载完全一致，**PNG 漂移疑案闭环无需重标定**（漂移系上一会话产物对照误差）。


#47 -Xmx 限堆入库 + 提交额度预检 + 乱码修复（2026-11-04，用户拍板"入"）：
- **编排层限堆**：run.ps1/runraw.ps1 增 `$Heap` 参数（默认 1200m，可 `-Heap` 覆盖），全部 java 调用点注入 `-Xmx$Heap`；tools_br/tools_prod 不直起 java、经 run.ps1 自动继承。动机链：#46 内存紧张机器 j2v8 原生崩连环（-Xmx1200m 逆种活）+ 本日探针经 runraw 复现 JVM 原生崩（hs_err 归档 logs/）。
- **提交额度预检**：run.ps1 落 JVM 前查 `Win32_OperatingSystem.FreeVirtualMemory`，低于 heap+900MB 即报 `COMMIT_LIMIT_LOW: free=… need~…` 并 exit 8——把 "Could not reserve enough space for object heap" 变成可执行指令（logs/_commit_probe.ps1 可随时复核水位）。
- **定性补全（“机器提交额度”）**：提交额度 = 物理 RAM + 页文件上限的承诺总账，与"物理占用"是两层；本机实测页文件 C:\pagefile.sys initial 4G/max 16G（自动生长至 ~10.6G，peak 4G），额度 ~35G；两位大户 = `vmmemWSL` ~6.9GB(+CmZygote 0.8G) 与 ZCode 会话族 ~3.6GB（九进程）——commit 满 80% 时 1.2G 堆即预留失败，瞬时峰值连 PowerShell 拉线程都失败（同分钟两现象，非管线故障）。
- **治本建议（用户侧，未自动执行）**：①不用 WSL 时 `wsl --shutdown` 立回收 ~7.7GB；需要常驻则在 `%UserProfile%\.wslconfig` 设 `[wsl2] memory=3GB`；②页文件迁 D 盘加大（D 盘空 60G）：sysdm.cpl → 性能设置 → 虚拟内存 → C: 关小、D: 自定义 16384–32768 → 重启，额度升 ~50G；③闲置 ZCode 会话窗口关掉几个。
- **真实环境回归（经 -Xmx1200m，run.ps1 全新链路）**：默认路径重跑 failures=0、EXPECTED TOTAL=26420、ROUNDTRIP ASSERT PASS、PNG/PDF 出图；demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F、销售明细_api.png=A8EF39AB648D5F00DDAE0481D0313110 逐字节复原。
- **README #28–#35 乱码段修复（本日，commit 5073c15）**：中文被批量置换 U+FFFD 且入库前既有，四通道反演不可逆（probes/_readme_moji_probe1–5 定性）；按幸存 ASCII 锚点逐字保真 + 工件交叉校验（make_verify.js 源码、logs/verify_table.txt 普查实测 selfOK=153/renderOK=221/renderMismatch=19/readFail=21/total=261、部署实名、frdemo dump 列名）存证重描，失考段显式标注；字节级拼接写回（前段 13933B=DC27BF37…、后段 21120B=8E0B8BFB… 改写前后一致），破损原件备份 logs/README.md.fix_backup_20261103。基线口径提示已入段落尾注：#28–#35 所记 101700BB/E2391200 为 2026-10-26 当期基线，现行见 AGENTS.md。


#48 外部审计修复批（2026-11-04，用户拍板 A+B 一批全修、URL 口径=仅相对路径）：
- **静态审查五连指控全属实并修复**（来源=第三方源码审计，行号级核实）。
- **P1 validate 两段式重构（lib/ir.js）**：结构层（容器/必填/类型——缺容器短路返回，validator 永不再被无效 IR 自炸，审计 P1-2）+ 语义层（跨对象引用完整性，审计 P1-3）：block/chart `dataset ∈ IR.datasets`；chart category/value/values/scatter x/y 列成员校验（kind=sql 数据集列运行期可变→自动豁免）；cells item 对象形态数据集真绑定名=`it.ds.ds||b.dataset`（字符串形态属历史遗留语义，object 层零回归、ir 层不断言）；param `filters.parameter ∈ widgets[].name`、`f.column ∈ 任意内嵌数据集列`。
- **detail.link 校验不可达修复（审计 P1-1，最重档）**：原校验困在 chart 分支 `if (b.type !== 'chart') return` 之后的 `detail` 分支——永不可达；现独立成段，drill/subtotal 真实 link 规格过新校验零误报。
- **make_api：IR 校验失败即停（审计 P1-4）**：打印全部 IR ISSUE 后 **EXIT 9**，不再调用 Obj.build 半成品。退出码序：2 SPEC 缺失 / 4 testConnection / 5 rowControl / 8 提交额度预检 / **9 IR VALIDATE FAILED**。
- **multi-sheet 口径**：IR 形态允许多 sheets、backend 单 sheet（object.js v3.2 预留 throw 受实查证）——validate 即报 `multi-sheet unsupported`；能力注记 **multi-sheet: unsupported（backend 预留）**。
- **安全三端口（批 B）**：① nav JavaScriptImpl 拼接链与 iframe 嵌页目标**仅相对路径**——ir.js isRelUrl 验形态 + object.js checkRelUrl 强制（scheme:// 全拒、反斜杠/引号/分号/反引号/换行拒；cells linkTo.web/web 走原生 WebHyperlink.setURL 非 JS 拼接，无此端口）② toolbar `b.className` 逃生口**移除**——只认 TOOLBAR_BUTTONS 白名单键（ir 层 TOOLBAR_KEYS 同步同报）③ `floats.imageFile` 路径**钳制在 FR_AGENT_HOME**（checkLocalPath：禁 .. 穿越与外部绝对路径）。现网 49 spec 的 className/imageFile 使用 = 0，收紧零漂移。
- **ABR-1 收尾**：make_api `localCpt = 'D:/fineagent/demo_api.cpt'` 硬编码 → `Paths.root` 拼接（本机默认值不变=零漂移）；lib/browser.js 垫片 Nashorn 分支走 FR_AGENT_HOME、Node 分支修正 `../features/data_browser/`（原路径必 404；管线 49 spec 走 Paths.feature，垫片仅服务旧第三方 load）。
- **回归**：负测试（logs/_bad_ir_test.js）7 项诊断全命中 + `IR VALIDATE FAILED: refusing to build`；正回归 7 连（默认+db_laser_subtotal+db_laser_drill+br_laser_aaa+rebuild_first+test_cellattrs+test_v41）全 failures=0；默认铁证 demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F、销售明细_api.png=A8EF39AB648D5F00DDAE0481D0313110 逐字节复原；R1–R6 全绿。
- 校准事故（诚实留痕）：首版 cells item 数据集断言按字符串形臆造 → br/subtotal 6 项 `[object Object]` 误报（exit 9 按设计落地=拦截生效）；读 object.js 568–581 + putDSCell 定位真实绑定语义后校准修正，再全绿。教训升格：**ir 层新增断言前必须先读 object 层字段的真实消费语义**，不许凭审查文字臆写。


#49 迭代 1「可靠性修复」落地批（2026-11-04，用户认可六段计划后开工；范围严格限定迭代 1，不加架构/不引框架/不推倒重来）：
- **先核对再动手（AGENTS §0 拒绝凭记忆）**：git log 顶 a43fc7e（=#48）已闭环迭代 1 大半（validate 两段式、detail.link 可达、dataset/列/参数引用完整性、multi-sheet 即报、IR FAIL 即停 EXIT 9、安全三端口、localCpt 单点）。逐读 main 源码圈定**真实欠账**四项：条件属性严格化 / 失败门禁到退出码 / 参数默认值映射 / validator 自身两处残余自炸。不重复劳动。
- **lib/ir.js 条件属性严格化（问题 3 全量）**：新增 `checkWhen/checkThen/eachWhenColumn`。when 恰三选一（conditionOf 按 formula→column→list 静默优先取一，混写=用户意图被后端悄悄丢，现拒）；column 条件必须给 value 或 formulaValue（两者全缺=后端 `Double.valueOf(null)` 当场炸，提前拦）；`when.list` 子条件同形态递归（conditionOf 对坏子条件返回 null 会静默混进 ListCondition）；then 键白名单 bg|color|bold|sizePt|font|rowHeight|colWidth|page + 逐键类型校验（actionsOf 对白名单外键静默忽略）；scope/valueType/value/op 形态收紧。highlight（v3.2 旧形态，object.js 包成单条 condition）同批补坏 op/缺 value/缺 bg 自检。
- **lib/ir.js 语义层列成员 + validator 抗炸**：detail 块 conditions/列级 conditions/highlight 的 column 引用做「∈ 数据集列」校验（Agent 写错列名高发点；kind=sql 列运行期可变→豁免）。负测试第一层揪出两处 #48 漏网自炸残口并补防护——`s.floats` 循环对 null sheet 未防、`c.conditions` 对 null 列元素未防。
- **make_api.js 失败门禁到退出码（问题：部署失败 catch 不计数可致 EXIT 0）**：新增 `gateAt(where)`——cpt 导出/校验后、执行后、部署前三处设闸，上游任何 FAILS 即 `GATE CLOSED` 拒后续（不执行/不部署/不往部署目录写诊断件）并 exit 1。`CPT DEPLOY FAIL` 与 `PDF FAIL` 的 catch 补 `FAILS++`（与 PNG 对齐，此前漏计）。
- **make_api.js 参数默认值全控件映射（问题 2-P1）**：旧 execute 只送 `editor` 默认值，date/combo/number/多选等控件默认值不进执行参数=执行验证的报表≠面板实际提交的报表。新增 `paramDefaults`：镜像 object.js `buildParamAttr` 的 widgetValue 口径——number 走数值（整数优先 Integer 防 SQL `${}` 文本替换位出 "20.0" 打进 TOP/LIMIT），editor/date/combo/textarea/radio/checkbox/combocheck/treecombo 走串形态，`=…` 公式默认值执行期不可求值→显式跳过并留 `PARAM DEFAULT SKIP` 诊断（不伪造值）。br_laser_aaa 两条 date 公式默认值命中此路径（旧代码 date 本就未送→执行参数净变化=0，无回归，现额外给可见诊断）。
- **test_widgets iframe 绝对 URL→相对**：#48「iframe 仅相对路径」安全批口径下 `https://example.com/help` 属应拒对象；test_widgets 系 #48 之后补的能力自检 spec、绝对 URL 一直没进正回归，本轮按相对 `help.html` 修正（不回退安全收紧）。
- **负测试两层**：① 无引擎快速层 `logs/_ir_neg_selftest.js`（new Function parse 门 + 20 组残缺/恶意 IR 抗炸门 + 新断言逐项命中 + 合法 IR 零误报，共 41 项 failures=0；只需 nashorn.jar，不碰 FineDB——对应用户「分层验证：不依赖引擎的快速测试」方向）；② 全链层 `logs/_bad_ir_test.js` 扩充条件属性族用例，make_api 实跑 **20 项 IR ISSUE 全命中 + EXIT 9 refusing to build、零产物零部署**。
- **正回归 10 连全绿 failures=0**：test_cellattrs/test_v41/sales_demo_hl/test_widgets/db_laser_subtotal/db_laser_drill/br_laser_aaa/rebuild_first/sales_demo 等；默认收尾铁证 demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F、销售明细_api.png=A8EF39AB648D5F00DDAE0481D0313110 逐字节复原（PNG 与已验收基线逐字节同=像素门按构造满足）；R1–R6 边界全绿 exit 0；部署 cpt 凭据 grep 0 命中。
- **内存处置留痕**：run.ps1 提交额度预检（#47）本轮真实拦下 3 次 `COMMIT_LIMIT_LOW`，vmmemWSL 二次回升（有子系统重启 WSL），经用户授权 `wsl --shutdown` 后额度回到可跑位——预检机制按设计生效、非管线故障。
- **迭代 1 验收线达成**：非法 IR 返回可读诊断、不构建、不部署、错误不产假绿退出码。后续迭代 2–4（IR 版本化+能力清单、真实业务报表闭环、现成 Agent 接入）按计划推进，ANTLR/通用 CPT→IR/MCP/多 Sheet 后端/自研 Agent 明确暂缓。


#50 迭代 2「IR 稳定化」契约批（2026-11-04，用户"继续"授权；严守零字节风险+高契约价值，不加框架/不推倒；类型白名单与 object.js decimal/long 映射按用户"不一上来全实现"推迟到迭代 3）：
- **动手前读消费面（AGENTS §5/#48 教训）**：核实 `object.js build()` 只按具名键消费 IR（palette/datasets/sheets/param/watermark/toolbar/webPage），**从不 `Object.keys(IR)` 遍历顶层**；`Ir.compile` 全项目仅 `make_api.js:95` 一个调用方且用返回值非输入同一性（data_browser 只产 spec 走同一入口）→ 结论：新增顶层 `irVersion` 键不被读、不进 `wb.export` 序列化、不碰字节基线（后由 demo_api.cpt CBEB42E3 / PNG A8EF39AB 逐字节 True 证实）。
- **① irVersion 版本契约（lib/ir.js）**：`IR_VERSION='1'`；`compile()` 两条路径产物均带版本（rawIR 缺省补 '1'）；`validate()` 认当前版本、**拒未知版本**（`UNSUPPORTED_IR_VERSION: <v>` 短路返回、不猜语义）；缺省（老 spec/rawIR 未标）视为当前版=49 spec 零迁移零漂移。
- **② compile() 输入不可变+幂等（修 #48 前既有 purity 隐患）**：旧 rawIR 直通 `extrasOut(spec.IR, spec); return spec.IR` 直接向调用方对象挂 watermark/floats/toolbar=污染输入 + 依赖前次残留（违 Agent 反复试改场景）；现 `deepClone(spec.IR)` 后再注入、返回克隆。默认 compile 路径本就不改 spec，仅补 `irVersion`。自检实证：`spec.IR.watermark==null`（输入未被改）、两次 `compile` 产物 `JSON.stringify` 全等（幂等）。
- **③ 能力清单 CAPABILITIES（机器+人双读，非重型 Registry）**：`Ir.capabilities()` 导出，含 single/multiSheet、embedded/sql 数据集、block 家族、chart legacy+VanChart 族、param 控件族（iframe 标 partial 仅相对 URL）、condition thenActions 白名单、extras（floats/watermark/toolbar/hyperlinks 标 partial 边界）；`reverseFromCpt:'unsupported'` 白纸黑字。**multi-sheet 拒绝升为机器可键控 token**：文案 `multi-sheet unsupported` → `UNSUPPORTED_CAPABILITY:multi_sheet`（object.js v3.2 预留 throw 不变）。
- **列类型词汇校准（记事实，不做硬白名单）**：普查 reports/ 发现两套正交列 `type`——内嵌数据集 `text/number/float`（object.js 映射 Integer/Double/String）与 data-browser 列画像 `num/cent/space/code/string`（走 kind:sql，Java 类型不消费）。若在 validate 强设单一白名单会砸这两套合法词汇踩 49 spec 回归。故迭代 2 仅在能力清单 `columnType.note` 标注统一类型白名单 + decimal/long 后端映射**延至迭代 3**（需真实业务数据 + 对象构建测试同批落，守"每增能力必配 IR 校验+构建测试+真实验证"）。
- **负测试两层重跑**：无引擎快速层 `logs/_ir_neg_selftest.js` 扩至 **57 项 failures=0**（新增版本识别/未知拒+短路/compile 不改输入/幂等/能力清单边界；multi-sheet 断言改判 token）；全链 `logs/_bad_ir_test.js` 经克隆直通仍 **EXIT 9、20 ISSUE 全命中、version 误报=0**（无 irVersion→视为当前版，直通语义不变）。
- **正回归 6 连 failures=0**：重点带 rawIR 克隆直通族 rebuild_first + test_v41（端到端证深拷贝不改产物），test_widgets/db_laser_subtotal/br_laser_aaa/sales_demo；默认收尾铁证 demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F、销售明细_api.png=A8EF39AB648D5F00DDAE0481D0313110 逐字节 True；R1–R6 exit 0。
- **迭代 2 验收线达成**：固定样本 IR 校验稳定、已有产物逐字节不变、IR 具备版本/纯度/能力边界三项正式接口，为迭代 4「现成 Agent 接入」铺好可依赖的 ReportIR 契约。迭代 3（真实业务报表 + 类型后端映射 + decimal/long）、迭代 4（Agent Instructions + 稳定机器入口 + Codex/Claude 之一接入）待续。


#51 迭代 4 地基·稳定机器调用入口（2026-11-04，用户"调用 ub-mode 技能，并且继续迭代"；ub-mode 纪律：Attack the Premise 跳过需数据源决策的迭代 3，先做决策无关的 Agent 接口杠杆；TDD 红→绿；Sequence into verifiable units 拆 A/B 两 commit）：
- **Attack the Premise（为何不是迭代 3 先行）**：迭代 3「真实业务报表」的真前提是"必须有确定数据源 + 凭据"（AGENTS §4 凭据只在本机 spec），我拿不到 → "先把数据形状搞对"不许猜 → 该决策属用户。而**核心资产 #4「Agent Interface」是决策无关、零字节风险、帮每一后续阶段**的杠杆，故先做。原计划"迭代 3→4"的次序前提被否掉，不是推倒架构。
- **① lib/runresult.js 纯契约模块（unit A，独立可测）**：一次管线 = 固定 stage 全序 `input_load→ir_validate→object_build→cpt_export→cpt_validate→execute→render→deploy` × 状态域 `{pending|running|passed|failed|skipped}` + 有序 diagnostics。**Model the Domain/Type System Discipline**：非法 stage/状态在 `set` 边界一次拒（写不出来），非跑一半炸；`success` 由 stage 一处推导（任一 failed→false；skipped 不算失败；全 settled→true；有 pending→null）；`fail` 自动把下游 pending 短路为 skipped（因果显式）；`toJson` 键序=STAGES 全序 → 逐字确定、幂等、可 diff。**零运行时依赖**（不 import/不引引擎类），离线单测 `logs/_runresult_selftest.js`：TDD 先红（`FileNotFoundException: lib/runresult.js`=预期失败因），实现后 3 项红（根因=`get` 误用 `stageIdx` 返回的**索引**而非名取值 → `st[0]=undefined`；success/snapshot 走 `st[s]` 故只对 get 依赖断言暴红——一处根因三症状），改 `stageIdx(s); return st[s]` 单行 → 16 项全绿。R1–R6 绿（纯模块不触 features；注释去掉 `Java.type/com.fr.` 字面以免误扫）。
- **② make_api.js 接线（unit B，RR 纯观察者）**：`RR=RunResult.begin()` 于 spec 装载后就位；8 stage 在既有检查点各一行转态（`writeRunResult(code)` 把 `snap.exit=code; snap.success=(code===0)` **以退出码为权威**、stage 定位、诊断入列，写 `FR_AGENT_RESULT`（默认 `logs/last_run.json`）+ 打 `RESULT_JSON {...}` 单行）；`gateAt`/EXIT 2/3/9/收尾 `exit(...)` 全 funnel 经 `finishRun`（**DRY**：消了散落的 `System.exit`）。**字节隔离**：RR 从不进对象图/wb.export/Cpt（只旁记），`demo_api.cpt=CBEB42E3` + `销售明细_api.png=A8EF39AB` 逐字节 True 实证零漂移。
- **③ 验证等级入契约（BR_SKIP_EXEC 通道不破）**：生产构建 `BR_SKIP_EXEC=1` → RESULT `execute:"skipped", render:"skipped", deploy:"passed", success:true`；负测 `_bad_ir_test` → `ir_validate:"failed"` + 下游全 `skipped` + 20 条 IR ISSUE 作结构化 diagnostics + `success:false` exit 9；默认全链 → 8 stage `passed` exit 0。三态实测 JSON 逐条对齐（用户原计划 §二 "响应格式示意" 落地为可跑实物）。
- **回归**：PARSE-only 编译门过；默认收尾 `failures=0`、双铁证 True、`last_run.json` 落盘正确、R1–R6 exit 0。ub-mode 质量门（crapper/dryer/mutator 二进制本机未装，按其精神手审）：函数低 CRAP、exit funnel 去重、自检+三实路径杀变异。
- **迭代 4 续**：下一步 Agent Instructions 文档（基于此稳定 `RESULT_JSON`+`Ir.capabilities()` 契约写"探索→产 IR→校验→跑→读 RESULT→修"闭环）；是否引 Codex/Claude 之一实跑、要不要 MCP，待接口被真 Agent 用过再定。


#52 迭代 3 真实报表 + 迭代 4 现成 Agent（=ZCode）实跑闭环（2026-11-04，用户"调用 ub-mode，都做，智能体使用 zcode"；ub-mode 纪律贯穿：Build the Lever 先手工一份→交工具对等复刻；Test Behavior 用真 DB + RESULT_DUMP 对真值；Keep a Log）：
- **push**：前 4 commit（迭代 1/2/契约两批）已推 origin/main（`a43fc7e..c67b23e`）。
- **迭代 3（ZCode 手工首份真实报表）`reports/agent_daily_report.js`**：laser_aaa 逐日"计划/完成/完成率"生产日报（cells+SQL+公式，连接 ATOM_LIVE，凭据仅 spec→`lib/dbpass.js`）。**根因坑（诚实留痕）**：初版 SQL 用 `BETWEEN '${d1}' AND '${d2}'`——AGENTS §3 明令 `${}` 是文本替换非绑定变量，经 `wb.execute` API 路径不被替换，`${d1}` 原样进 SQL→`TRY_CAST('${d1}' AS date)`=NULL→0 行、总计 0；改字面日期范围修复（运行期交互筛选是 br 族专职，独立报表不重造轮子）。RESULT_DUMP 逐格对真值：计划 `4238..2158`=`db_laser_aaa_truth` col2、完成 `2854..`=`db_laser_sub_truth` 明细、总计 `33531/26531`=grand_total、完成率 `79.12`=26531×100/33531 逐字命中；RESULT 8 stage 全 passed、执行+渲染+部署、failures=0。
- **迭代 4（现成 Agent=ZCode 子代理独立完成）`reports/agent_stage_report.js`**：新派 ZCode 通用子代理，**只给** `docs/agent-report-authoring.md` + `laser_aaa_profile.txt` + 真值文件 + `db_laser_subtotal.js` 形态参考 + 任务（按工序 stage 汇总，硬指标 总计=33531/26531），**不替它写**。子代理自主走闭环并真实踩坑自修：赌 `=SUMPRODUCT(...)` 求总计加权平均→execute 段 `InterpreterError: no function found: SUMPRODUCT`（RESULT execute=failed）→读诊断→改官方"独立聚合格"形态（`ds:{ds:'ds2',summary:'SUM',noExpand}` 绑 ds2 单行全加权）→RESULT `success:true` 8 stage passed。**主控独立复核（不采信子代理自述）**：`git status` 仅新增该 spec（未碰 lib/make_api/既有 spec）、凭据 grep 0 命中、RESULT_JSON 8 passed、RESULT_DUMP 明细 `L 16761/12611、R 16770/13920` 相加=计划33531/完成26531、总计平均分 `0.948809`=`db_laser_sub_truth` grand_total 逐字一致。**验收线达成：现成 Agent 凭 playbook 可独立完成一次真实报表创作（探索→产 IR→校验→跑→读 RESULT→修→交付）。**
- **实跑反哺接口（Agent 交学费→产品补，A/B/C）**：
  - **A（诊断闭环补全 `make_api.js`）**：子代理反馈"execute 根因只在 run.out、不在 RESULT.diagnostics，逼翻全量日志"。修：execute/deploy/PNG/PDF/roundtrip/cpt-validate 各 catch 现 `RR.diag(...)` 收根因。回归实证 `logs/_exec_fail_probe.js`（无 DB，`=SUMPRODUCT(A3,A3)`）→ RESULT `diagnostics:["EXECUTE FAIL: com.fr.stable.InterpreterError: no function found: SUMPRODUCT","GATE CLOSED at execute"]`、stages `execute:failed / render,deploy:skipped / success:false / exit:1`——Agent 不再翻 run.out。（`ir_validate` 仍 passed 是对的：FR 函数集非 IR 层可知，预防归 B/C。）
  - **B（能力边界 `lib/ir.js`）**：`CAPABILITIES.formula` 加实测词汇（supported `SUM/AVERAGE/MAX/MIN/COUNT/round()/row()/col()/=$$$`；unsupported `SUMPRODUCT/VLOOKUP/IFERROR/多数 Excel 专有函数`）——把子代理最大学费固化成机器读清单。
  - **C（playbook `docs/agent-report-authoring.md`）**：§5 加 SQL `${}` 陷阱 + 公式函数词汇条；新增 §5.5 已知坑（列宽经验值随当前渲染标尺 0.667px/pt 重标、diagnostics 现含运行期根因）。
- **R2 边界事件（诚实留痕）**：B 的 ir.js 注释写了 `com.fr.stable.InterpreterError` 字面量→触发 `check-boundaries` R2（ir.js 禁 `Java.type`/`com.fr.` 是**文本级**红线）exit 1。去 `com.fr.` 前缀（改 "InterpreterError"）恢复绿。教训入记忆：**ir.js 连注释都别写 banned token**（沿用 runresult 注释去字面同一纪律）。
- **回归**：默认 `run.ps1 make_api.js` failures=0、`demo_api.cpt CBEB42E3` + `销售明细_api.png A8EF39AB` 逐字节 True（A/B/C 零字节风险实证）；R1–R6 绿；离线快速层 `logs/_ir_neg_selftest.js` 57 + `logs/_runresult_selftest.js` 16 全 failures=0；部署 cpt 凭据 0 命中。
- **暂缓守约**：仍未做 MCP/Codex/Claude（按 §九"待接口被真 Agent 用过再定"——现已用过一次，结论是接口够用、先扩能力与真样本，MCP 不急）；ANTLR/通用 CPT→IR/多 Sheet 后端/自研 Agent 继续暂缓。迭代 3 已交一张真实报表（日报）+ 迭代 4 已证 Agent 独立创作（工序汇总），下一步可扩：类型后端 decimal/long 统一（迭代 3 尾）、更多真样本覆盖能力矩阵、以及把两报做成可复用 spec 模板。


#53 总计划 r1.md 对照主分 + 分层验证体系落地为持久资产（2026-11-04，用户重贴 master plan `docs/gpt/r1.md` 并要求 ub-mode；本单元零 lib/基线改动，纯 Subtract/加杠杆，不引新架构）：
- **Attack the Premise — 先对齐"计划 vs 现状"（证据制，不凭记忆）**：r1.md 的 §九 迭代 1–4 与 §十一 四资产，经 #48–#52 已落。逐节核对：
  - §二 迭代 1 可靠性修复：validate 两段式/缺容器短路(#48)、detail.link 可达(#48)、条件属性严格化+列成员(#49)、Runner IR FAIL 即停 EXIT9(#48)、部署/PDF 计入退出码+gateAt 三闸(#49)、参数默认值全控件 paramDefaults(#49)、localCpt 单点(#48)——**全 DONE**。
  - §三 IR 稳定化：irVersion 认版/拒版(#50)、compile 输入不可变+幂等(#50)、CAPABILITIES 能力清单(#50/#52 扩 formula)、multi-sheet `UNSUPPORTED_CAPABILITY:multi_sheet`(#50)——**DONE**；仅"统一数据类型定义"随类型后端缓到 §五.1。
  - §五 后端可靠性：安全三端口(nav/iframe 相对、toolbar 去 className、imageFile 钳制)(#48) **DONE**；**仍开放**=类型映射 decimal/long/boolean/date（object.js，需真实内嵌用例+逐函数探针，别一上来全实现）、消除 `try{dsc.setColumn}catch{}` 静默失败（object.js，字节风险，须配回归）、样式缓存跨格污染回归用例、字体单位 v2×21/v3×8 显式函数+9/10.5/12/14/18/24 标尺（§三.3，知识资产化，AGENTS §2/§3 现两条 attr 口径须以标尺实证厘清）。
  - §四 object/cpt 职责三分（v2 Builder / Legacy Validator / 通用 Artifact Validator）：**认知已明**（cpt.js 兼旧产物校验+回环），未拆文件（遵"不轻易动验证过的代码"）。
  - §八 CPT→IR / Template Patch、§六 240 模板能力覆盖矩阵（从"发现特性"转"证明已支持特性可稳定组合"）、SQL 只读源/凭据引用化（Agent 只选连接名）——**按计划开放/暂缓**。
- **本单元落地 §六"分层验证体系"为持久产品资产（此前 fast 测试散在 gitignore 的 logs/，克隆即失）**：`verify/` 纳入并 track 三层——**快速层(无引擎)** `verify/fast_parse.js`(9 文件 parse 门)+`verify/fast_ir_contract.js`(57 契约)+`verify/fast_runresult.js`(16 契约)，聚合门 `scripts/run-fast-tests.ps1`（只 nashorn.jar，不启动 FR/不碰 FineDB/不产字节，任一 rc≠0 整体 exit 1）；**引擎负测层** `verify/neg_ir_full.js`(#48/#52 _bad_ir_test 持久化)+`verify/neg_exec_formula.js`(#52 execute-fail 探针持久化)。
- **Test Behavior + TDD 自检**：快速门跑绿（57+16+9 parse，failures=0，gate exit 0）；**红证**=独立失败套件 rc=1（证明聚合真能判失败，非假绿）；重定位的引擎负测 `verify/neg_ir_full.js` 实跑 EXIT 9、`ir_validate:failed`+下游 skipped、20 IR ISSUE 命中（证明 track 后的持久资产可跑）。`check-boundaries` R1–R6 绿（verify/scripts 不在受限扫描集）。
- **PS 编码教训（AGENTS §5 同源，留痕）**：`run-fast-tests.ps1` 首版经 `cat<<EOF` 写成 UTF-8 **无 BOM**，Windows PowerShell 5.1 按系统 ANSI(GBK) 读 `.ps1`，中文/em-dash/引号注释使解析器错位吞掉 `$FR=` 赋值 → java 路径变 `\jre\bin\java.exe`（"命令未找到"）。修=**该 .ps1 全 ASCII 注释**（脚本内注释加 NOTE 警示）。纪律：**新 .ps1 要么纯 ASCII 要么带 BOM**，别指望 5.1 认无 BOM UTF-8。
- **诚实边界**：本单元未跑 FR 引擎整链字节回归——因为**没改任何影响产物的 lib/spec/runner 代码**（只新增 verify/ 测试与 scripts/ 门），`demo_api.cpt`/PNG 基线逻辑上不可能变；A/B/C 那批（改 lib/ir.js + make_api.js）的基线回归已在 f57b8df 复验 CBEB42E3/A8EF39AB True。快速门每次可跑（秒级、不占引擎）。

#54 r2.md I0「可靠性收尾」全量落地批（2026-11-04，用户贴阶段规范 `docs/gpt/r2.md` 令走 ub-mode；先对账纠正 r2「I0·0/6 已完成」前提——#48–#53 已实际吃掉约一半，真缺口 11 条逐条文件:行号+jjs 实测证据，经批准按 U1–U6 六单元推进；全程字节基线零漂移）：
- **U1 I0-01 校验完整化+错误结构化**：`validate()` 输出改 `{code,path(JSON 路径),message}`（r2 期望格式；make_api 序列化为 `IR ISSUE: <CODE> @ <path>: <message>`）；jjs 实测坐实的「真值非数组」自炸路全堵（columns/items/sumCols/floats/param.filters/toolbar.buttons/chart.values/rows/when.list 九条）；数值一律 `isFinite` 闸（NaN/Infinity 拒）；枚举白名单按后端实消费面定——`block.type`=object.js case 集（含 `space`；先读源码防误伤）、`aggregate.fn` 只 `sum`（object.js:555-560 硬编码 =SUM，其余聚合必须走 sumCols.formula）、`dataset.kind`/`imageFormat`/`targetFrame` 白名单；对象字段一律拒数组；必填洞补齐（title.text+span、detail.dataset+columns、total aggregate|sumCols 二选一、ds.name 必填+唯一、rows 宽度=columns 数、link.params/ds.params 项形态）；`link.reportlet` 走 isRelReportlet（isRelUrl 同规+禁 `..` 穿越）。零误伤铁律=新杠杆 `probes/scan_all_specs.js`（纯 nashorn 全量扫 reports/ 43 张 compile+validate）：首扫即抓两类校准情报——rebuild_first 表头 label-only 为官方重建实形（name 闸收窄至 detail）、rebuild_basicA 的 `sproduct_dump.txt` 为既有环境耦合（skip 留痕非回归）。快速层 105 项断言（57→105，先红后绿）。
- **U2 I0-02 Runner 兜底统一**：STAGES 8→11（`input_load→runtime_initialize→datasource_connect→…→render→deploy→roundtrip`；deploy 挪 render 之后=渲染失败不部署；无 connections 显式 skipped）；三条裸退逃逸路全堵（initialize 裸炸、datasource 裸 exit(4)、row-control 裸 exit(5)→全部段裁决+经 finishRun 落 JSON）；**RR 就位即写初始快照 `success:null`**——实测消灭「崩了不写 JSON、last_run.json 残留上轮 success:true」的陈旧假绿；`run.ps1` 两分支 `exit $LASTEXITCODE` 透传（原 `-Out` 吞码，调用方拿不到真裁决）。
- **U3 I0-03 object 层纵深**：`checkRelReportlet`（ReportletHyperlink 两构造点）、`WebHyperlink.setURL`、`targetFrame`、`imageFormat` 四闸；新反证探针 `probes/probe_objlinkgate.js`（绕过 IR 层直喂 Obj.build）5 拒 2 放行全中；顺带堵 `applyLink` 静默丢弃 targetFrame/params/byPost（对齐 cellLink 消费面；既有语料不设这些字段=字节零影响，AGENTS §3「消除后端静默失败」同类残余）。
- **U4 I0-04 SQL 边界（用户拍板最小加固口径；`?` 值绑定接线=会改浏览器族 24 张 SQL 文本+重录基线，列 I1 前独立工单，README 此条即留痕）**：browser.js 入口标识符白名单（表/列/dateCol/timeCol/filterCol/sortKeys/BR_TPFX，`]` 闭合逃逸当场拒）+ page/size 数值闸（原 `Math.max(1,+env)` 遇坏值漂 NaN 进 SQL 文本）；ir.js `SQL_READONLY` 闸（单语句 SELECT/WITH 起头+禁内嵌 `;`，既有 6 sql spec+浏览器族 pagedSql 形态全量核过零误伤）；make_api §5.9 **凭据自动门**（AGENTS §4 人工 grep 纪律→管线硬门：扫本轮部署件，命中即撤回+deploy failed+非零退出，实测命中样例 neg_secret_leak 全链路成立；token<4 字符跳过防 `sa` 类误伤，日志只报序号不落密钥）。数据级铁证=br_laser_aaa 定日期（2026-09-13）栅格与 `logs/abr1_baseline/_br_aaa_d13_grid.txt` 逐字节 **IDENTICAL**；新离线套件 `verify/fast_browser_sql.js` 13 项（正控 browserSpec→compile→validate 全链绿+9 反控）。
- **U5 I0-05 数据类型映射**：实机探针 `probes/probe_typemap.js` 一手证 9 型 `addColumn→export→readTemplateWorkBook` 读回 columnClass 逐一保真 + PNG 出图地板（r2 铁律：FineReport 日期对象映射禁凭类名猜）→ object.js `DS_JTYPE` 全型表（integer/long/decimal/boolean/date/datetime/string+legacy number/float/text 三分支逐字不动），ir.js `EDS_TYPES` 白名单 + `checkRowValue` 行值形态闸（date 补零字面、datetime 全字面、integer/long 整值（long 收数字串保精度）、decimal 数字串、boolean 字面量、null 可空不折 `'null'` 串）；端到端 `reports/test_types.js`（rawIR）栅格逐格核：`9000000001/-2147483649` 越 int 域保真、true/false、日期字面、null 行 8 格全空、SUM 合计 37。首跑另暴露两事：compile 路径 `lastNumberIdx` 对新型列出 totalCol=-1（rawIR 为多型自检正确形态）；**make_api.js:242 `java.lang.StringWriter` 潜伏类名错**（正确 `java.io.StringWriter`）——失败 catch 自身抛 ClassNotFoundException 致 JVM 挂死，恰是 I0「失败处理器反崩」反模式实证，root-cause 修。
- **U6 I0-06 自动化负门**：`scripts/run-engine-negative-tests.ps1`（引擎级四路坏输入：ir-bad→9、db-conn→4、secret-leak→1、exec-formula→1；逐路断言 进程码↔JSON stage↔`success⟺exit==0` 不变量；末步默认 spec 回补护铁证）——「失败但退出码 0」从 U2 手工实证升级为可重复门，本轮跑出 **GREEN**；门自身也踩过坑并留痕：PS 5.1 默认 ANSI 读 Java 写的 UTF-8 结果文件→中文诊断碎码→`ConvertFrom-Json` 炸（runner 无辜），修 `[IO.File]::ReadAllText(...,UTF8)`，印证 #53 编码纪律应扩展到**读**面。playbook `docs/agent-report-authoring.md` 同步 11 段契约/结构化诊断/新闸面/型别词表。
- **r2 I0 验收对照**：① 基线报表全过（默认/br d13/test_types failures=0）② MD5 铁证无非预期变化（CBEB42E3+A8EF39AB 每单元复验；PDF 内嵌 `CreationDate` 本质非确定，**非**铁证项——ABR-1 清单里的 PDF hash 不可跨日复现，此认知入档）③ 异常输入测试 57→105+20+13 ④ 安全边界（超链/枚举/SQL/凭据四域离线+引擎双证）⑤ 无假绿（负门 GREEN）⑥ Nashorn 实机全链绿。R1–R6 边界每单元复跑绿。
- **仍开放（不装完成）**：`?` 值绑定接线（I1 前工单，口径=浏览器族 SQL 全参数化+基线重录+24 张复跑）；`RelaxationRestrictionConfig` 阈值照 AGENTS §3 未碰；PNG 人工目检验收待用户亲眼看（销售明细默认 + 类型映射自检两张）；`docs/gpt/` 自本批起随仓库 track。

#55 r2.md I1「ReportSpec 结构化输入接口」落地批（2026-11-04，I0 验收后按"前一迭代验收过再开下一迭代"推进 I1；用户对 r2 §1.3/§一 拍板两口径：**v1 sum-only 最小闭环**（filters/ratio/semantic 拒而不建，禁提前抽象）+ **Runner 加 JSON 模式**（不建 make_spec.js 第二 runner，防管线漂移）；三职责分离：report_spec=词汇、spec_validator=校验、spec_compiler=编译；全程 ir.js/object.js/cpt.js 零改动）：
- **三件套（全 ES5/IIFE，parse 门扩 12 文件全绿=无 let/=>/模板串混入）**：`lib/report_spec.js` 纯数据词汇+能力名册（SPEC_VERSION='1'、AGGREGATIONS{sum}、AGG_UNIMPLEMENTED{avg,count,ratio_of_sums…}、COLUMN_TYPES 复用 ir.js 列型不造第二套类型语言、REJECTED 逐项指向 I2-I5）；`lib/spec_validator.js` 完全沿用 I0-01 错误契约 `{code,path(JSON),message}`、抗炸（残缺/恶意输入只产诊断）、`outName` 路径安全闸（禁分隔符/`..`/盘符——"不允许 Agent 指定任意输出位置"落点，目录仍由 BR_DEPLOYDIR env 控）；`lib/spec_compiler.js` ReportSpec→ReportIR **逐字镜像 ir.js compile out 字面量**（键序/块序/shared columns 引用），输入不可变+幂等（#50 纪律）。
- **Runner 注入（make_api.js §0 后缀分支，旧 .js 路径一行不动）**：`.json` → readAllBytes+JSON.parse（**Nashorn `load()` 吃 .json 必当 JS 编译炸——实测坐实，绝不可用**）→ validate（拒=`SPEC ISSUE: CODE @ path` 逐条入诊断+input_load failed+exit 2）→ compile → 包 `SPEC={outName, IR}` 完全复用 rawIR 直通路（Ir.compile 深拷+补版本→validate→build→导出→执行→渲染→部署→门禁→roundtrip 零改动；JSON 结构无凭据位=天然满足 r2 §0.3）。
- **等价铁证（I1 验收硬条件"一个 JSON ReportSpec 能生成同等功能的报表"）**：离线=新杠杆套件 `verify/fast_report_spec.js` 44 项断言（先红：NoSuchFile 缺库→后绿）核心断言 `JSON.stringify(compile(sales_demo.json)) === JSON.stringify(Ir.compile(sales_demo.js SPEC))`（比 build() 具名键消费更严的全串等，过了字节必过）+ 编译产物过 Ir.validate 零误报 + 纯度/幂等 + 校验负项全集（版本拒/outName 穿越拒/结构闸/sum 放行 avg·ratio 拒/filters·chart·semantic 拒/行宽对齐/有限数/拒数组）；引擎=JSON 入口实跑 **demo_api.cpt=CBEB42E3、销售明细_api.png=A8EF39AB 逐字节相等、11 stage 全 passed、failures=0**；拒路径实测 `verify/neg_bad_spec.json`（越界 outName+avg+filters+chart 型）→exit2+input_load failed+四条结构化 SPEC ISSUE，并入 `scripts/run-engine-negative-tests.ps1` 第 5 路，全门 **GREEN** 且末步默认回补基线完好。
- **契约文档化**：`schemas/report-spec.schema.json`=声明式机器契约（draft-07 形态，x-* 标注拒项；**认知留痕：Nashorn 运行期无 JSON-Schema 校验库，权威执行者=spec_validator.js，schema 是它的可读镜像，二者须同步演进**——与 ir.js 手写校验同先例）；`examples/report-spec/sales_demo.json`=等价靶；playbook 新增 §3.5 JSON 入口+§2 三路径+尾注。
- **r2 I1 验收对照**：① sales_demo.js 照旧可用（路径未动+负门回补铁证）② JSON ReportSpec 生成同等报表（字节级相等）③ 无需 Nashorn 代码（纯 JSON）④ 无效 Spec 结构化错误（exit2+CODE@path）⑤ 同一 Spec 多次执行稳定（compile 纯函数+幂等断言+引擎 JSON 全等）。scan_all_specs 42/43 照旧、R1–R6 绿（新 lib 零运行时依赖方向合规）。
- **诚实边界/仍开放**：v1 词汇= sum-only，filters/chart/semantic query/非 sum 聚合为**设计留白**（结构化拒，非遗忘），I2 Schema Inspector + I3 Semantic Model 落地后逐项开闸；列宽反算（AGENTS §2）不在 I1 重建（widthPt 由 spec 透传，交付级排版仍走人工红线）；`?` 绑定工单不变。

#56 r2.md I2「Schema Inspector 数据库结构检查器」落地批（2026-11-04，I1 验收后按"前一迭代验收过再开下一迭代"推进；用户拍板两口径：**DatabaseMetaData 机制**（本仓零先例，JDBC 标准、引擎无关，贴合"换库可复用"初衷）+ **v1 纯结构不采样**（r2 §2.3 采样本就默认关，且现 db_laser_tables.json 把业务样本写进 JSON 恰是 §2.3 反例）；semantic/ 是 ABR-1 规则真空区，先登记再动码）：
- **W0 实机定性探针（先证据后设计，AGENTS §5）**：`probes/probe_metadate.js`（runraw 跑，classpath 含 mssql-jdbc，不杀 java/不启 FR/只读元数据）实测演示库(SQL Server 15.00/JDBC 9.4.1) DatabaseMetaData 能力面+关键未知数"库里有无 PK/FK"，落 `data/schema_probe_truth.txt`（sanitized 零凭据）。硬结论：**26 表、25 有 PK（50 列，典型 (file_key,row_number)）、FK=0 全库**（推摇"可能无 PK"猜测、证实"多半无 FK"）、`COLUMN_SIZE`=字符长(nvarchar 4000) vs `sys.max_length`=字节(8000)=归一取前者解旧画像字节-vs-字符陷阱、`getIndexInfo` 含 INDEX_NAME=null 统计伪行须滤、`getCatalog` 非 DatabaseMetaData 方法（护栏修）。此 truth 是 W1/W2 设计与 I3 语义层的一手底座。
- **W1 纯函数三件（零 java，离线可测）**：`semantic/schema/metadata.js`（列/键归一：IS_NULLABLE→bool、DATA_TYPE 有限整数、ordinal 升序、COLUMN_DEF null 不折串，沿用 I0-01 `{code,path,message}` 抗炸；**刻意不掺 num/cent 业务 kind**=派生语义归 I3）+ `relation.js`（r2 §2.2 三分桶硬隔离：structural=PK事实 / fk=getImportedKeys 两端列齐才入 / unconfirmedNaming=file_key→laser_files 命名推导候选 `requires_confirmation` 永不进事实·FK 桶）+ `serializer.js`（表名排序+确定序+relations 三键；toJson 前 assertClean 递归扫 key/value 命中 password/url/jdbc/:// 即抛拒落盘=I0-04 凭据纪律的 schema 面镜像；v1 无采样字段非法态不可表达）。`verify/fast_schema.js` 22 项对拍 W0 真实行形态全绿。
- **W2 inspector 薄壳+入口+实机产出对拍**：`inspector.js`（唯一触 `java.sql`，DatabaseMetaData typed getter 边界一次抽原生行→交零-java 核心；滤 W0 实测统计伪行）+ `inspect_main.js`（runraw 入口，env 覆盖默认演示库+dbpass 单源，UTF-8 落 `data/schema_<source>.json`，机器摘要 print 零凭据）。实跑=26表/25PK/0FK/27命名推导/0归一错（吻合 W0）。`verify/verify_schema_profile.js`（数据纪律 §4，纯 JDK 无引擎）schema↔`db_tables_profile.txt` **489 列逐列 dtype/nullable 零偏差**、FK=0、structural 非空、命名推导全 requires_confirmation、输出无 password——限 laser_ 表集（排 profile 内 zprobe 临时表）全绿。
- **W3 ABR-1 登记**：`runtime/paths.js` 加 `semantic()` 访问子（纯路径解析）；`scripts/check-boundaries.ps1` 新增 **R7**（R7a semantic 禁 com.fr./激活链/真 load 后端三件，**词表刻意不含裸 `Java.type`**——与 R2 不同是有意，防"统一词表"误杀 inspector 的 java.sql，注释写死理由；R7b core 三件禁 Java.type=零运行时依赖红线等同 R2）；`dependency-rules.md` 允许表+禁止表 R7a/R7b+事实契约 `SchemaInspector`/`Paths.semantic()`；`boundaries.md` 插语义层旁路带；AGENTS §4（画像权威源升级：`data/schema_*.json`=机器直查一级、txt=历史参照，verify 持续对拍）+§6；README 目录结构三新目录。踩坑留痕：R7a 首版把"注释里提到 lib/ir.js"和"load runtime/paths.js"误判反向依赖——收紧为「真 `load(` 后端三件」且 runtime 助手/dbpass 属允许面。
- **r2 I2 验收对照**：① 真实 SQL Server 源→完整准确结构描述（26 表全要素：类型/长度/可空/PK/索引，489 列对拍零偏差）② 三态严格区分（结构事实 PK / FK 推导=本库实测空 / 未确认业务关系=命名推导 27 条带 requires_confirmation，桶间硬隔离，置信度只排序不替代确认=r2 §3.3）③ 只读 SQL Server 优先、Adapter 面靠 DatabaseMetaData 天然方言无关但不建未验证驱动 ④ 采样=设计不做（§2.3 默认关）。终验：fast **7 套件** GREEN、**R1–R7** GREEN、scan_all_specs 42/43 照旧、schema↔profile 对拍 GREEN。
- **仍开放**：视图/索引已在结构事实面覆盖但演示库 0 视图；生产库画像（`SCHEMA_URL` 指生产+生产连接）留待有环境时一键复跑（机制已通，非缺码）；I3 Semantic Model 消费本 schema 建业务语义（把 unconfirmedNaming 逐条转确认关系）；gen_laser_specs 从私有画像迁到标准 schema = I5 创作闭环期。

#57 r2.md I3「轻量 Semantic Model」落地批（2026-11-04，I2 验收后按"前一迭代验收过再开下一迭代"推进；用户拍板两口径：**JSON 模型文件**（Nashorn 无 YAML 库，原生 parse 且能机器回溯；弃手写 YAML 子集解析器的新面）+ **真实激光检测评分领域**（非 production_* 合成玩具，指标口径锚定已真值校验的 agent_stage/daily_report）；r2 建议 8 文件 → 收敛 4 core + 1 数据，同 I2 collapse 先例）：
- **四 core（零 java、零 com.fr、零 IR 词汇，独立于 FineReport=换引擎可整体复用，r2 §3）**：`semantic/model/vocab.js`（概念词汇+能力名册：METRIC_KINDS 每 kind 必带字段、ratio 必分子分母=**显式聚合语义禁裸 formula** r2 §3.2、RELATION_SOURCES{fk,pk,naming-derived}）+ `registry.js`（by-name 索引+resolver 术语表：属性名/标签/列名/指标/维度多候选**不合并=暴露歧义**）+ `validator.js`（**双校验**：模型结构 + 回溯性——凡引用 DB 字段处必须在 I2 `schema.tables[]` 找到否则 UNKNOWN_REF，r2 §3"所有映射可追溯到数据库字段"机器化；沿用 I0-01 `{code,path,message}` 抗炸）+ `resolver.js`（业务术语→resolved/ambiguous/unknown，置信度**只降序排序绝不自动选**、多候选必 requiresConfirmation、未知空候选不臆造=r2 §3.3+§4"不许静默编造业务指标"）。
- **models/production/model.json（真实领域，满足 r2 §3 验收计数）**：5 实体（检测记录 laser_aaa/数据文件 laser_files/机台 source_id/工序 stage/评分 score）、15 属性映射、6 指标（计划=COUNT(*)、完成=countThreshold score>=0.9、完成率=ratio×100、平均分=weightedAvg 全加权禁均值之均值、评分合计 sum、文件数 count）、3 维度（日期/工序/机台，日期附 TRY_CAST 归一 Rule）、3 关系（recordToFile/fileToMachine/recordToStage，**DB FK=0 故全 source=naming-derived+requiresConfirmation**——三态区分从 I2 贯穿到 I3）；业务口径直接锚定 agent_stage_report 真值（计划/完成/完成率/平均分），映射零臆造。
- **S1 离线契约测** `verify/fast_semantic.js` 18 项：杀手验收=**真模型过真 I2 schema 回溯 0 错**（模型列名全命中真库结构）；负项（幽灵列 UNKNOWN_REF/ratio 缺分母 REQUIRED/裸 formula INVALID_TYPE/naming-derived 缺确认 REQUIRED/未知 kind INVALID_ENUM）+抗炸+确定序+输入不可变+resolver 三态（planned→resolved、机台→ambiguous+requiresConfirmation 不自动选、未知词→unknown 空候选）+验收计数达标。parse 门登记 4 model core、聚合门扩第 7 套件。
- **S2 ABR-1 登记**：R7b **泛化**为「`semantic/**` 除 inspector/inspect_main 薄壳外一律禁 `Java.type`」——一次覆盖 I2 schema core + I3 model core（零运行时依赖红线等同 R2）；`dependency-rules.md` 允许表加 `semantic/model→models/*.json+I2 schema`、事实契约加 `SemanticModel`；`boundaries.md` 语义层带补 model 子层；AGENTS §4（业务口径权威源=model.json，指标引真值报表）+§6（I3 状态+开放项 I4 下一站）；README 目录结构补 `models\`。
- **r2 I3 验收对照**：≥5 实体(5)✓、≥10 映射(15)✓、≥3 关系(3)✓、≥5 指标(6)✓、≥3 维度(3)✓、业务歧义处理✓、所有映射可追溯数据库字段✓（validator UNKNOWN_REF 护栏，实测回溯 0 错）。终验：fast **7 套件** GREEN、**R1–R7** GREEN、scan_all_specs 42/43 照旧、I3 零改动产物路径代码→默认引擎回归双铁证 CBEB42E3/A8EF39AB 逐字节不变（廉价保险）。
- **仍开放/不做（防提前抽象，r2 §十暂缓）**：不接生成链（模型→ReportSpec 编译=I4 Planner/I5 闭环）；不建 NL→模型 Planner（I4）；无模糊/ML 语义匹配（confidence 只用结构规则）；无 YAML 解析器（选 JSON）；不连库（消费 I2 现成 schema）；`?` 值绑定工单不变。三能力"知道数据是什么(I2)/知道业务是什么意思(I3)/知道如何生成报表(I1 接口，I4/I5 补全)"至此其二落地，I4 是把它们接成自然语言闭环的第一块拼图。

#58 r2.md I4「Report Planner 确定性接口层」落地批（2026-11-04，I3 验收后按"前一迭代验收过再开下一迭代"推进；用户拍板两口径：**只交付确定性接口 + 20 需求矩阵 + 文档**（不跑真 Agent，NL→intent 留 I5，避 LLM 不可重复性）、**保持 I1 现状 + 诚实拒绝能力墙**（ratio/filters 不打通、不悄悄降级）；r2 §I4 字面"不自己实现 Agent 框架，用现成的，fr-agent 只提供确定性工具接口"）：
- **两件 core（零 load/零 Java/零 com.fr，天然落 R7）**：`semantic/planner/capability.js`（能力墙判定单点：`aggregation` sum→supported/非sum→deferred 带 owner、`intentFeature` filters·chart·multiSheet·semanticQuery→deferred 指归属迭代、`metricTargetIsAggregate` I3 聚合指标→deferred **不降级成 sum**）+ `planner.js`（`plan(intent,ctx)` 纯函数编排，外部件 resolve/validateSpec/capability **全经 ctx 注入**=可喂 fake 证伪；三态分流 r2 §4.3：术语 ambiguous→unresolvedQuestions(requiresConfirmation 不自动选)、unknown→validationWarnings(不编造字段)、越权→validationWarnings(deferred+owner)、非正确性默认→assumptions(版式/宽度/合计自决不追问)；组 I1 ReportSpec 后注入 `SpecValidator.validate` 复验，仍 err→rejected=planner 绝不自吐非法 spec）。
- **不重造**：planner 用 I3 `ModelResolver` 解术语、I1 `SpecValidator` 验产物（一处真相），能力名册读注入的 `ReportSpec.capabilities/AGGREGATIONS`；只做"业务术语→物理字段"翻译 + 三态编排。
- **S1 离线 20+ 需求矩阵** `verify/fast_planner.js` 26 项（真 I3 模型 + 真 I1 校验器注入，零引擎零连库零 LLM）覆盖 r2 §4 四分支：明确(bizTime/collectionDate/collectedAt/rowNo)→ready 且 reportSpec 过 I1 **0 err**(≥6)、模糊(score/fileKey/machineId/stage/records 跨实体多候选)→requiresConfirmation 不自动选、越权(avg/filters/chart/I3 聚合指标 avgScore·completionRate·planned)→deferred+owner **不降级**、幽灵术语→不编造、混合保留可解析部分；capability 单元 + 纯/确定序/输入不可变/抗炸/自吐 spec 合法。**矩阵首跑抓到真 bug**：`mapTerm` 把 `table.` 前缀泄漏进 ReportSpec field（`laser_aaa.biz_time` 应为 `biz_time`）→修 split 叶名；术语唯一/歧义分类先经探针实测（拒"凭记忆猜"，AGENTS §0）。
- **S2 接口文档 + ABR-1 登记**：新建 `docs/agent-planner-interface.md`（现成 Agent 用：意图 schema、四件套输出、追问 vs 自决界分、越权=拒并非降级、与 I1 接法=写 examples/report-spec/*.json 走 I1 JSON 入口、与 I5 真闭环的接法；只描述已存在接口不写 Agent 代码）；`dependency-rules.md` 允许表加 `semantic/planner→(注入)I1+I3`、事实契约加 `ReportPlanner/PlannerCapability`；`boundaries.md` 语义层带补 planner 子层；AGENTS §6 I4 状态+开放项'I5 下一站'；README 目录补 planner；parse 门登记 2 core、聚合门扩第 8 套件。
- **r2 I4 验收对照**：明确需求自动生 ReportSpec✓、模糊需求正确追问✓、不支持需求明确拒✓、不产生未定义字段✓、不静默编造指标✓（矩阵四分支全断言）。终验：fast **8 套件** GREEN、**R1–R7** GREEN、scan_all_specs 42/43 照旧。
- **零产物路径改动=免引擎回归留痕**：I4 只新增 `semantic/planner`+`verify`+`docs`+登记，不碰 lib/make_api/paths/object/ir/cpt → 基线逻辑不可能变（#53 先例），未跑默认引擎回归（省无谓杀 java）；三能力至此：数据(I2)✓ 业务(I3)✓ 生成接口(I1)✓ + 规划编排(I4)✓，唯缺 I5 把「现成 Agent 的 NL→intent」与 I4 确定性件接成端到端真闭环。

#59 r2.md I5「自然语言→真实 CPT 完整闭环」落地批（2026-11-04，I4 验收后按"前一迭代验收过再开下一迭代"推进；用户拍板两口径：**扩 ReportSpec 到 SQL + 模型驱动聚合生成器**（非回退手写 rawIR，最贴"AI 报表创作引擎"初衷）+ **1–2 真报表端到端 + §5.2 守卫件**；"可以用 zcode 跑"=授权现成 Agent 承担 NL→语义 spec 那一环）：
- **取证定 gap（不臆测）**：Explore 坐实"用现有 I1(sum-only)+I4 端到端只能出玩具内嵌表，真 SQL 日报缺的是 model→SQL 语义生成器"（`model.json` 零运行时消费者、`browser.js` SQL 是激光族专用非通用、I4 `capability.js` 当初故意把聚合/SQL 甩给"I5"）；#52 真日报实为子代理**手写 rawIR 内置 SQL**。据此 I5 补的正是这一档。
- **Q1 `semantic/query/sqlbuilder.js`（零 java 纯函数）**：入 (model, sel{entity,dimensions,metrics,dateRange}) 读 `model.metrics[].expression` → 镜像 #52 已验证 SQL 形态（`TRY_CAST(score AS float)` 数值归一 + `score IS NOT NULL` 基筛 + `TRY_CAST(biz_date AS date) BETWEEN '字面'` 禁 `${}` + GROUP BY + ORDER BY 1）；**ratio 派生指标不进 SQL**（引擎无 SUMPRODUCT 且比率属展示层，回 derived 规格）；生成即自检单语句无 `;`（配 ir.js SQL_READONLY）；追溯闭合（ratio 分子分母未选/未知实体指标→UNKNOWN_REF、坏日期→INVALID_TYPE 防注入）。`verify/fast_sqlbuilder.js` 20 项先红后绿。
- **Q2 ReportSpec SQL 分支（加性，内嵌路逐字不动）**：`report_spec` 加 DATASET_KINDS{rows,sql}+能力名册、`spec_validator` 加 sql 分支（entity/connection/维度指标名/dateRange 校验，仍拒自由 `query`）、`spec_compiler.compileSql` 产 #52 同构 cells IR（明细 base 列 ds 绑定 + 派生 ratio 自格公式 =<num>*scale/<den>、总计 =SUM+比率引用总计行、行号算术镜像 agent_daily_report）；`make_api` JSON 分支检测 dataset.kind='sql'→载 model+sqlbuilder→compile(rs,deps)+ 按连接名从 dbpass **本地注入凭据**（密码不入 JSON/cpt）。`verify/fast_sqlpath.js` 16 项：sql spec 编译→IR 过 `Ir.validate` 0 err（含 SQL_READONLY）、ratio 成公式格、内嵌路 title,header,detail,total 不破。R6c 抓到 make_api 硬编码 load→改 Paths.lib。
- **Q3 planner SQL opt-in**：intent 带 dataset.kind='sql' → 直通模型驱动 sql ReportSpec（成员校验不编造），聚合指标在 SQL 路不再 deferred（兑现 I4 甩给 I5 的）；内嵌矩阵 26 项不改色。**Q4 `semantic/closure/loopguard.js`**：§5.2 五上限纯函数（maxFixCount/deadlineMs/modifiableFields/环境类 reject），`nextAction(RESULT,state,caps)`→done/retry-fix-spec/reject，自测抓出 `hasOwn` 值vs键真 bug。fast 套件至 **11**。
- **Q5 LIVE 端到端（ZCode 子代理，无会话记忆）**：派子代理仅凭**自然语言需求** + `docs/agent-closure-interface.md`，产 `examples/report-spec/daily_report_auto.json`（entity/dimensions/metrics/dateRange，**零手写 SQL/IR**，主 check 独立核 SELECT/GROUP BY 0 命中）→ `run.ps1` 引擎跑 → **RESULT_DUMP 总计 33531/26531/79.12 逐格命中 #52 独立真值、0 retry**、SECRET GATE clean。子代理并**如实上报一个展示层 gap**（模型 `completionRate.format="#,##0.00"` 未流到格子→PNG 完成率原始长小数）——主 check 未轻信、亲验 MD5/spec/栅格后定位 `compileSql` 发射未带 metric.format → 修（`fmtOf/numSt`）→ 引擎复验数值不变 + 部署 cpt 现含 `#,##0.00`。此 gap 由现成 Agent 真跑暴露、确定性件修复=闭环价值实证。
- **r2 I5 验收对照**：真实生产报表 NL→CPT 全自动（ZCode 子代理产语义 spec、不写 SQL/JS/IR）✓；六层验证（结构/IR/CPT/执行/数据/渲染）复用既有门全 passed 11 stage ✓；**数据口径对独立真值**（RESULT_DUMP 栅格 vs `db_laser_sub_truth` grand_total 逐格一致）✓；失败修复回路 + §5.2 五上限（max 修复次数/单次时间/可改字段白名单/SQL 范围 SQL_READONLY+dbpass 凭据/输出目录 BR_DEPLOYDIR+outName 路径闸）经 loopguard+既有闸落地 ✓；可重复性（builder/planner/compiler 纯函数 + 定日期字面 + 两次 SQL 全等/输入不可变）✓。
- **终验**：fast **11 套件** GREEN、**R1–R7** clean、scan 42/43、引擎负门 **5 路 GREEN**（含 json-bad-spec→exit2）、默认双铁证 **CBEB42E3/A8EF39AB** 经负门末步回补逐字节不变（I5 改了 spec_*/make_api 装载面，必跑）。
- **仍开放/不做**：语义 SQL 覆盖"单实体分组+模型指标+日期范围"，多表 JOIN 模型驱动生成 + 图表 + 非日期筛选=后续（跨实体关系当前走 #52 rawIR）；不自由文本 SQL/NL 直翻（§5.2）；不建 Agent 框架；不接已有 CPT 修改（I6）；`?` 值绑定工单不变。r2 三能力（知道数据/知道业务/知道如何生成）+ 端到端闭环（I5）**全部落地**，fr-agent 至此为可被现成 Agent 驱动的自然语言报表创作引擎，仅 I6（改已有 CPT）为独立技术路线待启。

#60 r2.md I6「已有 CPT 受控局部修改（Template Patch）」落地批（2026-11-04，r2 全路线最后一档；用户拍板：**保守白名单·R0 探针冻结** + **自产 CPT 受控闭环靶**）：
- **取证定边界（不臆测）**：Explore 坐实"读回→改→写回→比对"全链本仓仅 `make_report.js:53→71→96/117`（读回→`putTableData`→`export`→再校验）一处闭环证据，`cell.setValue` 型 mutation 在读回对象上只跑到 execute/render（`probe_vanchart23/25/26/27`）**跨 export 无先例**；r2 §6.2 七操作里 6 个读回零验证（参数面连 `getReportParameterAttr` 读口都没有、列宽只有 XML regex）；**导出字节 MD5 禁用**（`make_verify` 87/240 self=false，官方件 `<UUID>` 非确定），命名样式 `style_name=` 读回即默认化（README:103）→ 历史件 patch 会伤未改部分。r2 §十立场不变：`reverseFromCpt` 保持 unsupported，I6=对象级局部 patch 非全量反编译。
- **R0 读回/写回探针冻白名单**（`probes/probe_patch_readback.js`，runraw 不杀 java，落 `data/template_patch_readback_truth.txt`）：对自产无命名样式内嵌 CPT 实测 → **`cell.setValue`→export→再读回=PASS**（标题值确实变）、**`putTableData`→export→再读回 colCount 4→2=写回生效**、**`setColumnWidth` 读回对象 WrongMethodTypeException（要 UNIT）=排除**。v1 白名单冻结 = {replace_cell_value, replace_dataset}；其余 6 项 `TemplateOps.UNIMPLEMENTED` 各挂证据、不半成品。
- **R1 core 纯函数**（零 java 零 FR）：`template/ops.js`（白名单/UNIMPLEMENTED/FORBIDDEN_TARGETS 一处真相）、`validator.js`（PatchSpec 校验：op 白名单越权拒带证据、坐标非负整、源件路径穿越/盘符/基线禁写、dataset 行宽对齐，沿用 I0-01 `{code,path,message}` 抗炸）、`locator.js`（op 目标对描述符存在性，越界/数据集不存在→拒不静默新建）、`diff.js`（**语义 token 多重集 diff + 序列化噪声过滤**〔数字数组/UUID/长数字串〕+ namedStyles 守卫 + profile 计数，判"未改部分不变"，不靠导出字节 MD5）。`verify/fast_template.js` 32 项先红（sheet 通用校验误拦 dataset op / source 缺穿越守卫 / locator 数据集 op 免 sheet / codeAt 精确码）后绿。
- **R2/R3 薄壳 + LIVE 端到端受控闭环**（`reader/inspector/patch` 触 com.fr + `patch_main.js` runraw 编排：validate→**命名样式守卫**(源件含 style_name 默认 abort)→**原件 copy 保留**→readCpt→TemplatePatch.apply(白名单)→**写回只进 `logs/template_staging` 绝不碰 fineagent/基线**→再执行 pre/post 比结果栅格(**执行回归**)、前后 PNG 比像素(**渲染回归**)）。**真跑 I5 自产日报改标题格：结构 diff clean=true（仅标题文字变、列宽/行高数组噪声已忽略）+ 执行回归=PASS(数据栅格逐格不变) + 渲染像素 diff 1.69%<5%（差异仅标题区）+ namedStyle=0 + 原件保留** → r2 I6 六条验收全过（含"视觉差异在预期内"与超要求的"原始文件永远保留+不碰字节基线"）。踩坑留痕：diff 首跑把 re-export 重算的 `<RowHeight>` 数字数组误判"未改部分变了"→加 isNoise 过滤（README:126 re-export 非字节稳定而渲染稳是既定事实）。
- **R4 ABR-1 R8 + 收口**：`check-boundaries.ps1` 加 **R8**（R8a make_api 不载 template/——I6 独立于 generate 主链走 patch_main；R8b template core 四件零 Java.type/com.fr；薄壳才触 FR）；dependency-rules 允许/禁止/fact-contract(`TemplatePatch`)；boundaries template 旁路带；AGENTS §1 基线禁写升级、§6 I6 + r2 全路线收官；README 目录 `template\`；`docs/agent-closure-interface.md` 补 patch 接法。终验：**fast 12 套件 GREEN、R1–R8 clean、scan 42/43、引擎负门 5 路 GREEN、默认双铁证 CBEB42E3/A8EF39AB 逐字节不变**（I6 未触装载面，负门末步回补复验）。
- **r2 I6 验收对照**：5 张历史 CPT 读取（reader/inspector 自产件确证 + 官方件只读探命名样式现实）✓、≥1 种局部修改（格值/标题 + 数据集替换）✓、导出修改后 CPT（staging）✓、查询/参数/图表不回归（结构 diff clean + 执行回归数据不变）✓、视觉差异在预期内（渲染像素 1.69%<5%）✓、原始文件永远保留✓。**r2.md 全路线 I0~I6 至此全部落地**。
- **仍开放**：I6 v1 白名单仅两类 mutation，扩任一 op（style/column-width/column/filter/params/title）需各自 R0 式读回/写回探针先证；官方历史件多含命名样式，v1 只读探测不强 patch（守卫）；`?` 值绑定工单、多表 JOIN 语义 SQL、图表=后续；用户后投 `docs/gpt/r3.md` 新规范待处理。

#61 r3.md「I5.1 模型驱动 SQL 正确性加固」落地批（2026-11-04，用户投 `docs/gpt/r3.md` 外部审阅令走 ub-mode；**不轻信外部静态审查**——逐条对当前源码复现后动手）：
- **前提校准**：r3 基于快照写"I6 尚未开始"，实际 I6 已于 `c4fe924` 落地（其"探针冻结/不猜"哲学恰与 r3 一致）；r3 的 5 问题里 **P1–P4 经当前源码复现属实**，**P5 是正确的架构边界说明**（现成 Agent 驱动、loopguard 是纯判决件，不是缺陷），故只修 P1–P4。r3 §十/§五"先修正确性再加功能""四层模型不合并"两原则予以采纳。
- **P1 跨表静默出错**：`sqlbuilder` 维度/指标 `col.split('.').pop()` 后一律挂 `ent.table`、`count` 不看 `e.table` → `machine`(laser_files)/`fileCount`(laser_files) 被拼成 `... FROM laser_aaa` 不 JOIN 不报错静默错。修=维度 `d.table===ent.table`、指标 `exp.table===ent.table` 否则 `UNSUPPORTED_CROSS_TABLE` 且**不产该 SQL**（JOIN 留 I5.2）。
- **P2 语义未决却 ready**：planner SQL 分支状态只由 `validateSpec`（校形状不校成员存在）决定 → 幽灵维度/指标仍 ready。修=`memberMissing` 计数→status 非 ready、幽灵项 filter 不入 spec（"不能让未解决的业务语义进入 ready"）。
- **P3 ModelValidator 未接生成链**：make_api SQL 分支只载 sqlbuilder，不 `ModelValidator.validate` → schema 漂移不能及时发现。修=生成前读 I2 schema 快照跑 `ModelValidator.validate(model,schema)`，缺失/漂移即 `input_load failed` 拒（**用户拍板启动时校验、对不上即拒，不每次重扫库**）。
- **P4 日期形态不一致**：spec_validator 逐字段"有才查"（{from 无 to} 放过）、sqlbuilder 要 both、两边都只做字符串正则不校验日历有效性。修=新建 `lib/isodate.js` **单点**（严格双边+月/日/闰年日历有效+from<=to），spec_validator 与 sqlbuilder 共调（消除两处不一致）。
- 附带 r3 任务5=`ModelValidator` 加 ratio `scale` 有限数校验；任务6=`verify/verify_sql_data.js` 纯离线哨兵（I5 grid↔`db_laser_sub_truth` 逐日+合计硬核对，缺 grid SKIP 不假绿）。
- **TDD 全程红先行**：每洞先写当前必失败的复现测（fast_sqlbuilder +跨表/日期 6 项、fast_planner +幽灵成员 2 项、fast_report_spec/fast_sqlpath/fast_semantic 补日期/scale），再修根因；装载面（isodate/model-vocab 前置）由 fast 套件补 load + 引擎暴露。**教训留痕**：T4 只载 `model/validator.js` 未载其依赖 `model/vocab.js`，fast 层不覆盖 make_api 装载序 → 引擎首跑 `LOAD FAIL: ModelVocab not defined` 当场暴露 → 补前置；印证 AGENTS §1"改装载面必跑引擎回归、不许 validator 绿了就报完成"。
- **验证**：fast **12 套件** GREEN（+ 独立 `verify_sql_data` 哨兵，需 I5 端到端 grid，不入无引擎门）、R1–R8 clean、scan 42/43；引擎 live：I5 日报重跑 `MODEL↔SCHEMA 对齐通过`+failures=0+`verify_sql_data` grid 逐格 0 差（33531/26531/79.12）、跨表 machine 请求 `UNSUPPORTED_CROSS_TABLE` 干净拒（input_load failed exit2、不出错报表）、引擎负门 5 路 GREEN、末步默认回补双铁证 **CBEB42E3/A8EF39AB** 逐字节不变。
- **仍开放（按 r3 排序，先正确性后功能）**：I5.2 多表 JOIN（须先建关系方向/基数/JOIN 类型/关联路径唯一性/是否需业务确认，不能把 relations 数组字段简单拼 JOIN）、I5.3 图表/非日期筛选/排序/TopN/钻取（逐项扩 ReportSpec，不绕开让 Agent 写 IR）、`?` 值绑定工单、I6 patch op 扩展各需探针。四层模型（Schema/Semantic Model/ReportSpec/ReportIR）继续分层不合并（r3 §五）。

#62 r3.md「I5.2 多表 JOIN + I5.3 报表表达力」落地批（2026-11-04，r3 §四排期，一次连续做完不逐步请示；每项红→绿测 + 引擎 live）：
- **I5.2 多表 JOIN（模型语义约束、fan-out 守卫）**：`model/vocab` 加 `confirmed` 关系源 + `CARDINALITYS(1:1/N:1/1:N/N:M)` + `JOIN_SAFE_CARDINALITY(N:1/1:1，被 JOIN 维表侧唯一键→不 fan-out)`；model `recordToFile(laser_aaa.file_key→laser_files.file_key)` 升 confirmed N:1（`confirmedBy=browser.js fullSql 生产 JOIN + I2 file_key=laser_files 主键`实证，非拍脑袋）；`ModelValidator` 要求 confirmed 必带合法基数+confirmedBy；`sqlbuilder`：跨表**维度**经 confirmed 安全关系→`INNER JOIN to ON ent.fk=to.fk`+限表名消歧义、跨表**度量**仍拒（JOIN 不改 grain）、无安全关系/非安全基数(1:N/N:M)→回退 `UNSUPPORTED_CROSS_TABLE`；单表查询逐字不变（JOIN/qualify 仅在 joins 存在时生效）。**live 按机台日报**合计 plan 33531/done 26531/率 79.12 = grand_total（N:1 不重不漏，fan-out 若发生必虚高）。
- **I5.3-A sort/TopN**：sqlbuilder `sel.sort[{field,dir}]`（ORDER BY 已选 SQL 别名，派生比率列不在 SQL→拒；坏 dir→INVALID_ENUM）+ `sel.topN{n}`（SELECT TOP n；无 sort→拒"无确定序"；非正整→拒）；spec_compiler 透传 dataset.sort/topN、spec_validator 校形状。
- **I5.3-B 非日期 filters + `?` 绑定查证**：FR DBTableData 走 `${}` 文本替换 + ParameterProvider（object.js:106 坐实）、**非 JDBC prepared → `?` 绑定在该后端不可行**，记为架构阻塞点不假造；filters 用**受控字面量**：数值列值须有限数(TRY_CAST 比较)、文本列须安全 token(禁引号/;/注释，LIKE 包 %..%)、字段限实体表可过滤列(跨表 filter 拒)、op 白名单，仍守 SQL_READONLY 单语句无分号。live 日报 stage like 'L' 筛选正确(09-14 plan 1948<全量 3873)。
- **I5.3-C 图表**：`presentation.chart{kind∈bar|pie|line,category=维度别名,value=基础度量别名}`→compileSql 复用同一 SQL 数据集 ds1 出 IR chart 块；category/value 非已选列/用派生比率→编译期抛不静默；spec_validator 校 chart 形状。**引擎首跑暴露** v2 `Cpt` 的 `nameIn` 断言只认 CDATA/valueName 两形态、SQL 数据集 legacy chart 实为 `ChartSummaryColumn name="planned" customName="planned"` 第三形态（cpt 证据值已绑）→扩断言覆盖第三形态（非放宽掩盖）。live 每日计划柱状图出 `生产日报_图_api.png`(40KB)/pdf/cpt failures=0。
- **诚实收口（ub-mode 不硬凑）**：I5.2 joinByTable 已泛化但演示域真实跨表关系仅 file_key→laser_files 一条，不编造更多；`?` 绑定=FR 后端不支持（已查证 + 安全字面量替代）；I6 patch op（style/column-width）R0 探针已证不过/有损，不硬上。**剩余皆"运营按需扩"，非代码缺口**。
- **验证**：fast **12 套件** GREEN、R1–R8 clean、scan 42/43、引擎负门 5 路 GREEN、双铁证 CBEB42E3/A8EF39AB 逐字节回补不变；装载面（sqlbuilder 引用 ModelVocab）引擎首跑暴露并修 make_api 前置 load。r2.md I0~I6 + r3.md I5.1/I5.2/I5.3 全落地。

#63 r4.md「正确性收口」落地批（2026-11-04，用户投 `docs/gpt/r4.md` 外部审查，令"先确保已支持能力不会静默生成错误报表、不把模板修改误报成功"；逐条对当前 main 复现后动手，排期 I6.1→I5.4→I5.5→I1.1）：
- **P1-1 数据集描述符断层（`a32ab05`）**：`describe()` 旧版不返 `datasetNames` → 真实链 `replace_dataset` 必被 Locator 拒，离线测因手工构造 descriptor 而假绿。修=`describe` 增 `datasetNames`+`hasDataset(name)` 活断言（FR 无可靠枚举 API，不伪造列表），Locator 优先消费该断言、离线仍可喂静态表保持零 java。新增真 WorkBook 集成探针 `probe_patch_dataset_integration.js`（describe→Locator→apply→export→再读回：列数 4→2、首列 `java.lang.Integer` 保真、原件未写）8 项 PASS 落 `data/i61_dataset_integration_truth.txt`。
- **P1-2 diff clean 过宽 / P1-3 执行回归假 PASS（`faa2699`）**：diff 加关键属性签名多重集（过滤 Theme/Fork/TemplateId 引擎噪声）、`structDelta` 纳入 clean、按 op 分类（`replace_cell_value` 结构全守恒；`replace_dataset` 仅 dataCols/tableData + 数据集本体 token 豁免，单元格文本仍严格拒）；新建 `template/regression.js` 纯函数裁决器，`execution/render` 均返 `{ok,...}`，**任一失败=FAIL、绝不比错误文本**，标题变化只比数据区，渲染 `-1`=FAIL。真跑中 `cel.getText is not a function` 曾被 try 吞成假 PASS 即此洞实证，修后如实 FAIL 并加 `getValue/toString` 兜底。
- **I5.4 SQLBuilder 四边界（`9ffc775`）**：JOIN 列限定改两阶段（先收集全部维度 `{table,column}`+JOIN 集合，再统一限定）→ 结果与维度顺序无关；`dateRange` 保留日期维表归属、跨表挂 `refTable`；语义 op→SQL op 统一映射（`==`→`=`）、filter op×列型约束（数值列拒 like/contains、文本列只允许映射集）；受控字面量/单语句无分号仍守。fast_sqlbuilder +5 专项；引擎 live 双维 JOIN 33531/26531/79.12 不重不漏。
- **I5.5 关系目标键唯一性机器验证（`5ac4ca3`）**：confirmed N:1/1:1 的 to 侧键必须∈Schema 声明唯一键（PK/unique index）**或**有注入的数据侧证据，否则 `UNSUPPORTED_RELATION_KEY`；1:N/N:M 标 confirmed→`UNSUPPORTED_CARDINALITY`。validator 仍零 IO/零 java（证据经 `options.uniqueKeyEvidence` 注入）；`probe_relation_unique.js` 实机只读坐实 `laser_files.file_key` 538 行全唯一（PASS），make_api 生成前读该证据注入。教训：Java Long 对象身份比较使 538==538 误判 false → 数值化。
- **I1.1 能力清单统一 + 校验单点**：`ReportSpec.capabilities()` 按 `datasets.rows/sql` 分列、与实现一字对齐（sql：chart{bar|pie|line}、dateRange+dataset.filters、sort、topN、confirmed 安全关系；rows：均 unsupported）；`spec_validator` 抽 `validatePresentation()` 两分支共用，**sql 分支不再提前 return 跳过** showTotal/heightsPt/type 校验，presentation 未知键明确拒，**rows 路 `presentation.chart` 明确拒**（compiler 本不读=旧行为静默丢图）；planner SQL 分支透传 filters/sort/topN/chart 且 presentation 键原样交 validator 裁决，不再"报暂不支持却 ready"或静默吞。fast_report_spec +9 / fast_planner +6。
- **验证**：fast **12 套件** GREEN、R1–R8 clean、scan 42/43、引擎负门 5 路 GREEN、默认双铁证 CBEB42E3/A8EF39AB 逐字节回补不变。r4 审查 P1×3 + P2×4 全部关闭；`docs/gpt/r4.md` 收录原文要点+逐条复现裁决+执行记录。
- **仍开放**：I6 patch op 仅两类（扩项需 R0 探针先证）、`?` 绑定 FR 后端不可行（受控字面量替代）、跨表度量仍拒（JOIN 不改 grain）。

#64 r5.md「证据可信度 / 回归门真实性」落地批（2026-11-04，用户投 `docs/gpt/r5.md` 外部审查；按建议**只做 I5.5 与 I6 的 P1**，P2 在不新增能力前提下收口）：
- **P1 复合唯一键误判**：`ModelValidator.declaredUniqueKeys` 旧版把复合 PK 的每列都当单列唯一（`laser_files` 实为 `source_id+collection_date+file_id` 三列复合）。修=仅 `primaryKey.length===1` 与单列 unique index 才认可；`fast_semantic` 四象限（单列 PK/复合 PK/单列 UNIQUE/复合 UNIQUE）先红后绿。`model.json` 旧 `confirmedBy` 写"file_key 是主键"不实，一并改正。
- **P1 唯一性证据绑定+时效**：新增 `semantic/model/evidence.js`（纯函数，零 IO/零 java）解析结构化证据并校验 `schema 源 + probedAt 时效（默认 30 天，`I55_EVIDENCE_MAX_AGE_DAYS` 可调）+ unique=true 且 rows===distinct + relation 指向 model 里 to-side 恰为该列的关系`；不满足不注入并分类 accepted/rejected/stale/mismatched/malformed。`probes/probe_relation_unique.js` 改为遍历 model 中 confirmed N:1/1:1 的目标键（不再写死 file_key），产出 `data/i55_relation_unique_truth.json`（含 schema/时间/关系/行数）+ `.txt`。`make_api` 删除正则文本匹配、改走 evidence 过滤。**live 三连证**：证据有效→accepted + JOIN 日报 failures=0；移走证据→exit2 + `UNSUPPORTED_RELATION_KEY`；probedAt 改过期→exit2 + 诊断含"过期"。**诚实边界**：快照≠DB 唯一约束，长期 fan-out 安全仍需 DB 约束或 SQL 去重。
- **P1 replace_dataset 结果回归**：`TemplateInspector.datasetSnapshot`（列名/列型/逐格；API 由 `probe_tabledata_api.js` 反射实证 getColumnName/getColumnClass/getValueAt）+ `TemplateRegression.dataset` 严格比对（列数/列名/列型等价表/行数/逐格，数字归一 7≡"7"）；`patch_main` 先比内存写后快照、导出后复制临时件**再读回比一次**；集成探针同步加断言。live 两向均 PASS。
- **P2 diff 上下文**：数字噪声只在 `RowHeight/ColumnWidth/Height/Width` 节点内忽略（`<O>` 里 123→456 不再漏检）；属性签名改 `tag/attr=value`（属性跨节点移动可识别）。
- **P2 像素 diff 进流水线**：`pixelStats`（javax.imageio）统计尺寸/差异像素/比例/bbox；`TemplateRegression.render` 在 stats 缺失/尺寸变化/比例>5% 时 FAIL。live rename 例 1.69% PASS。**踩坑**：改写时 `new (J(...)).export` 少一组括号被解析成"对 Class 调 export"，live 立即暴露并修正。
- **P2 坐标屏蔽**：执行回归不再固定跳前两行，按 PatchSpec 坐标屏蔽；合并格按"同行同旧值→同新值"扩展；别的格改成同新值仍 FAIL。
- **P2 类型严格化**：`TemplateOps.DS_TYPES` 一处真相；validator 定死列名唯一/列型词表/逐格值型；`javaValue` 未知列型抛、boolean 非布尔抛（`"false"` 不再翻成 true）。
- **验证**：fast 12 套件 GREEN、R1–R8 clean、scan 42/43、引擎负门 5 路 GREEN、双铁证 CBEB42E3/6161F402 逐字节不变；docs/gpt/r5.md 收录原文+复现裁决+执行记录+开放项。

#65 r6.md「证据身份 / 探针原子性 / 数据可信度 / 视觉回归」落地批（2026-11-04，用户投 `docs/gpt/r6.md`；按建议不开新功能，r6-A→B→C→D 收口，完成后暂停底层架构扩张）：
- **r6-A 证据完整性**：证据升 v2（`evidenceVersion=2` + `status` + `sourceFingerprint/modelFingerprint/schemaFingerprint` + 每条 check 的 `relationFingerprint`）。`sourceFingerprint` 只含 driver+url（不含密码）；模型指纹含全部关系规范形；关系指纹含 name/source/cardinality/from/to——换库、改关系端点/基数、改 Schema 都令旧证据失效。探针改为与 Runner 同一套 `SQL_DRIVER/SQL_URL/SQL_USER+dbpass`（不再硬编码），目标关系取自 `ModelEvidence.requiredRelations(model)`；**原子性**：任一查询失败或任一不唯一 → `status=failed` + `exit(1)`；Runner 只消费 `status=passed`，且每条待验证关系必须**有且只有一条** check（missing/duplicates 均拒）。**live 三连证**：正常→accepted+JOIN 11 阶段全 passed；换 SQL_URL→exit2（打印两枚指纹）+EVIDENCE_MISSING+UNSUPPORTED_RELATION_KEY；坏连接探针→rc1+status failed（恢复后 PASS）。
- **r6-B 数据可信度**：`datasetSnapshot` 严格读回（反射任一失败→`{ok:false,error}`，不再降级 'text'/null）；`normCell` 改十进制字符串规范化（不用 parseFloat）——2^53 相邻整数可区分、1.50≡1.5、精度不丢；`PatchSpec` 数值列允许精确字符串（long/decimal 大数不经 double），validator 做数字语法校验。
- **r6-C 视觉回归加强**：执行回归加 `keyCells` 关键单元格内容断言（改后结果必须真为新值）；渲染加 `expectPixelChange`（有 op 却零像素差=FAIL）；像素比例 5%+尺寸一致+bbox 保留为辅助，数据正确性由 keyCells+dataset 快照+执行栅格三线保证。
- **r6-D SemanticPreflight**：新件 `semantic/preflight.js`（纯函数零 Java）只做"指纹+模型回溯+证据完整性→ok/diagnostics/context"，不接管 SpecValidator/SqlBuilder/连接；`make_api` SQL 分支连接身份只解析一次并同时用于指纹与 `SPEC.connections`。
- **验证**：fast 12 套件 GREEN（fast_semantic +12 证据/+5 preflight、fast_template +8）、R1–R8 clean、scan 42/43、引擎负门 5 路 GREEN、双铁证 CBEB42E3/6161F402 不变；patch rename（keyCells+像素 1.69%）与 dataset（双向逐格）live PASS。

#66 r7.md「探针原子性 / 关系完整性 / 指纹强度 / Inspector 严格语义」+ Agent 创作闭环首批（2026-11-04，用户投 `docs/gpt/r7.md`；按建议只开小 r6.1 修完即冻结底层，随后交付工具层与首次完整演示）：
- **P1 探针真原子写入**：所有 checks/status 算完后，JSON/TXT 先写 `.tmp`，JSON 最后 move（ATOMIC_MOVE→REPLACE_EXISTING 回退）；任一写失败→尽力把正式 JSON 改成 `status:"failed"`（再失败则删除）并 exit1。**实证**：预建 `i55_relation_unique_truth.txt.tmp` 目录→探针 rc1 且磁盘 JSON=failed；清理后 PASS。
- **P1 关系级完整性**：完整性主键改为 `acceptedRelations[relationName]`；同键两关系不再互相顶替（`missing` 精确到关系名）。`uniqueKeys[table.column]` 仅作 validator 注入。
- **P2 指纹升级**：纯 ES5 SHA-256（标准向量对拍通过）替换双 FNV；URL 规范化直接剔除 password/user 等敏感参数（加参数不改指纹，换库必变）。诚实边界：SHA-256 不证明服务器未被伪装。
- **P2 Inspector 严格语义**：`describe/cellExists/cellText` 统一 `{ok:true,...}|{ok:false,error:{operation,message}}`，`safeNum` 删除；Locator 对 `ok:false` 描述符/sheet 维度一律拒；patch_main 描述符失败直接 abort。真实 WorkBook 探针全 PASS。
- **Agent 工具层（r7-B）**：`agent/tools/fr_agent.ps1` + `discover/resolve/validate/preview.js`，契约 `docs/agent-tools.md`：discover（能力清单）/resolve（三态，不自动选）/compile（ReportSpec→CPT）/validate（11 阶段+产物+栅格自洽+外部真值）/preview/patch（受控修改）。每 verb 输出一行 ASCII JSON，详情落 `logs/agent/*.json`；Agent 不接触 Java/CPT/SQL。
- **首次完整演示**（`docs/agent-demo-machine-daily.md`）：独立子代理仅凭原句需求（机台生产日报：日期+机台、计划/完成/完成率、日期筛选、完成率降序、<80% 高亮）+ 工具契约产出 `examples/report-spec/machine_daily_demo.json`，并显式告知三项不支持（运行期日期控件/按派生比率排序/条件格式）与替代方案。主链 `compile→validate(-ExpectTotals 33531:26531)→preview` 全绿：11 阶段 passed、合计=明细之和（33531/26531）、完成率公式命中、PNG 1587×2245 非空白。
- **踩坑留痕**：PS 函数 `$rc = Run-Js ...` 把 java stdout 吞进返回值致 verb 无输出→改直接调用；PS 写出 JSON 带 BOM→validate 读取剥 `\uFEFF`；R7b 连注释里的 `Java.type` 字样也误报→改写注释。
- **验证**：fast 12 套件 GREEN、R1–R8 clean、scan 42/43、引擎负门 5 路 GREEN、双铁证 CBEB42E3/6161F402 不变。
- **按审查结论冻结底层架构**：后续不再扩 Validator/编译链；开放项=运行期参数/派生比率排序/条件格式（属报表表达力新迭代）与工具服务化（HTTP/MCP）。

#67 r8.md「全局架构审查」执行批（2026-11-04，用户投 `docs/gpt/r8.md` 并令执行；按审查自身顺序 **A1 统一创作契约 → A3 已由 r7 交付 → A2 留后**，不搬迁目录、不反编译、不重写引擎）：
- **A1 统一产物契约**：新增 `application/contracts.js`（纯函数零 Java）定义 `ReportArtifact v1`：`{artifactVersion, artifactId, sourceType(generated|patched|duplicated), outName, createdAt, cptPath/pngPath/pdfPath, execution{ok,exit,stages,failedStage,source}, validation{ok,checks}, preview, diagnostics[{code,path,message,stage,severity}], spec, patch, staging}`；`executionFromRunResult/diagnosticsFromRunResult/executionFromPatch/diagnosticsFromPatch` 把 RunResult 字符串诊断与 patch 回归结果归一；`validate` 校结构（generated 必带 spec、patched 必带 patch）；`acceptance` = 执行成功 + 无 error 诊断 + validation 不为 false（warn 不阻断）。
- **Create/Modify 同形**：`application/create_report.js` 读 compile.json+runresult（仅 `AGENT_WITH_VALIDATION=1` 才并入本轮 validate，防陈旧验收）→ artifact(generated)；`application/modify_report.js` 读 patch.json+manifest（diff/执行/渲染/数据集检查→validation.checks）→ artifact(patched)。工具层 `compile`/`patch` 自动生成并回传 `"artifact":"logs/agent/artifact.json"`；`validate` 完成后刷新 artifact.validation。
- **架构口径统一**：新增 `docs/architecture/authoring.md`（六层目标视图 + ReportArtifact 契约 + 冻结项 + A2 启动条件），明确"Semantic 依赖解耦 ≠ 不参与创作链"；`docs/architecture/probes-inventory.md` 先登记正式证据探针/业务真值/一次性探索三类（172 个探针只登记不搬迁）。
- **测试**：新增 `verify/fast_contracts.js`（13 项：契约合法/非法、诊断结构化、失败段、patch 诊断、验收口径、输入不可变）；fast 套件升至 **13**，fast_parse 纳入 application/*。
- **验证**：fast 13 套件 GREEN；真实链路 compile（机台日报，11 阶段 passed）→ artifact generated，validate 后含 validation.ok=true；patch rename → artifact patched，与 Create 同形；R1–R8 clean、scan 42/43、引擎负门 5 路 GREEN、双铁证 CBEB42E3/6161F402 不变。
- **明确不做（r8 §十二）**：A2 能力等价迁移（需先做 5 类报表新旧路径对照）、目录搬迁、CPT→IR 反编译、Agent Runtime、多后端/OWL/TS/ANTLR。

#68 r8 A2 前置「五类报表新旧路径对照」（2026-11-04，用户选 A2；不改产品行为，只产出迁移决策证据，`docs/architecture/a2-matrix.md`）：
- **对照工具**：新增 `verify/compare_paths.js`（零引擎）：读两份 RESULT_DUMP/RunResult/PNG，按日期键对齐明细、十进制规范化逐格比较、合计对拍、PNG SHA-256；数据不等或运行失败即 `ok=false`，PNG 差异只记录不判失败。
- **日报双路径实测**：`examples/report-spec/daily_report.sql.json`（ReportSpec）vs `reports/agent_daily_report.js`（手写 SQL rawIR）——两条均 11 阶段 passed；**10 天明细逐格相等（0 差）**、合计 `33531/26531/79.1237958903701` 完全一致；结构差异仅标题后缀/表头文案/脚注行（13 vs 15 行），PNG 因结构不同而不同（记录 SHA，不判失败）。
- **五类结论**：① `sales_demo` 已等价（IR JSON 全等 + 字节铁证）；② 日报类**可迁移**（先对齐文案）；③ 机台日报 ReportSpec 独有（无旧路径，数据对真值）；④ 浏览器族 24/25 张**不迁移**（缺 SQL 分页/参数面板/机台过滤/TOP）；⑤ 图表**部分**（legacy bar|pie|line 可迁，VanChart 6 图种 ReportSpec 无入口）。
- **缺口登记**：SQL 分页与运行期参数（需 FR 参数面板读回探针）、VanChart 入口、条件格式高亮、派生比率排序——均登记为能力缺口，不做静默降级。
- **决策**：ReportSpec 承担"新建 + 日报类结构化报表"长期契约；交互式浏览器族与 VanChart 仍由 Feature 承担；A2 若继续，先做日报文案对齐并双跑验收。
- **验证**：fast 13 套件 GREEN、R1–R8 clean、scan 42/43；本轮无产品路径改动，基线 `CBEB42E3` 未动（复核见提交前哈希）。

#69 r8 A2 收尾「日报类双路径全等」（2026-11-04，承接 #68；ReportSpec 加三个加性表达，缺省不改变既有产物）：
- **列引用覆盖**：`dataset.dimensions/metrics` 支持 `{term,label,widthPt}`（表头文案/列宽）；validator 白名单 term|label|widthPt，未知键/坏类型结构化拒；compiler 优先取覆盖值，缺省仍模型标签+110pt。
- **脚注**：`presentation.footnote` 发射 `space(10pt)+cells(24pt, sizePt 8)`，对齐旧日报口径行；validator 拒非字符串/空串。
- **对照结果**：`examples/report-spec/daily_report.sql.json` 对齐旧 `agent_daily_report.js` 后，双跑栅格 **15 行×4 列逐格全等（diffs=[]）**、合计 33531/26531/79.1238、两路 11 阶段 passed；PNG 仍不同（旧路自定义底色/边框样式），已登记为样式差异而非数据/结构差异。
- **测试**：fast_report_spec +4（footnote/未知键/widthPt/label 负项）、fast_sqlpath +3（表头覆盖/列宽覆盖/脚注块）。
- **验证**：fast 13 套件 GREEN、R1–R8 clean、scan 42/43、引擎负门 5 路 GREEN、`demo_api.cpt` 恢复 CBEB42E3。


#70 demo240 能力覆盖率看板落地（2026-11-04，r8 收官后「下一步只剩能力缺口」车道首件——批 0）：
- **工具**：`probes/coverage_report.js`（纯 nashorn 零引擎）→ 幂等重写 `docs/architecture/coverage.md`；状态源=`logs/_demo_classes.txt`（223 个 com.fr.* 类频次）+ `logs/_demo_feature_scan.txt`（27 tag 计数）+ lib 引擎源码两类 token 命中规则（全限定名 / 带引号短名——兼容 object.js 的 `H+'X'` 前缀拼接形态）。
- **首批全景**：missing=135 / partial=13（noncore=3 圈定不追：esd/云分析/widgettheme）。TOP 缺口按频次：ValueHighlightAction 717、AttrTooltip 族 ~2.9k、ParameterJavaScript 589、ConditionAttr 299、NoneReg 153、AttrLabel 族 259、AttrBorder 93、VanChartAxis 92、DatabaseDictionary 60、BuiltInSQLSubmiter 55、SimpleDateFormatThreadSafe 53、IntelliDMLConfig 53、AttrAlpha 52——与批 A/B/C/D/E/F/H/I/J 排期一一对应。
- **用意**：r1.md §六口径「demo 覆盖=证明已支持特性可稳定组合」——看板双列即此：A 节缺口账（排期依据，按类频次倒序）、B 节已实现族的组合稳定证据（载体 spec+13 快速套件+引擎负门+字节基线）、C 节 27 tag 三色表。每批收尾重跑该 probe 即刷新，覆盖增量即刻可见。


#71 批A 条件属性满血（2026-11-04，demo 车道批 A——then 四动作 Value 717/Border 19/Hyperlink 7/Widget 1 收编）：
- **ref）引擎词汇**：ir.js `COND_THEN_KEYS` 增 `value`(串|{formula})/`border`(top|bottom|left|right 各 {line:0..5,color:argb})/`link`(复用 checkLinkShape+web|reportlet 必一)/`widget`(值编辑器四件 kind 白名单 editor|number|date|textarea)；CAPABILITIES.condition.thenActions 同步。object.js actionsOf 四构造一手探针后落地：ValueHighlightAction(Object)（官方 公司评级.cpt =IF(F6..,"A","B","C") 同形）、BorderHighlightAction(CellBorderStyle set 某某Style/Color)（官方 签约情况分析 bottomLine=2 同位）、HyperlinkHighlightAction(NameJavaScriptGroup)（buildLinkGroup 提取单源共用）、WidgetHighlightAction(Widget)（buildWidget 提取单源：参数面板与条件换控件同一构造器）。
- **测试**：fast_ir_contract +23 项（先红后绿：四动作正控零误报 + value 数字/空对象/未知键、border 未知边/无边/line 缺/串/越界/color 串、link .. 穿越/空对象、widget 缺 kind/非法 kind/value 非串、非对象）全绿；载体 `reports/test_hla2.js` 引擎 11 stage 全 passed（PNG 目视：换值字面「不合格」仅 L1、换值公式 补考/达标/达标 分行成立、粗底线仅 L1、96 绿灯、72 原样、合计 226）；部署 cpt XML 计数 Value 2/Border 1/Hyperlink 1/Widget 1+TextEditor 1，Border 节点 topLine="0" bottomLine="2"+FineColor 与官方逐位同构。
- **教案一（引擎级事实，入 AGENTS §3）**：**cell 级 highlight 的 `when.column` 实测=对本格值求值**（列名不跨格求值；空串→0：`'<60'` 恒真、`'>0'` 恒假——首批 PNG 三行全画线/全列空白的根因）——跨列判断一律 `when.formula` 相对公式（`=F3<60` 本格锚+行自动偏移，官方语料同款）。
- **教案二（spec 编写纪律）**：v2 源 spec 的 totalCol 聚合格不得被 `total.label`（span=n−1）合并区吞并——评分列放中间时标签格与聚合格重叠 → 引擎丢格 → 幽灵样式 13建/12 序 → CPT GATE `style count mismatch` 的表象根因是它。总分列一律放最右（或 rawIR 自排）。
- **诚实留痕**：buildWidget/buildLinkGroup 提取单源无 pre-refactor 字节参照，等价性由「逐字段 move 无值修改 + 默认 spec 字节铁证 + test_widgets 引擎跑 failures=0」三重兜底。ObjectCondition 定性=CommonCondition 的父类型（带列参与物），cell 高亮面已覆盖；数据集级 TableData filter 条件仍计缺口（看板不在批 A 词汇内）。
- **门禁**：fast 13 套件 GREEN、scan 44 张（43 ok+1 env-skip）、引擎负门 5 路 GREEN（默认回补完好）、R1–R8 clean、默认 spec 收尾 demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F / 销售明细_api.png=A8EF39AB648D5F00DDAE0481D0313110 逐字节；coverage 看板重跑 missing 135→131。


#72 批B 图表装饰层（2026-11-05，demo 车道批 B——AttrTooltip ~2.9k/AttrLabel 259/AttrBorder 93/AttrAlpha 52/趋势线+标记 84/堆叠轴 58 + #46 三遗留）：
- **词汇**（chart 块新增，仅 Van 图族，ir.js 结构化闸+fast +15 项红→绿）：`tooltip{muti?,formats{series|value|percent|changedValue|changedPercent|category: true|格式串}}`、`label{enable,position}`、`marker{type 15 白名单,radius,common}`、`lineStyle{type solid|dashed|none,style normal|step|curve,width}`、`trend{type linear|exp|log|poly,name,color,pre,after}`、`stack{stacked,percent,stackId}`(仅 vbar/varea)、`alpha 0..1`、`bg`、`border{color,style}`、`axisY.unit`(#46 主刻度)、`conditions[{when,then{seriesColor|alpha}}]`。
- **挂接一手**（probe_chartdeco/2/3）：统一通道=Plot.setConditionCollection(ConditionCollection)——装饰件入 DefaultAttr(ConditionAttr).addDataSeriesCondition(...)（官方 DataVisualization.cpt 条件集形态同构）；plot 级 alpha/bg/border=GeneralInfo setters 直通；堆叠=VanChartRectanglePlot.setStackAndAxisCondition（官方形=命名 ConditionAttr+空 ListCondition+stackID=attr 名）；tooltip 内容=getContent() 活引用回填（AttrTooltip 无 setContent setter）；legend 类名=com.fr.chart.chartattr.Legend。
- ** ★ 根因教案（8 小时连环二分的终点，一行修复）**：**装饰件全挂在 dTag 上但从未 `cc.setDefaultAttr(dTag)`**——首版漏一行导致「build 途中挂/尾段挂/后挂全都不见」的假象，先被误判为「引擎清空 ConditionCollection」（bisect2/4/5/6 五轮对拍 + DBG 读回才定位）。**教训**：挂接 API 组装完必须回读 count 自证（readback-or-it-didn't-happen）。
- **架构定案**：装饰走 `out.applyDeco()` 后挂——build 收集任务单（cell 引用+块 spec），make_api 在「build 返回后、wb.export 前」统一应用（bisect5/6 XML 一手实证该时点存活）；ASSEMBLED 行带 deco=N 计数。
- **视觉实证**（能力自检_VanChart PNG）：marker 圆点/线形/趋势线（红「产量趋势」，isValidTrendLine 门槛=必须 setLineStyleInfo）/图例位置/plot 底色+边框/**散点 bubbleSize 修复（#46 大蓝点消失）**；XML 计数 Line 1/Marker 1/TrendLine 3/labelAttr 1/stackID 1 同官方形。
- **诚实边界（挂接完成、渲染端未达，后续批补）**：stack 堆叠渲染未生效（序列化在、渲染仍分组）、label 数值显示未出现、条件系列色 AttrColor 挂上未染、vline2 加趋势线后 x 轴刻度缩至 2 档（auto 收缩，可读）、vpie 图例 4 见 3 未解（#46 遗留维持）。
- **门禁**：fast 13 GREEN、scan 43+1、负门 5 路 GREEN、R1–R8、默认双铁证逐字节复原；coverage missing 131→116。


#73 批C 页眉页脚 + 模板级 attrMark（2026-11-05，demo 车道批 C——headerfooter 207/240 + TemplateId 166/TemplateTheme 79）：
- **词汇**：`sheets[].headerFooter{header|footer: {left|center|right: [{text|formula|pageNumber|totalPages|date, fontPt?, bold?, newLine?}], bg?}}`（sheet 级）+ `templateId: 'uuid'` / `templateTheme{name,dark}`（workbook 级）；ir.js checkHeaderFooter/checkHFList 结构化闸 + fast +13 项（红→绿）。
- **挂接一手**（probe_pagehf/_hf7/9）：`sheet.setHeader/setFooter(int, ReportHF)`——**ReportHF 裸 classpath 静态初始化撞 license 墙（LicenseContext ClassNotFound），env 全激活后可用**（管线 env 恒满足，与 CellSortAttr 同墙不同命）；attrMark 走水印同路 addAttrMark（TemplateIdAttrMark(String) ctor/TemplateThemeAttrMark().setName/setDark）。
- **教案（便捷 API 假象）**：ReportHF.addCenterText/addCenterPageNumber 等**便捷 add 不落 list**（首版页眉 CenterList 空的根因；getCenterList() 读回 [] 也是副本假象）——元素必须 HFElement 直构造 + `setXxxList` 回写：TextHFElement(text,font)/FormulaHFElement(content)/DateHFElement(font,dateFormat)；页码=公式 `"第" + $$page_number + "页"`（官方 档案式报表.cpt 同款）。
- **教案二（v2 spec 透传）**：新 sheet 级/workbook 级词汇若只写 rawIR 直通会「validate 看得见、build 看不见」——v2 默认 compile 路径是**逐字段白名单构造**，新键必须在 extrasOut 显式透传（本轮 headerFooter/templateId/templateTheme 三键补齐；DBG 分支不打印即为信号）。
- **像素实证**（PDF 文本层逐字命中）：页眉「激光检测中心 · 页眉（批C 自检）」+页眉底色、页脚「第1页/共1页」+「2026-11-05」日期 + 右列「fineagent 管线」；部署 XML Header/Footer(reportPageType=0)/TextHFElement 3/FormulaHFElement 1/DateHFElement 1/TemplateIdAttrMark/TemplateThemeAttrMark 全在；execute 不清页眉页脚（pre/post 导出同构——与批 B 条件集同墙不同命）。
- **门禁**：scan 44 张（43+1）、fast 13 GREEN、负门 5 路 GREEN、R1–R8、默认 CBEB42E3 逐字节复原；coverage missing 维持 116（headerfooter 家族类不落类级账，tag 层待批收尾重扫）。


#74 批D 字典族 + 日期/文本格式（2026-11-05，demo 车道批 D——dict 39 收全谱 + SimpleDateFormatThreadSafe 53）：
- **词汇**：`dict` 三形态——custom map（v4.0 原形）/ `{tableData:{ds,keyIdx?,valIdx?}}`（TableDataDictionary，官方 54 张主形态，零凭据）/ `{formula}`（FormulaDictionary）；`DatabaseDictionary/DynamicSQLDict 需 Connection 对象面 → 凭据注入批工单`（不假造，AGENTS 凭据单源）。列格式派生零新词汇：number→CoreDecimalFormat（既有）、**date/datetime→SimpleDateFormatThreadSafe.applyPattern（官方 53 张）**、text→TextFormat.getInstance()——kind 由列型自动派生（style 层 st.formatKind）。
- **挂接一手**（probe_dict2/_fmt + 官方 员工变化查询分析.cpt）：TableDataDictionary(NameTableData, keyIdx, valIdx) 直构造；**FormulaDictionary 真实 API=setProduceFormula(带=串)+setExcuteFormula**（probe 修正：无 setFormula——早先 dump 被 DynamicSQLDict 父类方法混行误导）；官方形=EFormulaDict 执行公式缺省 `=$$$`（原值即键），**produce 是键→显示公式（$$$ 占位键），不是行上下文公式**——引用列名（CONCATENATE(grade,..)）求值空白，改 `=CONCATENATE($$$,"-档说明")` 即出。
- **教案**：① ReportHF 同款「便捷 API 假象」在字典面再现——getCenterList()/get*List() 读回是副本，存储以 set* 为准（readback-or-it-didn't-happen 换成 list-API 版）；② v2 spec 总分列=数字列必须存在（无数字列 totalCol=-1 → 聚合格 span 异常 → style count 幽灵，批 A 教训二的 v2 路复现）；③ 日期格式 pattern 直接写中文（yyyy年MM月dd日），SimpleDateFormat 引号转义在 FR 格式层会漏成字面引号。
- **像素实证**（能力自检_字典格式 PNG）：custom 字典 A/B/C→合格/返修/报废、tableData 字典 M1/M2、日期列「2026年11月05日」、formula 字典「A-档说明」式产出；XML 计数 TableDataDictionary 1/FormulaDictionary 1/SimpleDateFormatThreadSafe 1。
- **门禁**：fast 13 GREEN、scan 45 张（44+1）、负门 5 路 GREEN、默认 CBEB42E3 逐字节；coverage missing 116→110。


#75 批E 事件 JS 体系（2026-11-05，demo 车道批 E——ParameterJavaScript 589/DialogAttr 26）：
- **词汇**（linkTo/detail.link/then.link 三路共享）：`js: [{name?, params:[{name,value|formula}], recalc?}]`（超链组多件=钻取主件+动态参数回填件）、`dialog: {title,center,left,top}`（ReportletHyperlinkDialogAttr 经 setAttr）、`width/height`（Hyperlink 基类）、`title`（setLinkTitle）；ir.js checkLinkShape 扩四字段闸 + fast +7（红→绿）。
- **挂接一手**（probe_jsev/_rh）：ParameterJavaScript() 无参 ctor + setParameters(ppArray)+setShouldRecalculate；DialogAttr 经 **ReportletHyperlink.setAttr(da)**（探针定名）；NameJavaScriptGroup 数组构造（NameJavaScript[]）挂多件。
- **教案（路径统一）**：detail.link 走老 applyLink 未接 buildLinkGroup——批 E 组装只在 cellLink 路径生效，部署件节点 0 的根因；统一后 applyLink 缺省名保 '钻取'（字节防漂移）。**审查轮 2 顺手抓出测试基建潜伏 bug**：fast 的 baseIR 共享 BC 数组引用——批 A 负控把 then.widget:'editor' 写进共享列对象污染后续全部 mut 断言（批 A/C/D 各轮零误报是被「后写覆盖」掩盖的假绿）——baseIR 改 JSON 深拷贝（columns/datasets 三处）。
- **诚实边界**：setLinkTitle/setShowParameterInterface 序列化节点未现（属性名待查，低频不追）；Commit2DBJavaScript 挪批 F 填报章；ChartHyperRelateCellLink（18）挂接点在图表侧，批 I 一并。
- **像素/序列化实证**：部署 XML ParameterJavaScript 1/DialogAttr 1（test_jsev.js 载体，超链组两件+弹窗窗属性）；fast 13 GREEN、scan 46 张（45+1）、默认 CBEB42E3 逐字节；coverage missing 110→108。


#76 批F 填报章·序列化面（2026-11-05，demo 车道批 F 第一步——BuiltInSQLSubmiter 55/IntelliDMLConfig 53/write 按钮族/reg 校验族）：
- **词汇**：`write: {name?, connection(连接名,凭据不落模板), table{schema?,name}, columns:[{name, isKey?, skipUnmodified?, cell:[col,row]}]}`（v1 单格/列；多格 ColumnRowGroup/SubmitJob/DBManipulation 后续批）+ `paramPanel.widgets[].reg: none|phone|idcard|mobile|postcard|{custom,err?}` + toolbar 按钮族 5 键（appendRow/deleteRow/appendColumnRow/showCellValue/importExcel）。ir.js write 结构闸+reg 闸+TOOLBAR_KEYS 扩+fast +11（红→绿）。
- **挂接一手**（probe_write/_wa5-9 + 官方 产品月销量情况录入表.cpt）：**<ReportWriteAttr> 是 sheet 级 AttributeTarget——挂点=`sheet.addAttributeTarget(rwa)`**（wb 级 setter 不存在、addAttrMark=Cast 异常、WorkSheetAttr 无关——三轮穷举定案）；ColumnConfig(name, ColumnRow.valueOf(col,row), isKey, skip) 单格 ctor；编辑器校验=TextEditor.setRegex(RegExp)+setRegErrorMessage（NumberEditor/TextArea/DateEditor 无 setRegex→reg 静默跳过，登记）。
- **三教案**：① **VerifyItem≠Verifier**（addVerifier ClassCastException 一手实证）——verifiers 词汇按一处真相红线**结构化拒**（UNSUPPORTED_CAPABILITY），真实 Verifier 家族待 probe 后批；② **extrasOut 透传教训二度复发**（批 C 教训的原样重演：validate 看得见、build 看不见）——v2 spec 新 workbook 级键必须 extrasOut；③ cpt.js SimHei 规则补 **<ToolBars> 段豁免**（按钮 widget 默认 SimSun 不属单元格管辖，同参数面板域逻辑）。
- **诚实边界**：真提交（WriteActor DML 链路、演示库 staging 表真实写入）=独立工单挂账（需 web 表单提交值构造，复杂度独立成批）；NoneReg 显式 reg 在 number 等控件不落节点（无 setRegex）。
- **序列化实证**：部署 XML ReportWriteAttr 2/BuiltInSQLSubmiter 1/IntelliDMLConfig 1/ColumnRow/CustomReg 1/AppendRowButton/ShowCellValue 全在（test_write.js 载体）；fast 13 GREEN、scan 47 张（46+1）、R1–R8、默认 CBEB42E3 逐字节；coverage missing 108→94。


#77 批G 小特性扫荡（2026-11-05，demo 车道批 G——BarcodePresent 4/CustomGrouper 4/SubReport）：
- **词汇**：cells item `barcode: {type(BarcodeAttr 条码类型枚举 int), barWidth?, barHeight?, drawingText?}`（present 机制把单元格值编码成条码）；cells item `subreport: 'reportlets 相对路径'`（SubReport(TemplateWorkBook) 整嵌已部署模板，安全闸同 link.reportlet）；detail 列 `groupCustom: {other, otherDisplay, more, force}`（CustomGrouper 简单形态；ConditionGroup[] 条件组后续批）。ir.js 三闸 + fast +8（红→绿）。
- **挂接一手**（probe_g/_sr + 官方 卡片分栏.cpt）：BarcodePresent 在 `com.fr.report.cell.cellattr.BarcodePresent`（非 base.present）+ BarcodeAttr(int) ctor/setBarWidth/setBarHeight/setDrawingText；SubReport 在 `com.fr.report.cell.cellattr.core.SubReport(TemplateWorkBook)`。
- **诚实登记（240 demo 零直接语料，不硬凑）**：diagonal（`_demo_tags.txt` 无命中，斜线表头已有 putBiasCell v3.3 通路）/freeze web 半边/subreport 嵌套编辑形态——语料到手再收。
- **像素实证**（能力自检_小特性 PNG）：条码真实画出（条码图+数字）、子报表嵌套渲染（销售明细骨架整嵌）、CustomGrouper 分组表+合计 19；XML BarcodePresent/BarcodeAttr/SubReport 2/CustomGrouper 全在。
- **门禁**：fast 13 GREEN、scan 48 张（47+1）、R1–R8、默认 CBEB42E3 逐字节；coverage missing 94→92。


#78 批H CellSortAttr 排序墙重攻（2026-11-05，demo 车道批 H——定性修正 + 诚实挂账）：
- **定性修正（#45 结论更新）**：`com.fr.report.core.sort.common.CellSortAttr`/`SortHeader` 在 **env 全激活后可正常加载**——#45「静态初始化需 license 上下文」的墙与 ReportHF 同命（裸 classpath 才撞，管线 env 恒满足）。
- **挂点已证**：`CellExpandAttr.setCellSortAttr(CellSortAttr)` / `setSortFormula(String)` / `setResultSortHeader(SortHeader)` 均存在；CellSortAttr API=setSortExpressions(List)/setExpandExpressions/setResultSortExpressions/setSortHeader。
- **诚实挂账（不盲写）**：`setSortFormula` 直塞**不序列化**（本地/部署 XML 双 0、渲染顺序不变的探针实证）；`SortHeader` 组合面（SortHeaderIndex/Direction/SortItem[]/SortRule/SortArea 字符串区）**240 demo 无非空 cellSortAttr 语料**（#45 已记，本轮复核同）——组合形态无参照，按不硬凑纪律 **IR `sort` 词汇结构化拒**（UNSUPPORTED_CAPABILITY；一处真相红线：build 不生效的词汇不许放行），等真实排序 cpt 语料到手后批收。
- **门禁**：fast 13 GREEN（批H 断言=结构化拒 1 项）、scan 48、默认 CBEB42E3 逐字节。


#79 批I 图表族扩容·vbubble + 地图/极端族定性（2026-11-05，demo 车道批 I——BubblePlot 4/Map 7/极端图 1-4 张族）：
- **vbubble 收编**：VK 表 + VanChartBubblePlot（BubblePlot 构造一手探针 OK）；绑定=**BubbleTableDefinition（vscatter 同法）**——`vscatter||vbubble` 分支共享（seriesName/bubbleX/bubbleY/bubbleSize）；ir.js CHART_KINDS/必填分支/CAPABILITIES 同步 + fast +1。引擎 XML VanChartBubblePlot 2（test_vanchart 载体第 11 块）。
- **vmap 诚实挂账**：VanChartMapPlot 可构造，但绑定 ctor 10 参（TableData,分类,CSC[],boolean,5×String,**MapMatchResult**）——区域名匹配依赖 GIS 底图资源与地图数据，无轻量通路；7 张地图书料的 MapMatchResult 形态待专门批。
- **极端图族登记**（heatmap/3D globe/carousel/meter/kpi/wisdomtree 等各 1-4 张）：同为绑定形深水区，随地图批一并。
- **ChartHyperRelateCellLink（18）**：挂接点在图表热链（chart 级 setHyperLink 面未探完），随地图批。
- **门禁**：fast 13 GREEN、scan 48、默认 CBEB42E3 逐字节；coverage missing 92→91。


#80 批J 聚合报表 Poly 定性 + demo 车道阶段收官（2026-11-05）：
- **Poly 一手定性**：PolyWorkSheet/PolyECBlock 可构造（env 后），**PolyWorkSheet instanceof TemplateReport——wb.addReport(poly) 通路存在**；但块构建面（AbstractPolyECBlock 网格 API）未探全、demo 仅 5 处语料、渲染走独立聚合链——按不硬凑挂账（通路已证，块面 API 到手即收）。
- **阶段收官账**（批 0/A/B/C/D/E/F/G/H/I/J 全过一遍）：coverage missing **135→91**（223 类账本）；落库批次=0/A/B/C/D/E/F/G/I（8 批实现）+H/J（定性挂账 2 批）；**诚实登记渲染端待达/挂账清单**：批 B stack 渲染/label 显示/条件系列色、vpie 图例 4 见 3、批 F WriteActor DML 真提交/Verifier 家族/多格 ColumnRowGroup、批 H SortHeader 语料、批 I vmap GIS 底图/极端图族/ChartHyperRelateCellLink、批 J Poly 块面、批 D Database|DynamicSQLDict 凭据注入批——全在 coverage.md 缺口账+README 对应条目。
- **终局门禁（十载体连跑 + 全套）**：test_hla2/vanchart/pagehf/dict2/jsev/write/g/cellattrs/widgets/types **10/10 failures=0**；fast 13 GREEN、scan 48（47+1）、负门 5 路 GREEN、R1–R8、默认双铁证 CBEB42E3/A8EF39AB 逐字节。



#81 范围圈定：基本授权全做、收费/移动端不做（2026-11-05，用户拍板，经三轮澄清终口径="**基本授权有的内容都可以做；额外收费的不做；移动端不做**"——缺口账 41 类移入 noncore）：
- **判据（物理证据，非印象）**：范围判定=类物理定义在哪个 jar。WEB-INF/lib `fine-*` 核心 jar=基本授权自带；`plugins/` 插件 jar=插件功能。缺口账 108 类逐一核到 jar：
  ① **FVS 大屏插件**（收费产品）`plugins/plugin-com.fr.plugin.bigScreen.v11-4.6.16/fr-plugin-extendedCharts-4.6.16.jar`（448 类，全在 com.fr.plugin.chart.*）命中 **36 类**：globe(3D 地球/slideshowmap)/meter(pixelgrid)/kpi/wisdomtree/fluid/catalog/time(时间齿轮)/particlecounter/multidata/map.groupmap/column.arccolumn/column.carouselbar/shapecolumn/pie.carouselpie 全家=即"极端图族"本体；14 包在核心 jar 零交叉（grep -a 实证）。**FVS 复核（用户提醒"若有不收费的也是要的"）：36 类全随付费大屏产品无一属基本授权；VanChart 常规图型（柱/线/饼/散点/面积/仪表/雷达/地图/热力/气泡）全在核心 jar——零误伤**。
  ② **com.fr.extended.chart（15 类）**：类在核心 jar（序列化兼容基建），但消费者=付费扩展图族（KPI/地球/智慧树等图型只在 FVS 插件），引用它的 25 张 demo 全是扩展图 demo——基建无基本授权图型可挂，**随付费族不追**。
  ③ **移动端（用户拍板不做）**：`com.fr.report.mobile.*`+`com.fr.form.ui.mobile.*` 共 4 类（Default/EmptyMobileParamStyle、DefaultMobileBookMarkStyle/ParameterStyle）；`com.fr.form.ui.reg.MobileReg`=**手机号校验**（表单验证基本功能）不在此列已 full。
- **边界核实（不误伤）**：其余 67 类（50 missing+17 partial）全数核到核心 jar=基本授权，**无其他收费插件依赖**。其中 10 个是版本包名差异非缺类：demo 记 `com.fr.report.web.ui.impl.page.PageNavi`/`com.fr.base.iofileattr.TemplateIdAttrMark`，引擎实际类为 `web.button.page.PageNavi`/`iofile.attr.TemplateIdAttrMark`（同功能跨版本改包名）。VanChartMapPlot/AttrMapLabel/VanMapMoreNameCDDefinition/VanChartHeatMapPlot（核心 heatmap 包）/PolyECBlock/PolyWorkSheet/ChartHyperRelateCellLink 全在核心 jar——**map/poly/heatmap 留账全做**。
- **工具链坑（本案当场踩）**：`unzip -l` 清单含非 UTF-8 类名（ISO-8859），Git Bash grep 默认按二进制**静默跳过**（-c 无输出不报错）——jar 类归属判定必须 `grep -a`；大 jar 清单先落盘再 grep，勿在命令替换里直连管道。
- **落地**：coverage_report.js `NONCORE_PAID`（14 包前缀 + extended.chart + 移动端两包）+ specialcharts 族收窄（Meter/KPI/CarouselPie 出键，余核心 HeatMap+已收 bubble）；coverage.md 重生成 **missing 135→91→54→50 / partial 17 / noncore 44**；头部留痕判据与拍板日期。
- **剩余工单（全在基本授权内）**：WriteActor DML 真提交、Verifier 家族、vmap GIS（核心图族）、Poly 块面、批B 渲染端四项、批D 字典凭据注入、SortHeader 语料、ChartHyperRelateCellLink、tooltip/axis/label 装饰深水区（AttrTooltipRichText 192/NormalDataModel 180/AttrBorder 93/VanChartAxis 92 是头部——均为常规图表自带装饰，属"基本授权有的内容"）。


#82 r10-A/B/C/D「Agent 创作链可靠性收口」落地批（2026-11-05，外部审查 r10.md 令执行；基准 main/e4ae950，四项 P1 逐条复现属实后动手；r10.md 入库）：
- **r10-A Artifact 可靠性（四项指控全修复+实证）**：① `artifactId = sourceType:outName@runId`（contracts.js runId 必填——同报表两次创建 ID 必不同）；② **每 verb 独立任务目录 `logs/agent/runs/{runId}/`**（discover/plan/compile/patch/validate/preview 产物全进 runDir，runId 由 fr_agent.ps1 生成或 -RunId 显式续跑；并发/串行 A/B 实测 compile.json 各归各 outName）；③ **防陈旧验收硬校验**（create_report/modify_report 检查 compile.json/patch.json/validate.json/preview.json 的 runId 与 AGENT_RUN_ID 一致，mismatch 即 exit 1——旧任务的 validate.json/preview.json 不可能混入本轮 Artifact；老固定路径 logs/agent/*.json 不再写=污染源头消灭）；④ **PS 退出码修正**（compile/patch/validate 分支 `exit $(if ($okAll) {0} else {1})`——compile rc=0 但 artifact 失败时不再 exit 0 掩盖）；⑤ **原子写**（agent/tools/_lib.js atomicWriteUtf：tmp+ATOMIC_MOVE）。
- **r10-B CapabilityManifest**：`application/capability_manifest.js`（一处真相，纯数据零 IO）——**四层状态** construction/serialization/rendering/agentAvailable（agentAvailable=四层全 verified 才 true）；chart/condition/write/page 四段 30+ 能力逐条带 README/probe 引证；批 B 渲染端待达三项（stack/label/conditionalSeries rendering=pending agentAvailable=false）、批 H sort rejected 全部如实标注。discover verb 输出加 `capabilityManifest` 全表 + `agentAvailable` 扁平名单——Agent 不会再把仅挂接完成的功能当已支持。
- **r10-C Planner 接入工具链**：fr_agent.ps1 加 **plan verb**（agent/tools/plan.js）——组装 Planner 五注入 ctx；前置改 **SemanticPreflight.run 统一检查**（与 make_api 同套证据指纹/时效 env 默认——ModelValidator 裸调会因 uniqueKeyEvidence 形状不对 UNSUPPORTED_RELATION_KEY 误拒，preflight.filter 归一才是对口径）；**术语归一胶水**（intent 业务词/label 经 resolver 归一为模型 name 再喂 planner 的成员校验，ambiguous/unknown 原样透传走 unresolvedQuestions——planner 本体零改动）；**业务命名 create/modify 入 ValidateSet**（内部映射 compile/patch，底层 verb 保留）。三态实测：SQL 日报 intent=ready（reportSpec 落盘）、rows '机台'=ambiguous（requiresConfirmation=true）、模型外指标=rejected。
- **r10-D 真实任务闭环（三场景，Agent 只调工具）**：① 生产日报——plan(ready)→reportSpec 自动落盘→create→validate（栅格自洽+外部真值 4238:2854 对拍）→preview 全 ok；② 图表报表——intent 带 presentation.chart → plan ready → create → preview ok；③ 已有模板修改——modify verb + PatchSpec（生产日报_I5闭环 换标题格）→ 结构 diff clean + 回归全过 → artifact ok=true。全程零人工 JSON 中间产物（reportSpec 由 plan 产出，PatchSpec 由 Agent 依 discover 契约生成）。
- **执行中暴露并当场修**：validate.js num() 丢失（重写漏带，首轮实跑 ReferenceError 当场修）；plan.js idx 先用后赋值；evidence 须走 preflight.filter 归一；/tmp 路径经 PS 环境传给 Nashorn 的 Windows 解析问题（改用仓内相对路径）。
- **门禁**：fast 13 GREEN（fast_contracts 扩 runId 唯一性+manifest 四层断言 9 项）、scan 48、R1–R8、负门 5 路 GREEN、默认 CBEB42E3 逐字节。


#83 r11/r12「Agent 创作链执行模型修正 + 可靠性收口」落地批（2026-11-05，外部审查 r11.md→r12.md 令执行；r12 对 r11 补充，冲突以 r12 为准；docs/gpt/r11.md+r12.md 入库）：
- **r12 执行模型（核心修正）**：任务可并发提交、独立 runId 目录、独立追踪，但 FineReport Runtime **单实例串行**（全局锁+队列+受控恢复）。基础设施 `agent/tools/runtime.ps1`——全局锁=`logs/agent/runtime/lock` 目录原子创建（跨进程互斥）；current.json 记持有者 runId+pid+startedAt；queue/done 任务态；history.log 事件流（ACQUIRE/RELEASE/RECOVER）；acquire 自旋取锁含陈旧持有者判定、release 幂等（非 owner 不释放）、status/recover。**Recovery 仅在确认 current pid 已死后才 kill+删 FineDB 锁**，abandoned run 标 failed/RUNTIME_LOST 绝不标成功（r12 §3 运行生命周期管理，非每次执行默认前置动作）。
- **fr_agent 接入**：compile/create、patch/modify 两条起 Runtime 路径经 `acquire → run.ps1 -NoKill → release` 包裹；run.ps1 加 `-NoKill`（agent 路径绝不误杀在跑的 JVM，kill 降格为 Supervisor Recovery 专用）；零引擎 verb（discover/resolve/plan/plan2spec/validate/preview）不取锁。
- **r11 收口**：r11-1 plan.js 双拼路径修复（删本地 readUtf 用 _lib 版，相对/绝对双验）；r11-2 patch 链 per-run staging（TEMPLATE_STAGING=runDir/staging，modify_report 读 pj.stagingDir）；r11-3 原子写修复（不预删目标+ATOMIC_MOVE|REPLACE_EXISTING 优先+失败清 tmp 保原目标；fr_agent WriteAtomic 统一 compile/patch.json）；r11-4 RunId 严格（comp.runId||'' 不等即拒缺 runId；PS GUID+_lib checkRunId 字符集白名单防穿越）；r11-5 manifest 升 **五层**（construction/serialization/rendering/**regression**/agentAvailable，agentAvailable=四层全 verified）+ product 段扩 spec/template/agent 覆盖 + plan preflight 按数据集类型分流（sql 跑/rows 跳）；r11-6 docs 全更新。make_api JSON spec 剥 BOM（外部 Agent 健壮性正解）。
- **★审查修复循环（r12 基线，三轮，独立复测非采信提交说明）**：
  - 轮1 **OwnerPid 根因**（复现确认）：acquire 曾记子进程自身 $PID（打印即退）→ 下一 acquire 误判持有者已死 → 错误 Recovery 杀在跑的 JVM；S2 侥幸只因 Job 启动延迟掩盖。修=acquire 记调用方存活 pid（-OwnerPid），fr_agent 传 $PID；活持有者下第二 acquire 实测 QUEUE_TIMEOUT 排队、history 无 RECOVER。
  - 轮2 超时幽灵排队项清理（waiter 放弃时删自己 queue 登记）+ 两视图机器可验证关系（rejected 能力绝不可 agentAvailable=true，fast 断言）。
  - 轮3 代码残留旧固定路径扫描（零）+ 文档一致性。
- **集成验收 `verify/integration_runtime.ps1`（覆盖 PowerShell/Nashorn/Application/FineReport Runtime 全链，JS 单测不可替代）S1–S8 全绿**：并发 create A/B 串行（maxLiveRuntime=1）、失败隔离、崩溃恢复（ghost 标 failed 非 success）、模板 staging 不串、plan sql/rows 分流、**S8 确定性并发**（活持有者 4s 内 create 无 compile.json=排队非并行，释放后自动跑成）。
- **门禁**：fast 13 GREEN（fast_contracts 扩 runId 唯一+manifest 五层+两视图一致断言）、scan 48、R1–R8、负门 5 路 GREEN、默认双铁证 CBEB42E3/A8EF39AB 逐字节。


#84 r13「Runtime Supervisor 正确性收口」落地批（2026-11-05，外部审查 r13.md 令执行；基准 main/1a6ca2d；r13 对 R12 深挖，冲突以 r13 为准；docs/gpt/r13.md 入库）：
- **两个并发 P1（复现属实→修复→故障注入证明）**：
  - **P1-A 锁初始化竞态（双获取）**：r12 先 `New-Item lock` 再写 `current.json` 两步非原子，waiter 在窗口见"锁在但 current 缺"→误判陈旧→删锁→**两个任务都以为持锁**。修=waiter **按 owner 身份判定生死，绝不因文件缺失删锁**：新增 `initializing`（lock 存在但 owner.json 未写且 lock 创建 < InitGraceSec=10s）态→只等待；`init_stalled`（超 grace 仍无 owner）→ 专门恢复（不杀 java，因无从确认任何实例）。S9 主动制造 init 窗口验证 waiter 不删锁不恢复。
  - **P1-B MaxLockAgeSec 误杀活任务**：r12 里 owner 存活但任务超 1800s 也判 stale→Recovery 杀在跑的 JVM。修=**年龄≠死亡**：`TaskSuspectSec` 只在 status 产 `suspect=true` 告警，**永不触发恢复**；生死只由 owner 身份（pid 存活 + StartTime 匹配）决定。S10 造"owner 存活但 acquiredAt 超 2000s"→recover 报 OWNER_ALIVE、lock 保留、suspect=true。
- **r13 其余收口**：① **OwnerToken**（acquire 生成/记录，release/recovery 必须校验，错 token 绝不删他人锁——S11）；② **恢复范围限定**（只杀 CommandLine 匹配 pipelineTag=make_api.js/patch_main.js 的 java，不再 `Get-Process java|Stop` 全杀；FineDB 锁仅在确认 owner 已死后删——S14 造无关 java 存活验证不误杀）；③ **runtimeState(queued/running/released/lost) 与 businessResult(pending/succeeded/failed) 正交**（release 只置 released，业务成败由 fr_agent 显式传 -BusinessResult，"执行权释放"≠"报表成功"）；④ **重复 RunId 策略**（在途 queued/running 拒 RUNID_INFLIGHT——S13）；⑤ **FIFO best-effort**（仅最旧 queued 尝试取锁）；⑥ **PID 复用防误判**（owner 身份 = pid + StartTime 双确认，P2-B）。
- **★审查修复循环（r13 基线，独立复测）轮1**：自查发现 **FIFO 饿死缺陷**——最旧 queued 等待者进程崩溃后其 queue 槽无人清理，年轻任务永远 defer 给它→饿死。修=queue 槽记 acquire 进程自身 pid，`Is-OldestQueued` 剔除并删除死等待者槽；新增 **S16 故障注入**（植一个 ownerPid=999999 的最旧幽灵槽，真实等待者应剔除它并成功获取）。又修一处边界：ownerStart 记为 -1（StartTime 不可读）时 `OwnerIdentityAlive` 会把活 owner 误判死→加 `>0` 守卫回退 pid-alive。
- **R12.3 工程收敛**：`agent/tools/config.ps1` 路径与策略单源（root/fr/java/nashorn/runtime dir/deploy/heap/超时）；run.ps1/runraw.ps1 改读 FR_HOME/FR_AGENT_HOME env；`docs/architecture/runtime-supervisor.md` 状态协议正式文档（存储布局/状态机/锁协议/不变量↔测试映射）；`verify/check_ps1_static.ps1` 静态门（PSParser tokenize 全脚本 + agent 工具 ASCII-only + runtime/fr_agent 无硬编路径）；`scripts/run-integration-tests.ps1` 统一门。
- **验收**：`verify/integration_runtime.ps1` **S1–S16 全绿**（真实全链故障注入：双获取/年龄/token/崩溃识别/重复 RunId/无关 java/三任务串行/饿死剔除）；静态门 failures=0；fast 13 GREEN、scan 48、R1–R8、默认双铁证 CBEB42E3/A8EF39AB 逐字节。
- **r13 原则落地**：不再扩 Runtime Supervisor 功能面（无任务中心/持久化调度/分布式队列/重试引擎）；每条关键不变量都有主动制造故障并证明系统正确拒绝的测试，而非以 GREEN 自证。


#85 r14「Runtime 与 Artifact 双边界审查」落地批（2026-11-05，外部审查 r14.md 令执行；基准 main/f432068；docs/gpt/r14.md 入库；6 P1+5 P2+三性质）：
- **架构级修正（Redesign From First Principles）**：互斥从"文件锁 + 时间启发式"改为 **OS 命名 Mutex（内核级）**，崩溃恢复从"时间/损坏判定"改为 **owner 身份（pid+StartTime）判定**。★关键实证：本机 `TerminateProcess` 后 Mutex 变**空闲**而非抛 AbandonedMutexException——故恢复检测**不依赖 abandoned 信号**，改在取锁后读 owner.json 判前手身份已死则 recover-previous（可靠、跨 abandoned 语义）。r13 的 InitGraceSec/init_stalled 时间回收（P1-B 会误删挂起但存活的持有者）彻底移除。
- **六个 P1 全复现→修复→故障注入证明**：① RunId 登记 TOCTOU→`FileMode.CreateNew` 原子独占（S18 并发同 RunId 严格一个赢，去"死 owner 回收"那会让重复非严格的启发式）；② release 身份不全→finalize 验 runId+ownerToken，owner.json 缺失→OWNER_STATE_UNKNOWN 非幂等（S19 损坏 fail-closed）；③ init 超 10s 误删活锁→身份判定（活持有者持 Mutex，WaitOne 阻塞，绝不因时间回收，S8）；④ owner 损坏误删→损坏不可解析即 fail-closed 不回收（S19）；⑤ JVM 恢复匹配偏宽→run.ps1 记 `runs/<runId>/java.pid`(pid+StartTime)，恢复只杀身份完全匹配进程（S14 双向：start 不符放过/精确匹配杀），CommandLine 匹配废除；⑥ Patch 证据缺失假通过→contracts.js executionFromPatch fail-closed（manifest/diffClean/execution/render 缺失即 ok=false，!==false 是根因；S17 + fast_contracts +8）。
- **P2**：queue 槽记 pid+StartTime 防 PID 复用永久排队；Planner 术语归一抽 `semantic/planner/termnorm.js` 纯函数按候选 target 契约映射（旧取不存在的 candidates[0].name 恒 undefined 静默失效），中文 label→规范成员端到端测（fast_planner +10）；测试脚本不再全杀 java，改身份化清理本 harness 记录的 java.pid；三脚本去硬编走 config/env 单源；run.ps1 预检有限重试（decommit 延迟，串行 create 不再瞬时 exit8）；文档同步 mutex 模型。
- **软崩溃安全网**：fr_agent finally 若 owner.json 仍指本 run（body 抛出未 finalize）→ 补 finalize failed，绝不留 phantom running 被误当成功。
- **验收**：`verify/integration_runtime.ps1` **S1–S19 三性质故障注入全绿**（互斥 S2/S4/S15·原子 RunId S18·崩溃恢复 S5·活锁不回收 S8·身份化杀 S14·损坏 fail-closed S19·patch 证据 S17）；真实 patch 端到端仍验收（fail-closed 未误伤）；静态门 failures=0；fast 13 GREEN、scan 48、R1–R8、负门 5 路、默认双铁证 CBEB42E3/A8EF39AB 逐字节。
- **r14 原则**：不扩 Runtime 功能面（无任务中心/持久化调度/分布式队列/重试引擎）；转向验证更底层并发不变量——每条不变量配主动制造故障并证明系统正确拒绝的测试，不以 GREEN 自证。三性质（互斥安全/恢复安全/结果可信）站稳。


#86 r15「Runtime 与 Artifact 双边界审查·自研基础设施减法」落地批（2026-11-05，外部审查 r15.md 令执行；基准 main/f7c8d74；docs/gpt/r15.md 入库）：
- **架构决策（先核对代码再断言可删，r15 §5）**：全仓扫描确认 queue/owner.json/OwnerToken/done/recover-previous 仅 runtime.ps1+fr_agent.ps1 自用、无外部依赖 → 四决策表：保留 OS Named Mutex + java.pid（FineReport 特有边界）；替换 owner.json→薄 active.json（仅身份）；删除 queue/、OwnerToken、RUNID_INFLIGHT、done/记录、runtimeState/businessResult、recover-previous 独立动作、FIFO；补充 enter 遗留进程身份检测（确认孤儿→身份杀；不可确认→拒绝）。
- **关键洞见（r15 §3）**：Mutex 被 OS 释放 ≠ Java 进程退出——PowerShell 宿主崩溃后 Java 子进程可能仍存活占 FineDB。故恢复走**进程身份（pid+StartTime）**判定，不依赖 abandoned 信号（本机实测 TerminateProcess 后 Mutex 变空闲不抛 AbandonedMutexException）。活持有者/损坏哨兵→RUNTIME_BUSY 拒绝（fail-closed，绝不为"恢复"清哨兵或起第二个 FineReport）。
- **薄执行器流程**（r15 §4）：WaitOne→enter(遗留检测)→claim(active.json 身份)→run.ps1(-NoKill,记 java.pid)→create/modify_report→release→ReleaseMutex。无 register/finalize/OwnerToken/queue。
- **★审查发现（故障注入的价值兑现）**：S5 崩溃恢复测试抓到 `IdentityAlive([int]$pid,…)` 参数撞 PowerShell 自动变量 `$PID`（只读）→赋值 VariableNotWritable→身份判定失效→孤儿 Java 没被杀——**与 r13 OwnerAlive 完全同款陷阱**，正因先造验证器（S5 主动制造"前手崩溃+孤儿 Java 存活"）才当场暴露。修=参数改名 $procId。另 FR_AGENT_HEAP env（embedded 无 j2v8，测试低堆保确定性）。
- **保留的非基础设施（领域逻辑，非调度）**：contracts.js patch/create fail-closed、termnorm.js 候选契约归一、capability_manifest 五层——r15 只减自研调度基础设施，不动这些解决报表特有问题域的逻辑。
- **验收**：`verify/integration_runtime.ps1` **S1–S17 全绿**（互斥 S2/S4/S15·孤儿身份杀 S5·放过 S14·活锁拒绝 S6·损坏拒绝 S16·排队 S8·patch 证据 S17）；静态门/fast13/scan48/R1–R8 GREEN；真实 create/patch 端到端仍验收；默认双铁证 CBEB42E3/A8EF39AB 逐字节。


#87 r16「Runtime 与 Artifact 双边界交叉验证」落地批（2026-11-05，外部审查 r16.md 令执行；基准 main/f7c8d74；docs/gpt/r16.md 入库；r16 审的是 R14 代码，逐条对照 R15 当前态定适用性）：
- **交叉验证结论**：r16 多数 P1 针对 R14 的 queue/owner.json/OwnerToken/recover-previous/FIFO——R15 已删；但逐条核对一手代码后确认 **5 项仍适用于 R15**，全部修复：P1#1 patch 路径 runraw.ps1 裸 `& java` 不记 java.pid（孤儿 JVM 无从定位）；P1#2 `enter` 仍可独立调用杀 JVM（绕过互斥）；P1#3 损坏 owner 只在独立 recover 测、未测真 create；P1#4 集成测试 Reset-Rt 清**生产** runtime 目录（测试与真任务并发会互删状态）；Kill 异步未 WaitForExit（孤儿 java 没确认退出就起新实例→FineDB 冲突）。
- **P1#1 统一 Java 启动**：新 `engine_launch.ps1`（run.ps1/runraw.ps1 共用，消除 classpath 重复；FR_AGENT_JAVA_PIDFILE 时走 Start-Process 记 pid+StartTime）→ patch 路径也记 java.pid。★**审查中发现并修 rc 传播回归**：函数把 java stdout + "EXIT=" 串泄进管道，`$rc = Start-EngineJava` 捕成数组→`exit $rc` 退化 exit0→负门 json-bad-spec 假绿；修=函数只 return rc、java 输出走 Out-Host/文件、run/runraw `exit (Start-EngineJava)`。
- **P1#2 恢复只在主流程**：enter 折入 fr_agent Invoke-UnderMutex（WaitOne 后、持锁内做遗留检测+身份杀+claim/release）；runtime.ps1 降为**只读 status**，无独立危险恢复入口（r16「恢复只能由持有执行权的主流程内部完成」）。
- **Kill 异步**：`Kill-OrphanJvm` 用 Process.Kill()+WaitForExit(15s)，返回 gone/killed/spared/stuck——spared（PID 复用非我 java）放行不杀、stuck（杀了没退出）拒绝启动（绝不与未确认退出的孤儿并发）。
- **create/modify_report 移出锁**（r16 §3 缩短持锁）：纯 JS 验收不碰引擎，移到 ReleaseMutex 之后。
- **P1#4 测试隔离**：config 加 `FR_AGENT_RUNTIME_DIR`/`FR_AGENT_MUTEX` env，集成测试用 `logs/agent/_it_runtime` + 独立 mutex，绝不清生产 runtime；启动只按 it_*/java.pid 身份清自己遗留 java，不扫全 java。
- **P1#3 fail-closed 真路径**：损坏 active.json/活 owner → 真 create 返回 RUNTIME_BUSY、不启动、不清哨兵（S6/S16）。
- **AbandonedMutexException 最小实验**（r16 §5 要求一手验证非采信文档）：本机实测 TerminateProcess 后下一 WaitOne 返回 True **不抛异常**→证实"恢复不能靠 abandoned 信号、必须靠进程身份"，R15/R16 设计正确。
- **验收**：`verify/integration_runtime.ps1` 重写为真 create/patch 路径故障注入 **S1–S17 全绿**（S5 崩溃孤儿身份杀·S5b patch 也记 java.pid 并杀·S14 身份不符放过仍继续·S6 活锁拒·S16 损坏拒·S8 排队·S15 三并发串行+隔离·S17 patch 证据 fail-closed）；合并全门一次跑通 GREEN：STATIC0/INTEG0/FAST13/SCAN48/R1-R8/负门5路/默认双铁证 CBEB42E3·A8EF39AB 逐字节。
- **r16 原则**：Runtime 不再扩功能面；互斥只信 OS Mutex、恢复只信进程身份、结果只信完整证据。三性质（互斥/恢复安全/结果可信）经故障注入站稳。


#88 r17「Runtime 身份/异常退出五 P1 + 两 P2 边界收口」（2026-11-05，外部审查 r17.md 令执行；基准 main/6ae6364；docs/gpt/r17.md 入库；评审确认 R16 不回滚、R17 只修边界不再造基础设施，全部修复落在 .NET/Win32 原生能力内无新组件）：
- **P1-1 验证与击杀必须同一 Process 对象**：r16「先查一次→再按 pid 重新 Get-Process→Kill」在 PID 复用窗口第二次查可能拿成无关进程直接杀；`_identity.ps1 Get-ClassifiedProcess` 一次取对象、读**该对象** StartTime、命中才在那一个对象上 Kill+WaitForExit（.NET Process 持原句柄，复用 PID 永不可能被误杀）。
- **P1-2 三态身份取代 bool/-1**：alive/gone/unknown——「无法确认」（权限读不到 StartTime、查询失败非找不到进程、哨兵值损坏）一律 unknown → RUNTIME_BUSY 拒绝；废除 ProcStartTicks 把一切异常折成「-1=已死」的假 GO。★**实机指纹**（首轮集成 S2/S5/S5b/S14/S15/S20 六项 FAIL 抓出的回归自纠）：PS 5.1 `Get-Process -Id` 对不存在 pid 回抛 ProcessCommandException（FQID=`NoProcessFoundForGivenId`），typed catch 类型名不可靠→掉泛 catch→unknown→成功 run 的哨兵 HOLD 泄漏→下一次 create 全部 RUNTIME_BUSY——根因不是"恢复逻辑错"而是"找不到进程"被误判 unknown；分类改按稳定错误指纹字符串判定，重跑全绿。
- **P1-3 java.pid 登记前移**（engine_launch.ps1）：spawn 前先写 `PENDING`，Start-Process 成功后立即覆盖 pid+start，spawn 抛则撤登记——宿主在「已起、未登记」窗口被杀时留下 PENDING=身份未知=下次**拒绝启动**（把「无身份双 JVM 并发」收缩为「安全拒绝」）；Windows Job Object 按审查建议评估过、**未引入**（现有 .NET/Win32 已够且 r17 禁止新增运行机制）。
- **P1-4 java.pid 四态**：absent（从未登记=从未起→gone）/ pending（spawn 窗口崩溃）/ corrupt / unreadable——后三者一律 unknown 拒绝；r16 把「pidfile 有垃圾」当「无进程」与损坏 active.json 拒绝口径不一致。runtime.ps1 status 同步三态化（只报 live/gone/unknown，仍只读无动作）。
- **P1-5 哨兵只在确认 Java 退出才清**（fr_agent finally）：release 前先 `Confirm-RunJavaGone`——只有 pidfile absent（从未起）或 recorded java 确认已退出才清 active.json；不能确认（alive/pending/corrupt/unreadable）→**保留哨兵** + history 记 HOLD，让下一次任务拒绝或按身份恢复，绝不「本进程看不到哨兵=没有遗留」。
- **P2-1 RunId create-new 独占**：显式重复 RunId → `RUNID_EXISTS` 拒绝（New-Item 无 -Force 作并发窗口兜底）——消除 r16「第二次同 RunId 调用覆写同目录 compile.json/patch.json + Mutex 外 artifact 组装读到交叉数据」污染路径（GUID 默认只降低概率，显式重复必须硬拒）。
- **P2-2 验收诚实口径 + 真宿主崩溃测试**：S5/S5b 明示为「decoy 构造遗留态 → 恢复**路径**」验证（README 此前「崩溃恢复全绿」的准确含义）；新增 **S20 真宿主崩溃**——活 powershell 宿主起引擎（java 已记真身份）后 TerminateProcess 宿主，真孤儿 Java 存活+哨兵留存，下一次 create 按身份杀孤儿并正常完成（非 decoy、非预置状态）；新增 S21（corrupt pidfile → 拒、decoy 无敌杀）/ S22（PENDING → 拒）/ S23（显式重复 RunId → 拒）。
- **MaxLiveRuntime 定性修正**：history.log 是自报诊断不是内核互斥证明；互斥性证明 = S2/S4/S15 串行结果 + 同一时刻只有一个引擎 JVM，背书是 OS WaitOne 语义（验收表文档同步）。
- **门**：STATIC 0（engine_launch.ps1 纳入 PARSE/ASCII 清单）/ 负门 5 路 GREEN / 默认双铁证 CBEB42E3·A8EF39AB（+ 6161F402 模板基线）逐字节复查 / 集成门 failures=0（S1–S23）。
- **r17 原则**：R16 架构保留不回滚（OS Named Mutex/.NET Process/统一 Java 启动器/薄 active.json/Artifact 契约五件套）；不新增状态目录、Token、调度器或恢复命令；**身份「无法确认」永不当作「已消失」；验证与击杀同一对象；RunId 只登记一次（显式重复硬拒）**。


#89 coverage 看板对齐增强（2026-11-05，"批次归属≠实现状态"错位收口——A 表参考批次逐类补全 + 新增 D 表批次↔探针对齐）：
- **动机**：A 表 40+ 条目"参考批次"列是"(漏账：批排期时人工归入)"——旧 batchOf 只认家族键全等，批次归属残缺；外部统计确认"参考批次=排期归属，不等于探针已认到实现"需机器可见对齐。
- **版本包名差异 10 类逐一坐实**（非印象，引擎源码一手）：First/Previous/Next/Last/PageNavi 引擎= `com.fr.report.web.button.page.*`、Export/Print/FlashPrint/Email = `web.button.*`（object.js TOOLBAR_BUTTONS 1137-1149）、TemplateIdAttrMark = `iofile.attr.*`（object.js:904）——demo 记 `web.ui.impl.*`/`iofileattr` 为旧包名，**功能非真缺**（#81"10 个版本包名差异"点名全对上）。
- **A 表归属补全（README 引证，不硬编）**：#600 工单头部 4 类（AttrTooltipRichText 192/NormalDataModel 180/AttrBorder 93/VanChartAxis 92）→"批B后继(#600 工单头部,未排)"；tooltip/axis 装饰域→批B后继；map/heatmap/热链 9 类→批I(挂账,#79)；Poly 2 类→批J(挂账,#80)；write 族 8 类+Verifier 族→批F后继(#75 挪章/#558/#600)；Database|DynamicSQLDict→批D(凭据注入工单,#539)；ObjectCondition→批A(定性,#45)；10 版本差异→"既有·版本包名差异(#81 已核)"。**真漏账只剩 9 类**（ChartCommonCondition/组合图/MultiFileEditor/表单树/CustomToolBarButton/ExcelTableData/RecursionTableData/DataSetDefinition/FileAttrErrorMarker）——无 README 批定义背书，保留显式"漏账·域(需批定义后归属)"标记不硬编。
- **D 表（批次↔探针对齐）**：按批次码聚合家族键 full/missing + 类级账 partial+missing——批B=3+21、批F=1+8、批I=0+9（map/heatmap/热链全挂账）、批J=0+2、既有=10（版本差异类）、漏账=0+9；**当场暴露一处真错位**：批E 家族键仍挂 Commit2DBJavaScript 缺失而类级账已按 #75 挪批F——对齐表价值即在此。
- **ALIGN 哨兵输出**：`ALIGN: batchAttributed=58 unattributed(漏账)=9 of 67`（★口径=missing+partial 67；曾把 full 兜底类算进漏账导致假 51，已修）。
- **数字零漂移**：missing=50 partial=17 noncore=44 与基线一致；B/C 表逐行未动（标记行仅平移）；两次连续重生成内容一致（幂等，除时间戳）。
- **修改面**：`probes/coverage_report.js`（BATCH_CLASS 67 项映射+A 表头对齐口径+D 表+ALIGN 统计）与再生成 `docs/architecture/coverage.md`；运行时链路零改动（与并行 r17 修复线完全解耦）。


#90 r18「Runtime 严格身份与登记失败收口」（2026-11-05，外部审查 r18.md 入库（docs/gpt/r18.md）两 fail-open P1 + 三项收口；基准 main/220ce61；评审确认 R16/R17 架构保留、只修现场缺口不扩架构，无新组件）：
- **P1-① 整数可解析垃圾 ≠ 身份（fail-open 修复）**：`Read-JavaPid` 严格四条——**恰好两字段、pid>0、start>0**，不合者一律 corrupt=unknown=拒绝（r17 只查「能转成整数」，`1234 -1` 曾解析成 ok 后按 pid-only 降级：pid 撞上任一活进程即**误杀**，pid 无主则带幽灵身份照跑任务）。`Get-ClassifiedProcess` 加 **requireStart** 参数：Java 击杀目标禁 pid-only 降级（expectStart≤0 → unknown 拒），owner 语义（ownerStart=-1 → pid 存在即保守 alive）**保留且两者永不混用**。TDD 红探针实读：五变体 `1234 -1`/`1234 0`/`0 123456789`/`-1 123456789`/`1234 123456789 extra` 在 r17 代码下全部以幽灵身份放行（红实录拷贝存 logs）→ 修复后 S21 六变体全绿。
- **P1-② spawn 前后失败分道（fail-open 修复，审查最优先项）**：旧代码 PENDING 写+spawn+身份登记共享一个 catch——spawn 成功后 StartTime 读取失败会写 `pid -1` 伪身份（重新触发 P1-①）、pidfile 覆盖失败会删 PENDING → fr_agent `Confirm-RunJavaGone` 读到 absent → **清哨兵 → 下一次起第二个 JVM**，正面击穿 r17 核心承诺。修=①PENDING 写+`Start-Process` 独立 try：此刻任一失败=确实没有 java，撤登记合法；②spawn 成功后的登记失败一律走 **`Collect-UnregisteredSpawn`**（engine_launch.ps1 新函数）：在已持有的同一 Process 对象上 Kill+WaitForExit，**确认退出才清登记，否则 PENDING 留守**（下一次拒绝）；③StartTime 失败绝不写 `pid -1`。验收双路注入：**S25** 端到端（pidfile 落缺失盘符 → rc≠0 且按命令行身份查证无 decoy java 泄漏——不数全机 java，另一会话并发任务不算我们的）+ **S26** 白盒（真 java confirmed→清登记 / Kill 抛 stub / WaitForExit=false stub → PENDING 留守）。TDD：S26 预跑实红（函数不存在）→ 修复后三分支绿。
- **P1-③ Mutex 作用域定界（运行契约）**：Mutex 名无 `Global\` 前缀 → 落 **Local（每 Windows 登录 Session）** 命名空间；运行契约定为**单 Session**（产品现状：同机同交互会话的所有调用方），跨 Session 消费者（计划任务/服务/其他登录会话）**不在保护内**，须先评估 `Global\`+ACL 再谈——按审查建议不引入复杂锁协议，只把边界写进 `docs/architecture/runtime-supervisor.md` §0 + config.ps1 注释。
- **P2-④ RunId 并发独占实证**：新 **S24** 两个独立 powershell 进程抢同一 RunId——恰一 `"ok":true`、另一 `RUNID_EXISTS`（New-Item create-new 语义在 OS 层单赢），「create-new 原子独占」从注释宣称升级为实测证明。
- **run.ps1 全杀 java 使用边界声明**：手动门专用路径（agent 路径一律 -NoKill）仍 `Get-Process java|Stop-Process`——**机器级副作用**，与同机任何 java 互斥；同一台机并行跑两路引擎任务会互相污染（本轮实录：负门 db-conn 首跑被另一会话并发引擎竞态打出 exit=3 FineLifecycleFatalError + 孤儿 db.lck 残留，重跑即绿——入档为已知运维边界，agent 链路不受影响）。R18 不改此行为，仅声明边界。
- **门**：STATIC 0 / FAST 13 套件绿 / SCAN 48（bad=0）/ R1–R8 干净 / 负门 5 路 GREEN / 默认三铁证 CBEB42E3·A8EF39AB·6161F402 逐字节 / 集成 **S1–S26 failures=0**（含 S20 真宿主崩溃孤儿按身份击杀复验：orphan 456 killed）。
- **r18 原则**：R16/R17 五件套保留不回滚；不新增状态目录、Token、调度器或恢复命令；新增不变量——**参与 Kill 的身份必有 start>0（owner 除外且永不混用）；「已启动」之后的任何登记失败不改变事实（确认退出才清登记或 PENDING 留守）；互斥只信单 Windows 登录 Session 内的 OS Mutex。**


#91 r19「文件状态四分类与收集器自退竞态」（2026-11-05，外部审查 r19.md 入库（docs/gpt/r19.md）一 P1+两 P2；基准 main/6a73463；评审确认 R16/R17/R18 架构继续保留、只修三个现场问题不扩范围）：
- **P1 Test-Path 的 false 不承担 absent 判定**：`Test-Path`/`File.Exists` 把访问错误折叠成 false——被独占锁住/畸形路径/权限故障都可能"谎报不存在"，若采信就会在真实遗留 JVM 还活着时跳过哨兵检查、claim 执行权起第二个 JVM（直接击穿单实例承诺）。修统一 `agent/tools/_identity.ps1 Get-FilePresence`（.NET File.Open，FileShare=ReadWrite 不干扰正常共存读写）：**absent**（FileNotFound/DirectoryNotFound=确实不在）/ **readable**（可读→继续解析）/ **unreadable**（存在但拒绝访问→拒）/ **unknown**（共享冲突、畸形路径等其他 FS 错→拒）——只有 absent 允许按"无哨兵/无登记"处理。三个调用点全换：`Read-JavaPid`（java.pid 存在性，替代 Test-Path）、`fr_agent Invoke-UnderMutex`（active.json 哨兵，unreadable/unknown 直接 RUNTIME_BUSY）、`runtime.ps1 status`（分类透出 UNREADABLE/UNKNOWN/CORRUPT）。★**PS 5.1 套娃陷阱第 N 张面孔**（红探针实读）：.NET 方法异常被包成 `MethodInvocationException`、真异常藏在 **InnerException**——typed catch 判类型前必须解一层；r17 的"typed catch 不可靠"教训在 .NET 方法面重演，分类按解包后的真实类型名分层。TDD：S27 函数缺位实红 → 四态白盒（absent/readable/独占锁 unknown/畸形路径 unknown，并顺带实证 Test-Path 对畸形路径谎报 false）+ S27b 黑盒锁哨兵防退化（RUNTIME_BUSY 不清）。
- **P2 Collect-UnregisteredSpawn 自退竞态**：JVM 在回收前已自然退出时 `Kill()` 抛 InvalidOperationException——r18 旧单 catch 把这个"已确认退出"的好结局判成 kept-pending，哨兵 HOLD 留守 → 下一次 RUNTIME_BUSY 恶循环（安全方向保守错、但制造人工恢复负担）。修=**Kill 的异常只是提示，退出才是裁决**：吞 Kill 任何异常、统一由 WaitForExit(15s) 裁决——确认退出才清登记，否则保留 PENDING。TDD：S26 新增分支 D（Kill 抛 InvalidOperationException + WaitForExit=true stub）在 r18 代码下实红 kept-pending → 修复后 confirmed、登记落空；原三分支（真 java confirmed / Kill 抛 stub 留守 / Wait=false 留守）语义不回归。
- **P2 故障注入确定性**：S25 弃用 `Q:` 盘依赖（换机不可靠），改**把 pidfile 父路径预先创建成普通文件**——目录创建/登记必然失败，零环境依赖；断言不变（rc≠0 + 按命令行身份查证无 decoy java 泄漏）。S24 诚实化注释明确 300ms 启动错位**不能严格证明**命中竞争窗口（本轮按审查"以后有机会"保留，不扩范围）。
- **S21 十变体**：在 r18 六变体上补**多连续空格 / 制表符分隔 / PID 超 Int32 / StartTime 超 Int64** 四条格式边界（解析层 TryParse 失败或字段数≠2 一律 corrupt，铁证区域零放宽）。
- **门**：STATIC 0 / FAST 13 套件绿 / SCAN 48（bad=0）/ R1–R8 干净 / 负门 5 路 GREEN（本轮一次跑过，无并会竞态） / 默认三铁证 CBEB42E3·A8EF39AB·6161F402 逐字节 / 集成 **S1–S27 failures=0**（S20 真宿主崩溃复验：orphan 37800 killed；S21 x10；S26 四分支；S27+S27b 双线）。
- **r19 原则**：R16/R17/R18 五件套与薄执行器不动；不新增状态目录/Token/调度器；新增不变量——**「文件状态无法确认」永不当作「不存在」（哨兵与 pidfile 一体适用）；Kill 的成败不裁决 PENDING 去留，WaitForExit 的退出才是裁决。**


#92 r19 收尾轮「runtime.ps1 穷尽状态映射 + unreadable 分支证明」（2026-11-05，收尾审查入 r19.md（docs/gpt/r19.md 附「收尾审查」节，逐字）；审查确认 R19 两 P1 实质修好、架构零倒退、只修两项收尾）：
- **P2 runtime.ps1 status 穷尽映射**：`Read-JavaPid` 六态（absent/readable→ok/pending/corrupt/unreadable/**unknown**）但 status 的 if/elseif 链没有 unknown 分支——锁定状态的 java.pid 被**误显示为 absent**（红探针实读：`javaState:"absent"` ← file='unknown'），与「文件状态无法确认≠不存在」新原则自相矛盾；虽是只读诊断层不直接引发双 JVM，却会把运维引向正好是 fail-closed 契约最在意的现场。修=switch 穷尽映射 + **default→'unknown'**（未知状态值也绝不落 absent 初值）——行为变白盒红→绿实读验证。
- **P2 S27e unreadable 分支证明**：四分类唯一没有专项测的分支。确定性注入=**`icacls /deny *S-1-1-0:(R)`（Everyone 拒读）**——显式 Deny ACE 先于任何 Allow（含继承），且默认令牌的 SeBackupPrivilege 处于停用态、普通 `File.Open` 无 backup flag 不走备份语义→**管理员/提升运行也成立**（审查点名的不确定性诉求）；验后 `/remove:d *S-1-1-0`（owner 隐含 WRITE_DAC 必能还原）+删文件清理。断言 `Get-FilePresence == 'unreadable'`（绝不折叠成 absent）。
- **P3（审查评定暂不阻塞）**：Get-FilePresence 先检查后由调用方读取的两开窗口——读取失败本就按 unknown 保守拒绝，留账**后续统一读取接口**（一次打开返回内容），本轮不动。
- **门**：STATIC 0 / FAST 13 套件绿 / SCAN 48（bad=0）/ R1–R8 干净 / 负门 5 路 GREEN / 默认三铁证 CBEB42E3·A8EF39AB·6161F402 逐字节 / 集成 **S1–S27+e failures=0**（IT FAIL=0：S26 四分支·S27 四态+S27b 黑盒·S27e unreadable·全绿）。
- **收尾裁定**：Runtime 冻结（薄执行器五件套不动）；既有边界继续：互斥=单 Windows 登录 Session；手动 run.ps1 全杀 java 机器级副作用、agent 路径一律 -NoKill。
