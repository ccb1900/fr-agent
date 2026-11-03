// probe_vanchart17.js — VanChart(Plot) 构造后 plot 同一性 + 轴设置读回
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

var plot = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))();
var vc = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
var pg = vc.getPlot();
print('identity: getPlot()===plot ? ' + (pg === plot) + '  plotClass=' + pg.getClass().getName());
var yaOld = plot.getyAxis(), yaNew = pg.getyAxis();
print('yAxis identity: ' + (yaOld === yaNew));
yaNew.setMaxValue(new (J('com.fr.base.Formula'))('=1000'));
yaNew.setCustomMaxValue(true);
print('old plot axis max after set on chart-side axis: ' + plot.getyAxis().getMaxValue() + ' custom=' + plot.getyAxis().isCustomMaxValue());
print('chart-side axis max: ' + yaNew.getMaxValue() + ' custom=' + yaNew.isCustomMaxValue());
print('PROBE_VANCHART17_DONE');
J('java.lang.System').exit(0);
