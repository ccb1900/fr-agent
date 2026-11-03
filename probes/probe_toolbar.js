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

var wb = new (J('com.fr.main.impl.WorkBook'))();
var ra = new (J('com.fr.web.attr.ReportWebAttr'))();
wb.setReportWebAttr(ra);
print('ra class = ' + ra.getClass().getName());
var ms = ra.getClass().getMethods(), keep = [];
for (var i = 0; i < ms.length; i++) {
  var nm = ms[i].getName();
  if (/Tool|Web|Content/i.test(nm)) {
    var ps = ms[i].getParameterTypes(), a = [];
    for (var k = 0; k < ps.length; k++) a.push(ps[k].getSimpleName());
    keep.push(nm + '(' + a.join(',') + ')');
  }
}
var u = {}; keep.forEach(function (x) { u[x] = 1; });
print('ReportWebAttr M ' + Object.keys(u).sort().join(' '));

// 官方 ToolBarManager 默认构造 → 有哪些工具栏
var tm = new (J('com.fr.report.web.ToolBarManager'))();
print('default toolBar = ' + tm.getToolBar() + ' size=' + (tm.getToolBar() ? tm.getToolBar().getWidgetSize() : -1));
print('location = ' + tm.getToolBarLocation());
print('PROBE_TB_DONE');
J('java.lang.System').exit(0);
