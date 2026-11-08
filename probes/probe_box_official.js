// probe_box_official.js — 官方 分组箱型图.cpt 无头渲染对照（2026-11-08，箱线图接线诊断）
var J = function (n) { return Java.type(n); };
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(), new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(), new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(), new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(J('java.lang.Class').forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
try {
  var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('doc/Chart/BoxPlot/分组箱型图.cpt');
  print('BOX OFFICIAL READ OK');
  var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
  print('BOX OFFICIAL EXEC=' + rb);
  var F = J('java.nio.file.Files');
  var os = new (J('java.io.FileOutputStream'))('logs/_box_official.png');
  new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb); os.close();
  var sz = F.size(J('java.nio.file.Paths').get('logs/_box_official.png'));
  print('BOX OFFICIAL PNG bytes=' + sz + (sz > 1000 ? ' RENDER-OK' : ' RENDER-SUSPECT'));
} catch (e) { print('BOX OFFICIAL FAIL: ' + String(e).split('\n').slice(0, 3).join(' || ')); }
J('java.lang.System').exit(0);
