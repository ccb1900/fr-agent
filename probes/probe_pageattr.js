// probe_pageattr.js — 从官方 basicA 挖 ReportPageAttr 实现类与 setter 面
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
var r = wb.getReport(0);
var pa = r.getReportPageAttr();
print('PAGEATTR CLASS = ' + (pa ? pa.getClass().getName() : 'null'));
if (pa) {
  print('PA = ' + pa);
  var c = pa.getClass();
  while (c) {
    var ms = c.getDeclaredMethods();
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]).replace('public ', '');
      if (/set|get|efine|ange/.test(s) && s.indexOf('writeXML') < 0 && s.indexOf('readXML') < 0) print('  ' + s);
    }
    c = c.getSuperclass();
  }
}
print('PROBE END');
J('java.lang.System').exit(0);
