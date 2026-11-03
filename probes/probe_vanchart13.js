// probe_vanchart13.js — LocaleManager 获取方式 + getEntireKV null 复现
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

var LM = Class.forName('com.fr.locale.LocaleManager');
print('ctors: ' + Array.prototype.map.call(LM.getConstructors(), function (c) { return String(c); }).join(' | '));
var ms = LM.getMethods();
for (var i = 0; i < ms.length; i++) {
  var m = ms[i];
  if (m.getName().indexOf('get') === 0 || m.getName().indexOf('add') === 0 || m.getName() === 'getInstance')
    print('M ' + m.getName() + '(' + m.getParameterTypes().length + ') static=' + java.lang.reflect.Modifier.isStatic(m.getModifiers()) + ' ' + m.getReturnType().getName());
}
var loc = new (J('java.util.Locale'))('zh', 'CN');
try {
  var kv = J('com.fr.locale.InterProviderFactory').getClientProvider().getEntireKV(loc);
  print('zh_CN EntireKV=' + (kv == null ? 'NULL' : 'size=' + kv.size()));
} catch (e) { print('KV ERR ' + e); }
print('PROBE_VANCHART13_DONE');
J('java.lang.System').exit(0);
