// probe_r4m22.js — FineDateFormat 序列化实证:日期列格式经 buildFormat 同构(FF.getInstance)→wb.export→XML 断言
var Class = Java.type('java.lang.Class');
var J = function (n) { return Java.type(n); };
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(), new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(), new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(), new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(Class.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
var FAILS = 0;
function check(name, cond) { print((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) FAILS++; }
var wb = new (J('com.fr.main.impl.WorkBook'))();
var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
etd.addColumn('日期', Class.forName('java.lang.String'));
etd.addRow(J('java.util.Arrays').asList(['2026-09-13']));
wb.putTableData('ds', etd);
var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
var cell = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0);
cell.setValue(new (J('com.fr.base.Formula'))('="2026-09-13"'));
var style0 = new (J('com.fr.report.core.style.CellStyle'))();
var fmt = J('com.fr.general.date.FineDateFormat').getInstance('yyyy-MM-dd');
style0.setFormat(fmt);
cell.setStyle(style0);
sheet.addCellElement(cell);
sheet.setRowHeight(0, J('com.fr.stable.unit.FU').getInstance(Math.round(40 * 12700)));
sheet.setColumnWidth(0, J('com.fr.stable.unit.FU').getInstance(Math.round(200 * 12700)));
wb.addReport('sheet1', sheet);
var outP = 'D:/fineagent/logs/_m22_datefmt.cpt';
var osP = new (J('java.io.FileOutputStream'))(outP);
wb.export(osP); osP.close();
var xml = new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get(outP)), 'UTF-8');
check('FineDateFormat serialized', xml.indexOf('FineDateFormat') >= 0);
check('NO FAILS', FAILS === 0);
print('DONE');
J('java.lang.System').exit(FAILS === 0 ? 0 : 1);
