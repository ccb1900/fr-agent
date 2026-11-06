// probe_barinterval_hosts.js — barInterval 宿主面（setCategoryIntervalPercent 在哪些 plot 类上）
var SYS = java.lang.System;
function has(name, meth){
  try {
    var C = Java.type('java.lang.Class').forName(name);
    var found = false;
    Java.from(C.getMethods()).forEach(function(m){ if (m.getName() === meth) found = true; });
    SYS.out.println(name.split('.').pop() + ' has ' + meth + ' = ' + found);
  } catch(e){ SYS.out.println(name + ' ERR ' + e); }
}
has('com.fr.chart.chartattr.Bar2DPlot', 'setCategoryIntervalPercent');
has('com.fr.chart.chartattr.PiePlot', 'setCategoryIntervalPercent');
has('com.fr.chart.chartattr.LinePlot', 'setCategoryIntervalPercent');
has('com.fr.plugin.chart.column.VanChartColumnPlot', 'setCategoryIntervalPercent');
has('com.fr.plugin.chart.line.VanChartLinePlot', 'setCategoryIntervalPercent');
has('com.fr.plugin.chart.area.VanChartAreaPlot', 'setCategoryIntervalPercent');
has('com.fr.plugin.chart.scatter.VanChartScatterPlot', 'setCategoryIntervalPercent');
has('com.fr.plugin.chart.bubble.VanChartBubblePlot', 'setCategoryIntervalPercent');
has('com.fr.plugin.chart.PiePlot4VanChart', 'setCategoryIntervalPercent');
has('com.fr.plugin.chart.gauge.VanChartGaugePlot', 'setCategoryIntervalPercent');
