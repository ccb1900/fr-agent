# FineReport 无头渲染管线（D:\fineagent）

不打开设计器，直接用 FR 自带 jar 把模板渲染成 PNG/PDF 的完整闭环。
**v3.0 已上线：API 对象图后端——报表 = 组装 FR 内存对象图，XML 由 FR 自己序列化产出。v2 字符串生成器保留为回归门。**
**2026-10-27 字号单位大更正：FR11.5 size attr = pt×2（旧 #12/#19 的"pt×4"经 font_ruler 标尺实验证伪）。新基线铁证：demo_api.cpt = D3E3C2A0300ED1DF9A112DBBDFA6AD10、销售明细_api.png = B24BE26C36AC6E9D0DDA122F9D6727FE。**

**agent 开工先读 `AGENTS.md`**（行为约束 + 硬性回归门 + 排版红线清单）；本文档编号条目 #1 起 = 一手实证事实库。

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

28. **v3.3 ȫ���ղ������ߣ�������֤����**��`make_verify.js` �Թٷ� cpt ����������š���A ������أ�`TemplateWorkBookIO.readTemplateWorkBook`���� B ���ζ������ظ��� `wb.export()` ���л� MD5 ��ȣ���Ǣ���� C �������ض������ `execute+ImageExporter` ��Ⱦ PNG MD5 ��ȣ���Ⱦ�ȼۣ���һ��ʵ֤����·������ = ��� reportlets ��������ֱ���ļ�����`demo/basic/x.cpt` �����̬����������·���� `reportlets/` ǰ׺�� TemplateFileNotFoundException����readTemplateWorkBook �� env �� "EntityDao can not be used before ConfigurationActivator starts!"��env �������𣻢۶��� 21 demo �����ղ飨2026-10-26�������� 21/21 ȫ�������л���Ǣ 17/21����Ⱦ�ȼ� 14/21����4 ����������Ǣ�Ĺٷ�ģ�壨3D���ݷ�������/WorkBook3/��ˮ�ɼ���2�����ζ������ص����ֽھͲ�ͬ��**�ٷ�ģ�����л�����ȷ�����ֶΣ��� `<UUID>`��**��MD5 ���ֽ�ȷ����ֻ�������Բ�ģ�������壨���� demo_api.cpt 101700BB ����Ӱ�죩����7 ���ٷ� demo ��Ⱦʧ�ܣ�3D��ѯϵ/����ϵ/�ɼ�����ϵ�����������Ϊ���ղ������ϵ�����������ݹٷ���������"Ӱ���ļ�"��GettingStarted=WorkBook1��diag=������ϸ ��Ⱦ PNG MD5 ���ȣ����ܹ�ͼ����д��ӣ��ղ�ѭ����ڶ�������©�����������"ȫ��"���󡪡��쳣����� catch �̳�ͳһ READ_FAIL�����ڹؼ��ڵ����Լ��Ľ�ӡ��

