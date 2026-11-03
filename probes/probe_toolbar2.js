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

function list(name, re) {
  try {
    var C = Class.forName(name), ms = C.getMethods(), keep = {};
    for (var i = 0; i < ms.length; i++) {
      var nm = ms[i].getName();
      if (!re.test(nm)) continue;
      var ps = ms[i].getParameterTypes(), a = [];
      for (var k = 0; k < ps.length; k++) a.push(ps[k].getSimpleName());
      keep[nm + '(' + a.join(',') + ')'] = 1;
    }
    print('M ' + name + ' :: ' + Object.keys(keep).sort().join(' '));
  } catch (e) { print('MISS ' + name + ' :: ' + e.message); }
}
list('com.fr.web.attr.ReportWebAttr', /ToolBar|WebView|WebWrite|WebPage/);
list('com.fr.report.web.WebView', /ToolBar|get|set/);
list('com.fr.report.web.WebWrite', /ToolBar|get|set/);
var ra = new (J('com.fr.web.attr.ReportWebAttr'))();
print('webView = ' + ra.getWebView());
print('toolBarManagers(0) = ' + ra.getToolBarManagers(0));
print('PROBE_TB2_DONE');
J('java.lang.System').exit(0);
