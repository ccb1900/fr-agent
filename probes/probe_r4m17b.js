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
var c = Class.forName('com.fr.chart.chartattr.Axis');
var ms = c.getMethods();
var hits = [];
for (var i = 0; i < ms.length; i++) { var n = String(ms[i].getName()); if (/itle|AxisName|NameText/.test(n) && hits.indexOf(n) < 0) hits.push(String(ms[i]).replace('public ', '')); }
print('== Axis title methods:\n' + hits.join('\n'));
var t = Class.forName('com.fr.chart.chartattr.Title');
var ms2 = t.getMethods(); var h2 = [];
for (var j = 0; j < ms2.length; j++) { var n2 = String(ms2[j].getName()); if (/Text|Font|Content/.test(n2) && h2.indexOf(n2) < 0) h2.push(String(ms2[j]).replace('public ', '')); }
print('== Title methods:\n' + h2.join('\n'));
print('DONE');
J('java.lang.System').exit(0);
