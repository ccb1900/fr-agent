// probe_vanchart4.js — 官方 demo pie/column VanChart 对象属性 vs new 默认值逐项对拍
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
function findChart(path) {
  var wb = TWBIO.readTemplateWorkBook(path);
  var ws = wb.getReport(0);
  for (var r = 0; r < 40; r++) for (var c = 0; c < 20; c++) {
    var v = ws.getCellElement(c, r) ? ws.getCellElement(c, r).getValue() : null;
    if (v != null && String(v.getClass().getName()).indexOf('ChartCollection') >= 0) return v.getSelectedChart();
  }
  return null;
}
function props(o, names) {
  var out = [];
  for (var i = 0; i < names.length; i++) {
    try { out.push(names[i] + '=' + String(o[names[i]]())); } catch (e) { out.push(names[i] + '=ERR'); }
  }
  return out.join(' ');
}
var PIE_PROPS = ['getRadius', 'getRoseType', 'getStartAngle', 'getEndAngle', 'getInnerRadiusPercent', 'isLargeDataModel', 'isGisKindLabel', 'isMapPlot', 'isMeterPlot', 'getCustomType', 'getPlotID', 'getVersion', 'isAutoBackground', 'getAutoRefreshPerSecond', 'isSeriesDragEnable', 'isShadow', 'isRoundBorder', 'getAlpha', 'getPlotFillStyle', 'getPlotStyle', 'isNullValueBreak', 'isOnlyIntervalBackground'];
var COL_PROPS = ['getCategoryIntervalPercent', 'getSeriesOverlapPercent', 'isStacked?', 'getColumnWidth', 'getCombinedSize', 'getPlotID', 'isAxisRotation', 'is3D'];
function dumpChart(label, ch) {
  var plot = ch.getPlot();
  print('== ' + label + ' ' + plot.getClass().getName());
  if (plot.getClass().getName().indexOf('Pie') >= 0) print('   ' + props(plot, PIE_PROPS));
  var ya = plot.getyAxis ? plot.getyAxis() : null;
  print('   yAxis=' + (ya == null ? 'null' : 'customMax=' + ya.isCustomMaxValue() + ' max=' + ya.getMaxValue() + ' min=' + ya.getMinValue() + ' mainUnit=' + ya.getMainUnit() + ' labelNumber=' + ya.getLabelNumber()));
  var lg = plot.getLegend();
  print('   legend=' + (lg == null ? 'null' : 'pos=' + lg.getPosition() + ' vis=' + lg.getLegendVisible()));
}
var demo = findChart('demo/chart/basic/环形图.cpt');
if (demo == null) demo = findChart('doc/Chart/Pie/饼图.cpt');
print('demo found: ' + (demo != null));
dumpChart('DEMO', demo);
dumpChart('NEW', new (J('com.fr.plugin.chart.vanchart.VanChart'))(new (J('com.fr.plugin.chart.PiePlot4VanChart'))()));
var newCol = new (J('com.fr.plugin.chart.vanchart.VanChart'))(new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))());
dumpChart('NEWCOL', newCol);
print('PROBE_VANCHART4_DONE');
J('java.lang.System').exit(0);
