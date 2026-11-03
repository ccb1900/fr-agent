// probe_dict.js — 自定义枚举字典类 + DateEditor 的格式语义确认
var names = ['com.fr.data.impl.CustomDictionary', 'com.fr.data.impl.ListDataDictionary', 'com.fr.data.impl.NameTableDictionary', 'com.fr.data.impl.DictDictionary', 'com.fr.data.Dictionary'];
for (var i = 0; i < names.length; i++) {
  try {
    var cls = java.lang.Class.forName(names[i]);
    print('== ' + names[i] + ' EXT ' + String(cls.getSuperclass()));
    var ms = cls.getMethods();
    for (var j = 0; j < ms.length; j++) {
      var s = String(ms[j]);
      if (/hashCode|toString\(\)|getClass\(|clone|equals\(|wait\(|notifyAll/.test(s)) continue;
      if (/put|add|Entry|set|clear|ctor/i.test(s) || /Dictionary\./.test(s)) print('  ' + s);
    }
    var cs = cls.getConstructors();
    for (var j = 0; j < cs.length; j++) print('  CTOR ' + String(cs[j]));
  } catch (e) { print('== ' + names[i] + ' MISSING'); }
}
try {
  var d = new (java.lang.Class.forName('com.fr.form.ui.DateEditor'))();
  print('== DateEditor 实例 formatText 默认 = ' + d.getFormatText());
  print('== startText=' + d.getStartText() + ' endText=' + d.getEndText() + ' returnDate=' + d.isReturnDate());
} catch (e) { print('DateEditor inst fail ' + e.message); }
print('DONE');
