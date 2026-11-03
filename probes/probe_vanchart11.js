// probe_vanchart11.js — 管线同款引导下 getClientProvider 初始状态 + fetchI18NJs 全链
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

var IPF = J('com.fr.locale.InterProviderFactory');
var p0 = IPF.getClientProvider();
print('INIT getClientProvider=' + (p0 == null ? 'NULL' : p0.getClass().getName()));
var pF = IPF.getFrontProvider();
print('INIT getFrontProvider=' + (pF == null ? 'NULL' : pF.getClass().getName()));
try {
  var RH = J('com.fr.web.ResourceHelper');
  var js = RH.fetchI18NJs(new (J('java.util.Locale'))('zh', 'CN'));
  print('fetchI18NJs OK len=' + String(js).length);
} catch (e) { print('fetchI18NJs ERR ' + e); }
try { var pE = IPF.getClientProvider().getEntireKV(new (J('java.util.Locale'))('zh', 'CN')); print('EntireKV size=' + (pE == null ? 'NULL' : pE.size())); } catch (e2) { print('EntireKV ERR ' + e2); }
print('PROBE_VANCHART11_DONE');
J('java.lang.System').exit(0);
