// probe_vanchart21.js — demo VanChart vs 裸构造 VanChart 全 getter 面一一对拍
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
var ws = wb.getReport(0);
var demo = null;
for (var r = 0; r < 40 && demo == null; r++) for (var c = 0; c < 20; c++) {
  var v = ws.getCellElement(c, r) ? ws.getCellElement(c, r).getValue() : null;
  if (v != null && String(v.getClass().getName()).indexOf('ChartCollection') >= 0) { demo = v.getSelectedChart(); break; }
}
var mine = new (J('com.fr.plugin.chart.vanchart.VanChart'))(new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))());

var skip = /getClass|getClassLoader|getRuntime|getName$|hashCode|iterator|toString|getFilterDefinition|getSelectedChart|getDefinition|getCategoryName|getSeriesArray|getSeriesDefinitionArray|getValueName|getTopCate|的大小/;
function diff(label, o1, o2) {
  var ms = o1.getClass().getMethods(), seen = {};
  for (var i = 0; i < ms.length; i++) { var n = ms[i].getName(); if (!/^get/.test(n)) continue; seen[n] = 1; }
  var ms2 = o2.getClass().getMethods();
  for (var i = 0; i < ms2.length; i++) { var n = ms2[i].getName(); if (!/^get/.test(n)) continue; seen[n] = 1; }
  for (var n in seen) {
    if (skip.test(n)) continue;
    var m1 = null, m2 = null;
    try { m1 = o1.getClass().getMethod(n); } catch (e) { m1 = null; }
    try { m2 = o2.getClass().getMethod(n); } catch (e) { m2 = null; }
    if (m1 == null || m2 == null) { print(label + ' only-one-side ' + n); continue; }
    if (m1.getParameterTypes().length !== 0) continue;
    var v1, v2;
    try { v1 = m1.invoke(o1); } catch (ex) { v1 = 'ERR ' + String(ex).substring(0, 40); }
    try { v2 = m2.invoke(o2); } catch (ex) { v2 = 'ERR ' + String(ex).substring(0, 40); }
    var s1 = (v1 == null ? 'null' : String(v1).substring(0, 60)).replace(/@[\w]+$/, '@');
    var s2 = (v2 == null ? 'null' : String(v2).substring(0, 60)).replace(/@[\w]+$/, '@');
    if (s1 !== s2) print(label + ' ' + n + ': DEMO=[' + s1 + '] MINE=[' + s2 + ']');
  }
}
diff('CHART', demo, mine);
diff('PLOT', demo.getPlot(), mine.getPlot());
print('PROBE_VANCHART21_DONE');
J('java.lang.System').exit(0);