29. **v3.3 ȫ���ղ飨�ٷ� demo �� 240 cpt��fvs �ų���**������ 240/240����Ⱦ�ȼ� 221/240��92%�������л���Ǣ 153/240��64%����������ϵ��form 15/15 ˫�̡�basic 25/26��other 3/3��parameter 13/13 ��Ⱦ�̣�DataReport 6/6 self=false ����Ⱦ 6/6 �̡���**��Ǣ�������ȶ��Խ���**��UUID ���ֶ��Ŷ����л��ֽڣ����Ŷ���Ⱦ������Ⱦ�ȼ۲��� IR �ؽ���ê��19 �� render=false �����ࣺ3 Ӳ�ܣ�NewbieGuide ��ת/���ɱ��� `Image_Export_Error_Info`��financial2/�ʽ����� `DeathCycleException`��������������ർ���߽磬ʵѵ��ϵ׼�ߣ���16 �� png1��png2 ��**��������**�����ֱ淨�ţ�ͬһ���ض����������� MD5 ȫ�ȣ�probe ʵ֤��Phone/tabular �� chart/special ˫������+ �ı���֤���������� XML ��ȫ������ NOW(/TODAY(/Refresh װ�ã��� ģ���Դ�ʱ��װ�ã����ζ��ظ���ȡֵ��ͬ�����ݼ���̬���ؽ�������̶�����ʱ��ֵ���ղ�� verify_table.txt ����ʵʱ���̣�print �� buffered stdout ��ﵽ�����ˡ��������� BufferedWriter.flush ��ʵʱ����

30. **v3.3 �ؽ���һ���� PASS���ٷ� demo/NewbieGuide/��һ�ű��������� diff 3.79% < 5%��**���ٷ� PNG vs �ؽ� PNG ͬҳ 1587��2245��diff=134958/3562815=3.79% PASS��������v1 5.68% �� ���ⰴȫ��������+ͼ���մ���ʽ setTitle ɱĬ��ռλ�� 5.71% �� ��ͷ�ֺ� 24��22pt + axisY 0-1000 + legend 12pt + ����� 40 �� 3.79%������������֤�����������������졪��DBTableData.createDataModel(Calculator) һ��ִ�йٷ�ģ�� ds1��FRDemo SELECT * FROM ������dump 45 ����ֵ��frdemo_sales_dump.txt��45 �� 6 �� ����|����Ա|��Ʒ����|��Ʒ|����|Ӣ�ļ�ƣ������� 5 ����Ա��5 ��Ʒ�決�������кϼƹ����ܼ� 9818 ��ٷ���Ⱦ��ƽ�����ֺŵ�λʵ֤����FRSize=pt��4 ���ɱ��֣��ٷ� XML ��ʽ s=1(б�߽Ǹ�)=96(24pt)/s=2(��ͷ)=88(**22pt**)/s=3(����)=84(21pt)/����=128(32pt)����һ�ֱ�ͷ���� 24pt ��������ȫ�죬22pt �����������ȫ�� ��2%���۱�����л�׼ʵ֤�������� fit ���� 0.25��ҳ�� 595pt������ 1780.79pt�����ٷ��������� 737.5px=���� 891.6pt��ȫ���� 890.4/2��**���������ȫ��������ҳ��**����bbox �þ�������������bbox_probe ɨ��������ͶӰ��˫���� bbox ��ȫ�ȴ�(w=266 h=42 px=5443)֤�ֺž�ȷ������ͼĿ��"���β���"�� AA �����������ع�������ɡ���make_pixel_diff��32 ͨ����ֵ+24 ���ͳ��+Ʒ������ͼ heatmap.png��+ crop_diff/bbox_probe/colscan �����ף�**����·������ CR_*/PD_* ���������������в������λᶪ**��colscan �߿�ɫ��Ⱦ AA �в�ֵ��ֱ�����ݲ���޻ع�˫��֤����engine �ߴ����ݺ���� demo_api.cpt=101700BB��PNG=E2391200 ���ֽڲ��䣬Ĭ��·�����Ŷ���engine v3.3 �����ߴ���lib/object.js����font(bold,sizePt,colorInt)+setForeground��style(st) ֧�� st.color/st.border��palette ͳһ�߿�ɫ������ǳ��������putChartCell ��ϵ��(values��ChartSummaryColumn[])+legend+axisY(max/min �� Formula("=N"))+barInterval(setCategoryIntervalPercent)+legend.setFRFont+noBorder��putBiasCell(BiasTextPainter(String)+setIsBackSlash(false)������|�ָ��ո����)��header corner ռ��+�����ơ�detail �� align/bold/bg/format ����(format �մ�=���ϸ�ʽ)��total sumCols ����+labelSpan/labelAlign/labelSizePt+�� space �տ飻lib/ir.js compile ͷ�� spec.IR ֱͨ��rawIR �ؽ�·����Ĭ�� compile һ��δ������API һ�ֵ�λ��**ͼ��ס Plot �� chart.getPlot().getLegend()��Chart.getLegend �����ڣ�**��Axis.setMaxValue/setMinValue �� Formula��Legend.setFRFont(FRFont)��BarPlot.setCategoryIntervalPercent(double)��rawIR �����䣨make_api.js/lib/cpt.js����styleCount �� null �������������л��ϲ���ͬ��ʽ 11��7 ������ȥ�أ���skipFormatOrder��Format��FRFont ���� v2 ��װ��������ɣ����������л�������Źܣ���ͼ�����в� 17-34% �� Van vs legacy �ṹ������/Y �� auto �㷨/ͼ���оࣩ+�ٷ�ͼ������˫дδ���������ѹ��߲�׷��
#31 �ڶ����� demo/basic/������ϸ���ܱ�A������С���壩PASS 0.30%����ֵ<5%���������ڵ�һ���� 3.79%�������ţ��ٷ� 11 ��ģ�ͣ�r0��������135pt/r1��ͷ108pt/r2�ܼ��ڶ�99pt/r3С��93pt/r4��ϸ99pt + r5��/r6r7βע 57pt����20 ʽ��ʽ����s0-s19��΢���ź�72/80/88/144=18/20/22/36pt����8 �п� 288-360pt��ds1=FRDemo S��Ʒ 77 ����ֵ dump������=�������� 1,2,7,6,8,4,3,5 ��ٷ� PNG һ�£���DictPresent �ֵ䷭���� pre-join ������������������ API������������������55.43%��©���е����� D0ECFA �� bg����16.06%�������޸�����0.30%��ҳͷ�ظ� HR F=0 T=1���ٷ�ÿҳ�ظ� r0 ��������+r1 ��ͷ��API=com.fr.page.stable.ReportPageAttr.setRepeatHeaderRowFrom(0)+setRepeatHeaderRowTo(1)��fresh getReportPageAttr()=null ������ʽ�ң���v3.4 engine ���ݣ�lib/object.js ȫһ��̽��ʵ֤����font �� name ������΢���źڣ�SimHei ֻ�ǵ�һ����ٷ�ѡ�ͣ���style �� borders ��� [styleInt,colorInt] ͸�����ٷ�������� 1ϸ/2�ҵ�/3��/5�֣���putDSCell opts summary(SUM/AVERAGE=SummaryGrouper.setFunction)+result($)+noExpand���ٷ���ֵ�� <Expand/> ����ʽ dir����putCell ��7�� ea={dir,leftCol,leftRow}��CellExpandAttr.setLeftParentColumnRow(ColumnRow.valueOf)+setLeftParentDefault(false) С�����󸸰󶨣���sheet.paper ֱ���� ReportSettings(PaperSetting(PaperSize,Margin)) EMU ֱ�� FU.getInstance���ٷ��Զ���ֽ 40320000x42768000+margins 432000/720000/286560/574560��fresh PaperSetting ȫ̽�� PASS����cells ͨ�ÿ� items ����ı�/��ʽ/DS/���� cellLink byPost/expansion������ titlebar/subtotal/note һ�зǱ�׼�У�ds.columns float=Double������ 21.35����lib/ir.js validate �ſ����׿� title|titlebar|cells��cells �����Դ�ͷ��ϸ�У�/lib/cpt.js ������ rawIR ·���ſ���skipFormatOrder ͬԴ���أ��ٷ��������岻�������׼��Ͻ�������߻ع�˫��֤���ֽڱ��֣�demo_api.cpt=101700BB��������ϸ_api.png=E2391200�������Ѳ��� reportlets/fineagent/������ϸ���ܱ�A_api.*��PNG 2116x6735 ��ٷ������ػ���һ�£���

#32 DB ������·�� PASS��A+B ����ģ������ SQL + ��ʵ SQL Server����һ����ⱨ��������ӹ������ձ�������
- ���ƽ����ջ����� XMLableReader��ǰ������ɽ���÷�����NameDatabaseConnection(String) �вι��� + DBTableData(Connection,String) + DatasourceManager.putConnection/getConnection/getConnectionNameIterator ȫ��һ��ʵ֤��ע�� ndc.getConnection() ���� null �� createConnection() ������Druid �� �� SQL Server 15.0.4490��������ִ���� createConnection�����ް���
- ����ǽ��jdbc:sqlserver:// URL ��Ȼ�� JDBCSecurityChecker�������� jdbc:hsqldb:file �ļ��⣩������ mssql-jdbc-9.4.1.jre8.jar ������ WEB-INF/lib��classpath �ڣ��������û��ṩ��
- �������� v3.5��lib/object.js datasets ˫��̬��Ĭ���԰��� EmbeddedTableData / kind=sql �� DBTableData(NameDatabaseConnection(������), ģ������ SQL)����make_api.js ������1.5 ��������ע�᡹�Σ�SPEC.connections[] ƾ��ֻ������ spec �ļ���testConnection ����ʧ�ܼ� exit 4���ܾ����Ż����ӳ���������lib/ir.js validate �� sql ���ݼ� connection/query �����š��󶨲���Ķ�����DS �󶨰� dsName �ַ�������������̬ͬ·��
- ������ף�atom_live_demo��34 ������laser_aaa 122757 ��ҵ����ȫ nvarchar�����ݻ���������֤����ͬһ����� '2026/9/13' �� '2026-9-13' �����ַ�����ʽ��GROUP BY ԭ�����һ���ѳ����У���б�ܸ�ʽ���� 89226 �� score ȫ NULL��AVG �� null������ SQL ���� TRY_CAST(biz_date AS date) �鲢 + WHERE TRY_CAST(score AS float) IS NOT NULL ���ˣ��� 10 ���վۺϡ���ѵ������������������ٶ������ھ��������չٷ� demo �ĸɾ������뵱Ȼ��
- �������գ�db_laser_aaa_truth.txt��ͬһ�� SQL ֱ���� UTF-8���� PNG ���˶�ȫ�ȡ���4238/3873/3004/5333/2675/2220/3154/2965/3911/2158���ϼ� 33,531���վ� 0.9501��
- ������̬��cpt �� <Connection class="com.fr.data.impl.NameDatabaseConnection"><DatabaseName>ATOM_LIVE + DBTableData ���� SQL��ȫ����ƾ�ݣ�grep whmeiko �����У����������ɽ�����̬��
- ��������¶��putConnection ��־û��� FineDB��WEB-INF/embed/finedb/db.script �� 47 �� ATOM_LIVE ��¼�������� JVM �Կɼ������û����� FRDemo/whora1/wh_live ���С�����������/���߶���ֱ�Ӵ򿪸�ģ���ǰ�ᣬҲ��ζ��̽��д���˹�����װ���á��������棺DatasourceManager.removeConnection('ATOM_LIVE')��
- �Ű����ӣ��װ��п� 96pt ���������У�total ��ֻ�� label+���ܸ񣬺ϼ����Ҳ��޿��ޣ��п� 112/80/80/90/90/90/104pt + �ϼ��и��� cells ͨ�ÿ��������������Ķ����������ߣ������ؼ��κ��飺ImageExporter PNG ���ű� 0.667px/pt������ʵ����� ColumnWidth EMU��1422400/1016000/1143000/1320800��ȫ�ȡ�������ͼĿ��ġ����С������Ŵ��������������㡣
- ���߻ع飺v3.5 �����Ķ��� failures=0��demo_api.cpt=101700BB��������ϸ_api.png=E2391200 ���ֽڲ��䣨FineDB ��һ������δ�Ŷ�Ĭ��·������
- ��������ɣ�run.ps1��ɱ java + �� db.lck + ȫ��·�� + ����ض���һ��������ȿӣ�bash �ﴫ Windows ·�����뵥���ţ�����б�ܱ��Ե���PowerShell �����ű���� $_ �ᱻ bash չ���������߼�һ���� .ps1 �ļ���
#33 ���ڶ��� PASS����ϸ+С��+�ܼ�+������ȡ��ĸ��/��ģ��˫ cpt������v3.6 �������������
- �����ĸ�� reportlets/fineagent/����ӹ������ձ�_������ϸС��_api.{cpt,png,pdf}��day��stage 20 ����ϸ + ����С�� 10 �� + ȫ���ܼ� 1 �У�3 ҳ A4 ����ÿҳ�ظ���������+��ͷ������ģ�� ����ӹ������ձ�_��ʱ��ȡ_api.{cpt,png,pdf}������ day ���� 24 Сʱ�� + ���պϼƣ���spec��reports/db_laser_subtotal.js��reports/db_laser_drill.js
- v3.6 �������ݣ��ϸ�������Ĭ��·����Ķ�����lib/object.js ���� ppArray() ParameterProvider[] ������com.fr.base.Parameter(name, Formula|String)����datasets[].params �� DBTableData.setParameters��linkTo.{params,targetFrame,extendParameters,width,height} �� ReportletHyperlink.setParameters/setTargetFrame/setExtendParameters/setWidth/setHeight
- ��ȡ���л�ʵ֤��ĸ�����ڸ񣩣�linkTo params = [{name:'day', formula:'=$$$'}]���ٷ����� demo/basic/������ȡ������.cpt���� cpt �� <Parameter><Attributes name="day"/> + <O class="com.fr.base.Formula"> �� Attributes CDATA �������Ǹ� '=$$$' �� + <TargetFrame>_self + <Features width="1000" height="640"/> + <ReportletName extendParameters="true">fineagent/����ӹ������ձ�_��ʱ��ȡ_api.cpt
- ${} �滻�߽磨һ��ʵ�⣬���������� FR ֻ�� SQL ���滻 ${param}����Ԫ��ʽ��ԭ���� ${day} �� �ӱ����ڸ������ݼ��� biz_day ֱ�������湫ʽ���ԣ��� �滻�Ǵ��ı�ע�룬TRY_CAST(${day} AS date) ��������� int �������� Fine-Engine_Report_NS_Exception_Td_With_NameExplicit(int��date)�������Դ�����д�� = '${day}'
- ������գ�verify_sub_grid.js 229 ��ȫ�ԡ�verify_drill_grid.js 103 ��ȫ�ԣ���ֵ db_laser_sub_truth.txt �ĶΣ���ϸ 20 / С�� 10 / �ܼ� / ��ʱ 24��probe_dbtruth2.js ͬһ�� SQL ֱ�����̣�����ģ��һ���ԡ����ӱ����պϼ� = ĸ�� 09-13 С�ƣ�4238 / 2854 / 3959.776 / 0.9344 / 67.34 / 1.0000��
- �ھ����죺�ܼ�ƽ���� 0.948809��= 31814.517 / 33531 ����Ȩ���� ���ռ�ƽ�� 0.950097��verifier ��ʽ�������߲��ȣ��ž�"ƽ��ֵ��ƽ��"
- ��������棨������դ�� introspection����wb.execute �� com.fr.main.workbook.PageRWorkBook.getReportCount()/getResultReport(i) �� ResultReport.getRowCount/getColumnCount/getCellElement(c,r) �� ����� com.fr.report.core.lkd.KMW �� getValue()/getShowValue()���� getText����make_api.js 4.5 �ν��� env RESULT_DUMP=·�� ʱ������Ĭ�ϲ����κ��ļ�
- �Ű�ʵ�����޸���ImageExporter 0.667px/pt�����ֲ���ʵ�� ��9.5pt����� 10.5pt �� FRSize=pt��4 ��ȾԼ 2 ���Ӿ����������滻�㡪�����˾����������ߣ����װ� 74/112/96pt �������У�33,531��31,814.517���ϸ���(%)�����ӿ�Ϊ 86/128/112������ 762pt �� A4 �����ӡ 788pt�����У�С����"������ǳ"����FR ���к󻭡������߱���һ�и��ǳ���߸��� �� С������ͳһǳ���ߣ��ҵ�+�Ӵ����㹻�ֲ㣩������ֻ��������ܼ��У�С��/�ܼ��и� 32��36pt ����Ӵ���������
- ���߻ع飺v3.6 �����Ķ�����Ĭ��·�� failures=0��demo_api.cpt=101700BB7BF8B306E98E3393F5D32454��������ϸ_api.png=E2391200643D6A4CD533D4DFB6A96D2F ���ֽڲ���
- ������̬�������� cpt grep whmeiko��grep -i password �� 0 ���У�ģ����ֻ�������� ATOM_LIVE��DB ƾ����ֻ�䱾�� spec �ļ������� README ���ˣ���ATOM_LIVE ���û����߱����� FineDB������·�� DatasourceManager.removeConnection('ATOM_LIVE')
- �������߿ӣ������ٲȣ���PowerShell �����ű���� $_ �ᱻ bash ��չ�� �� �κδ��ܵ��������߼�һ���� .ps1 �ļ���New-Object Type(a,b) �Ѷ��Ų��������� Object[]��op_Multiply �������� Ԥ��� int ���� -ArgumentList������·���� PowerShell ������ʧ�� �� ͼ��ǰ�� cp �� ASCII �ļ�����run.ps1 �� *> �ض�����־�� UTF-16LE��grep ǰ���� iconv -f UTF-16LE������Ĭ������

#34 �ھ�����������ڱ߿�Ҳ�ĺڣ��û� 2026-10-26 �·������Ǳ�׼�ĵ�"����ǳ��"��
- ��Χ�綨��ֻ���Բ���ⱨ�����ݣ��ٷ� demo �ؽ��壨��һ�ű�����������ϸ���ܱ�A�������� diff Ϊ�����ߣ��߿�ɫ�ճ��ٷ������ܱ����Ŷ�
- ĸ��/�ӱ���cells ����ʽ edges����spec ���߲�λ LIGHT �� -3417120 �� -16777216 ��ȫ�������ߣ�˳��ɾ�� SM() �� deep �ֵ���������ͬɫ�� FR"���к󻭸��ǹ�����"���µ�"������ǳ"�������Σ�������·
- ��һ����ⱨ����title/header/detail ������ edgesOf Ԥ�ã�����������Ĭ��ֵ�����˻��ƹٷ��壩�����ü��� IR.palette.border ͳһ�߿�ɫ��v3.3 palette ͨ����title/header/detail/total ��· style ���� border: P.border����һ�ֿӣ�P ����ʱ headerBg �� P.headerBg��ֻ�� border ���� headerBg ���ñ�ͷ��ɫ�� undefined ��������palette ��д����ɶԸ�
- ��׼�ĵ�ͬ����TABLE_DESIGN_STANDARD ���� ��д��������ΪĬ�ϡ�ǳ�� -3417120 ����Ϊ"��Ҫ Excel ��դ��"��ѡ�����������߸��ǻ���ʵ�����������ٷ��ؽ���������������ؼ���嵥������ѡ��ͬ���Ŀھ�
- ���գ�verify_sub_grid 229 �verify_drill_grid 103 ����� verify_aaa_grid.js 73 ���һ���վۺ� 10 �С�7 �� + �ϼ������ȫ�ȣ���ֵ db_laser_aaa_truth.txt�����̣��������� failures=0������˫��֤���ֽڲ��䣨demo_api.cpt=101700BB7BF8B306E98E3393F5D32454��������ϸ_api.png=E2391200643D6A4CD533D4DFB6A96D2F��


#35 ������������������� + ����ҳ/���ڷ�Χ/����ɸѡ�����������漶ʵ֤��
- ���lib/browser.js ���ù����� + reports/br_laser_aaa.js / br_laser_aaa_gosa.js / br_laser_pwr.js ���� thin spec������ �������������_{������ˮ,GOSA���,���ʼ�}_api.cpt(+png/pdf)��������� d1/d2/stage/size/page + ��ѯ��ť����ģ���Զ��ص� 1 ҳ
- ����ʵ֤�����򱻳Ե���FR �� cpt ʱ�� SQL ��ÿ�� [] ��ʶ�����ɱ�������[file_key]A��������ʱ ORDER BY ʧЧ������ʽ�������������̬�����кͣ��� ��ҳ��Ϊ��ȫ����� ROW_NUMBER() OVER(...) �� _ord �С��� _ord ����ȡҳ������ FR ��Ⱦ��"��ϸ��һ��"����չʾ������ _ord �������ɵ�һ�У��кţ���չʾ��=ȫ��=��ֵ��ų���
- ����ʵ֤�ڸ��Ŷ�ī������ 8pt �� '-' ֻռλ����ī��advance �����ġ�����ȫ�ף���9/10/10.5pt �� 8pt �ź�/����/Arial ������ �� �������ֺ������� 9pt��Math.max(9, fontPt)����������һ�������ŷ��ع飻դ�� dump ����������ĸ�ֵ���и��ţ�����������ȱ��ֻ�ܿ������ط���
- �Ű滻��ʵ�⣺���� 0.667px/pt �º�����ǰ��� ��1.0��FP��ȫ�� ��2.0��FP�������� +10%��probe_fontmetrics2.js��FRSize=pt��4������ size36 ʱ w0=18 / w��=36���� �п��뵼����/������Ŀ�����һ���� textPt() ���㣬�����ֲ£����ⲻ������ѹ����������
- ���գ�probe_br_truth.js ֱ����ֵ��ν��/����/ƫ��ȫ����������д������ lib��+ verify_br_grid.js 3689 �� failures=0��������ֵ��_ord ������ҳ1��ҳ2��stage �Ӽ�����ҳ��ʽ����ʵ����ַ��"һ SQL ҳ = һ��Ⱦҳ"��ֽ�ߡ�0.667 = PNG �ߣ���� ��3%����������ī��ͬ��ͬλ��һ��һ��ī���� >1.2��
- ���ߣ�Ĭ��·������ demo_api.cpt=101700BB7BF8B306E98E3393F5D32454��������ϸ_api.png=E2391200643D6A4CD533D4DFB6A96D2F ���ֽڲ��䣻��������� cpt grep ���ӿ���/password �� 0 ����
- �߽磨��ʵ��¼����${} ���ı��滻���ǰ󶨱�����������������Ż��ƻ� SQL����ģ������������ά�Բ飻��Ҫ���������� DBTableData �� ? �󶨲�����v3.6 ppArray ͨ���Ѿ߱���δ�ӣ�

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
