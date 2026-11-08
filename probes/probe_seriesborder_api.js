// probe_seriesborder_api.js — seriesBorder 渲染攻坚（2026-11-08）：边界类 API/宿主面反射一手
//   输出：三个 Border 类的构造与 setter 面、Plot/GeneralInfo 的 border 相关 setter。只读反射，不改产物。
var JT = function (n) { return Java.type(n); };
function dump(cn) {
  try {
    var C = JT(cn);
    print('== ' + cn);
    var ms = C.class.getDeclaredMethods();
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], n = String(m.getName());
      if (n.indexOf('Border') >= 0 || n.indexOf('Width') >= 0 || n.indexOf('Shape') >= 0 || n.indexOf('Alpha') >= 0 || n.indexOf('Color') >= 0) {
        var ps = m.getParameterTypes(), out = [];
        for (var k = 0; k < ps.length; k++) out.push(String(ps[k].getName()));
        print('  m ' + n + '(' + out.join(',') + ')');
      }
    }
    var sc = C.class.getSuperclass();
    while (sc) { print('  <- ' + sc.getName()); sc = sc.getSuperclass(); }
  } catch (e) { print('ERR ' + cn + ': ' + e); }
}
dump('com.fr.chart.base.AttrBorder');
dump('com.fr.plugin.chart.base.AttrBorderWithAlpha');
dump('com.fr.plugin.chart.base.AttrBorderWithWidth');
dump('com.fr.plugin.chart.base.AttrBorderWithShape');
function setters(cn, pat) {
  try {
    var C = JT(cn);
    print('== ' + cn + ' set* matching /' + pat + '/');
    var ms = C.class.getMethods();
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], n = String(m.getName());
      if (n.indexOf('set') === 0 && n.toLowerCase().indexOf(pat) >= 0) {
        var ps = m.getParameterTypes(), out = [];
        for (var k = 0; k < ps.length; k++) out.push(String(ps[k].getName()));
        print('  ' + n + '(' + out.join(',') + ')');
      }
    }
  } catch (e) { print('ERR ' + cn + ': ' + e); }
}
setters('com.fr.chart.chartattr.Plot', 'border');
setters('com.fr.chart.chartglyph.GeneralInfo', 'border');
setters('com.fr.plugin.chart.vanchart.VanChart', 'border');
setters('com.fr.chart.chartattr.Chart', 'border');
// ---- 构造器面（Border 家族；2026-11-08 实验 3 的判据：WithWidth 无参 ctor + setLineWidth）----
['com.fr.chart.base.AttrBorder', 'com.fr.plugin.chart.base.AttrBorderWithAlpha', 'com.fr.plugin.chart.base.AttrBorderWithWidth', 'com.fr.plugin.chart.base.AttrBorderWithShape'].forEach(function (cn) {
  try {
    var C2 = JT(cn); print('== ctor ' + cn);
    var cs = C2.class.getConstructors();
    for (var ci = 0; ci < cs.length; ci++) {
      var ps2 = cs[ci].getParameterTypes(), out2 = [];
      for (var ck = 0; ck < ps2.length; ck++) out2.push(String(ps2[ck].getName()));
      print('  ctor(' + out2.join(',') + ')');
    }
  } catch (e2) { print('ERR ' + cn + ': ' + e2); }
});
