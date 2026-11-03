// probe_paper.js — 从官方 cpt 对象图挖 paper/settings API 面
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
var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('demo/basic/基本明细汇总表A.cpt');
var r = wb.getReport(0); // Report 页对象
var rc = r.getClass().getName();
print('SHEET CLASS = ' + rc);
var rs = r.getReportSettings();
print('SETTINGS CLASS = ' + rs.getClass().getName());
var ps = rs.getPaperSetting();
print('PAPERSETTING CLASS = ' + ps.getClass().getName());
var psize = ps.getPaperSize();
print('PAPERSIZE CLASS = ' + psize.getClass().getName() + ' -> ' + psize);
var mg = ps.getMargin();
print('MARGIN CLASS = ' + mg.getClass().getName() + ' -> ' + mg);
// 挖 setters
function dumpMethods(obj, pat, tag) {
  var c = obj.getClass();
  while (c) {
    var ms = c.getDeclaredMethods();
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]).replace('public ', '');
      if (pat.test(s) && s.indexOf('Object') < 0) print('  ' + tag + ' ' + s);
    }
    c = c.getSuperclass();
  }
}
dumpMethods(ps, /etPaper|etMargin/, 'PS');
dumpMethods(psize, /set|isD|isA|get/, 'SIZE');
dumpMethods(mg, /set/, 'MARG');
print('PROBE END');
J('java.lang.System').exit(0);
