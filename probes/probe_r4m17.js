// probe_r4m17.js — axis 渲染定性（axisYUnit 主刻度/轴标题/预警线/label 字色）：
//   大格子 vline，axisY{min:0,max:300,unit:50,title:'产量',alerts:[150 红]}, axisX{title:'机型'}, label{fontPt,color}。
//   PNG 目检：刻度 0/50/100/150/200/250/300（axisYUnit 渲染案）+ 红色预警横线 + 轴标题出现。
var Class = Java.type('java.lang.Class');
var J = function (n) { return Java.type(n); };
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(),
  new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(),
  new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(),
  new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(Class.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
var GC = J('com.fr.general.GeneralContext');
var loc0 = GC.getLocale();
GC.setLocale(new (J('java.util.Locale'))('zh', 'CN'));
J('com.fr.general.I18nResource').getInstance();

var wb = new (J('com.fr.main.impl.WorkBook'))();
var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
etd.addColumn('机型', Class.forName('java.lang.String'));
etd.addColumn('产量', Class.forName('java.lang.Integer'));
etd.addColumn('良率', Class.forName('java.lang.Integer'));
etd.addRow(J('java.util.Arrays').asList(['A线', J('java.lang.Integer').valueOf(120), J('java.lang.Integer').valueOf(98)]));
etd.addRow(J('java.util.Arrays').asList(['B线', J('java.lang.Integer').valueOf(200), J('java.lang.Integer').valueOf(93)]));
etd.addRow(J('java.util.Arrays').asList(['C线', J('java.lang.Integer').valueOf(160), J('java.lang.Integer').valueOf(85)]));
wb.putTableData('dsVan', etd);
var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
var plot = new (J('com.fr.plugin.chart.line.VanChartLinePlot'))();
var chart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
var CSC = Class.forName('com.fr.chart.chartdata.ChartSummaryColumn');
var cols = J('java.lang.reflect.Array').newInstance(CSC, 2);
cols[0] = new (J('com.fr.chart.chartdata.ChartSummaryColumn'))('产量', '产量', new (J('com.fr.data.util.function.NoneFunction'))());
cols[1] = new (J('com.fr.chart.chartdata.ChartSummaryColumn'))('良率', '良率', new (J('com.fr.data.util.function.NoneFunction'))());
chart.setFilterDefinition(new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('dsVan'), '机型', cols));
// Y 轴（applyAxisCommon 同构 + max/min/unit + 预警）
var yA = plot.getyAxis();
yA.setMaxValue(new (J('com.fr.base.Formula'))('=300')); yA.setCustomMaxValue(true);
yA.setMinValue(new (J('com.fr.base.Formula'))('=0')); yA.setCustomMinValue(true);
yA.setMainUnit(new (J('com.fr.base.Formula'))('=50')); yA.setCustomMainUnit(true);
yA.setAxisName('产量'); yA.setShowAxisTitle(true);
yA.setTitle(new (J('com.fr.chart.chartattr.Title'))('产量'));
var axisFont = J('com.fr.general.FRFont').getInstance('SimHei', 0, 10, new (J('java.awt.Color'))(0x33, 0x33, 0x33));
yA.getTextAttr().setFRFont(axisFont);
var AV = J('com.fr.plugin.chart.attr.axis.VanChartAlertValue');
var av = new AV();
av.setAlertValueFormula(new (J('com.fr.base.Formula'))('=150'));
av.setAlertContent('预警150');
av.setLineColor(new (J('com.fr.chart.base.AttrColor'))(new (J('java.awt.Color'))(0xD0, 0x39, 0x2E)));
var _als = new (J('com.fr.chart.base.AttrLineStyle'))(); _als.setLineStyle(2); av.setLineStyle(_als);
var alist = new (J('java.util.ArrayList'))(); alist.add(av);
yA.setAlertValues(alist);
// X 轴标题
var xA = plot.getxAxis();
xA.setAxisName('机型'); xA.setShowAxisTitle(true);
xA.setTitle(new (J('com.fr.chart.chartattr.Title'))('机型'));
// label（字色+字号，渲染可见性案）
var s = new (J('com.fr.chart.chartglyph.ConditionCollection'))();
var d = new (J('com.fr.chart.chartglyph.ConditionAttr'))(); d.setName('');
var lt = new (J('com.fr.chart.chartglyph.ConditionAttr'))(); lt.setName('数值标签');
lt.setCondition(new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()));
var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))(); lab.setEnable(true);
var ld = lab.getAttrLabelDetail();
ld.setPosition(2);
ld.setTextAttr(function () { var ta = new (J('com.fr.chart.base.TextAttr'))(); ta.setFRFont(J('com.fr.general.FRFont').getInstance('SimHei', 0, 10, new (J('java.awt.Color'))(0x33, 0x33, 0x33))); return ta; }());
lt.addDataSeriesCondition(lab);
s.addConditionAttr(lt); s.setDefaultAttr(d);
plot.setConditionCollection(s);
var cell = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, new (J('com.fr.chart.chartattr.ChartCollection'))());
cell.getValue().addChart(chart);
sheet.addCellElement(cell);
sheet.setRowHeight(0, J('com.fr.stable.unit.FU').getInstance(Math.round(420 * 12700)));
sheet.setColumnWidth(0, J('com.fr.stable.unit.FU').getInstance(Math.round(800 * 12700)));
wb.addReport('sheet1', sheet);
var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
if (!rb) { print('!! execute null'); } else {
  var pngP = 'D:/fineagent/logs/_r4m17_axis.png';
  var osP = new (J('java.io.FileOutputStream'))(pngP);
  new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
  osP.close();
  print('== M17 PNG ' + pngP);
}
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);
