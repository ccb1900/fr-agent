// probe_r4m19.js — 批I map 域 R0：类方法面 dump + 官方 mapfather.cpt 无头渲染可行性
var Class = Java.type('java.lang.Class');
var J = function (n) { return Java.type(n); };
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(), new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(), new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(), new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(Class.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
function dump(name, pat) {
  var out = ['== ' + name];
  try {
    var c = Class.forName(name);
    out.push('  super=' + String(c.getSuperclass()).replace('class ', ''));
    var ms = c.getMethods();
    for (var i = 0; i < ms.length; i++) { var s = String(ms[i]).replace('public ', '');
      if (pat && !pat.test(s)) continue;
      if (/getClass|wait\(|notify|hashCode|equals|toString|clone|writeXML|readXML|toJSON|getJs|getUsedFonts|putVanJSON|addAttributeConfig|getBuryingPoint|hasBuryingPoint|getConditionType|inCondition/.test(s)) continue;
      out.push('  ' + s); }
    var cs = c.getConstructors();
    for (var k = 0; k < cs.length; k++) out.push('  CTOR ' + String(cs[k]).replace('public ', ''));
  } catch (e) { out.push('  FAIL ' + e); }
  print(out.join('\n'));
}
dump('com.fr.plugin.chart.map.VanChartMapPlot', /set[A-Z]|get[A-Z]|Map/);
dump('com.fr.plugin.chart.map.data.VanMapMoreNameCDDefinition', /./);
dump('com.fr.plugin.chart.heatmap.VanChartHeatMapPlot', /set[A-Z]|get[A-Z]|Map|Heat/);
dump('com.fr.plugin.chart.map.attr.AttrMapLabel', /./);
dump('com.fr.plugin.chart.map.line.condition.AttrCurve', /./);
dump('com.fr.plugin.chart.map.line.condition.AttrLineEffect', /./);
dump('com.fr.chart.web.ChartHyperRelateCellLink', /./);
dump('com.fr.plugin.chart.base.format.AttrTooltipAreaNameFormat', /Enable|Format/);
dump('com.fr.plugin.chart.base.format.AttrTooltipMapValueFormat', /Enable|Format/);
// 官方 mapfather.cpt 无头渲染
try {
  var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('doc/Chart/mapfather.cpt');
  var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
  if (!rb) { print('!! MAPFATHER execute null'); }
  else {
    var pngP = 'D:/fineagent/logs/_r4m19_mapfather.png';
    var osP = new (J('java.io.FileOutputStream'))(pngP);
    new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
    osP.close();
    print('== MAPFATHER rendered ' + pngP);
  }
} catch (e) { print('!! MAPFATHER FAIL ' + e); }
print('DONE');
J('java.lang.System').exit(0);
