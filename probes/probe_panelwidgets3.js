// probe_panelwidgets3.js — ComboBox 全方法 + JavaScriptImpl 构造面 + com.fr.form.event.Listener
function safeDump(name) {
  try {
    var cls = java.lang.Class.forName(name);
    print('== ' + name + ' EXT ' + String(cls.getSuperclass()));
    var ms = cls.getMethods();
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]);
      if (/hashCode|toString\(\)|getClass\(|clone|equals\(|wait\(|notifyAll/.test(s)) continue;
      print('  ' + s);
    }
    print('  -- 构造器 --');
    var cs = cls.getConstructors();
    for (var i = 0; i < cs.length; i++) print('  ' + String(cs[i]));
  } catch (e) { print('== ' + name + ' MISSING'); }
}
safeDump('com.fr.form.ui.ComboBox');
safeDump('com.fr.js.JavaScriptImpl');
safeDump('com.fr.form.event.Listener');
print('DONE');
