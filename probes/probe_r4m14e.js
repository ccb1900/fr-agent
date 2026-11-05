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
      if (/getClass|wait\(|notify|hashCode|equals|toString|clone|writeXML|readXML|toJSON|getJs|getUsedFonts|putVanJSON|addAttributeConfig|getConditionType/.test(s)) continue;
      out.push('  ' + s); }
    var cs = c.getConstructors();
    for (var k = 0; k < cs.length; k++) out.push('  CTOR ' + String(cs[k]).replace('public ', ''));
  } catch (e) { out.push('  FAIL ' + e); }
  print(out.join('\n'));
}
dump('com.fr.chart.chartattr.PieCategoryLabelContent', /./);
var ms = Class.forName('com.fr.plugin.chart.PiePlot4VanChart').getMethods();
var hits = [];
for (var i = 0; i < ms.length; i++) { var n = String(ms[i].getName()); if (/Label|Category/.test(n) && hits.indexOf(n) < 0) hits.push(n); }
print('== PiePlot4VanChart label/category methods: ' + hits.join(' '));
print('DONE');
J('java.lang.System').exit(0);
