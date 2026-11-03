// probe_vanchart12.js — LocaleManager bundle 状态 + 各 locale EntireKV
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

var LM = J('com.fr.locale.LocaleManager');
var Locales = [new (J('java.util.Locale'))('zh'), new (J('java.util.Locale'))('zh', 'CN'), java.util.Locale.CHINA, java.util.Locale.ENGLISH, java.util.Locale.US];
for (var i = 0; i < Locales.length; i++) {
  var l = Locales[i];
  var b = null;
  try { b = LM.getLocalBundle(l); } catch (e) { print(l + ' bundle ERR ' + e); continue; }
  print(l + ' bundle=' + (b == null ? 'NULL' : (b.getClass().getName() + ' size=' + b.getStack ? 'S' : b)));
  var kv = null;
  try { kv = J('com.fr.locale.InterProviderFactory').getClientProvider().getEntireKV(l); print(l + ' EntireKV=' + (kv == null ? 'NULL' : 'size=' + kv.size())); } catch (e2) { print(l + ' KV ERR ' + e2); }
}
print('LocaleManager list=' + LM.getList().size());
print('PROBE_VANCHART12_DONE');
J('java.lang.System').exit(0);
