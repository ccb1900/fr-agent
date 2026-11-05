// probe_r4m14.js — 批B词汇+装饰簇反射方法面 dump（零渲染零写入）：
//   tooltip content 类与方法面 / 8 个 tooltip 格式件 / ScatterAttrTooltip /
//   装饰 7 类（Border·BorderWithAlpha·Contents·Effect·AreaSeriesFill·SeriesImage·MarkerAlpha）/ AttrTooltipRichText。
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
      if (/getClass|wait\(|notify|hashCode|equals|toString|clone/.test(s)) continue;
      out.push('  ' + s);
    }
    var cs = c.getConstructors();
    for (var k = 0; k < cs.length; k++) out.push('  CTOR ' + String(cs[k]).replace('public ', ''));
  } catch (e) { out.push('  FAIL ' + e); }
  print(out.join('\n'));
}
// 1) tooltip 内容类（经 AttrTooltip 活引用取真类）
try {
  var tip0 = new (J('com.fr.plugin.chart.base.AttrTooltip'))();
  print('== contentClass=' + tip0.getContent().getClass().getName());
} catch (e) { print('!! contentClass ' + e); }
dump('com.fr.plugin.chart.base.AttrToolTipContent', /Format|RichText|set[A-Z]|get[A-Z]/);
// 2) tooltip 格式件群
['com.fr.plugin.chart.base.format.AttrTooltipAreaNameFormat',
 'com.fr.plugin.chart.base.format.AttrTooltipMapValueFormat',
 'com.fr.plugin.chart.base.format.AttrTooltipSummaryValueFormat',
 'com.fr.plugin.chart.base.format.AttrTooltipStartAndEndNameFormat',
 'com.fr.plugin.chart.base.format.AttrTooltipXFormat',
 'com.fr.plugin.chart.base.format.AttrTooltipYFormat',
 'com.fr.plugin.chart.base.format.AttrTooltipSizeFormat',
 'com.fr.plugin.chart.scatter.attr.ScatterAttrTooltip'
].forEach(function (n) { dump(n, /Format|set[A-Z]|get[A-Z]|Enable/); });
// 3) 装饰 7 类 + RichText
dump('com.fr.chart.base.AttrBorder', /./);
dump('com.fr.chart.base.AttrBorderWithAlpha', /./);
dump('com.fr.chart.base.AttrContents', /./);
dump('com.fr.chart.base.AttrEffect', /./);
dump('com.fr.plugin.chart.base.AttrAreaSeriesFillColorBackground', /./);
dump('com.fr.plugin.chart.base.AttrSeriesImageBackground', /./);
dump('com.fr.plugin.chart.base.AttrMarkerAlpha', /./);
dump('com.fr.plugin.chart.base.AttrTooltipRichText', /./);
print('DONE');
J('java.lang.System').exit(0);
