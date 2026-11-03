// probe_paper2.js — 构造面收口：PaperSetting/Margin/PaperSize/ReportSettings ctor + fresh sheet 默认值
var Class = Java.type('java.lang.Class');
var J = function (n) { return Java.type(n); };
var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
var ps = sheet.getPaperSetting();
print('FRESH getPaperSetting = ' + (ps ? ps.getClass().getName() : 'null'));
if (ps) { var mz = ps.getMargin(); print('  margin=' + mz); var sz = ps.getPaperSize(); print('  size=' + sz); }
function ctors(name) {
  try { var c = Class.forName(name); var cs = c.getConstructors(); print('== ' + name); for (var k = 0; k < cs.length; k++) print('  CTOR ' + String(cs[k]).replace('public ', '')); }
  catch (e) { print('== ' + name + ' FAIL ' + e); }
}
ctors('com.fr.page.stable.PaperSetting');
ctors('com.fr.base.Margin');
ctors('com.fr.base.PaperSize');
ctors('com.fr.report.stable.ReportSettings');
// CoreDecimalFormat 双参（roundingMode 透传）+ PaperSize 直接构造试打
try {
  var cdf = J('com.fr.base.CoreDecimalFormat');
  print('CDF ctors:'); var cs2 = Class.forName('com.fr.base.CoreDecimalFormat').getConstructors(); for (var k2 = 0; k2 < cs2.length; k2++) print('  ' + String(cs2[k2]).replace('public ', ''));
} catch (e2) { print('CDF FAIL ' + e2); }
try {
  var pz = new (J('com.fr.base.PaperSize'))();
  pz.setWidth(J('com.fr.stable.unit.FU').getInstance(40320000)); pz.setHeight(J('com.fr.stable.unit.FU').getInstance(42768000));
  print('PaperSize new+set OK = ' + pz);
  var mg = new (J('com.fr.base.Margin'))();
  print('Margin new OK');
  var psc = new (J('com.fr.page.stable.PaperSetting'))();
  psc.setPaperSize(pz); psc.setMargin(mg);
  print('PaperSetting new OK');
} catch (e3) { print('PAPER TRIAD FAIL ' + e3); }
print('PROBE END');
