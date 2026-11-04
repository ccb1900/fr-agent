function dump(name, flt) {
  try {
    var cls = java.lang.Class.forName(name);
    print('== ' + name + ' EXT ' + String(cls.getSuperclass()));
    var ms = cls.getMethods();
    var seen = {};
    for (var i = 0; i < ms.length; i++) { var s = String(ms[i]); if (/hashCode|toString\(\)|getClass|clone\(\)|equals\(|wait\(|notifyAll|readXML|writeXML/.test(s)) continue; if (!flt || flt.test(s)) { var sig = s.replace(/^[^ ]+ /, ''); if (!seen[sig]) { seen[sig] = 1; print('  ' + sig); } } }
    var cs = cls.getConstructors();
    for (var i2 = 0; i2 < cs.length; i2++) print('  ctor ' + String(cs[i2]).replace(/^[^ ]+ /, ''));
  } catch (e) { print('== ' + name + ' MISSING: ' + e.message); }
}
dump('com.fr.js.ParameterJavaScript');
dump('com.fr.js.ReportletHyperlinkDialogAttr');
dump('com.fr.chart.web.ChartHyperRelateCellLink');
dump('com.fr.js.ReportletHyperlink', /setAttrib|Dialog|addParameter|setParameters/i);
print('DONE');
