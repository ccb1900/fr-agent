// probe_hl_api3.js — CellSortAttr / Condition 参数类型 精查
var J = function (n) { return Java.type(n); };
var CLS = function (n) { return Java.type('java.lang.Class').forName(n); };
function sigOf(ct) {
  var out = [];
  for (var i = 0; i < ct.length; i++) {
    var ps = ct[i].getParameterTypes(), a = [];
    for (var k = 0; k < ps.length; k++) a.push(ps[k].getName());
    out.push('(' + a.join(',') + ')');
  }
  return out.length ? out.join(' | ') : 'none';
}
function methodsOf(C, re) {
  var ms = C.getMethods(), keep = [];
  for (var i = 0; i < ms.length; i++) if (re.test(ms[i].getName())) keep.push(ms[i].getName());
  var u = {}; keep.forEach(function (x) { u[x] = 1; });
  return Object.keys(u).sort().join(',');
}
function tryOne(label, fn) { try { fn(); } catch (e) { print('MISS ' + label + ' :: ' + e.message); } }

tryOne('CellSortAttr', function () {
  var C = CLS('com.fr.report.core.sort.common.CellSortAttr');
  print('CellSortAttr CTOR ' + sigOf(C.getConstructors()));
  print('  M ' + methodsOf(C, /^(set|get|add|is)/));
  var f = C.getDeclaredFields(), fs = [];
  for (var i = 0; i < f.length; i++) if (!/static/.test(java.lang.reflect.Modifier.toString(f[i].getModifiers()))) fs.push(f[i].getName());
  print('  F ' + fs.join(','));
});

tryOne('CommonCondition ctors', function () {
  var C = CLS('com.fr.data.condition.CommonCondition');
  print('CommonCondition CTOR ' + sigOf(C.getConstructors()));
});

tryOne('BgAction ctors', function () {
  var C = CLS('com.fr.report.cell.cellattr.highlight.BackgroundHighlightAction');
  print('BgHighlightAction CTOR ' + sigOf(C.getConstructors()));
});

tryOne('FRFontAction ctors', function () {
  var C = CLS('com.fr.report.cell.cellattr.highlight.FRFontHighlightAction');
  print('FRFontHighlightAction CTOR ' + sigOf(C.getConstructors()));
});

tryOne('DictPresent', function () {
  var C = CLS('com.fr.base.present.DictPresent');
  print('DictPresent CTOR ' + sigOf(C.getConstructors()));
});

tryOne('ListCondition', function () {
  var C = CLS('com.fr.data.condition.ListCondition');
  print('ListCondition CTOR ' + sigOf(C.getConstructors()));
  print('  M ' + methodsOf(C, /^(set|get|add|is)/));
});
print('DONE3');
