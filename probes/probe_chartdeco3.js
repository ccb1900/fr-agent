try {
  var c = java.lang.Class.forName('com.fr.chart.base.AttrColor');
  print('== AttrColor ok ' + c);
  var ms = c.getMethods();
  for (var i = 0; i < ms.length; i++) { var s = String(ms[i]); if (/hashCode|getClass|wait|notifyAll|toJSONObject|toVanJSON|addAttributeConfig|getBurying|hasBurying|putVanJSON/.test(s)) continue; print('  ' + s.replace(/^[^ ]+ /, '')); }
  var cs = c.getConstructors();
  for (var j = 0; j < cs.length; j++) print('  ctor ' + String(cs[j]).replace(/^[^ ]+ /, ''));
} catch (e) { print('MISSING ' + e.message); }
print('DONE');
