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
// 最小手工 wb：header setCenterList + attrMark，验证序列化与 execute 后状态
var wb = new (J('com.fr.main.impl.WorkBook'))();
var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
etd.addColumn('v', Class.forName('java.lang.String'));
etd.addRow(J('java.util.Arrays').asList(['a']));
wb.putTableData('d', etd);
var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
wb.addReport('sheet1', sheet);
var cell = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, new (J('com.fr.base.Formula'))('=COUNTA(d.v)'));
sheet.addCellElement(cell);
var hf = new (J('com.fr.report.core.ReportHF'))();
var l = hf.getCenterList();
var fe = new (J('com.fr.base.headerfooter.FormulaHFElement'))('"第" + $$page_number + "页/共" + $$totalPage_number + "页"');
fe.setFRFont(J('com.fr.general.FRFont').getInstance('SimHei', 0, 9));
l.add(fe);
hf.setCenterList(l);
sheet.setHeader(0, hf);
sheet.setFooter(0, hf);
wb.addAttrMark(new (J('com.fr.base.iofile.attr.TemplateIdAttrMark'))('b7e3f2a1-4c5d-4e6f-9a8b-1f2e3d4c5b6a'));
var ttm = new (J('com.fr.base.iofile.attr.TemplateThemeAttrMark'))();
ttm.setName('兼容主题'); ttm.setDark(false);
wb.addAttrMark(ttm);
print('pre-execute header centerList=' + String(wb.getReport('sheet1').getHeader(0).getCenterList()));
var fos = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_hf2_pre.cpt');
wb.export(fos); fos.close();
// execute 后读回（批B 家族教训：部署导出在 execute 后）
try {
  var pm = new (J('java.util.HashMap'))();
  wb.execute(pm, new (J('com.fr.stable.PageActor'))());
  print('post-execute header centerList=' + String(wb.getReport('sheet1').getHeader(0).getCenterList()));
} catch (eEx) { print('EXEC FAIL ' + String(eEx).substring(0, 100)); }
var fos2 = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_hf2_post.cpt');
wb.export(fos2); fos2.close();
['pre', 'post'].forEach(function (tag) {
  var txt = new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get('D:/fineagent/logs/_hf2_' + tag + '.cpt')), 'UTF-8');
  function c(s) { var n = 0, i = 0; while ((i = txt.indexOf(s, i)) >= 0) { n++; i += s.length; } return n; }
  print(tag + ' Header=' + c('<Header') + ' FormulaHFElement=' + c('FormulaHFElement') + ' TemplateId=' + c('TemplateIdAttrMark') + ' Theme=' + c('TemplateThemeAttrMark') + ' WatermarkLike=' + c('AttrMark'));
});
print('DONE');
