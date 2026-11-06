var SYS = java.lang.System;
var K = Java.type('java.lang.Class').forName('com.fr.plugin.chart.custom.type.CustomPlotType');
Java.from(K.getFields()).forEach(function(f){ SYS.out.println('F ' + f.getName() + ' = ' + f.get(null)); });
var E = K.getEnumConstants();
if (E) Java.from(E).forEach(function(e){ SYS.out.println('E ' + e); });
