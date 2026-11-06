// probe_r4m21.js — 补漏账判定证据+批G/批D/批J 实现面:FileAttrErrorMarker/DataSetDefinition/RecursionTableData
//   +PolyECBlock/PolyWorkSheet+FrozenState/RepeatAndCollapsible+FineDateFormat;SortHeader/Diagonal 类普查。
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
    for (var i = 0; i < ms.length; i++) { var s = String(ms[i]).replace('public ', '');
      if (/getClass|wait\(|notify|hashCode|equals|toString|clone|writeXML|readXML|toJSON|getJs|getUsedFonts|putVanJSON|addAttributeConfig|getBuryingPoint|hasBuryingPoint|getConditionType|dependence/.test(s)) continue;
      out.push('  ' + s); }
    var cs = c.getConstructors();
    for (var k = 0; k < cs.length; k++) out.push('  CTOR ' + String(cs[k]).replace('public ', ''));
  } catch (e) { out.push('  FAIL ' + e); }
  print(out.slice(0, 18).join('\n'));
}
dump('com.fr.base.io.FileAttrErrorMarker');
dump('com.fr.chartx.data.DataSetDefinition');
dump('com.fr.data.impl.RecursionTableData');
dump('com.fr.report.poly.PolyECBlock');
dump('com.fr.report.poly.PolyWorkSheet');
dump('com.fr.report.web.attr.FrozenState');
dump('com.fr.report.web.attr.RepeatAndCollapsible');
dump('com.fr.general.date.FineDateFormat');
print('DONE');
J('java.lang.System').exit(0);
