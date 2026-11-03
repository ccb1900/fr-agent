// probe_webpage3.js — 完整 env 下 ReportWebAttr/WebPageContent 的构造与 setter 面
var J = function (n) { return Java.type(n); };
var ClassT = J('java.lang.Class');

var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(),
  new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(),
  new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(ClassT.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();

function dump(clsName, pat) {
  try {
    var c = ClassT.forName(clsName);
    print('=== ' + clsName + ' ==>');
    var ms = c.getMethods();
    for (var i = 0; i < ms.length; i++) { var s = String(ms[i]); if (!pat || pat.test(s)) print('  ' + s); }
    var cs = c.getConstructors();
    for (var i = 0; i < cs.length; i++) print('  ctor ' + String(cs[i]));
  } catch (e) { print('=== ' + clsName + ' UNAVAILABLE: ' + e); }
}

dump('com.fr.web.attr.ReportWebAttr', /Web|set|get|ctor/);
dump('com.fr.report.web.WebPageContent', null);
