// probe_vanchart15.js — I18nResource 官方注册链激活验证
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
var IPF = J('com.fr.locale.InterProviderFactory');
print('before: provider=' + (IPF.getClientProvider() == null ? 'NULL' : IPF.getClientProvider().getClass().getName()));

// 激活官方单例（applying static init = registerClientProvider(FineLocaleManager 包装)）
var IR18 = J('com.fr.general.I18nResource');
print('I18nResource.getInstance() = ' + IR18.getInstance().getClass().getName());
print('after: provider=' + (IPF.getClientProvider() == null ? 'NULL' : IPF.getClientProvider().getClass().getName()));

var cp = IPF.getClientProvider();
var kv = cp.getEntireKV(loc);
print('EntireKV(before addResource) = ' + (kv == null ? 'NULL' : 'size=' + kv.size()));

try { IR18.addResource('/com/fr/server/i18n/chart'); print('addResource chart OK'); } catch (e) { print('addResource ERR ' + e); }
kv = cp.getEntireKV(loc);
print('EntireKV(after chart) = ' + (kv == null ? 'NULL' : 'size=' + kv.size()));

try {
  var js = J('com.fr.web.ResourceHelper').fetchI18NJs(loc);
  print('fetchI18NJs OK len=' + String(js).length);
} catch (e2) { print('fetchI18NJs ERR ' + e2); }
print('PROBE_VANCHART15_DONE');
J('java.lang.System').exit(0);
