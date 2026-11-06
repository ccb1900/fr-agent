// probe_customplot.js — D1 组合图 API 面探针（只读反射）
var SYS = java.lang.System;
function J(n){ return Java.type(n); }
function M(name, filter){
  try {
    var C = J('java.lang.Class').forName(name);
    SYS.out.println('CLASS ' + name + ' super=' + C.getSuperclass().getName());
    var seen = {};
    Java.from(C.getMethods()).forEach(function(m){
      var s = m.getName();
      if (filter && s.toLowerCase().indexOf(filter) < 0) return;
      var ps = []; Java.from(m.getParameterTypes()).forEach(function(p){ ps.push(p.getSimpleName()); });
      var line = s + '(' + ps.join(',') + ')';
      if (!seen[line]) { seen[line] = 1; SYS.out.println('  ' + line); }
    });
    Java.from(C.getFields()).forEach(function(f){ SYS.out.println('  F ' + f.getName()); });
  } catch(e){ SYS.out.println('ERR ' + name + ' ' + e); }
}
M('com.fr.plugin.chart.custom.VanChartCustomPlot', '');
M('com.fr.plugin.chart.column.VanChartColumnPlot', '');
