var SYS = java.lang.System;
function J(n){ return Java.type(n); }
try {
  var C=J('java.lang.Class').forName('com.fr.plugin.chart.type.MapMarkerType');
  var E=C.getEnumConstants();
  if(E) Java.from(E).forEach(function(e){ SYS.out.println('E '+e); });
  Java.from(C.getFields()).forEach(function(f){ SYS.out.println('F '+f.getName()+'='+f.get(null)); });
} catch(e){ SYS.out.println('ERR '+e); }
try {
  var P=J('java.lang.Class').forName('com.fr.plugin.chart.map.VanChartMapPlot');
  Java.from(P.getMethods()).forEach(function(m){ var s=m.getName(); if(/Marker|NullValue|MapType/.test(s)) SYS.out.println('M '+s); });
} catch(e){ SYS.out.println('ERR P '+e); }
