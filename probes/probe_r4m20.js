// probe_r4m20.js — 漏账 9 类判定面 dump（零渲染）：逐类 super+CTOR+关键 setter,判"可实现/引擎标记/域外"
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
function dump(name) {
  var out = ['== ' + name];
  try {
    var c = Class.forName(name);
    out.push('  super=' + String(c.getSuperclass()).replace('class ', ''));
    var ms = c.getMethods();
    var seen = [];
    for (var i = 0; i < ms.length; i++) { var s = String(ms[i]).replace('public ', '');
      if (/getClass|wait\(|notify|hashCode|equals|toString|clone|writeXML|readXML|toJSON|getJs|getUsedFonts|putVanJSON|addAttributeConfig|getBuryingPoint|hasBuryingPoint|getConditionType/.test(s)) continue;
      if (/^void (set|add)[A-Z]/.test(s) || /CTOR|^java|^int|^boolean|^double|^float|^com\.fr/.test(s)) { out.push('  ' + s); } }
    var cs = c.getConstructors();
    for (var k = 0; k < cs.length; k++) out.push('  CTOR ' + String(cs[k]).replace('public ', ''));
  } catch (e) { out.push('  FAIL ' + e); }
  print(out.slice(0, 16).join('\n'));
}
dump('com.fr.chart.chartattr.ChartCommonCondition');
dump('com.fr.plugin.chart.custom.VanChartCustomPlot');
dump('com.fr.form.ui.MultiFileEditor');
dump('com.fr.report.web.button.form.TreeNodeToggleButton');
dump('com.fr.form.ui.CustomToolBarButton');
dump('com.fr.data.impl.ExcelTableData');
dump('com.fr.data.impl.RecursionTableData');
dump('com.fr.base.io.FileAttrErrorMarker');
dump('com.fr.chartx.data.DataSetDefinition');
print('DONE');
J('java.lang.System').exit(0);
