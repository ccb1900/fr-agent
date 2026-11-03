// probe_basic4.js — 分组小计族 API 面四连探
// ① CellExpandAttr（左父绑定）② CellElement 扩展属性读写 ③ FloatElement/Sheet ④ DBTableData 直构造 + Grouper 家族
var Class = Java.type('java.lang.Class');
function dump(name, pat, tag) {
  print('== ' + name);
  try {
    var c = Class.forName(name);
    var ms = c.getMethods();
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]).replace('public ', '');
      if (pat.test(s)) print('  ' + s);
    }
    var cs = c.getConstructors();
    for (var k = 0; k < cs.length; k++) print('  CTOR ' + String(cs[k]).replace('public ', ''));
  } catch (e) { print('  FAIL ' + e); }
}
dump('com.fr.report.cell.cellattr.CellExpandAttr', /Table|ected|eft|irection|pward|Parent|set|get/, 'X');
dump('com.fr.report.cell.cellattr.core.group.SummaryGrouper', /set|get|FN/, 'X');
dump('com.fr.data.impl.DBTableData', /Query|Connection/, 'X');
dump('com.fr.report.cell.FloatElement', /set|get|add/, 'X');
dump('com.fr.report.cell.element.FloatElement', /set|get|add/, 'X');
print('== DefaultWorkSheet/WorkSheet float+cellattr face');
var c = Class.forName('com.fr.report.report.WorkSheet');
var ms2 = c.getMethods();
for (var j = 0; j < ms2.length; j++) {
  var s2 = String(ms2[j]).replace('public ', '');
  if (/loat|Expand|ellExpand|erge/.test(s2)) print('  WS ' + s2);
}
print('== DefaultCellElement expand face');
var c3 = Class.forName('com.fr.report.cell.DefaultCellElement');
var ms3 = c3.getMethods();
for (var j2 = 0; j2 < ms3.length; j2++) {
  var s3 = String(ms3[j2]).replace('public ', '');
  if (/Expand/.test(s3)) print('  CELL ' + s3);
}
print('PROBE END');
