// probe_legacy_axis.js — P1-B 前置：legacy Bar2DPlot/PiePlot getyAxis 实例与公共 setter 面（零渲染零写入）
var Class = Java.type('java.lang.Class');
var J = function (n) { return Java.type(n); };
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(), new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(), new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(), new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(Class.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
['com.fr.chart.chartattr.Bar2DPlot', 'com.fr.chart.chartattr.PiePlot', 'com.fr.chart.chartattr.LinePlot'].forEach(function (cn) {
  try {
    var plot = new (J(cn))();
    var ya = plot.getyAxis ? plot.getyAxis() : null;
    print('== ' + cn + ' yAxis=' + (ya ? String(ya.getClass().getName()) : 'null'));
    if (ya) {
      var ms = ya.getClass().getMethods();
      var hits = {};
      for (var i = 0; i < ms.length; i++) { var n = String(ms[i].getName()); if (/^(set|get)(AxisName|ShowAxisTitle|Title|TextAttr|AxisColor|AxisReversed|ArrowShow|ShowAxisLabel|MainGridColor|MainGridStyle|Rotation|Format|MaxValue|MinValue|MainUnit|CustomMaxValue|CustomMinValue|CustomMainUnit|AlertValues)/.test(n)) hits[n] = 1; }
      print('  setters: ' + Object.keys(hits).sort().join(' '));
    }
  } catch (e) { print('!! ' + cn + ' ' + e); }
});
print('DONE');
J('java.lang.System').exit(0);
