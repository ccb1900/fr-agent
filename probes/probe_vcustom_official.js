// probe_vcustom_official.js — 官方组合图无头渲染对照
var J = function (n) { return Java.type(n); };
var Class = J('java.lang.Class');
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(), new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(), new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(), new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(Class.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
var path = java.lang.System.getenv('CPT_PATH') || 'doc/Chart/柱形图变形.cpt';
try {
  var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook(path);
  print('READ OK ' + path);
  var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
  print('EXEC OK pages=' + (rb ? rb.getReportCount() : 'null'));
  if (rb) {
    var os = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_vcustom_official.png');
    new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb); os.close();
    print('PNG DONE logs/_vcustom_official.png');
  }
} catch (e) { print('FAIL ' + e); }
J('java.lang.System').exit(0);
