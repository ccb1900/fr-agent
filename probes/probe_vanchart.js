// probe_vanchart.js — VanChart 插件图表族 API 面：构造器 + 超类链 + 官方 demo 反读
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

function chain(c) { var s = []; while (c != null && c !== Object['class']) { s.push(c.getName()); c = c.getSuperclass(); } return s.join(' < '); }
function ctors(c) { var a = c.getConstructors(), o = []; for (var i = 0; i < a.length; i++) o.push(String(a[i])); return o.join('\n   '); }
function msurface(c, prefix) {
  var a = c.getMethods(), u = {};
  for (var i = 0; i < a.length; i++) { var n = a[i].getName(); if (prefix.test(n)) u[n] = 1; }
  return Object.keys(u).sort().join(',');
}

var NAMES = ['com.fr.plugin.chart.vanchart.VanChart', 'com.fr.plugin.chart.column.VanChartColumnPlot',
  'com.fr.plugin.chart.PiePlot4VanChart', 'com.fr.plugin.chart.gauge.VanChartGaugePlot',
  'com.fr.plugin.chart.line.VanChartLinePlot', 'com.fr.plugin.chart.area.VanChartAreaPlot',
  'com.fr.plugin.chart.scatter.VanChartScatterPlot', 'com.fr.plugin.chart.map.VanChartMapPlot',
  'com.fr.plugin.chart.custom.VanChartCustomPlot', 'com.fr.plugin.chart.base.VanChartAttrLine',
  'com.fr.plugin.chart.base.VanChartAttrMarker', 'com.fr.plugin.chart.base.VanChartAttrTrendLine'];
for (var i = 0; i < NAMES.length; i++) {
  try {
    var c = Class.forName(NAMES[i]);
    print('== ' + NAMES[i]);
    print('   chain: ' + chain(c));
    print('   ctors: ' + ctors(c));
    print('   M ' + msurface(c, /^(set|get|add|is|has|create)/));
  } catch (e) { print('== ' + NAMES[i] + ' MISSING: ' + e); }
}

// 官方 demo 反读：拿真实 VanChart 对象形态
try {
  var TWBIO = J('com.fr.io.TemplateWorkBookIO');
  var wb = TWBIO.readTemplateWorkBook('demo/analytics/柱形图变形.cpt');
  var ws = wb.getReport(0);
  for (var r = 0; r < 40; r++) {
    for (var c = 0; c < 20; c++) {
      var ce = ws.getCellElement(c, r);
      if (!ce) continue;
      var v = ce.getValue();
      if (v == null) continue;
      var cn = v.getClass().getName();
      if (cn.indexOf('ChartCollection') >= 0) {
        print('== DEMO CELL(' + c + ',' + r + ') ' + cn);
        var ch = (v.getChartCount && v.getChartCount() > 0) ? v.getSelectedChart() : v;
        print('   chartClass=' + ch.getClass().getName());
        var plot = ch.getPlot();
        print('   plotClass=' + plot.getClass().getName());
        var pm = plot.getClass().getMethods(), pu = {};
        for (var i = 0; i < pm.length; i++) { var n = pm[i].getName(); if (/^(set|get|add)/.test(n)) pu[n] = 1; }
        print('   PLOTM ' + Object.keys(pu).sort().join(','));
      }
    }
  }
} catch (e) { print('DEMO READ ERR: ' + e); }

print('PROBE_VANCHART_DONE');
J('java.lang.System').exit(0);
