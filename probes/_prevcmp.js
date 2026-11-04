// _prevcmp.js — 批B 审查循环：父提交 object.js 重建 sales_demo_chart cpt 与现行部署件字节对拍
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
load('D:/fineagent/runtime/paths.js');
load('D:/fineagent/lib/ir.js');
load('D:/fineagent/logs/_object_prev.js');   // 父提交版（内含 applyChartAttrs 尾调 applyChartDeco 的旧结构）
SPEC = undefined;
load('D:/fineagent/reports/sales_demo_chart.js');
var ir = Ir.compile(SPEC);
var out = Obj.build(ir);
var fos = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_prevchart.cpt');
out.wb.export(fos); fos.close();
print('PREV EXPORTED');
