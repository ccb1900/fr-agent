// probe_pagehf.js — 批C：页眉页脚（headerfooter 207/240）+ 模板级 attrMark（TemplateId/Theme/Mobile）API 面
function dump(name, flt) {
  try {
    var cls = java.lang.Class.forName(name);
    print('== ' + name + ' EXT ' + String(cls.getSuperclass()));
    var ms = cls.getMethods();
    var seen = {};
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]);
      if (/hashCode|toString\(\)|getClass|clone\(\)|equals\(|wait\(|notifyAll|readXML|writeXML|analyzeCorrel|dependence/.test(s)) continue;
      if (!flt || flt.test(s)) { var sig = s.replace(/^[^ ]+ /, ''); if (!seen[sig]) { seen[sig] = 1; print('  ' + sig); } }
    }
    print('  -- ctors --');
    var cs = cls.getConstructors();
    for (var i2 = 0; i2 < cs.length; i2++) print('  ' + String(cs[i2]).replace(/^[^ ]+ /, ''));
  } catch (e) { print('== ' + name + ' MISSING: ' + e.message); }
}
dump('com.fr.page.stable.ReportPageAttr', /Header|Footer|HeaderL|FooterL/i);
dump('com.fr.base.iofile.attr.TemplateIdAttrMark');
dump('com.fr.base.iofile.attr.TemplateThemeAttrMark');
dump('com.fr.report.mobile.DefaultMobileParamStyle');
dump('com.fr.report.mobile.DefaultMobileBookMarkStyle');
print('DONE');
