var J = function (n) { return Java.type(n); };
var CLS = function (n) { return Java.type('java.lang.Class').forName(n); };
function sg(ps) { var a = []; for (var k = 0; k < ps.length; k++) a.push(ps[k].getSimpleName()); return a.join(','); }
function show(name) {
  try {
    var C = CLS(name);
    var ct = C.getConstructors(), l = [];
    for (var i = 0; i < ct.length; i++) l.push('(' + sg(ct[i].getParameterTypes()) + ')');
    print('CTOR ' + name + ' :: ' + (l.length ? l.join(' | ') : 'none'));
    var ms = C.getMethods(), keep = {};
    for (var i = 0; i < ms.length; i++) { var nm = ms[i].getName(); if (/^(set|get|add|put|create|insert)/.test(nm)) keep[nm + '(' + sg(ms[i].getParameterTypes()) + ')'] = 1; }
    print('  M ' + Object.keys(keep).sort().join(' '));
  } catch (e) { print('MISS ' + name + ' :: ' + e.message); }
}
show('com.fr.report.cell.cellattr.core.RichChar');
show('com.fr.report.cell.cellattr.core.RichText');
show('com.fr.report.web.ToolBar');
show('com.fr.web.attr.ReportWebAttr');

function filt(name, re) {
  try {
    var C = CLS(name), ms = C.getMethods(), keep = {};
    for (var i = 0; i < ms.length; i++) { var nm = ms[i].getName(); if (re.test(nm)) keep[nm + '(' + sg(ms[i].getParameterTypes()) + ')'] = 1; }
    print('FILT ' + name + ' ' + Object.keys(keep).sort().join(' '));
  } catch (e) { print('MISS F ' + name + ' :: ' + e.message); }
}
filt('com.fr.main.impl.WorkBook', /Attr|Watermark|ReportWeb/);
filt('com.fr.report.worksheet.WorkSheet', /Attr|Watermark|Float|Rich/);
filt('com.fr.report.report.Report', /Attr|Watermark/);
print('PROBE_A2_DONE');
