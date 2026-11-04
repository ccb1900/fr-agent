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
// A: ColumnConfig 带 ColumnRow value ctor
var cr = J('com.fr.stable.ColumnRow').valueOf(3, 3);
var cc = new (J('com.fr.write.config.ColumnConfig'))('产品名称', cr, true, false);
print('cc.getRelatedColumnRows?=');
try { var m = java.lang.Class.forName('com.fr.write.config.ColumnConfig').getMethod('getColumnRowGroup'); print('has getColumnRowGroup'); } catch (e) { print('no getColumnRowGroup: ' + e.message); }
var cfg = new (J('com.fr.write.config.IntelliDMLConfig'))();
cfg.setTable(new (J('com.fr.data.core.db.dml.Table'))('', 'zprobe_write'));
cfg.addColumnConfig(cc);
// B: DMLConfig 相关行挂法试探
try { cfg.setRelatedColumnRows ? print('cfg.setRelatedColumnRows exists') : print('cfg.setRelatedColumnRows absent'); } catch (e2) { print('r2 fail'); }
var rwa = java.lang.Class.forName('com.fr.report.write.ReportWriteAttr').newInstance();
var sub = new (J('com.fr.report.write.BuiltInSQLSubmiter'))();
sub.setName('内置SQL1');
sub.setDBName('ATOM_LIVE');
sub.setDmlConfig(cfg);
rwa.addSubmitVisitor(sub);
// C: 编辑器 reg
var te = new (J('com.fr.form.ui.TextEditor'))();
te.setRegex(new (J('com.fr.form.ui.reg.PhoneReg'))());
te.setRegErrorMessage('手机号不合法');
var wb = new (J('com.fr.main.impl.WorkBook'))();
wb.setReportParameterAttr((function () { return null; })());
var rpa = new (J('com.fr.main.parameter.ReportParameterAttr'))();
var wpl = new (J('com.fr.form.ui.container.WParameterLayout'))();
wpl.setDesignWidth(400);
var BW = J('com.fr.form.ui.container.WAbsoluteLayout$BoundsWidget');
wpl.addWidget(new (BW)(te, new (J('java.awt.Rectangle'))(10, 10, 120, 22)));
var fpi = new (J('com.fr.form.main.parameter.FormParameterUI'))(wpl);
fpi.setDesignSize(new (J('java.awt.Dimension'))(400, 60));
rpa.setUseParamsTemplate(true); rpa.setParameterWindowTitle('P'); rpa.setParameterUI(fpi);
wb.setReportParameterAttr(rpa);
var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
etd.addColumn('v', Class.forName('java.lang.String'));
etd.addRow(J('java.util.Arrays').asList(['a']));
wb.putTableData('d', etd);
var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
wb.addReport('sheet1', sheet);
sheet.addAttributeTarget(rwa);
sheet.addCellElement(new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, 'x'));
var fos = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_wa9.cpt');
wb.export(fos); fos.close();
var txt = new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get('D:/fineagent/logs/_wa9.cpt')), 'UTF-8');
function c(s) { var n = 0, i = 0; while ((i = txt.indexOf(s, i)) >= 0) { n++; i += s.length; } return n; }
print('XML ReportWriteAttr=' + c('<ReportWriteAttr') + ' ColumnRow=' + c('<ColumnRow') + ' PhoneReg=' + c('PhoneReg') + ' regErr=' + c('手机号不合法'));
print('DONE');
