// probe_chartdata_builder.js — 剩余 7 图族的 dataDefinition builder 面批量探针（探针先行纪律，2026-11-08）
//   目标：为 meter/range/stock/custom/drillmap/treemap/gantt 一次量出「每个 plot 对应的 dataDefinition 类 + 构造器 + setter 面」
//     ——直接读 FineReport jar 的类清单（DataDefinition|TableDefinition|ValueDefinition 类），打印一手 API；
//     也同时列出目标 plot 的构造器与 setter，为下一步逐类实现提供直接依据。
//   输出到 stdout（runraw 会写入日志）；非闭包承诺，只产出 TRUTH。实现必须看到这个输出后再写。
// 用法：run.ps1 -Script probes/probe_chartdata_builder.js
var J=function(n){return Java.type(n);};
var z=J('java.util.zip.ZipFile');
var jarPath='D:/software/FineReport_11.0/webapps/webroot/WEB-INF/lib/fine-report-engine-11.0.jar';
var jar=new z(jarPath);
var F=jar.entries();
var clsNames=[];
while(F.hasMoreElements()){
  var e=F.nextElement(); var n=(''+e.getName());
  if(!n.endsWith('.class'))continue;
  if(n.indexOf('$')>=0)continue;
  if(n.indexOf('com/fr/chart/')!==0 && n.indexOf('com/fr/plugin/chart/')!==0)continue;
  var simple=n.substring(n.lastIndexOf('/')+1).replace('.class','');
  if(/(DataDefinition|DataDefinition|TableDefinition|ValueDefinition|MapDataDefinition|TableDef)$/.test(simple)) clsNames.push(n.substring(0,n.length-6).replace(/\//g,'.'));
}
clsNames.sort();
print('BUILDER CLASSES=' + clsNames.length);
clsNames.forEach(function(n){
  var c=J(n);
  print('--- ' + n);
  try{
    var ct=c.class.getConstructors();
    for(var i=0;i<ct.length;i++){
      var ps=ct[i].getParameterTypes(); var a=[];
      for(var j=0;j<ps.length;j++)a.push(ps[j].getName());
      print('  CTOR (' + a.join(',') + ')');
    }
  }catch(eC){}
  try{
    var ms=c.class.getDeclaredMethods();
    for(var k=0;k<ms.length;k++){
      var m=ms[k]; var nm=m.getName(); if(m.indexOf!==undefined){}
      var ps=m.getParameterTypes();
      if((nm.indexOf('set')===0 || nm.indexOf('add')===0 || nm.indexOf('put')===0) && ps.length>0){
        var a=[]; for(var q=0;q<ps.length;q++)a.push(ps[q].getName());
        print('  SETTER ' + nm + '(' + a.join(',') + ')');
      }
    }
  }catch(eM){}
});
function dumpPlot(cn){
  try{
    var c=J(cn);
    print('=== PLOT ' + cn);
    var ct=c.class.getConstructors();
    for(var i=0;i<ct.length;i++){var ps=ct[i].getParameterTypes();var a=[];for(var j=0;j<ps.length;j++)a.push(ps[j].getName());print('  CTOR ('+a.join(',')+')');}
    var ms=c.class.getMethods();
    for(var k=0;k<ms.length;k++){
      var m=ms[k];var nm=m.getName();
      if(m.getDeclaringClass().getName().indexOf('com.fr')<0)continue;
      if(nm.indexOf('set')===0||nm.indexOf('get')===0||nm.indexOf('is')===0){
        var ps=m.getParameterTypes();var a=[];for(var q=0;q<ps.length;q++)a.push(ps[q].getName());
        print('  ' + nm + '(' + a.join(',') + ')' + (ps.length&&q>=0?'  <-':""));
      }
    }
  }catch(eP){print('  PLOT-ERR ' + cn + ' :: ' + eP);}
}
['com.fr.chart.chartattr.MeterPlot',
 'com.fr.chart.chartattr.RangePlot',
 'com.fr.chart.chartattr.StockPlot',
 'com.fr.chart.chartattr.GisMapPlot',
 'com.fr.plugin.chart.custom.VanChartCustomPlot',
 'com.fr.plugin.chart.treemap.VanChartTreeMapPlot'].forEach(dumpPlot);
print('PROBE END');
J('java.lang.System').exit(0);
