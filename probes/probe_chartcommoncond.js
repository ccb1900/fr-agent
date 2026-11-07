var SYS=java.lang.System;
function J(n){return Java.type(n);}
try{var C=J('java.lang.Class').forName('com.fr.chart.chartattr.ChartCommonCondition');
 Java.from(C.getConstructors()).forEach(function(c){var ps=[];Java.from(c.getParameterTypes()).forEach(function(p){ps.push(p.getSimpleName());});SYS.out.println('CTOR ('+ps.join(',')+')');});
 Java.from(C.getMethods()).forEach(function(m){var s=m.getName();if(!/^(set|get|add)/.test(s))return;var ps=[];Java.from(m.getParameterTypes()).forEach(function(p){ps.push(p.getSimpleName());});SYS.out.println(' '+s+'('+ps.join(',')+')');});
}catch(e){SYS.out.println('ERR '+e);}
