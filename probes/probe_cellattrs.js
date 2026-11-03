// probe_cellattrs.js — 单元格属性挂载点（Present / CellGUIAttr / Expand）
var J = function (n) { return Java.type(n); };
var CLS = function (n) { return Java.type('java.lang.Class').forName(n); };
function ms(C, re) {
  var a = C.getMethods(), keep = [];
  for (var i = 0; i < a.length; i++) if (re.test(a[i].getName())) keep.push(a[i].getName());
  var u = {}; keep.forEach(function (x) { u[x] = 1; });
  return Object.keys(u).sort().join(',');
}
function tryOne(label, fn) { try { fn(); } catch (e) { print('MISS ' + label + ' :: ' + e.message); } }

tryOne('Cell', function () {
  var C = CLS('com.fr.report.cell.DefaultTemplateCellElement');
  print('Cell M ' + ms(C, /^(set|get)/));
});

tryOne('DSColumn present', function () {
  var C = CLS('com.fr.report.cell.cellattr.core.group.DSColumn');
  print('DSColumn M ' + ms(C, /^(set|get|is)/));
});

tryOne('CustomDictionary build', function () {
  var keys = J('java.lang.reflect.Array').newInstance(CLS('java.lang.Object'), 2);
  keys[0] = 'A'; keys[1] = 'B';
  var vals = J('java.lang.reflect.Array').newInstance(CLS('java.lang.Object'), 2);
  vals[0] = '甲'; vals[1] = '乙';
  var d = new (J('com.fr.data.impl.CustomDictionary'))(keys, vals);
  print('CustomDictionary ok, get(A) = ' + d.get('A'));
  var p = new (J('com.fr.base.present.DictPresent'))(d);
  print('DictPresent ok type=' + p.getType());
});

tryOne('CellGUI', function () {
  var C = CLS('com.fr.report.cell.cellattr.CellGUIAttr');
  print('CellGUIAttr ctor ' + C.getConstructors().length);
});
print('DONE4');
