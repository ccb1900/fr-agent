// probe_chartdeco2.js — 批B 二轮：挂接宿主（ConditionCollection/AttrTooltipContent/VanPlot label 方法/枚举值/正名 Legend）
function dump(name, flt) {
  try {
    var cls = java.lang.Class.forName(name);
    print('== ' + name + ' EXT ' + String(cls.getSuperclass()));
    var ms = cls.getMethods();
    var seen = {};
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]);
      if (/hashCode|toString\(\)|getClass|clone\(\)|equals\(|wait\(|notifyAll|readXML|writeXML|analyzeCorrel|dealFormula|dependence|modColumnRow|formula2Value|addDataSetNames|createJSON|parseJSON|evalTableData|eval\(|toJSONObject|toVanJSON|addAttributeConfig|addFormatName|add2JSON|putVanJSON|getBurying|hasBurying/.test(s)) continue;
      if (!flt || flt.test(s)) { var sig = s.replace(/^[^ ]+ /, ''); if (!seen[sig]) { seen[sig] = 1; print('  ' + sig); } }
    }
    print('  -- ctors --');
    var cs = cls.getConstructors();
    for (var i2 = 0; i2 < cs.length; i2++) print('  ' + String(cs[i2]).replace(/^[^ ]+ /, ''));
  } catch (e) { print('== ' + name + ' MISSING: ' + e.message); }
}
dump('com.fr.chart.chartglyph.ConditionCollection');
dump('com.fr.chart.chartglyph.Legend');
dump('com.fr.plugin.chart.base.AttrTooltipContent');
dump('com.fr.plugin.chart.column.VanChartColumnPlot', /Label|Tooltip|Markers?|Stack|Attr/);
dump('com.fr.plugin.chart.marker.type.MarkerType');
dump('com.fr.plugin.chart.type.LineType');
dump('com.fr.plugin.chart.type.LineStyle');
dump('com.fr.plugin.chart.base.TrendLineType');
dump('com.fr.chart.base.AttrColor');
print('ENUM ticks:');
try {
  var MT = java.lang.Class.forName('com.fr.plugin.chart.marker.type.MarkerType');
  var ec = MT.getEnumConstants();
  for (var i = 0; i < ec.length; i++) print('  MarkerType ' + String(ec[i]));
} catch (e) { print('MarkerType missing'); }
try {
  var LT = java.lang.Class.forName('com.fr.plugin.chart.base.TrendLineType');
  var ec2 = LT.getEnumConstants();
  for (var j = 0; j < ec2.length; j++) print('  TrendLineType ' + String(ec2[j]));
} catch (e2) { print('TrendLineType missing'); }
print('DONE');
