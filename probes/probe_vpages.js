// probe_vpages.js — 引擎读回部署的评分流水 cpt，执行后打印 RESULT PAGES 与每页行数分布
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

var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('fineagent/激光数据浏览器_评分流水_api.cpt');
print('READ OK');
var pm = new (J('java.util.HashMap'))();
pm.put('d1', '2026-09-13'); pm.put('d2', '2026-09-22');
pm.put('stage', ''); pm.put('size', '50'); pm.put('page', '4');
var rb = wb.execute(pm, new (J('com.fr.stable.PageActor'))());
var cnt = rb.getReportCount();
print('RESULT PAGES = ' + cnt);
for (var p = 0; p < cnt; p++) {
  var rr = rb.getResultReport(p);
  var rhSum = 0;
  try {
    var report = rr.getReport();
    var ms = report.getClass().getMethods();
    var rhM = null;
    for (var i = 0; i < ms.length; i++) { if (String(ms[i].getName()) === 'getRowHeightList') rhM = ms[i]; }
  } catch (e) {}
  print('page' + p + ': rowCount=' + rr.getRowCount() + ' colCount=' + rr.getColumnCount());
}
J('java.lang.System').exit(0);
