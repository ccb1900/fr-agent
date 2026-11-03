// probe_vanchart3.js — VanChartValueAxis 默认 custom 标志 + 官方 scatter/饼图 demo 绑定反读
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

var p = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))();
var ya = p.getyAxis();
print('AXIS isCustomMaxValue=' + ya.isCustomMaxValue() + ' maxValue=' + ya.getMaxValue() + ' min=' + ya.getMinValue());
var BTD = J('com.fr.chart.chartdata.BubbleTableDefinition');
var bts = BTD.class ? BTD.class.getConstructors() : Class.forName('com.fr.chart.chartdata.BubbleTableDefinition').getConstructors();
var bo = []; for (var i = 0; i < bts.length; i++) bo.push(String(bts[i]));
print('BUBBLE ctors:\n   ' + bo.join('\n   '));
var bs = {}; var bm = Class.forName('com.fr.chart.chartdata.BubbleTableDefinition').getMethods();
for (var i = 0; i < bm.length; i++) { var n = bm[i].getName(); if (/^set/.test(n)) bs[n] = 1; }
print('BUBBLE setters: ' + Object.keys(bs).sort().join(','));
var yl = p.getValueAxisList();
if (yl.size() > 0) { var a0 = yl.get(0); print('YLIST0 ' + a0.getClass().getName() + ' customMax=' + a0.isCustomMaxValue() + ' max=' + a0.getMaxValue() + ' min=' + a0.getMinValue()); }
var xl = p.getXAxisList();
if (xl.size() > 0) { var x0 = xl.get(0); print('XLIST0 ' + x0.getClass().getName() + ' type=' + x0.getAxisType()); }

// 官方 demo scatter / pie VanChart 反读绑定形态
var TWBIO = J('com.fr.io.TemplateWorkBookIO');
function dumpdef(path) {
  var wb = TWBIO.readTemplateWorkBook(path);
  for (var r = 0; r < 40; r++) {
    for (var c = 0; c < 20; c++) {
      var ws = wb.getReport(r >= 0 ? 0 : 0);
      var ce = ws.getCellElement(c, r);
      if (!ce) continue;
      var v = ce.getValue();
      if (v == null) continue;
      if (String(v.getClass().getName()).indexOf('ChartCollection') < 0) continue;
      var ch = v.getSelectedChart();
      var plot = ch.getPlot();
      var pn = plot.getClass().getName();
      if (pn.indexOf('Scatter') < 0 && pn.indexOf('Pie') < 0) continue;
      print('== ' + path + ' CELL(' + c + ',' + r + ') plot=' + pn);
      var def = ch.getChartDataDefinition();
      print('   defClass=' + (def == null ? 'null' : def.getClass().getName()));
      if (def != null) {
        var dm = def.getClass().getMethods();
        for (var i = 0; i < dm.length; i++) if (/^(get|set)/.test(dm[i].getName())) { /* too many */ }
        var s = def.toString();
        print('   def=' + String(s).substring(0, 300));
      }
      return true;
    }
  }
  return false;
}
dumpdef('demo/analytics/柱形图变形.cpt');
print('PROBE_VANCHART3_DONE');
J('java.lang.System').exit(0);
