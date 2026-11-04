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
var rwaC = java.lang.Class.forName('com.fr.report.write.ReportWriteAttr');
print('interfaces=' + String(rwaC.getInterfaces()));
var rwa = rwaC.newInstance();
var wb = new (J('com.fr.main.impl.WorkBook'))();
var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
etd.addColumn('v', Class.forName('java.lang.String'));
etd.addRow(J('java.util.Arrays').asList(['a']));
wb.putTableData('d', etd);
var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
wb.addReport('sheet1', sheet);
sheet.addAttributeTarget(rwa);
var cell = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, 'x');
sheet.addCellElement(cell);
var fos = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_wa8.cpt');
wb.export(fos); fos.close();
var txt = new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get('D:/fineagent/logs/_wa8.cpt')), 'UTF-8');
var n = 0, i = 0; while ((i = txt.indexOf('<ReportWriteAttr', i)) >= 0) { n++; i += 10; }
print('XML ReportWriteAttr=' + n);
print('DONE');
