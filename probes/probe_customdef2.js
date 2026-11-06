var SYS = java.lang.System;
function J(n){ return Java.type(n); }
function C(name){
  var K = J('java.lang.Class').forName(name);
  SYS.out.println('CLASS ' + name);
  Java.from(K.getConstructors()).forEach(function(c){
    var ps=[]; Java.from(c.getParameterTypes()).forEach(function(p){ ps.push(p.getName()); });
    SYS.out.println('  CTOR (' + ps.join(',') + ')');
  });
  Java.from(K.getMethods()).forEach(function(m){
    var s=m.getName();
    if (!/^(set|get|add|put)/.test(s)) return;
    var ps=[]; Java.from(m.getParameterTypes()).forEach(function(p){ ps.push(p.getSimpleName()); });
    SYS.out.println('  ' + s + '(' + ps.join(',') + ')');
  });
}
C('com.fr.chart.chartdata.OneValueCDDefinition');
C('com.fr.plugin.chart.custom.CustomDefinition');
