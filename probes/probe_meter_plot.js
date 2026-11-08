var J=function(n){return Java.type(n);};
var c = J('com.fr.chart.chartattr.MeterPlot');
print('CLASS ' + c.class.getName());
print('SUPER ' + c.class.getSuperclass().getName());
var ms = c.class.getMethods();
for (var i=0;i<ms.length;i++){
  var m=ms[i]; if(m.getDeclaringClass().getName().indexOf('com.fr')<0) continue;
  print('M '+m.getName()+'('+[].slice.call(m.getParameterTypes()).map(function(t){return t.getName();}).join(',')+')');
}
J('java.lang.System').exit(0);
