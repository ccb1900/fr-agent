// probe_linkparam.js — 钻取传参考古：ReportletHyperlink / Hyperlink 家族方法面（纯反射，不启 FR）
var J = function (n) { return Java.type(n); };
function dumpClass(full) {
  var c = J('java.lang.Class').forName(full); // Java.type 返回的是 JavaClass 包装，反射要真 Class
  print('==== ' + full);
  var sup = c.getSuperclass();
  print('  SUPER: ' + (sup ? sup.getName() : 'none'));
  var ms = c.getMethods();
  for (var i = 0; i < ms.length; i++) {
    if (!ms[i].getDeclaringClass().getName().startsWith('com.fr')) continue;
    var ps = ms[i].getParameterTypes();
    var p = [];
    for (var k = 0; k < ps.length; k++) p.push(ps[k].getSimpleName());
    print('  ' + ms[i].getReturnType().getSimpleName() + ' ' + ms[i].getName() + '(' + p.join(',') + ')');
  }
}
['com.fr.js.ReportletHyperlink', 'com.fr.js.Hyperlink', 'com.fr.report.cell.cellattr.core.group.FunctionGrouper',
 'com.fr.report.cell.cellattr.core.group.DSColumn'].forEach(function (n) {
  try { dumpClass(n); } catch (e) { print('ERR ' + n + ': ' + e); }
});
