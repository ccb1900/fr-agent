// probe_r4reflect2.js — 反射挖矿：plot 继承链 stack/plotType 相关字段+方法全量；找 vanChartPlotType 归属类与枚举值
var Class = Java.type('java.lang.Class');
var J = function (n) { return Java.type(n); };
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(),
  new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(),
  new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(),
  new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(Class.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();

function dumpHierarchy(fq, rx) {
  var k = Class.forName(fq), cls = k, c = k;
  print('== HIER ' + fq);
  while (c != null && String(c.getName()) != 'java.lang.Object') {
    var fs = c.getDeclaredFields(); var hits = [];
    for (var i = 0; i < fs.length; i++) {
      var fn = String(fs[i].getName());
      if (rx.test(fn)) hits.push(fn + ':' + String(fs[i].getType().getName()).replace(/com\.fr\.|java\.lang\./g, ''));
    }
    if (hits.length) print('  fields @' + String(c.getName()).replace(/com\.fr\.plugin\.|com\.fr\.chart\./g, '') + ' { ' + hits.join(' ') + ' }');
    var ms = c.getDeclaredMethods(); var mh = [];
    for (var m = 0; m < ms.length; m++) {
      var mn = String(ms[m].getName());
      if (rx.test(mn)) mh.push((java.lang.reflect.Modifier.isStatic(ms[m].getModifiers()) ? '#' : '') + mn + '/' + ms[m].getParameterTypes().length);
    }
    if (mh.length) print('  methods @' + String(c.getName()).replace(/com\.fr\.plugin\.|com\.fr\.chart\./g, '') + ' { ' + mh.join(' ') + ' }');
    c = c.getSuperclass();
  }
}
var rxStack = /stack|Stack|plot|Plot|type|Type|axis|Axis/i;
dumpHierarchy('com.fr.plugin.chart.column.VanChartColumnPlot', rxStack);

// plot 实例字段值现场（可能装着 RectanglePlotAttr）
try {
  var plot = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))();
  dumpHierarchy('com.fr.plugin.chart.base.VanChartRectanglePlotAttr', /type|Type|stack|Stack/);
} catch (eA) { print('!! dump RectanglePlotAttr fail ' + eA); }

// 找 VanChartRectanglePlotAttr 的全类名：从 plot 字段反射 get 后看运行时类
var plot2 = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))();
for (var k2 = plot2.getClass(); k2 != null && String(k2.getName()) != 'java.lang.Object'; k2 = k2.getSuperclass()) {
  var fs2 = k2.getDeclaredFields();
  for (var f2 = 0; f2 < fs2.length; f2++) {
    fs2[f2].setAccessible(true);
    var fv = fs2[f2].get(plot2);
    var tn = String(fs2[f2].getName());
    if (/plot|attr|Attr|type|Type/i.test(tn) && fv != null) {
      print('FIELD ' + tn + ' (' + String(fv.getClass().getName()) + ') = ' + String(fv).substring(0, Math.min(150, String(fv).length)));
    }
  }
}
print('DONE');
J('java.lang.System').exit(0);
