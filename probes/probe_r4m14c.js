// probe_r4m14c.js — 散点 content 真类 / AttrMapTooltip 方法面 / ImageWithSuffix 构造
var Class = Java.type('java.lang.Class');
var J = function (n) { return Java.type(n); };
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(),
  new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(),
  new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(),
  new (J('com.fr.report.ReportActivator'))(),
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
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]).replace('public ', '');
      if (pat && !pat.test(s)) continue;
      if (/getClass|wait\(|notify|hashCode|equals|toString|clone|writeXML|readXML|toJSON|add2JSON|getJs|getUsedFonts|putVanJSON|addAttributeConfig|getBuryingPoint|hasBuryingPoint|getConditionType/.test(s)) continue;
      out.push('  ' + s);
    }
    var cs = c.getConstructors();
    for (var k = 0; k < cs.length; k++) out.push('  CTOR ' + String(cs[k]).replace('public ', ''));
  } catch (e) { out.push('  FAIL ' + e); }
  print(out.join('\n'));
}
try {
  var st = new (J('com.fr.plugin.chart.scatter.attr.ScatterAttrTooltip'))();
  print('== scatterContentClass=' + st.getContent().getClass().getName());
} catch (e) { print('!! scatterContent ' + e); }
dump('com.fr.plugin.chart.map.attr.AttrMapTooltip', /./);
dump('com.fr.general.ImageWithSuffix', /./);
print('DONE');
J('java.lang.System').exit(0);
