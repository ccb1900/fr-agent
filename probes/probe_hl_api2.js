// probe_hl_api2.js — 运行时类名 + 枚举取值（CellSortAttr / Dictionary / Compare）
var J = function (n) { return Java.type(n); };
var CLS = function (n) { return Java.type('java.lang.Class').forName(n); };
function tryName(label, fn) { try { fn(); } catch (e) { print('MISS ' + label + ' :: ' + e.message); } }

tryName('DSColumn.getCellSortAttr', function () {
  var d = new (J('com.fr.report.cell.cellattr.core.group.DSColumn'))();
  var a = d.getCellSortAttr();
  print('CellSortAttr class = ' + (a == null ? 'null' : a.getClass().getName()));
  if (a != null) {
    var ms = a.getClass().getMethods(), keep = [];
    for (var i = 0; i < ms.length; i++) if (/^(set|get|add|is)/.test(ms[i].getName())) keep.push(ms[i].getName());
    var u = {}; keep.forEach(function (x) { u[x] = 1; });
    print('  CellSortAttr M ' + Object.keys(u).sort().join(','));
  }
  print('DSColumn.getOrder type = ' + d.getOrder());
});

tryName('Compare enum', function () {
  var c = CLS('com.fr.data.condition.Compare');
  var cs = c.getEnumConstants();
  var out = [];
  for (var i = 0; i < cs.length; i++) out.push(String(cs[i].name()));
  print('Compare values = ' + out.join(', '));
});

tryName('CustomDictionary', function () {
  var C = CLS('com.fr.data.impl.CustomDictionary');
  var ct = C.getConstructors();
  var sig = [];
  for (var i = 0; i < ct.length; i++) {
    var ps = ct[i].getParameterTypes(), a = [];
    for (var k = 0; k < ps.length; k++) a.push(ps[k].getSimpleName());
    sig.push('(' + a.join(',') + ')');
  }
  print('CustomDictionary CTOR ' + sig.join(' | '));
  var ms = C.getMethods(), keep = [];
  for (var i = 0; i < ms.length; i++) if (/^(set|get|add|put)/.test(ms[i].getName())) keep.push(ms[i].getName());
  var u = {}; keep.forEach(function (x) { u[x] = 1; });
  print('  CustomDictionary M ' + Object.keys(u).sort().join(','));
});

tryName('DatabaseDictionary', function () {
  var C = CLS('com.fr.data.impl.DatabaseDictionary');
  var ms = C.getMethods(), keep = [];
  for (var i = 0; i < ms.length; i++) if (/^(set|get|add)/.test(ms[i].getName())) keep.push(ms[i].getName());
  var u = {}; keep.forEach(function (x) { u[x] = 1; });
  print('DatabaseDictionary M ' + Object.keys(u).sort().join(','));
});

tryName('TableDataDictionary', function () {
  var C = CLS('com.fr.data.impl.TableDataDictionary');
  var ms = C.getMethods(), keep = [];
  for (var i = 0; i < ms.length; i++) if (/^(set|get|add)/.test(ms[i].getName())) keep.push(ms[i].getName());
  var u = {}; keep.forEach(function (x) { u[x] = 1; });
  print('TableDataDictionary M ' + Object.keys(u).sort().join(','));
});

tryName('CellGUI HTML', function () {
  var g = new (J('com.fr.report.cell.cellattr.CellGUIAttr'))();
  var ms = g.getClass().getMethods(), keep = [];
  for (var i = 0; i < ms.length; i++) if (/^(set|get|is)/.test(ms[i].getName())) keep.push(ms[i].getName());
  var u = {}; keep.forEach(function (x) { u[x] = 1; });
  print('CellGUIAttr M ' + Object.keys(u).sort().join(','));
});
print('DONE2');
