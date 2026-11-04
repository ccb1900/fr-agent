// probe_chartdeco.js — 批B 图表装饰层 API 面：AttrTooltip 全家/AttrLabel/ConditionAttr/AttrBorder/Alpha/Background/趋势线/标记/堆叠轴/刻度密度/图例布局
function dump(name, flt) {
  try {
    var cls = java.lang.Class.forName(name);
    print('== ' + name + ' EXT ' + String(cls.getSuperclass()));
    var ms = cls.getMethods();
    var RE = flt || /Attr|Tooltip|Label|Condition|Border|Alpha|Background|Trend|Marker|Stack|MainUnit|Tick|Size|Cate|Percent|Changed|Series|Radar|Pie/;
    var seen = {};
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]);
      if (/hashCode|toString\(\)|getClass|clone\(\)|equals\(|wait\(|notifyAll|readXML|writeXML|analyzeCorrel|dealFormula|dependence|modColumnRow|formula2Value|addDataSetNames|createJSON|parseJSON|evalTableData|eval\(/.test(s)) continue;
      if (RE.test(s)) {
        var sig = s.replace(/^[^ ]+ /, '');
        if (!seen[sig]) { seen[sig] = 1; print('  ' + sig.replace(name, '~')); }
      }
    }
    print('  -- ctors --');
    var cs = cls.getConstructors();
    for (var i2 = 0; i2 < cs.length; i2++) print('  ' + String(cs[i2]).replace(/^[^ ]+ /, ''));
  } catch (e) { print('== ' + name + ' MISSING: ' + e.message); }
}
// 宿主面：Plot 基类 + Van 柱 + Chart + 图形件
dump('com.fr.chart.chartattr.Plot');
dump('com.fr.chart.chartattr.Chart', /Attr|Tooltip|Condition|ConditionA[nt]/);
dump('com.fr.chart.chartglyph.PlotGlyph');
dump('com.fr.plugin.chart.base.AttrTooltip');
dump('com.fr.plugin.chart.base.format.AttrTooltipSeriesFormat');
dump('com.fr.plugin.chart.base.format.AttrTooltipPercentFormat');
dump('com.fr.plugin.chart.base.format.AttrTooltipChangedValueFormat');
dump('com.fr.plugin.chart.base.format.AttrTooltipCategoryFormat');
dump('com.fr.plugin.chart.base.AttrLabel');
dump('com.fr.plugin.chart.base.AttrLabelDetail');
dump('com.fr.chart.chartglyph.ConditionAttr');
dump('com.fr.chart.base.AttrBorder');
dump('com.fr.chart.base.AttrAlpha');
dump('com.fr.chart.base.AttrBackground');
dump('com.fr.plugin.chart.base.VanChartAttrLine');
dump('com.fr.plugin.chart.base.VanChartAttrMarker');
dump('com.fr.plugin.chart.base.VanChartAttrTrendLine');
dump('com.fr.plugin.chart.base.AttrSeriesStackAndAxis');
dump('com.fr.plugin.chart.attr.axis.VanChartValueAxis', /MainUnit|Tick|Decimals|NumberFormat|Force|Min|Max|Title/);
dump('com.fr.base.chart.chartglyph.Legend', /Size|Width|Height|Position|Visible/);
print('DONE');
