// probe_panelwidgets2.js — DateEditor / ComboBoxEditor 全方法 + 事件 Listener 家族 + JSFunction
function safeDump(name, filter) {
  try {
    var cls = java.lang.Class.forName(name);
    print('== ' + name + ' EXT ' + String(cls.getSuperclass()));
    var ms = cls.getMethods();
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]);
      if (/hashCode|toString\(\)|getClass|clone|equals\(|wait\(|notifyAll/.test(s)) continue;
      if (!filter || filter.test(s)) print('  ' + s);
    }
    print('  -- 构造器 --');
    var cs = cls.getConstructors();
    for (var i = 0; i < cs.length; i++) print('  ' + String(cs[i]));
  } catch (e) { print('== ' + name + ' MISSING: ' + e.message); }
}
function all(s) { return true; }
safeDump('com.fr.form.ui.DateEditor');
safeDump('com.fr.form.ui.ComboBoxEditor');
safeDump('com.fr.form.event.listener.JavaScriptEventListener');
safeDump('com.fr.form.event.listener.MouseEventListener');
safeDump('com.fr.js.JavaScript');
safeDump('com.fr.js.WebHyperlink');
var names = ['com.fr.form.event.PressEvent', 'com.fr.form.event.ClickEvent', 'com.fr.form.event.core.Event', 'com.fr.form.event.Listener', 'com.fr.event.Event', 'com.fr.form.ui.event.FormEvent'];
for (var i = 0; i < names.length; i++) {
  try { print('== ' + names[i] + ' EXT ' + String(java.lang.Class.forName(names[i]).getSuperclass())); } catch (e) { print('== ' + names[i] + ' MISSING'); }
}
print('DONE');
