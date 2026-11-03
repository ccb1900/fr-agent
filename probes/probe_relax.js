// probe_relax.js — RelaxationRestrictionConfig 方法面 print 全量
var J = function (n) { return Java.type(n); };
var ClassT = J('java.lang.Class');
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(),
  new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(),
  new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(),
  new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(ClassT.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
var RC = J('com.fr.report.restriction.config.RelaxationRestrictionConfig');
var c = ClassT.forName('com.fr.report.restriction.config.RelaxationRestrictionConfig');
var ms = c.getMethods();
for (var i = 0; i < ms.length; i++) {
  var s = String(ms[i]);
  if (/Row|Conf|Instance|set|get/.test(s)) print('  ' + s);
}
try { var f = c.getFields(); for (var i = 0; i < f.length; i++) print('  field: ' + String(f[i])); } catch (e) {}
print('DONE');
J('java.lang.System').exit(0);
