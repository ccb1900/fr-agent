// probe_vantitle_api.js — VanChart 标题对象方法面（2026-11-08，chart.title 空图缺陷定位）
var J = function (n) { return Java.type(n); };
var cls = ['com.fr.plugin.chart.attr.VanChartTitle', 'com.fr.chart.chartattr.Title'];
cls.forEach(function (cn) {
  try {
    var c = J(cn);
    print('CLASS ' + cn);
    var ms = c.class.getMethods();
    var names = {};
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.getDeclaringClass().getName().indexOf('com.fr') < 0) continue;
      var s = m.getName();
      if (s.indexOf('get') === 0 || s.indexOf('set') === 0 || s.indexOf('is') === 0) names[s] = 1;
    }
    print(Object.keys(names).sort().join(','));
  } catch (e) { print('ERR ' + cn + ' :: ' + e); }
});
J('java.lang.System').exit(0);
