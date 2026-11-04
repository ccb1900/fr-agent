// probe_write.js — 批F 填报章 API 面：ReportWriteAttr 挂点/BuiltInSQLSubmiter/IntelliDMLConfig/VerifyItem/reg 族
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
dump('com.fr.report.write.ReportWriteAttr', /./);
dump('com.fr.report.write.BuiltInSQLSubmiter', /./);
dump('com.fr.write.config.IntelliDMLConfig', /./);
dump('com.fr.data.VerifyItem', /./);
['com.fr.form.ui.reg.NoneReg', 'com.fr.form.ui.reg.CustomReg', 'com.fr.form.ui.reg.PhoneReg'].forEach(function (n) { dump(n, /./); });
dump('com.fr.form.ui.TextEditor', /setReg|getReg|Reg/);
print('DONE');
