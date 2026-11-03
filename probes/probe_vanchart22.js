// probe_vanchart22.js — 部署 cpt round-trip 反序列化 → execute → 渲染（判定内存对象 vs 反读对象差异）
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
J('com.fr.general.I18nResource').getInstance();
J('com.fr.general.GeneralContext').setLocale(new (J('java.util.Locale'))('zh', 'CN'));

var TWBIO = J('com.fr.io.TemplateWorkBookIO');
var wb = TWBIO.readTemplateWorkBook('fineagent/能力自检_VanChart_api.cpt');
var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
var os = new (J('java.io.FileOutputStream'))('D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent/_probe_van_roundtrip.png');
new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
os.close();
print('ROUNDTRIP PNG OUT OK');
print('PROBE_VANCHART22_DONE');
J('java.lang.System').exit(0);
