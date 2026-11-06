# FineReport 无头渲染管线（D:\fineagent）

> 📚 本文件已瘦身（2026-11-06）：#36-#106 逐轮全文归档于 **docs/history/README-full-2026-11-06.md**（grep 历史事实用它）；叙事亦在 git log / docs/night-shift-log.md / docs/gpt/。本文件只保留稳定事实 + 索引 + 当前口径。

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

---

# 编号事实库索引（#36-#106，一行一条）

全文逐字归档：`docs/history/README-full-2026-11-06.md`（条目号 grep 可查）；提交叙事=git log；逐轮审查=docs/gpt/r1~r24.md。

- #36 打开直出三案
- #37 生产画像双源 + colSpec v2
- #38 机台筛选 + 表头 toml 映射 + 导航去键序
- #39 TRY_CAST 非确定性 → 计算列/索引拒绝
- #40 4936 二次复发 → CASE 守卫表达式定案
- #41 每表增加「机台」列
- #42 字符串日期列直索引
- #43 大表打开 10s 定案
- #44 按天 TOP 最后一环
- #45 lib 能力族扩容 v4.0/v4.1
- #46 VanChart 画区地板定案 + j2v8 原生崩连环事故
- #47 -Xmx 限堆入库 + 提交额度预检 + 乱码修复
- #48 外部审计修复批
- #49 迭代 1「可靠性修复」落地批
- #50 迭代 2「IR 稳定化」契约批
- #51 迭代 4 地基·稳定机器调用入口
- #52 迭代 3 真实报表 + 迭代 4 现成 Agent
- #53 总计划 r1.md 对照主分 + 分层验证体系落地为持久资产
- #54 r2.md I0「可靠性收尾」全量落地批
- #55 r2.md I1「ReportSpec 结构化输入接口」落地批
- #56 r2.md I2「Schema Inspector 数据库结构检查器」落地批
- #57 r2.md I3「轻量 Semantic Model」落地批
- #58 r2.md I4「Report Planner 确定性接口层」落地批
- #59 r2.md I5「自然语言→真实 CPT 完整闭环」落地批
- #60 r2.md I6「已有 CPT 受控局部修改
- #61 r3.md「I5.1 模型驱动 SQL 正确性加固」落地批
- #62 r3.md「I5.2 多表 JOIN + I5.3 报表表达力」落地批
- #63 r4.md「正确性收口」落地批
- #64 r5.md「证据可信度 / 回归门真实性」落地批
- #65 r6.md「证据身份 / 探针原子性 / 数据可信度 / 视觉回归」落地批
- #66 r7.md「探针原子性 / 关系完整性 / 指纹强度 / Inspector 严格语义」+ Agent …
- #67 r8.md「全局架构审查」执行批
- #68 r8 A2 前置「五类报表新旧路径对照」
- #69 r8 A2 收尾「日报类双路径全等」
- #70 demo240 能力覆盖率看板落地
- #71 批A 条件属性满血
- #72 批B 图表装饰层
- #73 批C 页眉页脚 + 模板级 attrMark
- #74 批D 字典族 + 日期/文本格式
- #75 批E 事件 JS 体系
- #76 批F 填报章·序列化面
- #77 批G 小特性扫荡
- #78 批H CellSortAttr 排序墙重攻
- #79 批I 图表族扩容·vbubble + 地图/极端族定性
- #80 批J 聚合报表 Poly 定性 + demo 车道阶段收官
- #81 范围圈定
- #82 r10-A/B/C/D「Agent 创作链可靠性收口」落地批
- #83 r11/r12「Agent 创作链执行模型修正 + 可靠性收口」落地批
- #84 r13「Runtime Supervisor 正确性收口」落地批
- #85 r14「Runtime 与 Artifact 双边界审查」落地批
- #86 r15「Runtime 与 Artifact 双边界审查·自研基础设施减法」落地批
- #87 r16「Runtime 与 Artifact 双边界交叉验证」落地批
- #88 r17「Runtime 身份/异常退出五 P1 + 两 P2 边界收口」
- #89 coverage 看板对齐增强
- #90 r18「Runtime 严格身份与登记失败收口」
- #91 r19「文件状态四分类与收集器自退竞态」
- #92 r19 收尾轮「runtime.ps1 穷尽状态映射 + unreadable 分支证明」
- #93 r21「status 调用链回归自纠 + 黑盒持久回归」
- #94 最终冻结裁定
- #95 Golden E2E v1 范围收敛 + 机台级真值资产
- #96 golden v1 开跑前收齐
- #97 r22c 开跑阻断项
- #98 ☆☆☆ GOLDEN v1 第一次真实端到端运行
- #99 r23 同 RunId 并发重入竞态闭口
- #100 r24 并发测试确定性化 + patch 路径验收 → Runtime 收尾正式关闭
- #101 批B 渲染端四项收案
- #102 批B 词汇+装饰扩容一发
- #103 批B axis 群收案
- #104 批B 头部类收案
- #105 缺口归属清零（unattributed 9→0；≠missing 已实现）+ 批H 定性 + 批I R0 翻案
- #106 审查修复环轮 1 + 幽灵键勘误 + FineDateFormat 收案
- #107 审查轮 2 收敛：P1-A/P1-B 契约修复 + Golden 栅格回归 + 文档整理（详见 docs/night-shift-log.md）
- #108 能力闭环专项审计（只读）：三层 Coverage/Manifest/Agent 逐项对账 → `docs/architecture/capability-closure-audit.md`
- #109 闭环审计实施：证据对账器/manifest v3 regressionScope/Golden E2E 自动复证/视觉验证（详见 docs/architecture/capability-closure-audit.md §6）
- #110 验证工具自身修正（外部审查 v2）：对账器键覆盖/scope 一致性/Coverage 交叉 + Golden 逐格真值+modify 离线核验器 + fixture 自给（详见同文档 §7）
- #111 run.ps1 提交额度预检删除（用户拍板）：#46 原生崩前提=未限堆 6G，限堆 -Xmx 是主防线；预检在小堆误拦（1776MB 提交剩余下 -Xmx400m 可跑）。保留 -Xmx 上限，失败由 JVM/原生非零退出 fail-closed 暴露
- #112 验证入口可靠性四项收口（外部审查终轮）：Golden 真值缺失必须失败（REQUIRE_TRUTH）/ Fast Golden 入库 fixture（干净 clone 可过）/ Manifest 检查器定位为静态一致性检查 / 视觉 fixture 支持 FR_AGENT_HOME
- #113 能力矩阵与路线图（docs/architecture/capability-matrix.md）：七源对账+六维评分+P0-P3 排序+前三项；第一项「合并行/多层表头（IR cells rowSpan）」已实施（ir.js:545 + object.js 传 spanR/多行游标 + 载体 test_merge_header + PNG 实拍）
- #114 R3-0 收尾：rowSpan 游标缺陷修复（合并格曾被覆盖丢失）+ IR 整数闸/块内重叠静态拒 + 7 场景断言 + 真引擎载体；矩阵口径修正（cells 合并 vs header 多层拆行、Agent 可用=待验证、频率 103/240 文件）
- #115 Native Capability Inventory（docs/architecture/native-capability-inventory.md）：五层差集（Engine/CPT+Object/IR/ReportSpec/Agent）+ A/B/C/D 四份清单；核心结论=最大金矿是 B 类（IR 已有但 ReportSpec 无入口：条件高亮/参数面板/cells 族/页眉页脚），A 类确证仅多 Sheet；确立原则=不做 FR 重实现，只做语义接口层
- #116 C 类两项裁定/实施：C1 TemplateInfoAttrMark 探针更正为 cloud 插件类（com.fr.plugin.cloud.analytics.attr.*，core 包无此类→noncore 不追）；C2 隐藏行列三层打通（IR sheets[].hideRows/hideCols 整数闸 + object 于 sheet 构建末归零行高/列宽 + ReportSpec sheet.hideRows/hideCols）——rawIR 载体与 spec 载体均真引擎跑通（RowHeight[1]=0/ColumnWidth=0，PNG 表头行与列消失），fast 5 套件/scan 55 ok/基线 MD5 CBEB42E3 不变
- #134 集成门复跑 + backlog 卫生：run-integration-tests S1–S28 GATE GREEN（make_api 改动后纪律）；B-审查3-3 fixture 3 列对齐；fast15 rc0
- #133 管线全局覆盖守卫：make_api 快照 J_FACTORY，载体 load 后若覆盖全局 J → input_load failed + 明确诊断 + fail-closed（负门实测 exit 2）；全量扫 reports/ 仅 test_visual_deco 一处已改 JF；fast15 rc0/铁证 CBEB42E3
- #132 seriesImage 判别实验+载体修复：test_visual_deco 覆盖全局 J 致 rc=102（P1 测试 bug）改局部 JF；fixture 改 16×16 品红/白棋盘做判别（纯色与默认柱色同色）；部署 cpt ImageBackground 在而 PNG 柱仍纯蓝 → rendering 维持 pending（证据升级为判别性阴性）；fast15 rc0/scan58 ok
- #131 barInterval 宿主精确化（backlog B-审查3-2 完成）：反射+部署 cpt 一手定案——真正落 XML 的宿主只有 vbar（legacy Bar2DPlot setter 在但 writer 不序列化）；IR 仅 vbar 放行、其余 kind 拒；object 改 setter 存在性守卫；载体 test_barinterval（categoryIntervalPercent="25.0"）；rebuild_first 移除伪键；fast15 rc0/scan58 ok/铁证 CBEB42E3
- #130 名称 map 无原型加固：params seenNames / IR dsIdx / param pnames 改 Object.create(null)，两个 __proto__ 参数名现 DUPLICATE、__proto__ 参数可被 filters 引用；fast+2；多 Sheet 复审终评 converged；fast15 rc0/scan57 ok/铁证 CBEB42E3
- #129 多 Sheet 复审轮2：__proto__ 名称假阴修复（seenSheet/sheetNames/seenDs 改 Object.create(null)），两个 __proto__ 同名 sheet 现在 DUPLICATE；补 SQL 基表+rows extra 的 stub-deps 编译覆盖；fast+2；fast15 rc0/scan57 ok/铁证 CBEB42E3
- #128 多 Sheet spec 复审修复（1 P1+4 P2）：extras 校验对 rows/sql 两基表都执行（此前 sql 提前 return 绕过）；extra 拒 watermark/toolbar（workbook 级仅基表）与手写 dsName；sheet 名重复判定改 hasOwn（原型链键）；schema/report_spec 文案同步；fast_report_spec+7；fast15 rc0/scan57 ok/铁证 CBEB42E3
- #127 多 Sheet 进 ReportSpec（A1 产品化）：rows 路 extraSheets[]（name 唯一、独立数据集 ds2..、可带 presentation/sheet）；validator 复用主校验加前缀、sql extra 结构化拒；compiler 合并 sheet/数据集；planner 透传；载体 multisheet.json 真引擎 2 `<Report>` + PNG 汇总/明细两页；fast_report_spec+8/fast_planner+2；fast15 rc0/scan57 ok/铁证 CBEB42E3（plan→create e2e 未跑，manifest agentAvailable 仍 false）
- #126 合计聚合复审轮3 收敛：无新 P1/P2；顺手把落点超表宽提前到 SpecValidator（rows 表宽=维度+度量，INVALID_NUMBER），compile throw 保留二道防线；fast15 rc0
- #125 合计聚合复审轮2（spec aggregate 通道 2 P2）：aggregate 键白名单+形态互斥（ratio 禁 col、非 ratio 禁 num/den、拼写错键拒）；compileRows 对 sumCols/aggregate 落点 >= 表宽编译期抛错，aggregate span 不越 n-1；fast_ir_contract+3/fast_report_spec+4；fast15 rc0/scan57 ok/铁证 CBEB42E3
- #124 合计聚合复审修复（6 P2）+ spec 通道：IR 列号 0/小数/越界/重复列/fn+formula/互斥/fn 类型全拒，aggregate.format 可覆盖表头格式，total 无 detail 抛错；ReportSpec 新增 total.aggregate（sum|avg|count|min|max|ratio={num,den,format}）+ sumCols item 键白名单；新 spec 载体 total_agg.json/=AVERAGE(B3) PNG 60.0、total_ratio.json/=SUM(B3)/SUM(C3) PNG 1.14；manifest evidence/KEY_OF 收紧；fast15 rc0/scan57 ok/铁证 CBEB42E3
- #123 Planner 链路收尾：intent.params/intent.sheet 在 rows/sql 两分支原样透传进 reportSpec（此前只带 presentation，Agent 走 plan 无法表达参数面板/隐藏行列）；非法键仍由 SpecValidator rejected；fast_planner +6 断言，fast15 rc0
- #122 合计行非 sum 聚合（P1，矩阵第4项）：IR aggregate.fn=sum|avg|count|min|max|ratio（ratio={num,den}，禁列0）+ sumCols[].fn；object 映射 SUM/AVERAGE/COUNT/MIN/MAX 与 SUM(num)/SUM(den)；载体 test_total_agg（PNG 60.0/2/35）与 test_total_ratio（PNG 1.14）；manifest 新增 spec.rows.totalAgg；fast15 rc0/scan57 ok/铁证 CBEB42E3
- #121 manifest 补 B/C 新能力行（backlog B-审查1-1 完成）：6 行入 CapabilityManifest——sheet.hideRowsCols/cells.rowSpan/spec.rows.conditions/cells/sumCols/spec.params.panel，四层状态按证据如实（cells rendering=pending、params=serialization-only、rowSpan agentOverride=false），KEY_OF 同步；fast15 rc0
- #120 审查轮3 收敛：轮2 五项 P2 全部关闭且无新 P1/P2；残留 3 项（schema 宽松镜像/legacy line-pie barInterval 静默/fixture rows 宽度）记 backlog 不属缺陷。门：fast15 rc0/scan55 ok/铁证 CBEB42E3
- #119 审查轮2 修复（复审 2cf7fce）：sumCols col0 与合计 label 同格前置拒（IR+spec）；B6 span 断言改 3 列避免新旧同值假绿；非散点 kind 的 x/y 拒；schema chart 改 if/then/else 按 kind 分流；散点编译链 stub-deps fast 覆盖 + Ir.validate 零误报；legacy barInterval 无 legend 拒。门：fast15 rc0/scan55 ok/铁证 CBEB42E3
- #118 审查轮1 修复（独立代理审 2 P1 + 9 P2）：sql 路 conditions/cells/total 结构化拒；total.sumCols label span=最小求和列（部署 cpt 校验 SUM 格不再被吞）；vscatter/vbubble spec 改 x/y；legend/barInterval IR 闸；params 白名单+转发+values/submit 闸；sheet 名唯一/paper 数值/多 sheet+write 拒；presentation.cells 绝对 r 拒；schema/report_spec/capabilities/docs 同步。门：fast15 rc0/scan55 ok/params+sumcols 引擎 failures=0/铁证 CBEB42E3
- #117 C3 裁定 + D1 阻塞封存：C3 cell.sort/verifiers 维持结构化拒（引擎墙/缺官方语料，不盲写）；D1 组合图 VanChartCustomPlot 已打通构造+序列化（CustomStyle/CustomPlotList/CustomDefinition+DefinitionMap 枚举键，部署 cpt 与官方 柱形图变形.cpt 同构）但渲染未达成（分类轴恒单类、缺子图系列分配 ConditionCollection），按三轮规则回收实验代码并留阻塞注释/探针/日志；D2 vmap 仅抓 API 面（MapType/MatchResult/GisLayer），待独立工单

---

# 当前口径速查（2026-11-06）

- **铁证三件**：demo_api.cpt=CBEB42E3CE48E46E362B9AE80168026F / 销售明细_api.png=A8EF39AB648D5F00DDAE0481D0313110 / v2 模板=6161F402B340321B4ABF68B68E301828——改 lib/object|ir|cpt 必逐字节复核。
- **缺口账**：docs/architecture/coverage.md（missing=32 partial=20 noncore=44、漏账=0；A 表=排期依据）。
- **能力声明一处真相**：application/capability_manifest.js（四层 construction/serialization/rendering/agentAvailable；agentAvailable 名单以 discover 输出为准）。
- **现状**：批 0/A-J + 批B 车道全结（渲染端四项/词汇扩容/axis 群/头部类，#101-#106）；未结=vmap 词汇/poly/批F 写回/批D 字典凭据/审查环轮 2——直续步骤见 docs/night-shift-log.md。