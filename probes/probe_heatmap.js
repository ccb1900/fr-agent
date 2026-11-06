// probes/probe_heatmap.js — D2 热力图 R0（probes 先行纪律，D1 教训：先证官方无头渲染，再谈接线）
//   官方语料 doc/Chart/HeatMap/网页热力图.cpt 结构（XML 一手，2026-11-07）：
//     Plot class=com.fr.plugin.chart.heatmap.VanChartHeatMapPlot
//       + <VanChartHeatMapPlotAttr radius blur maxopacity minopacity/>
//       + <VanChartMapPlotAttr mapType="point" geourl="assets/map/image/heatmap.json" zoomlevel="0" mapmarkertype="0"/>
//     ChartDefinition/VanMapDefinition/pointDefinition class=VanMapMoreNameCDDefinition（与 vmap point 完全同构，我们已构造）
//   本探针：①VanChartHeatMapPlot 反射方法面（ctor/setter/getter/attr 读写口）
//           ②官方 网页热力图.cpt 无头渲染（readTemplateWorkBook→execute→ImageExporter）
//   跑法：run.ps1 -Script probes/probe_heatmap.js（需 FR 引擎）
var J = function (n) { return Java.type(n); };

// ---------- 1. 反射方法面 ----------
var CL = J('java.lang.Class');
var HK = CL.forName('com.fr.plugin.chart.heatmap.VanChartHeatMapPlot');
print('HM CLASS=' + HK.getName());
var supers = [];
var sc = HK.getSuperclass();
while (sc) { supers.push(sc.getName()); sc = sc.getSuperclass(); }
print('HM SUPERS=' + supers.join(' <- '));
var ms = HK.getMethods();
var ctorBits = [], setterBits = [], attrBits = [];
for (var i = 0; i < ms.length; i++) {
  var n = ms[i].getName();
  if (ms[i].getDeclaringClass().getName().indexOf('com.fr') < 0) continue;
  if (n.indexOf('VanChartHeatMap') >= 0 || /Attr\b|getPlotAttr|setVanChartPlotAttr/i.test(n)) {
    var ps = ms[i].getParameterTypes();
    var sig = n + '(';
    for (var p = 0; p < ps.length; p++) sig += (p ? ',' : '') + ps[p].getSimpleName();
    sig += ')';
    (n.indexOf('set') === 0 || n.indexOf('add') === 0 ? setterBits : attrBits).push(sig);
  }
}
print('HM ATTR-RELATED=' + attrBits.join(' | '));
var ctors = HK.getConstructors();
for (var c = 0; c < ctors.length; c++) {
  var ps2 = ctors[c].getParameterTypes();
  var sig2 = 'ctor(';
  for (var q = 0; q < ps2.length; q++) sig2 += (q ? ',' : '') + ps2[q].getSimpleName();
  ctorBits.push(sig2 + ')');
}
print('HM CTORS=' + ctorBits.join(' | '));
// 官方 XML <VanChartHeatMapPlotAttr> 是序列化别名——真类面=javap 一手（2026-11-07）：
//   VanChartHeatMapPlot 直接持有 setRadius/setBlur/setMinOpacity/setMaxOpacity(double)，无独立 Attr 类
var hm = HK.getMethods();
var hpBits = [];
for (var k = 0; k < hm.length; k++) {
  var nm = hm[k].getName();
  if (/^set(Radius|Blur|MinOpacity|MaxOpacity)$/.test(nm)) hpBits.push(nm + '(' + hm[k].getParameterTypes()[0].getSimpleName() + ')');
}
print('HM HEAT SETTERS=' + hpBits.join(' | '));

// ---------- 2. 官方 网页热力图.cpt 无头渲染（D1 教训检查点；boot 序列照抄 probe_r4m19） ----------
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(), new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(), new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(), new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(J('java.lang.Class').forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
try {
  var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('doc/Chart/HeatMap/网页热力图.cpt');
  print('HM OFFICIAL READ OK');
  var params = new (J('java.util.HashMap'))();
  var rb = wb.execute(params, new (J('com.fr.stable.PageActor'))());
  print('HM OFFICIAL EXEC=' + rb);
  var F2 = J('java.nio.file.Files');
  var os = new (J('java.io.FileOutputStream'))('logs/_heatmap_official.png');
  new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
  os.close();
  var sz = F2.size(J('java.nio.file.Paths').get('logs/_heatmap_official.png'));
  print('HM OFFICIAL PNG bytes=' + sz + (sz > 1000 ? ' RENDER-OK' : ' RENDER-SUSPECT'));
} catch (e) {
  print('HM OFFICIAL FAIL: ' + String(e).split('\n').slice(0, 3).join(' || '));
}
J("java.lang.System").exit(0);
