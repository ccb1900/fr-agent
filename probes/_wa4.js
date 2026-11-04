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
var rwa = new (J('com.fr.report.write.ReportWriteAttr'))();
print('xmlTag=' + rwa.xmlTag() + ' isAttrMark=' + (rwa instanceof J('com.fr.stable.fun.IOFileAttrMark') ? 'YES' : 'no'));
var sub = new (J('com.fr.report.write.BuiltInSQLSubmiter'))();
sub.setName('内置SQL1');
sub.setDBName('ATOM_LIVE');
var cfg = new (J('com.fr.write.config.IntelliDMLConfig'))();
cfg.setTable(new (J('com.fr.data.core.db.dml.Table'))('', 'zprobe_write_staging'));
var cc = new (J('com.fr.write.config.ColumnConfig'))('月份', null, true, false);
cc.setColumnRowGroup ? print('has setColumnRowGroup') : print('no setColumnRowGroup');
cfg.addColumnConfig(cc);
sub.setDmlConfig(cfg);
rwa.addSubmitVisitor(sub);
wb.addAttrMark(rwa);
var fos = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_wa4.cpt');
wb.export(fos); fos.close();
var txt = new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get('D:/fineagent/logs/_wa4.cpt')), 'UTF-8');
function c(s) { var n = 0, i = 0; while ((i = txt.indexOf(s, i)) >= 0) { n++; i += s.length; } return n; }
print('XML ReportWriteAttr=' + c('<ReportWriteAttr') + ' Submiter=' + c('BuiltInSQLSubmiter') + ' IntelliDML=' + c('IntelliDMLConfig') + ' zprobe=' + c('zprobe_write_staging'));
print('DONE');
