var J=function(n){return Java.type(n);};
var r=new (J('com.fr.plugin.chart.box.data.VanBoxTableResultDefinition'))();
['getMin','getMax','getQ1','getQ3','getMedian','getCategoryName','getSeriesName','getMinLabel','getMaxLabel'].forEach(function(m){
  try { print(m+'='+r[m]()); } catch(e){ print(m+' ERR '+e); }
});
J('java.lang.System').exit(0);
