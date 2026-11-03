// probe_linkparam2.js — 钻取传参第二轮考古：Parameter / DBTableData.getParameters / ReportletHyperlink.setParameters
var J = function (n) { return Java.type(n); };
function sig(full) {
  var c = J('java.lang.Class').forName(full);
  print('==== ' + full + '  IFACES=' + Java.from(c.getInterfaces()).map(function (x) { return x.getName(); }).join(','));
  var cs = c.getConstructors();
  for (var i = 0; i < cs.length; i++) {
    print('  CTOR (' + Java.from(cs[i].getParameterTypes()).map(function (t) { return t.getName(); }).join(',') + ')');
  }
  var ms = c.getMethods();
  for (var k = 0; k < ms.length; k++) {
    var m = ms[k];
    if (!/^get(Parameters?)$|^setParameters$|^addParameter|^insertParameter|^removeParameter/.test(m.getName())) continue;
    print('  ' + m.getReturnType().getName() + ' ' + m.getName() + '(' +
      Java.from(m.getParameterTypes()).map(function (t) { return t.getName(); }).join(',') + ')');
  }
}
['com.fr.base.Parameter', 'com.fr.stable.ParameterProvider', 'com.fr.data.impl.DBTableData',
 'com.fr.data.TableDataUtil', 'com.fr.stable.AbstractParameterProvider',
 'com.fr.report.cell.cellattr.core.group.DSColumn'].forEach(function (n) {
  try { sig(n); } catch (e) { print('ERR ' + n + ': ' + e); }
});
// ParameterDefinition 家族
try {
  var pd = J('java.lang.Class').forName('com.fr.data.ParameterDefinition');
  print('com.fr.data.ParameterDefinition OK');
} catch (e) { print('no com.fr.data.ParameterDefinition'); }
