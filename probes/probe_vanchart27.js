// probe_vanchart27.js — F: demo wb + 双系列 MoreName(产量,良率) → 复现"只 0 刻度"？
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

var TWBIO = J('com.fr.io.TemplateWorkBookIO');
var wb = TWBIO.readTemplateWorkBook('demo/chart/ColumnChart/国旗柱形图.cpt');
var ws = wb.getReport(0);
var cell = null;
for (var r = 0; r < 40 && cell == null; r++) for (var c = 0; c < 20; c++) {
  var ce = ws.getCellElement(c, r);
  if (ce != null && ce.getValue() != null && String(ce.getValue().getClass().getName()).indexOf('ChartCollection') >= 0) { cell = ce; break; }
}
// dsVan 同 make_api spec：机型/产量/良率 4 行
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
var ya = plot.getyAxis();
print('axis max=' + ya.getMaxValue() + ' min=' + ya.getMinValue() + ' customMax=' + ya.isCustomMaxValue());
var cc = new (J('com.fr.chart.chartattr.ChartCollection'))();
cc.addChart(chart);
cell.setValue(cc);

var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
var os = new (J('java.io.FileOutputStream'))('D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent/_probe_van_axis_F.png');
new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
os.close();
print('render F OK');
print('PROBE_VANCHART27_DONE');
J('java.lang.System').exit(0);
