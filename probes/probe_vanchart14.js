// probe_vanchart14.js — ClientI18nProvider 内部字段 + addResource 试注册 + getEntireKV 复验
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

var loc = new (J('java.util.Locale'))('zh', 'CN');
var cp = J('com.fr.locale.InterProviderFactory').getClientProvider();
print('provider=' + cp.getClass().getName());

// 内部字段（委托的 LocaleManager 实例等）
var fs = cp.getClass().getDeclaredFields();
for (var i = 0; i < fs.length; i++) {
  fs[i].setAccessible(true);
  var v = null; var vstr = '?';
  try { v = fs[i].get(cp); vstr = (v == null ? 'null' : String(v).substring(0, 80)); } catch (e) { vstr = 'ERR ' + e; }
  print('FIELD ' + fs[i].getName() + ' : ' + fs[i].getType().getName() + ' = ' + vstr);
}

// 试注册：jar 内现成资源路径（不带扩展名/properties 两种变体）
var paths = ['/com/fr/server/i18n/chart', '/com/fr/server/i18n/chart.properties', '/com/fr/i18n/url_zh'];
for (var i = 0; i < paths.length; i++) {
  try { cp.addResource(paths[i]); print('addResource OK ' + paths[i]); } catch (e) { print('addResource ERR ' + paths[i] + ' ' + e); }
  var kv = null;
  try { kv = cp.getEntireKV(loc); print('  EntireKV now ' + (kv == null ? 'NULL' : 'size=' + kv.size())); } catch (e2) { print('  KV ERR ' + e2); }
}
print('PROBE_VANCHART14_DONE');
J('java.lang.System').exit(0);
