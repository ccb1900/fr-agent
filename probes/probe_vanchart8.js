// probe_vanchart8.js — 本地化环境 API 面 + ResourceHelper.mixLocaleData NPE 复现
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

function msurf(n, prefix) {
  try {
    var c = Class.forName(n); var a = c.getMethods(), u = {};
    for (var i = 0; i < a.length; i++) { var m = a[i].getName(); if (prefix.test(m)) u[m + '(' + a[i].getParameterTypes().length + ')'] = 1; }
    print('== ' + n + '\n   ' + Object.keys(u).sort().join(','));
  } catch (e) { print('== ' + n + ' MISSING'); }
}
msurf('com.fr.general.GeneralContext', /Locale|locale/i);
msurf('com.fr.stable.FRContext', /Locale|locale/i);
msurf('com.fr.web.ResourceHelper', /Locale|I18n|I18N/i);

// 复现：直接调 fetchI18NJs
try {
  var RH = J('com.fr.web.ResourceHelper');
  var js = RH.fetchI18NJs(false);
  print('fetchI18NJs OK len=' + String(js).length);
} catch (e) { print('fetchI18NJs ERR ' + e); }
print('PROBE_VANCHART8_DONE');
J('java.lang.System').exit(0);
