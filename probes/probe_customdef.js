var SYS = java.lang.System;
function J(n){ return Java.type(n); }
function M(name){
  try {
    var C = J('java.lang.Class').forName(name);
    SYS.out.println('CLASS ' + name);
    var seen = {};
    Java.from(C.getMethods()).forEach(function(m){
      var s = m.getName();
      if (/^(wait|notify|equals|hashCode|toString|getClass|clone)$/.test(s)) return;
      var ps = []; Java.from(m.getParameterTypes()).forEach(function(p){ ps.push(p.getSimpleName()); });
      var line = s + '(' + ps.join(',') + ')';
      if (!seen[line]) { seen[line]=1; SYS.out.println('  ' + line); }
    });
    Java.from(C.getDeclaredClasses()).forEach(function(k){ SYS.out.println('  INNER ' + k.getName()); });
  } catch(e){ SYS.out.println('ERR ' + name + ' ' + e); }
}
M('com.fr.plugin.chart.custom.CustomDefinition');
M('com.fr.chart.chartdata.OneValueCDDefinition');
