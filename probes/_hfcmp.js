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
load('D:/fineagent/lib/object.js');
SPEC = undefined;
load('D:/fineagent/reports/test_pagehf.js');
var ir = Ir.compile(SPEC);
var out = Obj.build(ir);
var wb = out.wb;
// 读回：wb → report(sheet) → getHeader(0)
var rep = wb.getReport('sheet1');
var h0 = rep.getHeader ? rep.getHeader(0) : 'no-method';
print('READBACK header=' + h0 + (h0 && h0.getCenterList ? ' centerList=' + String(h0.getCenterList()) : ''));
var fos = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_hfcmp.cpt');
wb.export(fos); fos.close();
var txt = new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get('D:/fineagent/logs/_hfcmp.cpt')), 'UTF-8');
function c(s) { var n = 0, i = 0; while ((i = txt.indexOf(s, i)) >= 0) { n++; i += s.length; } return n; }
print('XML Header=' + c('<Header') + ' FormulaHFElement=' + c('FormulaHFElement') + ' TemplateId=' + c('TemplateIdAttrMark') + ' Theme=' + c('TemplateThemeAttrMark'));
print('DONE');
