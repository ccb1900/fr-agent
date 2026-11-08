// probe_gismap.js — legacy GIS 地图（com.fr.chart.chartattr.GisMapPlot）一手反射探针（2026-11-08）
//   官方 reportlets 零 GisMapPlot 语料（grep 仅命中 FRDemo 表名 GisMap）；本探针直接从 jar 反射：
//   ① GisMapPlot 继承链/构造器/setter/defaultChartData ② com.fr.chart.chartdata.* 里 gis 相关数据定义
//   ③ 目标 setter 的可接受值面（若为 enum/常量类，打印其静态字段）。
//   输出是 TRUTH，不是承诺；实现前必须以此为准。
// 用法：run.ps1 -Script probes/probe_gismap.js
var J = function (n) { return Java.type(n); };
function dumpClass(cn) {
  try {
    var c = J(cn);
    print('=== CLASS ' + cn);
    var sc = c.class.getSuperclass();
    print('  EXTENDS ' + (sc ? sc.getName() : '<none>'));
    var ct = c.class.getConstructors();
    for (var i = 0; i < ct.length; i++) {
      var ps = ct[i].getParameterTypes(), a = [];
      for (var j = 0; j < ps.length; j++) a.push(ps[j].getName());
      print('  CTOR (' + a.join(',') + ')');
    }
    var msj = c.class.getDeclaredMethods(), ms = [];
    for (var z0 = 0; z0 < msj.length; z0++) ms.push(msj[z0]);
    ms.sort(function (x, y) { return ('' + x.getName()).localeCompare('' + y.getName()); });
    for (var k = 0; k < ms.length; k++) {
      var m = ms[k], nm = '' + m.getName(), p = m.getParameterTypes(), aa = [];
      if (nm.indexOf('set') === 0 || nm.indexOf('get') === 0 || nm.indexOf('add') === 0 || nm.indexOf('create') === 0 || nm.indexOf('default') === 0) {
        for (var q = 0; q < p.length; q++) aa.push(p[q].getName());
        print('  M ' + nm + '(' + aa.join(',') + ') -> ' + m.getReturnType().getName());
      }
    }
  } catch (e) { print('  ERR ' + e); }
}
function dumpStatics(cn) {
  try {
    var c = J(cn);
    print('=== STATICS ' + cn);
    var fs = c.class.getDeclaredFields();
    for (var i = 0; i < fs.length; i++) {
      var f = fs[i];
      if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) {
        try { print('  ' + f.getName() + ' = ' + f.get(null)); } catch (e) { print('  ' + f.getName()); }
      }
    }
  } catch (e) { print('  ERR ' + e); }
}
var targets = [
  'com.fr.chart.chartattr.GisMapPlot',
  'com.fr.chart.chartdata.GisMapTableDefinition',
  'com.fr.chart.chartdata.SeriesDefinition',
  'com.fr.chart.chartdata.GisMapChartData',
  'com.fr.chart.chartdata.GisMapReportDefinition',
  'com.fr.chart.charttypes.GisMapIndependentChart',
  'com.fr.chart.chartdata.GisMapDefinition',
  'com.fr.chart.chartdata.GisTableDefinition',
  'com.fr.chart.chartdata.MapTableDefinition',
  'com.fr.chart.chartdata.MapDefinition',
  'com.fr.chart.chartdata.GisMapDataDefinition'
];
for (var i = 0; i < targets.length; i++) dumpClass(targets[i]);
dumpStatics('com.fr.plugin.chart.type.GISLayerType');
dumpStatics('com.fr.plugin.chart.type.GaoDeGisType');
dumpStatics('com.fr.plugin.chart.base.GisLayer');

// jar 内 gis 相关类清单（不猜类名）
var z = J('java.util.zip.ZipFile');
var jar = new z('D:/software/FineReport_11.0/webapps/webroot/WEB-INF/lib/fine-report-engine-11.0.jar');
var en = jar.entries(), hits = [];
while (en.hasMoreElements()) {
  var e = en.nextElement(), n = '' + e.getName();
  if (!n.endsWith('.class') || n.indexOf('$') >= 0) continue;
  if (/gis/i.test(n)) hits.push(n.substring(0, n.length - 6).replace(/\//g, '.'));
}
hits.sort();
print('=== JAR GIS CLASSES (' + hits.length + ')');
hits.forEach(function (h) { print('  ' + h); });
