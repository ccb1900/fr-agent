// probe_all.js — v4.1 下一批能力族 API 面（富文本 / 悬浮元素 / 水印 / 工具栏 / 公式显示）
var J = function (n) { return Java.type(n); };
var CLS = function (n) { return Java.type('java.lang.Class').forName(n); };
function sig(ps) {
  var a = [];
  for (var k = 0; k < ps.length; k++) a.push(ps[k].getSimpleName());
  return a.join(',');
}
function show(name, ctorRe) {
  try {
    var C = CLS(name);
    var ct = (ctorRe ? C.getDeclaredConstructors() : C.getConstructors()), lines = [];
    for (var i = 0; i < ct.length; i++) lines.push('(' + sig(ct[i].getParameterTypes()) + ')');
    print('CTOR ' + name + ' :: ' + (lines.length ? lines.join(' | ') : 'none'));
    var ms = C.getMethods(), keep = {};
    for (var i = 0; i < ms.length; i++) {
      var nm = ms[i].getName();
      if (/^(set|add|get|put|create|insert)/.test(nm)) keep[nm + '(' + sig(ms[i].getParameterTypes()) + ')'] = 1;
    }
    print('  M ' + Object.keys(keep).sort().join(' '));
  } catch (e) { print('MISS ' + name + ' :: ' + e.message); }
}

show('com.fr.report.cell.FloatElement');
show('com.fr.report.cell.FloatLocation');
show('com.fr.report.cell.cellattr.rich.RichText');
show('com.fr.report.cell.cellattr.rich.RichChar');
show('com.fr.report.cell.cellattr.rich.RichStyle');
show('com.fr.base.iofile.attr.WatermarkAttr');
show('com.fr.report.web.button.page.First');
show('com.fr.report.web.button.page.PageNavi');
show('com.fr.report.web.button.write.Export');
show('com.fr.report.web.button.write.Print');
show('com.fr.report.web.button.write.Email');
show('com.fr.report.web.ToolBarManager');
show('com.fr.report.web.attr.ReportWebAttr');
show('com.fr.base.present.FormulaPresent');

var W = CLS('com.fr.report.worksheet.WorkSheet');
var keep = {};
var ms = W.getMethods();
for (var i = 0; i < ms.length; i++) if (/Float|Watermark/.test(ms[i].getName())) keep[ms[i].getName() + '(' + sig(ms[i].getParameterTypes()) + ')'] = 1;
print('WorkSheet FLOAT ' + Object.keys(keep).sort().join(' '));
print('PROBE_ALL_DONE');
