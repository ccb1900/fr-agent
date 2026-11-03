// probe_vanchart18.js — 官方 demo VanChart 用同管线渲染（地面真值）+ 内存对象轴属性反读
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

// locale 防护（与 make_api 相同）
J('com.fr.general.I18nResource').getInstance();
J('com.fr.general.GeneralContext').setLocale(new (J('java.util.Locale'))('zh', 'CN'));

var TWBIO = J('com.fr.io.TemplateWorkBookIO');
var wb = TWBIO.readTemplateWorkBook('demo/analytics/柱形图变形.cpt');
var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
print('EXEC OK ' + rb);
var os = new (J('java.io.FileOutputStream'))('D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent/_probe_van_柱形图变形.png');
new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
os.close();
print('PNG OUT OK');

// 内存对象轴属性反读（官方 demo vs 我们的默认构造）
function dumpAxis(label, ch) {
  var plot = ch.getPlot();
  var ya = plot.getyAxis();
  print(label + ' axis: class=' + ya.getClass().getName());
  var attrs = ['isCustomMaxValue', 'getMaxValue', 'isCustomMinValue', 'getMinValue', 'getLabelNumber', 'getAxisType', 'getMainUnit'];
  for (var i = 0; i < attrs.length; i++) {
    try { print('  ' + attrs[i] + '=' + ya[attrs[i]]()); } catch (e) { print('  ' + attrs[i] + ' N/A'); }
  }
}
var wb2 = TWBIO.readTemplateWorkBook('demo/analytics/柱形图变形.cpt');
var ws2 = wb2.getReport(0);
for (var r = 0; r < 40; r++) for (var c = 0; c < 20; c++) {
  var v = ws2.getCellElement(c, r) ? ws2.getCellElement(c, r).getValue() : null;
  if (v != null && String(v.getClass().getName()).indexOf('ChartCollection') >= 0) {
    dumpAxis('DEMO(' + c + ',' + r + ')', v.getSelectedChart());
  }
}
var vp = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))();
var yaN = vp.getyAxis();
print('NEW axis: customMax=' + yaN.isCustomMaxValue() + ' max=' + yaN.getMaxValue() + ' min=' + yaN.getMinValue() + ' labelCount=' + yaN.getLabelNumber());
print('PROBE_VANCHART18_DONE');
J('java.lang.System').exit(0);
