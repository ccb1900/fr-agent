// probe_vanchart20.js — 裸构造 VanChart 拷贝 demo 图的 theme/attr 逐项验证
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
print('demo=' + demo.getClass().getName() + '/' + demo.getPlot().getClass().getName());

// VanChart / Chart 全 set 方法面（找 theme/attr 相关 setter）
var cm = Class.forName('com.fr.chart.chartattr.Chart').getMethods();
var sets = [];
for (var i = 0; i < cm.length; i++) { var n = cm[i].getName(); if (/^set/.test(n) || /heme/.test(n) || /Provider/.test(n)) sets.push(n + '(' + cm[i].getParameterTypes().length + ')'); }
print('CHART surface: ' + sets.sort().join(', '));

// demo 侧 getter 相关值
var getters = ['getChartThemeStyleProvider', 'getDataProcessor', 'getDataProcessor4Definition', 'getFilterDefinition', 'getChartName', 'getID', 'getChartHttpLink'];
for (var i = 0; i < getters.length; i++) {
  try { print('demo.' + getters[i] + ' = ' + String(demo[getters[i]]()).substring(0, 90)); } catch (e) { print('demo.' + getters[i] + ' N/A'); }
}
print('PROBE_VANCHART20_DONE');
J('java.lang.System').exit(0);
