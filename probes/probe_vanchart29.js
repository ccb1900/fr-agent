// probe_vanchart29.js — H: 打印 demo 载体类名；G2: 我们 wb + 4×80pt 列宽 + span5 格（排除小尺寸假象）
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
var CSCS = J('com.fr.chart.chartdata.ChartSummaryColumn');

// demo 载体类名
var dwb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('demo/chart/ColumnChart/国旗柱形图.cpt');
var dws = dwb.getReport(0);
print('DEMO wb class=' + dwb.getClass().getName() + ' sheet=' + dws.getClass().getName());

// dsVan 工厂
function dsVanOf(wb) {
  var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
  etd.addColumn('机型', Class.forName('java.lang.String'));
  etd.addColumn('产量', Class.forName('java.lang.Integer'));
  etd.addColumn('良率', Class.forName('java.lang.Integer'));
  etd.addRow(J('java.util.Arrays').asList(['A线', J('java.lang.Integer').valueOf(120), J('java.lang.Integer').valueOf(98)]));
  etd.addRow(J('java.util.Arrays').asList(['B线', J('java.lang.Integer').valueOf(150), J('java.lang.Integer').valueOf(95)]));
  etd.addRow(J('java.util.Arrays').asList(['C线', J('java.lang.Integer').valueOf(90), J('java.lang.Integer').valueOf(99)]));
  etd.addRow(J('java.util.Arrays').asList(['D线', J('java.lang.Integer').valueOf(200), J('java.lang.Integer').valueOf(93)]));
  wb.putTableData('dsVan', etd);
}
function vanCollection() {
  var plot = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))();
  var chart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
  chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
  var cols = J('java.lang.reflect.Array').newInstance(CSCS.class, 2);
  cols[0] = new (CSCS)('产量', '产量', new (J('com.fr.data.util.function.NoneFunction'))());
  cols[1] = new (CSCS)('良率', '良率', new (J('com.fr.data.util.function.NoneFunction'))());
  chart.setFilterDefinition(new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('dsVan'), '机型', cols));
  var cc = new (J('com.fr.chart.chartattr.ChartCollection'))();
  cc.addChart(chart);
  return cc;
}
function render(tag, wb) {
  var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
  var os = new (J('java.io.FileOutputStream'))('D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent/_probe_van_' + tag + '.png');
  new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
  os.close();
  print('render ' + tag + ' OK');
}

// G2：我们 wb，4 列 ×80pt、行高 160pt、cell span 5×5（图区 ~400×800pt）
var wb = new (J('com.fr.main.impl.WorkBook'))();
var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
wb.addReport('sheet1', sheet);
for (var c = 0; c < 6; c++) sheet.setColumnWidth(c, fuPt(80));
for (var r = 0; r < 6; r++) sheet.setRowHeight(r, fuPt(160));
dsVanOf(wb);
var ce = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, vanCollection());
ce.setColumnSpan(6); ce.setRowSpan(5);
sheet.addCellElement(ce);
render('G2', wb);

// H2：demo wb 载体，但 cell 换成 6 列行高同 G2 的区域（demo sheet 原生行高更大）——类同 F，跳过
print('PROBE_VANCHART29_DONE');
J('java.lang.System').exit(0);
