# demo240 能力覆盖率看板

> 由 `probes/coverage_report.js` 生成（Fri Nov 06 07:54:17 CST 2026），幂等重写勿手 edit；状态源=`logs/_demo_classes.txt`+`logs/_demo_feature_scan.txt`+lib/engine 源码。
> 分类：**full**=类名在引擎源码构造/字符串命中；**partial**=部分 token 命中；**missing**=零命中。
> 圈定的不追目标（noncore）：com.fr.esd.*、com.fr.plugin.cloud.*、com.fr.widgettheme.*（插件配置类）。
> 不追范围（2026-11-05 拍板终口径="基本授权有的内容都可以做；额外收费的不做；移动端不做"）：① FVS 大屏付费插件扩展图族 14 包（kpi/meter/wisdomtree/globe/catalog/fluid/time/particlecounter/multidata/map.groupmap/column.arccolumn/column.carouselbar/column.shapecolumn/pie.carouselpie）——类物理定义于 plugin-com.fr.plugin.bigScreen.v11 fr-plugin-extendedCharts jar（缺口账 36 类命中；核心 jar 零交叉）；② com.fr.extended.chart.*（付费扩展图族配套数据集基建，类虽在核心 jar 但消费者全在付费插件）；③ 移动端 com.fr.report.mobile.* + com.fr.form.ui.mobile.*（4 类；MobileReg=手机号校验属基本功能不在其列）。

## A. 缺口总账（demo 类级，按演示库 240 张 cpt 引用频次倒序；也是批计划排期依据）

> r17 对齐口径：**参考批次=排期归属（README 引证），不等于探针已认到实现；实现状态以 状态 列为准**。
> 批次↔按键级实认交叉核对见 D 表；**版本包名差异 10 类（First/Previous/Next/Last/PageNavi/Export/Print/FlashPrint/Email/TemplateIdAttrMark）=demo 旧包名 vs 引擎新包名，功能非真缺（#81 已核）**。
> 漏账.域 条目=当前无 README 批定义背书，保留显式漏账标记、不硬编归属。

