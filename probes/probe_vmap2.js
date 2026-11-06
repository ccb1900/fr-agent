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
      if (/^(wait|notify|equals|hashCode|toString|getClass|clone|writeXML|readXML)$/.test(s)) return;
      var ps=[]; Java.from(m.getParameterTypes()).forEach(function(p){ ps.push(p.getSimpleName()); });
      SYS.out.println('  ' + s + '(' + ps.join(',') + ')');
    });
  } catch(e){ SYS.out.println('ERR ' + name + ' ' + e); }
}
M('com.fr.plugin.chart.map.data.VanMapDefinition', /./);
M('com.fr.plugin.chart.map.VanChartMapPlot', /^(set|get)(MapType|GeoUrl|MatchResult|ViewCenter|ZoomLevel|GisLayer)/);
