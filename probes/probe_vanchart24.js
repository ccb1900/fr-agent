// probe_vanchart24.js — 纯 VanChartColumnPlot demo vs 裸构造：chart 级 + plot 级全 getter 对拍
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
var wb = TWBIO.readTemplateWorkBook('demo/chart/ColumnChart/国旗柱形图.cpt');
var ws = wb.getReport(0);
var demoChart = null;
for (var r = 0; r < 40 && demoChart == null; r++) for (var c = 0; c < 20; c++) {
  var v = ws.getCellElement(c, r) ? ws.getCellElement(c, r).getValue() : null;
  if (v != null && String(v.getClass().getName()).indexOf('ChartCollection') >= 0) { demoChart = v.getSelectedChart(); break; }
}
var mineChart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))());
print('demo plot=' + demoChart.getPlot().getClass().getName() + ' demo class=' + demoChart.getClass().getName());

var skip = /getClass|hashCode|iterator|toString|getClass,|getFilterDefinition|getSelectedChart|getDefinition|getCategoryName|getSeriesArray|getSeriesDefinitionArray|getValueName|getTopCate|getWheelZoom|getCustomPlotList|大小|Version$|getVersion/;
function diff(label, o1, o2) {
  var names = {};
  var ms1 = o1.getClass().getMethods();
  for (var i = 0; i < ms1.length; i++) { var n = ms1[i].getName(); if (/^get/.test(n)) names[n] = 1; }
  var ms2 = o2.getClass().getMethods();
  for (var i = 0; i < ms2.length; i++) { var n = ms2[i].getName(); if (/^get/.test(n)) names[n] = 1; }
  var keys = []; for (var n in names) keys.push(n); keys.sort();
  for (var k = 0; k < keys.length; k++) {
    var n = keys[k];
    if (skip.test(n)) continue;
    var v1 = '?', v2 = '?', has1 = false, has2 = false;
    try { var m1 = o1.getClass().getMethod(n); if (m1.getParameterTypes().length === 0) { v1 = String(m1.invoke(o1)); has1 = true; } } catch (e) { }
    try { var m2 = o2.getClass().getMethod(n); if (m2.getParameterTypes().length === 0) { v2 = String(m2.invoke(o2)); has2 = true; } } catch (e) { }
    if (!has1 && !has2) continue;
    var s1 = has1 ? (v1 == 'null' ? 'null' : v1.substring(0, 70)) : '(n/a)';
    var s2 = has2 ? (v2 == 'null' ? 'null' : v2.substring(0, 70)) : '(n/a)';
    s1 = s1.replace(/@[0-9a-f]+$/i, '@'); s2 = s2.replace(/@[0-9a-f]+$/i, '@');
    if (s1 !== s2) print(label + ' ' + n + ': DEMO=[' + s1 + '] MINE=[' + s2 + ']');
  }
}
diff('CHART', demoChart, mineChart);
print('---- PLOT LEVEL ----');
diff('PLOT', demoChart.getPlot(), mineChart.getPlot());
print('---- AXIS LEVEL ----');
diff('XAXIS', demoChart.getPlot().getxAxis(), mineChart.getPlot().getxAxis());
diff('YAXIS', demoChart.getPlot().getyAxis(), mineChart.getPlot().getyAxis());
print('---- TITLE LEVEL ----');
diff('TITLE', demoChart.getTitle(), mineChart.getTitle());
print('PROBE_VANCHART24_DONE');
J('java.lang.System').exit(0);
