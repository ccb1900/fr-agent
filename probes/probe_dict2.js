function dump(name, flt) {
  try {
    var cls = java.lang.Class.forName(name);
    print('== ' + name + ' EXT ' + String(cls.getSuperclass()));
    var ms = cls.getMethods();
    var seen = {};
    for (var i = 0; i < ms.length; i++) { var s = String(ms[i]); if (/hashCode|toString\(\)|getClass|clone\(\)|equals\(|wait\(|notifyAll|readXML|writeXML|analyzeCorrel|dependence|createJSON|parseJSON|modColumnRow|dealFormula|formula2Value|addDataSetNames|evalTableData/.test(s)) continue; if (!flt || flt.test(s)) { var sig = s.replace(/^[^ ]+ /, ''); if (!seen[sig]) { seen[sig] = 1; print('  ' + sig); } } }
    var cs = cls.getConstructors();
    for (var i2 = 0; i2 < cs.length; i2++) print('  ctor ' + String(cs[i2]).replace(/^[^ ]+ /, ''));
  } catch (e) { print('== ' + name + ' MISSING: ' + e.message); }
}
dump('com.fr.data.impl.TableDataDictionary', /set|get/);
dump('com.fr.data.impl.DatabaseDictionary', /set|get/);
dump('com.fr.data.impl.DynamicSQLDict', /set|get/);
dump('com.fr.data.impl.FormulaDictionary', /set|get|accept/);
dump('com.fr.base.SimpleDateFormatThreadSafe', /./);
dump('com.fr.base.TextFormat', /./);
print('DONE');
