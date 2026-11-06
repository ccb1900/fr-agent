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
var c = Class.forName('com.fr.plugin.chart.attr.axis.VanChartAlertValue');
print('== super=' + String(c.getSuperclass()).replace('class ', ''));
var ms = c.getMethods();
for (var i = 0; i < ms.length; i++) { var s = String(ms[i]).replace('public ', ''); if (/set[A-Z]|get[A-Z]/.test(s) && !/getClass|getConditionType|getUsedFonts/.test(s)) print('  ' + s); }
var cs = c.getConstructors();
for (var k = 0; k < cs.length; k++) print('  CTOR ' + String(cs[k]).replace('public ', ''));
print('DONE');
J('java.lang.System').exit(0);
