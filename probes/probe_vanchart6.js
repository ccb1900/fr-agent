// probe_vanchart6.js — demo pie/柱形 数据定义类型反读
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

var TWBIO = J('com.fr.io.TemplateWorkBookIO');
function allCharts(path) {
  var wb = TWBIO.readTemplateWorkBook(path);
  var ws = wb.getReport(0);
  for (var r = 0; r < 40; r++) for (var c = 0; c < 20; c++) {
    var v = ws.getCellElement(c, r) ? ws.getCellElement(c, r).getValue() : null;
    if (v != null && String(v.getClass().getName()).indexOf('ChartCollection') >= 0) {
      var ch = v.getSelectedChart();
      var def = ch.getChartDataDefinition();
      print(path + ' (' + c + ',' + r + ') plot=' + ch.getPlot().getClass().getName() + ' isUseMoreDate=' + ch.isUseMoreDate() + ' def=' + String(ch.getFilterDefinition()).substring(0, 120) + ' [class=' + ch.getFilterDefinition().getClass().getName() + ']');
    }
  }
}
allCharts('demo/chart/basic/环形图.cpt');
allCharts('demo/analytics/柱形图变形.cpt');
print('PROBE_VANCHART6_DONE');
J('java.lang.System').exit(0);
