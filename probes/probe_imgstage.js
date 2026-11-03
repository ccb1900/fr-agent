// probe_imgstage.js — 导出层定性：read→execute→打印页数/每页行数/行高和→ImageExporter 导出→PNG 实尺
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

var pm = new (J('java.util.HashMap'))();
pm.put('d1', '2026-09-13'); pm.put('d2', '2026-09-22');
pm.put('stage', ''); pm.put('size', '50'); pm.put('page', '4');
var rb = wb.execute(pm, new (J('com.fr.stable.PageActor'))());
var cnt = rb.getReportCount();
print('EXEC RESULT PAGES = ' + cnt);

// 执行结果的行高总和（每页）——与纸高对比
for (var p = 0; p < cnt; p++) {
  var rr = rb.getResultReport(p);
  print('page' + p + ': rowCount=' + rr.getRowCount() + ' colCount=' + rr.getColumnCount());
}

// 导出整本 → PNG 实尺
var os = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_imgstage.png');
new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
os.close();
print('EXPORT DONE');
J('java.lang.System').exit(0);
