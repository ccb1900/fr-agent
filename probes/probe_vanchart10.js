// probe_vanchart10.js — ClientI18nProvider.getEntireKV 复现 + 工厂链检查
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

function tryStatic(cn, mn) {
  try {
    var c = Class.forName(cn);
    var ms = c.getMethods();
    for (var i = 0; i < ms.length; i++) {
      if (!ms[i].getName().equals(mn)) continue;
      var ps = ms[i].getParameterTypes();
      if (ps.length !== 1 || !ps[0].equals(Class.forName('java.util.Locale'))) continue;
      if (java.lang.reflect.Modifier.isStatic(ms[i].getModifiers())) ms[i].setAccessible(true);
      var v = ms[i].invoke(null, new (J('java.util.Locale'))('zh', 'CN'));
      print(cn + '#' + mn + ' OK ' + (v == null ? 'null' : (v.size ? 'size=' + v.size() : String(v).substring(0, 60))));
      return;
    }
    print(cn + '#' + mn + ' no static 1-Locale method');
  } catch (e) { print(cn + '#' + mn + ' ERR ' + e); }
}
tryStatic('com.fr.locale.ClientI18nProvider', 'getEntireKV');
try {
  var f = Class.forName('com.fr.locale.ClientI18nProviderFactory');
  var ms2 = f.getMethods();
  for (var i = 0; i < ms2.length; i++) print('FACTORY ' + ms2[i].getName() + ' static=' + java.lang.reflect.Modifier.isStatic(ms2[i].getModifiers()));
} catch (e) { print('factory ERR ' + e); }
try { var ipf = Class.forName('com.fr.locale.InterProviderFactory'); print('InterProv OK ' + ipf); } catch (e) { print('InterProv missing'); }
print('PROBE_VANCHART10_DONE');
J('java.lang.System').exit(0);
