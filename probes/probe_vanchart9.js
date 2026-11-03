// probe_vanchart9.js — ResourceHelper i18n API 反射复现
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

var RH = Class.forName('com.fr.web.ResourceHelper');
var ms = RH.getMethods();
for (var i = 0; i < ms.length; i++) {
  var n = ms[i].getName();
  if (n === 'fetchI18NJs' || n === 'mixLocaleData' || n === 'ensureI18n' || n === 'createI18NJs') {
    var ps = ms[i].getParameterTypes(), o = [];
    for (var k = 0; k < ps.length; k++) o.push(ps[k].getName());
    print(n + '(' + o.join(',') + ')');
  }
}
try {
  var js = RH.getMethod('fetchI18NJs', Class.forName('java.util.Locale')).invoke(null, new (J('java.util.Locale'))('zh', 'CN'));
  print('fetchI18NJs(zh_CN) OK len=' + String(js).length);
} catch (e) { print('fetchI18NJs ERR ' + e); }
try { print('locale=' + J('com.fr.general.GeneralContext').getLocale()); } catch (e2) { print('locale ERR ' + e2); }
print('PROBE_VANCHART9_DONE');
J('java.lang.System').exit(0);