| demo类 | 频次 | 状态 | 参考批次 |
|---|---|---|---|
| com.fr.base.chart.chartdata.model.NormalDataModel | 180 | missing | 批B后继(#600 工单头部,未排) |
| com.fr.plugin.chart.attr.axis.VanChartAxis | 92 | missing | 批B后继(#600 工单头部,未排) |
| com.fr.plugin.chart.base.format.AttrTooltipAreaNameFormat | 61 | missing | 批B后继·tooltip 深水区(未排) |
| com.fr.plugin.chart.base.format.AttrTooltipMapValueFormat | 54 | missing | 批B后继·tooltip 深水区(未排) |
| com.fr.plugin.chart.base.format.AttrTooltipSummaryValueFormat | 24 | missing | 批B后继·tooltip 深水区(未排) |
| com.fr.chart.web.ChartHyperRelateCellLink | 18 | missing | 批I(挂账,#79/#581 图表热链随地图批) |
| com.fr.chart.chartattr.ChartCommonCondition | 14 | missing | 漏账·图表条件(需批定义后归属) |
| com.fr.plugin.chart.custom.VanChartCustomPlot | 12 | missing | 漏账·组合图(需批定义后归属) |
| com.fr.plugin.chart.base.format.AttrTooltipStartAndEndNameFormat | 12 | missing | 批B后继·tooltip 深水区(未排) |
| com.fr.plugin.chart.map.attr.AttrMapLabel | 8 | missing | 批I(挂账,#79/#597) |
| com.fr.plugin.chart.map.attr.AttrMapTooltip | 8 | missing | 批I(挂账,#79/#597) |
| com.fr.plugin.chart.attr.axis.VanChartAlertValue | 7 | missing | 批B后继·axis/标记深水区(未排) |
| com.fr.plugin.chart.map.data.VanMapMoreNameCDDefinition | 7 | missing | 批I(挂账,#79/#597) |
| com.fr.plugin.chart.map.line.condition.AttrCurve | 6 | missing | 批I(挂账, map.line 域,#79) |
| com.fr.plugin.chart.bubble.attr.VanChartAttrBubble | 6 | missing | 批I后继·bubble 属性(未排; bubble plot 已收 #79) |
| com.fr.plugin.chart.map.VanChartMapPlot | 6 | missing | 批I(挂账,#79/#597 GIS 底图) |
| com.fr.plugin.chart.map.line.condition.AttrLineEffect | 6 | missing | 批I(挂账, map.line 域,#79) |
| com.fr.chart.chartattr.CategoryAxis | 5 | missing | 批B后继·axis 装饰深水区(未排) |
| com.fr.form.ui.MultiFileEditor | 5 | missing | 漏账·编辑器扩项(需批定义后归属) |
| com.fr.general.date.FineDateFormat | 5 | missing | 批D后继·格式域扩项(未排; SimpleDateFormatThreadSafe 已收 #74) |
| com.fr.report.web.button.form.TreeNodeToggleButton | 4 | missing | 漏账·表单树控件(需批定义后归属) |
| com.fr.report.web.button.write.DeleteColumnRow | 4 | missing | 批F后继·write 按钮(未排) |
| com.fr.report.poly.PolyECBlock | 4 | missing | 批J(挂账,#80/#586 块面 API 未探全) |
| com.fr.write.config.DeleteConfig | 2 | missing | 批F后继·WriteActor DML 工单(#558/#600) |
| com.fr.write.config.UpdateConfig | 2 | missing | 批F后继·WriteActor DML 工单(#558/#600) |
| com.fr.report.web.button.write.CustomizeImportExcelData | 2 | missing | 批F后继·write 按钮(未排) |
| com.fr.form.ui.CustomToolBarButton | 2 | missing | 漏账·工具条按钮(需批定义后归属) |
| com.fr.data.impl.ExcelTableData | 2 | missing | 漏账·数据集(需批定义后归属) |
| com.fr.js.Commit2DBJavaScript | 2 | missing | 批F(#75 挪填报章,未排) |
| com.fr.report.write.ValueVerifier | 2 | missing | 批F后继·Verifier 族工单(#558/#600) |
| com.fr.data.impl.RecursionTableData | 2 | missing | 漏账·数据集(需批定义后归属) |
| com.fr.report.web.button.write.ClearStashedButton | 1 | missing | 批F后继·write 按钮(未排) |
| com.fr.report.web.button.write.StashButton | 1 | missing | 批F后继·write 按钮(未排) |
| com.fr.base.io.FileAttrErrorMarker | 1 | missing | 漏账·IO 杂项(需批定义后归属) |
| com.fr.report.poly.PolyWorkSheet | 1 | missing | 批J(挂账,#80/#586 块面 API 未探全) |
| com.fr.plugin.chart.heatmap.VanChartHeatMapPlot | 1 | missing | 批I(挂账,#79; 核心 heatmap 包全做) |
| com.fr.chartx.data.DataSetDefinition | 1 | missing | 漏账·chartx 数据(需批定义后归属) |
| com.fr.data.condition.ObjectCondition | 506 | partial | 批A(定性:cell 高亮面已覆盖,数据集级过滤仍缺口,#45/#515) |
| com.fr.plugin.chart.base.AttrLabelDetail | 150 | partial | 批B后继·label 装饰深水区(未排) |
| com.fr.plugin.chart.attr.axis.VanChartValueAxis | 129 | partial | 批B后继(#600 工单头部,未排) |
| com.fr.data.impl.DatabaseDictionary | 60 | partial | 批D(凭据注入工单,#539) |
| com.fr.base.iofileattr.TemplateIdAttrMark | 23 | partial | 既有·版本包名差异(引擎=iofile.attr.TemplateIdAttrMark,#81 已核) |
| com.fr.chart.chartattr.ValueAxis | 10 | partial | 批B后继·axis 装饰深水区(未排) |
| com.fr.data.impl.DynamicSQLDict | 6 | partial | 批D(凭据注入工单,#539) |
| com.fr.data.VerifyItem | 5 | partial | 批F后继·Verifier 族工单(#557 Verifier≠VerifyItem 教案) |
| com.fr.report.web.ui.impl.page.First | 1 | partial | 既有·版本包名差异(引擎=web.button.page.First,#81 已核) |
| com.fr.report.web.ui.impl.Email | 1 | partial | 既有·版本包名差异(引擎=web.button.Email,#81 已核) |
| com.fr.report.web.ui.impl.FlashPrint | 1 | partial | 既有·版本包名差异(引擎=web.button.FlashPrint,#81 已核) |
| com.fr.report.web.ui.impl.page.Next | 1 | partial | 既有·版本包名差异(引擎=web.button.page.Next,#81 已核) |
| com.fr.report.web.ui.impl.page.PageNavi | 1 | partial | 既有·版本包名差异(引擎=web.button.page.PageNavi,#81 已核) |
| com.fr.report.web.ui.impl.page.Previous | 1 | partial | 既有·版本包名差异(引擎=web.button.page.Previous,#81 已核) |
| com.fr.report.web.ui.impl.page.Last | 1 | partial | 既有·版本包名差异(引擎=web.button.page.Last,#81 已核) |
| com.fr.report.web.ui.impl.Export | 1 | partial | 既有·版本包名差异(引擎=web.button.Export,#81 已核) |
| com.fr.report.web.ui.impl.Print | 1 | partial | 既有·版本包名差异(引擎=web.button.Print,#81 已核) |

## B. 已实现族·组合稳定证据（“已支持特性可稳定组合”，r1.md §六口径）

| family | 状态 | 关键组合载体 spec | 快速门套件 | README 实证位 |
|---|---|---|---|---|
| sheet | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| background | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| funcgroup | full | sales_demo.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #21/#45 |
| summary | full | db_laser_subtotal.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #33 |
| formula | full | db_laser_subtotal.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #52 A |
| condition | full | test_cellattrs.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| condActionsExt | full | test_hla2.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #72 |
| objCondition(定性) | full | test_cellattrs.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45/#72 |
| html | full | test_cellattrs.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| richtext | full | test_v41.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| formulaPresent | full | test_v41.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| float | full | test_v41.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| watermark | full | test_v41.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| toolbar | full | test_v41.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| writeButtons | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| editor (参数控件族) | full | test_widgets.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | v4.2/待回填 |
| dict | full | test_cellattrs.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| formats | full | sales_demo.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 数字格式既有 |
| chart legacy | full | sales_demo_chart.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #26 |
| chart Van | full | test_vanchart.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #46 |
| chartDeco | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| chartdata | full | sales_demo_chart.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #26 |
| webpage | full | test_v41.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| hyperlink | partial (缺: Commit2DBJavaScript) | sales_demo_link.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #25/#45 |
| jsEvents | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #?/#45 |
| freeze | partial (缺: FrozenState+RepeatAndCollapsible) | db_laser_subtotal.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #31 |
| headerfooter | full | test_pagehf.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #73 |
| template marks | full | test_pagehf.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #73 |
| submit (填报) | partial (缺: ValueVerifier) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| reg 校验族 | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| sort | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 受阻断 |
| subreport | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| diagonal | missing (缺: Diagonal) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| barcode | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| image | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 观察 |
| map | missing (缺: VanChartMapPlot+AttrMapLabel+VanMapMoreNameCDDefinition) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| specialcharts | partial (缺: VanChartHeatMapPlot) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #79(bubble) |
| poly | missing (缺: PolyECBlock+PolyWorkSheet) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| group (自定义分组) | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| 局部样式(样式肾上) | partial (缺: stylesOf) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #31 |

## C. feature 标签层三色表（demo 普查 27 tag → 当前状态；tag 经 ALIAS 并到语义族）

| tag | demo(240) | 状态 |
|---|---|---|
| background | 240 | full |
| sheet | 240 | full |
| headerfooter | 207 | full |
| condition | 163 | full |
| funcgroup | 133 | full |
| webpage | 117 | full |
| formula | 101 | full |
| chart | 62 | full |
| sort | 55 | full |
| html | 49 | full |
| editor | 45 | full |
| dict | 39 | full |
| summary | 38 | full |
| submit | 35 | partial 0x1 |
| hyperlink | 27 | partial 0x1 |
| chartdata | 25 | full |
| freeze | 21 | partial 0x2 |
| richtext | 21 | full |
| subreport | 18 | full |
| float | 18 | full |
| diagonal | 15 | missing 0x1 |
| watermark | 7 | full |
| map | 7 | missing 0x3 |
| barcode | 4 | full |
| image | 2 | full |
| group | 1 | full |

## D. 批次↔探针对齐（r17 增强；批标记=排期归属 ≠ 实现状态，按键级/类级实认交叉核对）

| 批次 | 覆盖族(tag) | 家族键: full/missing | missing 键 | 类级账: partial+missing | README 位 |
|---|---|---|---|---|---|
| 既有 | sheet、background、funcgroup、summary、formula、condition、html、richtext、formulaPresent、float、watermark、toolbar、chart legacy、chartdata、image、局部样式(样式肾上) | 34/1 | stylesOf | 10+0 | #45、#21/#45、#33、#52 A、#26、#45 观察、#31 |
| v4.2 | editor (参数控件族) | 8/0 | — | 0+0 | v4.2/待回填 |
| 批A | condActionsExt | 4/0 | — | 1+0 | #72 |
| 批B | chartDeco | 6/0 | — | 3+8 | 待回填 |
| 批C | headerfooter、template marks | 6/0 | — | 0+0 | #73 |
| 批D | dict、formats | 9/0 | — | 2+1 | #45、数字格式既有 |
| 批E | webpage、hyperlink、jsEvents | 9/1 | Commit2DBJavaScript | 0+0 | #45、#25/#45、#?/#45 |
| 批F | writeButtons、submit (填报)、reg 校验族 | 11/1 | ValueVerifier | 1+8 | 待回填 |
| 批G | freeze、subreport、diagonal、barcode、group (自定义分组) | 4/3 | FrozenState+RepeatAndCollapsible+Diagonal | 0+0 | #31、待回填 |
| 批H | sort | 1/0 | — | 0+0 | #45 受阻断 |
| 批I | chart Van、map、specialcharts | 7/4 | VanChartMapPlot+AttrMapLabel+VanMapMoreNameCDDefinition+VanChartHeatMapPlot | 0+9 | #46、待回填、#79(bubble) |
| 批J | poly | 0/2 | PolyECBlock+PolyWorkSheet | 0+2 | 待回填 |
| 漏账 | — | 0/0 | — | 0+9 | — |
| 其他 | objCondition(定性) | 1/0 | — | 0+0 | #45/#72 |
