// probe_r4m14b.js — m14 补漏：AttrTooltipContent(单T)方法面 / plugin.chart.base 的 BorderWithAlpha·Effect /
//   ImageBackground 构造 / plot 级 hotTooltip setter / VanChart 装饰 setters。
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
      if (/getClass|wait\(|notify|hashCode|equals|toString|clone|writeXML|readXML|toJSON|add2JSON|addFormatName|getJs|getUsedFonts|addJSON|putVanJSON|addAttributeConfig|createAttachImageUrl|getBuryingPoint|hasBuryingPoint|getConditionType|inCondition/.test(s)) continue;
      out.push('  ' + s);
    }
    var cs = c.getConstructors();
    for (var k = 0; k < cs.length; k++) out.push('  CTOR ' + String(cs[k]).replace('public ', ''));
  } catch (e) { out.push('  FAIL ' + e); }
  print(out.join('\n'));
}
dump('com.fr.plugin.chart.base.AttrTooltipContent', /./);
dump('com.fr.plugin.chart.base.AttrBorderWithAlpha', /./);
dump('com.fr.plugin.chart.base.AttrEffect', /./);
dump('com.fr.base.background.ImageBackground', /./);
// plot 级 setter（VanChartColumnPlot 全类 + Bar2DPlot legacy）
dump('com.fr.plugin.chart.column.VanChartColumnPlot', /Hot|hot|Tooltip|tooltip|newHot/);
dump('com.fr.chart.chartattr.Plot', /Hot|hot|Tooltip|tooltip/);
print('DONE');
J('java.lang.System').exit(0);
