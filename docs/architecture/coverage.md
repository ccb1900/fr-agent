# demo240 能力覆盖率看板

> 由 `probes/coverage_report.js` 生成（Wed Nov 04 22:47:05 CST 2026），幂等重写勿手 edit；状态源=`logs/_demo_classes.txt`+`logs/_demo_feature_scan.txt`+lib/engine 源码。
> 分类：**full**=类名在引擎源码构造/字符串命中；**partial**=部分 token 命中；**missing**=零命中。
> 圈定的不追目标（noncore）：com.fr.esd.*、com.fr.plugin.cloud.*、com.fr.widgettheme.*（插件配置类）。

## A. 缺口总账（demo 类级，按演示库 240 张 cpt 引用频次倒序；也是批计划排期依据）

| demo类 | 频次 | 状态 | 参考批次 |
|---|---|---|---|
| com.fr.plugin.chart.base.format.AttrTooltipSeriesFormat | 610 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.format.AttrTooltipPercentFormat | 602 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.format.AttrTooltipChangedPercentFormat | 590 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.format.AttrTooltipChangedValueFormat | 590 | missing | (漏账：批排期时人工归入) |
| com.fr.js.ParameterJavaScript | 589 | missing | 批E(缺3) |
| com.fr.plugin.chart.base.format.AttrTooltipCategoryFormat | 553 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.format.AttrTooltipValueFormat | 548 | missing | (漏账：批排期时人工归入) |
| com.fr.chart.chartglyph.ConditionAttr | 299 | missing | 批B |
| com.fr.plugin.chart.base.AttrTooltipRichText | 192 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.AttrTooltip | 182 | missing | 批B |
| com.fr.base.chart.chartdata.model.NormalDataModel | 180 | missing | (漏账：批排期时人工归入) |
| com.fr.form.ui.reg.NoneReg | 153 | missing | 批F |
| com.fr.plugin.chart.base.AttrLabelDetail | 150 | missing | 批B |
| com.fr.plugin.chart.base.AttrLabel | 109 | missing | (漏账：批排期时人工归入) |
| com.fr.chart.base.AttrBorder | 93 | missing | 批B |
| com.fr.plugin.chart.attr.axis.VanChartAxis | 92 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.format.AttrTooltipAreaNameFormat | 61 | missing | (漏账：批排期时人工归入) |
| com.fr.data.impl.DatabaseDictionary | 60 | missing | 批D(4缺) |
| com.fr.plugin.chart.base.AttrSeriesStackAndAxis | 58 | missing | (漏账：批排期时人工归入) |
| com.fr.report.write.BuiltInSQLSubmiter | 55 | missing | 批F |
| com.fr.data.impl.TableDataDictionary | 54 | missing | 批D(4缺) |
| com.fr.plugin.chart.base.format.AttrTooltipMapValueFormat | 54 | missing | (漏账：批排期时人工归入) |
| com.fr.base.SimpleDateFormatThreadSafe | 53 | missing | 批D(日期/文本缺) |
| com.fr.write.config.IntelliDMLConfig | 53 | missing | 批F |
| com.fr.chart.base.AttrAlpha | 52 | missing | 批B |
| com.fr.plugin.chart.base.VanChartAttrTrendLine | 42 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.VanChartAttrMarker | 42 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.VanChartAttrLine | 36 | missing | (漏账：批排期时人工归入) |
| com.fr.report.mobile.DefaultMobileParamStyle | 27 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.AttrSeriesImageBackground | 26 | missing | (漏账：批排期时人工归入) |
| com.fr.js.ReportletHyperlinkDialogAttr | 26 | missing | 批E(缺3) |
| com.fr.extended.chart.ExtendedTableDataSet | 25 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.format.AttrTooltipSummaryValueFormat | 24 | missing | (漏账：批排期时人工归入) |
| com.fr.chart.web.ChartHyperRelateCellLink | 18 | missing | (漏账：批排期时人工归入) |
| com.fr.report.web.button.write.AppendColumnRow | 18 | missing | 批F |
| com.fr.report.web.button.write.ShowCellValue | 16 | missing | 批F |
| com.fr.form.ui.mobile.impl.DefaultMobileBookMarkStyle | 14 | missing | (漏账：批排期时人工归入) |
| com.fr.chart.chartattr.ChartCommonCondition | 14 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.custom.VanChartCustomPlot | 12 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.format.AttrTooltipStartAndEndNameFormat | 12 | missing | (漏账：批排期时人工归入) |
| com.fr.chart.base.AttrBackground | 12 | missing | (漏账：批排期时人工归入) |
| com.fr.report.web.button.write.DeleteRowButton | 11 | missing | 批F |
| com.fr.form.ui.mobile.impl.DefaultMobileParameterStyle | 9 | missing | (漏账：批排期时人工归入) |
| com.fr.report.web.button.write.AppendRowButton | 9 | missing | 批F |
| com.fr.plugin.chart.map.attr.AttrMapLabel | 8 | missing | 批I |
| com.fr.data.impl.FormulaDictionary | 8 | missing | 批D(4缺) |
| com.fr.plugin.chart.base.AttrBorderWithAlpha | 8 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.format.AttrTooltipXFormat | 8 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.format.AttrTooltipSizeFormat | 8 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.map.attr.AttrMapTooltip | 8 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.format.AttrTooltipYFormat | 8 | missing | (漏账：批排期时人工归入) |
| com.fr.chart.base.AttrContents | 7 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.attr.axis.VanChartAlertValue | 7 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.map.data.VanMapMoreNameCDDefinition | 7 | missing | 批I |
| com.fr.plugin.chart.map.line.condition.AttrCurve | 6 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.bubble.attr.VanChartAttrBubble | 6 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.AttrEffect | 6 | missing | (漏账：批排期时人工归入) |
| com.fr.base.TextFormat | 6 | missing | 批D(日期/文本缺) |
| com.fr.data.impl.DynamicSQLDict | 6 | missing | 批D(4缺) |
| com.fr.plugin.chart.scatter.attr.ScatterAttrTooltip | 6 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.map.VanChartMapPlot | 6 | missing | 批I |
| com.fr.plugin.chart.base.AttrAreaSeriesFillColorBackground | 6 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.map.line.condition.AttrLineEffect | 6 | missing | (漏账：批排期时人工归入) |
| com.fr.report.cell.cellattr.BarcodePresent | 5 | missing | 批G |
| com.fr.report.web.button.write.ImportExcelData | 5 | missing | 批F |
| com.fr.data.VerifyItem | 5 | missing | 批F |
| com.fr.chart.chartattr.CategoryAxis | 5 | missing | (漏账：批排期时人工归入) |
| com.fr.form.ui.MultiFileEditor | 5 | missing | (漏账：批排期时人工归入) |
| com.fr.general.date.FineDateFormat | 5 | missing | (漏账：批排期时人工归入) |
| com.fr.report.mobile.EmptyMobileParamStyle | 4 | missing | (漏账：批排期时人工归入) |
| com.fr.form.ui.reg.CustomReg | 4 | missing | (漏账：批排期时人工归入) |
| com.fr.report.web.button.form.TreeNodeToggleButton | 4 | missing | (漏账：批排期时人工归入) |
| com.fr.report.web.button.write.DeleteColumnRow | 4 | missing | (漏账：批排期时人工归入) |
| com.fr.form.ui.reg.PhoneReg | 4 | missing | 批F |
| com.fr.plugin.chart.kpi.KPIDataConfig | 4 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.bubble.VanChartBubblePlot | 4 | missing | 批I |
| com.fr.report.poly.PolyECBlock | 4 | missing | 批J |
| com.fr.form.ui.reg.MobileReg | 4 | missing | (漏账：批排期时人工归入) |
| com.fr.report.cell.cellattr.core.group.CustomGrouper | 4 | missing | 批G |
| com.fr.plugin.chart.kpi.KPIElectronChart | 3 | missing | (漏账：批排期时人工归入) |
| com.fr.form.ui.reg.PostCardReg | 3 | missing | (漏账：批排期时人工归入) |
| com.fr.write.config.DeleteConfig | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.meter.MeterDataConfig | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.write.config.UpdateConfig | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.wisdomtree.WisdomTreeDataConfig | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.report.web.button.write.CustomizeImportExcelData | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.form.ui.CustomToolBarButton | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.data.impl.ExcelTableData | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.globe.Bar3DOnGlobeDataConfig | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.js.Commit2DBJavaScript | 2 | missing | 批E(缺3) |
| com.fr.plugin.chart.map.groupmap.GroupMapPointDataConfig | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.report.write.ValueVerifier | 2 | missing | 批F |
| com.fr.data.impl.RecursionTableData | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.catalog.CatalogDataConfig | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.form.ui.reg.IDCardReg | 2 | missing | 批F |
| com.fr.plugin.chart.fluid.FluidDataConfig | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.catalog.CatalogChart | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.meter.MeterChart | 2 | missing | 批I |
| com.fr.plugin.chart.globe.slideshowmap.SlideShowMapChart | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.base.AttrMarkerAlpha | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.globe.slideshowmap.SlideShowMapDataConfig | 2 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.time.TimeGearChart | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.column.arccolumn.ArcColumnChart | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.meter.pixelgrid.PixelGridChart | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.globe.scatter3D.Scatter3DOnGlobeChart | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.column.arccolumn.ArcColumnDataConfig | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.map.groupmap.GroupMapAreaDataConfig | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.report.web.button.write.ClearStashedButton | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.pie.carouselpie.CarouselPieChart | 1 | missing | 批I |
| com.fr.plugin.chart.globe.lines3D.Lines3DOnGlobeDataConfig | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.particlecounter.ParticleCounterChart | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.map.groupmap.GroupMapChart | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.column.carouselbar.CarouselBarChart | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.column.carouselbar.CarouselBarChartDataConfig | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.multidata.ExtendedMultiDataSet | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.globe.lines3D.Lines3DOnGlobeChart | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.particlecounter.ParticleCounterDataConfig | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.column.shapecolumn.ShapeColumnFieldCollection | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.wisdomtree.WisdomTreeModel | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.report.web.button.write.StashButton | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.fluid.FluidChart | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.globe.bar3D.Bar3DOnGlobeChart | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.base.io.FileAttrErrorMarker | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.report.poly.PolyWorkSheet | 1 | missing | 批J |
| com.fr.plugin.chart.kpi.KPIChart | 1 | missing | 批I |
| com.fr.plugin.chart.map.groupmap.GroupMapLineDataConfig | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.column.shapecolumn.ShapeColumnChart | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.heatmap.VanChartHeatMapPlot | 1 | missing | 批I |
| com.fr.plugin.chart.pie.carouselpie.CarouselPieDataConfig | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.wisdomtree.WisdomTreeElectron | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.chartx.data.DataSetDefinition | 1 | missing | (漏账：批排期时人工归入) |
| com.fr.data.condition.ObjectCondition | 506 | partial | (漏账：批排期时人工归入) |
| com.fr.plugin.chart.attr.axis.VanChartValueAxis | 129 | partial | (漏账：批排期时人工归入) |
| com.fr.base.iofileattr.TemplateIdAttrMark | 23 | partial | 批C |
| com.fr.chart.chartattr.ValueAxis | 10 | partial | (漏账：批排期时人工归入) |
| com.fr.report.web.ui.impl.page.First | 1 | partial | (漏账：批排期时人工归入) |
| com.fr.report.web.ui.impl.Email | 1 | partial | (漏账：批排期时人工归入) |
| com.fr.report.web.ui.impl.FlashPrint | 1 | partial | (漏账：批排期时人工归入) |
| com.fr.report.web.ui.impl.page.Next | 1 | partial | (漏账：批排期时人工归入) |
| com.fr.report.web.ui.impl.page.PageNavi | 1 | partial | 既有 |
| com.fr.report.web.ui.impl.page.Previous | 1 | partial | (漏账：批排期时人工归入) |
| com.fr.report.web.ui.impl.page.Last | 1 | partial | (漏账：批排期时人工归入) |
| com.fr.report.web.ui.impl.Export | 1 | partial | 既有 |
| com.fr.report.web.ui.impl.Print | 1 | partial | (漏账：批排期时人工归入) |

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
| writeButtons | missing (缺: AppendRowButton+DeleteRowButton+AppendColumnRow+ShowCellValue+ImportExcelData) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| editor (参数控件族) | full | test_widgets.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | v4.2/待回填 |
| dict | partial (缺: DatabaseDictionary+TableDataDictionary+DynamicSQLDict+FormulaDictionary) | test_cellattrs.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| formats | partial (缺: SimpleDateFormatThreadSafe+TextFormat) | sales_demo.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 数字格式既有 |
| chart legacy | full | sales_demo_chart.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #26 |
| chart Van | full | test_vanchart.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #46 |
| chartDeco | missing (缺: AttrTooltip+AttrLabelDetail+AttrBorder+AttrAlpha+ConditionAttr+TrendLine) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| chartdata | full | sales_demo_chart.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #26 |
| webpage | full | test_v41.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 |
| hyperlink | partial (缺: ParameterJavaScript+ReportletHyperlinkDialogAttr+Commit2DBJavaScript) | sales_demo_link.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #25/#45 |
| jsEvents | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #?/#45 |
| freeze | partial (缺: FrozenState+RepeatAndCollapsible) | db_laser_subtotal.js | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #31 |
| headerfooter | missing (缺: PageAttrProperty+headerfooter+HeaderFooter) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| template marks | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| submit (填报) | missing (缺: BuiltInSQLSubmiter+IntelliDMLConfig+VerifyItem+ValueVerifier) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| reg 校验族 | missing (缺: NoneReg+PhoneReg+IDCardReg) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| sort | missing (缺: CellSortAttr) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 受阻断 |
| subreport | missing (缺: SubReport) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| diagonal | missing (缺: Diagonal) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| barcode | missing (缺: BarcodePresent) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| image | full | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #45 观察 |
| map | missing (缺: VanChartMapPlot+AttrMapLabel+VanMapMoreNameCDDefinition) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| specialcharts | missing (缺: MeterChart+KPIChart+VanChartHeatMapPlot+CarouselPieChart+VanChartBubblePlot) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| poly | missing (缺: PolyECBlock+PolyWorkSheet) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| group (自定义分组) | missing (缺: CustomGrouper) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | 待回填 |
| 局部样式(样式肾上) | partial (缺: stylesOf) | — | verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB | #31 |

## C. feature 标签层三色表（demo 普查 27 tag → 当前状态；tag 经 ALIAS 并到语义族）

| tag | demo(240) | 状态 |
|---|---|---|
| background | 240 | full |
| sheet | 240 | full |
| headerfooter | 207 | missing 0x3 |
| condition | 163 | full |
| funcgroup | 133 | full |
| webpage | 117 | full |
| formula | 101 | full |
| chart | 62 | missing 0x6 |
| sort | 55 | missing 0x1 |
| html | 49 | full |
| editor | 45 | full |
| dict | 39 | partial 0x4 |
| summary | 38 | full |
| submit | 35 | missing 0x12 |
| hyperlink | 27 | partial 0x3 |
| chartdata | 25 | full |
| freeze | 21 | partial 0x2 |
| richtext | 21 | full |
| subreport | 18 | missing 0x1 |
| float | 18 | full |
| diagonal | 15 | missing 0x1 |
| watermark | 7 | full |
| map | 7 | missing 0x3 |
| barcode | 4 | missing 0x1 |
| image | 2 | full |
| group | 1 | missing 0x1 |
