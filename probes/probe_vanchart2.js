// probe_vanchart2.js — VanChart 族枚举常量 + 轴/图例对象 API 面
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

// 枚举/常量类静态字段
var ENUMS = ['com.fr.plugin.chart.type.VanChartPlotType', 'com.fr.plugin.chart.type.GaugeStyle',
  'com.fr.plugin.chart.base.ChartRoseType', 'com.fr.plugin.chart.type.MapType',
  'com.fr.plugin.chart.custom.type.CustomStyle'];
for (var i = 0; i < ENUMS.length; i++) {
  try {
    var c = Class.forName(ENUMS[i]);
    var fs = c.getFields(), o = [];
    for (var k = 0; k < fs.length; k++) {
      var m = java.lang.reflect.Modifier;
      if (m.isStatic(fs[k].getModifiers())) o.push(fs[k].getName() + '\\=' + fs[k].get(null));
    }
    print('ENUM ' + ENUMS[i] + ' chain=' + c.getSuperclass().getName() + '\n   ' + o.join(' | '));
  } catch (e) { print('ENUM ' + ENUMS[i] + ' ERR ' + e); }
}

// 每种 plot 的默认轴/图例对象
var PLOTS = [['com.fr.plugin.chart.column.VanChartColumnPlot', []],
  ['com.fr.plugin.chart.line.VanChartLinePlot', []], ['com.fr.plugin.chart.PiePlot4VanChart', []],
  ['com.fr.plugin.chart.gauge.VanChartGaugePlot', []]];
for (var i = 0; i < PLOTS.length; i++) {
  var p = new (J(PLOTS[i][0]))();
  print('== ' + PLOTS[i][0]);
  try { var ya = p.getyAxis(); print('   yAxis=' + (ya == null ? 'null' : ya.getClass().getName() + (ya.getMaxValue != null ? ' max=' + ya.getMaxValue() : ''))); } catch (e) { print('   yAxis ERR ' + e); }
  try { var lg = p.getLegend(); print('   legend=' + (lg == null ? 'null' : lg.getClass().getName())); } catch (e) { print('   legend ERR ' + e); }
}
// VanChartAxis 方法面
var ax = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))().getyAxis();
var am = ax.getClass().getMethods(), au = {};
for (var i = 0; i < am.length; i++) { var n = am[i].getName(); if (/^(set|get|is)/.test(n)) au[n] = 1; }
print('AXIS ' + ax.getClass().getName() + ' M ' + Object.keys(au).sort().join(','));
print('PROBE_VANCHART2_DONE');
J('java.lang.System').exit(0);
