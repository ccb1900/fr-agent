// probe_vanchart19.js — demo 图 + 我们构造的 MoreNameCDDefinition 绑定 → 渲染裁决
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

var TWBIO = J('com.fr.io.TemplateWorkBookIO');
var wb = TWBIO.readTemplateWorkBook('demo/analytics/柱形图变形.cpt');

// 找图对象
var ws = wb.getReport(0);
var chart = null;
for (var r = 0; r < 40 && chart == null; r++) for (var c = 0; c < 20; c++) {
  var v = ws.getCellElement(c, r) ? ws.getCellElement(c, r).getValue() : null;
  if (v != null && String(v.getClass().getName()).indexOf('ChartCollection') >= 0) { chart = v.getSelectedChart(); break; }
}
print('chart=' + chart.getClass().getName() + ' plot=' + chart.getPlot().getClass().getName());
var oldDef = chart.getFilterDefinition();
print('oldDef=' + oldDef.getClass().getName());

// 我们同款构造的 MoreNameCDDefinition（demo 自己的 ds1/国家/数量/NoneFunction）
var CSCS = J('com.fr.chart.chartdata.ChartSummaryColumn');
var cols = J('java.lang.reflect.Array').newInstance(CSCS.class, 1);
cols[0] = new (CSCS)('数量', '数量', new (J('com.fr.data.util.function.NoneFunction'))());
var myDef = new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('ds1'), '国家', cols);
chart.setFilterDefinition(myDef);
print('def swapped: ' + chart.getFilterDefinition().getClass().getName());

var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
var os = new (J('java.io.FileOutputStream'))('D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent/_probe_van_swapped.png');
new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
os.close();
print('PNG OUT OK');
print('PROBE_VANCHART19_DONE');
J('java.lang.System').exit(0);
