// probe_vanchart28.js — 我们 wb 载体复刻（main.impl.WorkBook + worksheet.WorkSheet + 160pt 行高）+ F 同款双系列图
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
try { J('com.fr.general.I18nResource').getInstance(); } catch (e) { }
try { J('com.fr.general.GeneralContext').setLocale(new (J('java.util.Locale'))('zh', 'CN')); } catch (e) { }

var FU = J('com.fr.stable.unit.FU');
function fuPt(pt) { return FU.getInstance(Math.round(pt * 12700)); }

var wb = new (J('com.fr.main.impl.WorkBook'))();
var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
wb.addReport('sheet1', sheet);
sheet.setColumnWidth(0, fuPt(320));

// dsVan
var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
etd.addColumn('机型', Class.forName('java.lang.String'));
etd.addColumn('产量', Class.forName('java.lang.Integer'));
etd.addColumn('良率', Class.forName('java.lang.Integer'));
etd.addRow(J('java.util.Arrays').asList(['A线', J('java.lang.Integer').valueOf(120), J('java.lang.Integer').valueOf(98)]));
etd.addRow(J('java.util.Arrays').asList(['B线', J('java.lang.Integer').valueOf(150), J('java.lang.Integer').valueOf(95)]));
etd.addRow(J('java.util.Arrays').asList(['C线', J('java.lang.Integer').valueOf(90), J('java.lang.Integer').valueOf(99)]));
etd.addRow(J('java.util.Arrays').asList(['D线', J('java.lang.Integer').valueOf(200), J('java.lang.Integer').valueOf(93)]));
wb.putTableData('dsVan', etd);
print('dsVan rows=' + etd.getRowCount());

var plot = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))();
var chart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
var CSCS = J('com.fr.chart.chartdata.ChartSummaryColumn');
var cols = J('java.lang.reflect.Array').newInstance(CSCS.class, 2);
cols[0] = new (CSCS)('产量', '产量', new (J('com.fr.data.util.function.NoneFunction'))());
cols[1] = new (CSCS)('良率', '良率', new (J('com.fr.data.util.function.NoneFunction'))());
chart.setFilterDefinition(new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('dsVan'), '机型', cols));
var cc = new (J('com.fr.chart.chartattr.ChartCollection'))();
cc.addChart(chart);

sheet.setRowHeight(0, fuPt(160));
sheet.setRowHeight(1, fuPt(160));
var ce = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, cc);
sheet.addCellElement(ce);
print('cell in OK wb=' + wb.getClass().getName() + ' sheet=' + sheet.getClass().getName());

var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
var os = new (J('java.io.FileOutputStream'))('D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent/_probe_van_axis_G.png');
new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
os.close();
print('render G OK');
print('PROBE_VANCHART28_DONE');
J('java.lang.System').exit(0);
