// probe_vanchart5.js — VanChartLegend 方法面 + demo/new pie 关键属性补遗
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

function msurface(c, prefix) {
  var a = c.getMethods(), u = {};
  for (var i = 0; i < a.length; i++) { var n = a[i].getName(); if (prefix.test(n)) u[n] = 1; }
  return Object.keys(u).sort().join(',');
}
var VL = J('com.fr.plugin.chart.attr.VanChartLegend');
print('VANCHARTLEGEND chain=' + VL.class.getSuperclass().getName());
print('VANCHARTLEGEND M ' + msurface(VL.class, /^(set|get|is)/));
var OL = J('com.fr.chart.chartattr.Legend');
print('OLDLEGEND M ' + msurface(OL.class, /^(set|get|is)/));
// VanChart 标题/工具
print('VANCHART title surface: ' + msurface(J('com.fr.plugin.chart.vanchart.VanChart').class, /^(set|get)Title|Switch/));
print('PROBE_VANCHART5_DONE');
J('java.lang.System').exit(0);
