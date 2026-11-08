// probe_border_datapoint.js — 2026-11-08：柱缘描边宿主用法（活对象方法面）
//   目标：VanChart plot/chart 上如何拿到 VanChartDataPoint 或 ColorInfo（序列样式）以挂 AttrBorder。
var J = function (n) { return Java.type(n); };
function dump(cn, pats) {
  try {
    var C = J(cn); print('== ' + cn);
    var ms = C.class.getMethods();
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], n = String(m.getName()).toLowerCase();
      var ok = false;
      for (var p = 0; p < pats.length; p++) { if (n.indexOf(pats[p]) >= 0) { ok = true; break; } }
      if (!ok) continue;
      var rt = String(m.getReturnType().getName());
      var ps = m.getParameterTypes(), out = [];
      for (var k = 0; k < ps.length; k++) out.push(String(ps[k].getName()));
      print('  ' + String(m.getName()) + '(' + out.join(',') + ') -> ' + rt);
    }
  } catch (e) { print('ERR ' + cn + ': ' + e); }
}
dump('com.fr.plugin.chart.column.VanChartColumnPlot', ['datapoint', 'series', 'style', 'colorinfo']);
dump('com.fr.plugin.chart.vanchart.VanChartPlot', ['datapoint', 'series', 'style', 'colorinfo']);
dump('com.fr.plugin.chart.vanchart.VanChart', ['datapoint', 'series', 'style', 'colorinfo']);
dump('com.fr.chart.chartattr.Plot', ['datapoint', 'series', 'style', 'colorinfo']);
dump('com.fr.chart.base.ColorInfo', ['border', 'set']);
