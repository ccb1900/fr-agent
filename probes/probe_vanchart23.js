// probe_vanchart23.js — 官方纯柱形 demo 模板 + 我们的 def/内嵌数据：隔离"数据 vs 图对象"
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
J('com.fr.general.I18nResource').getInstance();
J('com.fr.general.GeneralContext').setLocale(new (J('java.util.Locale'))('zh', 'CN'));

var ETD = J('com.fr.data.impl.EmbeddedTableData');
// 内嵌数据集构造 API 面
var etm = Array.prototype.map.call(ETD.class.getMethods(), function (m) { return m.getName(); }).filter(function (n, i, a) { return a.indexOf(n) === i; });
print('EmbeddedTableData M: ' + etm.join(','));

var TWBIO = J('com.fr.io.TemplateWorkBookIO');
var wb = TWBIO.readTemplateWorkBook('demo/chart/ColumnChart/国旗柱形图.cpt');

// WorkBook 表数据方法面
var wmm = Array.prototype.map.call(wb.getClass().getMethods(), function (m) { return m.getName(); }).filter(function (n, i, a) { return /TableData/i.test(n); });
print('WorkBook TableData M: ' + wmm.join(','));

// 建 dsMy（同我们的 spec 数据，与 lib/object.js 内嵌数据集同路：addColumn+addRow(List)+putTableData）
var etd = new (ETD)();
etd.addColumn('机型', Class.forName('java.lang.String'));
etd.addColumn('产量', Class.forName('java.lang.Integer'));
etd.addColumn('良率', Class.forName('java.lang.Integer'));
etd.addRow(J('java.util.Arrays').asList(['A线', J('java.lang.Integer').valueOf(120), J('java.lang.Integer').valueOf(98)]));
etd.addRow(J('java.util.Arrays').asList(['B线', J('java.lang.Integer').valueOf(150), J('java.lang.Integer').valueOf(95)]));
etd.addRow(J('java.util.Arrays').asList(['C线', J('java.lang.Integer').valueOf(90), J('java.lang.Integer').valueOf(99)]));
etd.addRow(J('java.util.Arrays').asList(['D线', J('java.lang.Integer').valueOf(200), J('java.lang.Integer').valueOf(93)]));
print('rows=' + etd.getRowCount());
wb.putTableData('dsMy', etd);
print('putTableData OK');

// 换图 def：MoreName(dsMy/机型/[产量] NoneFunction)
var ws = wb.getReport(0);
var demo = null;
for (var r = 0; r < 40 && demo == null; r++) for (var c = 0; c < 20; c++) {
  var v = ws.getCellElement(c, r) ? ws.getCellElement(c, r).getValue() : null;
  if (v != null && String(v.getClass().getName()).indexOf('ChartCollection') >= 0) { demo = v.getSelectedChart(); break; }
}
print('demo plot=' + demo.getPlot().getClass().getName());
var CSCS = J('com.fr.chart.chartdata.ChartSummaryColumn');
var cols = J('java.lang.reflect.Array').newInstance(CSCS.class, 1);
cols[0] = new (CSCS)('产量', '产量', new (J('com.fr.data.util.function.NoneFunction'))());
var myDef = new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('dsMy'), '机型', cols);
demo.setFilterDefinition(myDef);
print('def swapped to our-shape on demo object');

var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
var os = new (J('java.io.FileOutputStream'))('D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent/_probe_van_mydata.png');
new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
os.close();
print('PNG OUT OK');
print('PROBE_VANCHART23_DONE');
J('java.lang.System').exit(0);
