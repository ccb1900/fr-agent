// probe_margins.js — Style 的内边距/缩进/Leading API 面反射（排版标准五.1 待验项）
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

function dump(clsName, pat) {
  try {
    var c = ClassT.forName(clsName);
    print('=== ' + clsName);
    var ms = c.getMethods();
    for (var i = 0; i < ms.length; i++) { var s = String(ms[i]);
      if (pat.test(s)) print('  ' + s); }
  } catch (e) { print('=== ' + clsName + ' UNAVAILABLE: ' + e); }
}

var p = /pad|lead|indent|margin|space|derive/i;
dump('com.fr.base.Style', p);
dump('com.fr.report.cell.cellattr.TextAttr', p);
dump('com.fr.report.cell.DefaultTemplateCellElement', /pad|lead|indent|margin/i);
J('java.lang.System').exit(0);
