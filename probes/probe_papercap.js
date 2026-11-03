// probe_papercap.js — 问引擎：自定义纸高 4529pt 的 WorkBook 导出后是几页、画布多高
// （回答"内容放得下却被切两页"的成因：FR 纸高上限 or PageActor 切片）
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

// 造一个极简 WorkBook：纸高 4529pt×纸宽1380pt，只有一行小文本（内容放得下也超不过）
var wb = new (J('com.fr.main.impl.WorkBook'))();
var sh = new (J('com.fr.report.worksheet.WorkSheet'))();
var ce = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, 'PAGE/CANVAS TEST');
sh.addCellElement(ce);
var ps = new (J('com.fr.base.PaperSize'))();
ps.setWidth(J('com.fr.stable.unit.FU').getInstance(Math.round(1380 * 12700)));
ps.setHeight(J('com.fr.stable.unit.FU').getInstance(Math.round(4529 * 12700)));
var psc = new (J('com.fr.page.stable.PaperSetting'))();
psc.setPaperSize(ps);
var mg = new (J('com.fr.base.Margin'))();
mg.setTop(J('com.fr.stable.unit.FU').getInstance(0)); mg.setLeft(J('com.fr.stable.unit.FU').getInstance(0));
mg.setBottom(J('com.fr.stable.unit.FU').getInstance(0)); mg.setRight(J('com.fr.stable.unit.FU').getInstance(0));
psc.setMargin(mg);
var rs = new (J('com.fr.report.stable.ReportSettings'))();
rs.setPaperSetting(psc);
sh.setReportSettings(rs);
wb.addReport('sheet1', sh);

var pm = new (J('java.util.HashMap'))();
var rb = wb.execute(pm, new (J('com.fr.stable.PageActor'))());
var cnt = rb.getReportCount();
print('RESULT PAGES = ' + cnt);
for (var p = 0; p < cnt; p++) {
  var rr = rb.getResultReport(p);
  print('page' + p + ': rowCount=' + rr.getRowCount() + ' colCount=' + rr.getColumnCount());
}
var os = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_papercap.png');
new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
os.close();
print('EXPORT DONE');
J('java.lang.System').exit(0);
