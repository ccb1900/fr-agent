var SYS = java.lang.System;
function J(n){ return Java.type(n); }
function M(name, filter){
  try {
    var C = J('java.lang.Class').forName(name);
    SYS.out.println('CLASS ' + name + ' super=' + (C.getSuperclass()?C.getSuperclass().getName():''));
    Java.from(C.getConstructors()).forEach(function(c){
      var ps=[]; Java.from(c.getParameterTypes()).forEach(function(p){ ps.push(p.getSimpleName()); });
      SYS.out.println('  CTOR (' + ps.join(',') + ')');
    });
    Java.from(C.getMethods()).forEach(function(m){
      var s=m.getName();
      if (filter && !filter.test(s)) return;
      if (/^(wait|notify|equals|hashCode|toString|getClass|clone)$/.test(s)) return;
      var ps=[]; Java.from(m.getParameterTypes()).forEach(function(p){ ps.push(p.getSimpleName()); });
      SYS.out.println('  ' + s + '(' + ps.join(',') + ')');
    });
    Java.from(C.getFields()).forEach(function(f){ SYS.out.println('  F ' + f.getName() + '=' + f.get(null)); });
    var E=C.getEnumConstants(); if (E) Java.from(E).forEach(function(e){ SYS.out.println('  E ' + e); });
  } catch(e){ SYS.out.println('ERR ' + name + ' ' + e); }
}
M('com.fr.plugin.chart.type.MapType');
M('com.fr.plugin.chart.map.data.VanMapMoreNameCDDefinition', /./);
M('com.fr.plugin.chart.map.data.VanMapOneValueCDDefinition', /./);
M('com.fr.plugin.chart.map.VanChartMapPlot', /^(set|get)(Map|Geo|Match|View|Zoom|Gis|Data)/);
