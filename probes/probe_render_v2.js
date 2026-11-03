// probe_render_v2.js — 只把这个生产模板渲染成 PNG（不修改它），供物理量字号
// 产物：D:/fineagent/logs/_v2_render.png
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

var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('3D翘曲检查数据分析V2.cpt');
print('READ OK ' + wb.getClass().getName());
var pm = new (J('java.util.HashMap'))();
pm.put('品名', '');
pm.put('工单', '');
var rb = wb.execute(pm, new (J('com.fr.stable.PageActor'))());
var os = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_v2_render.png');
new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
os.close();
print('RENDER DONE');
J('java.lang.System').exit(0);
