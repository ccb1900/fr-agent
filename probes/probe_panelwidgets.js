// probe_panelwidgets.js — 面板控件家族一手 API 面：FreeButton(按钮/事件)、DateEditor(日期)、ComboBoxEditor(枚举)
function dump(name, filter) {
  var cls = java.lang.Class.forName(name);
  print('== ' + name);
  var ms = cls.getMethods();
  for (var i = 0; i < ms.length; i++) { var s = String(ms[i]); if (!filter || filter.test(s)) print(s); }
  print('-- 构造器 --');
  for (var i = 0; i < cls.getConstructors().length; i++) print(String(cls.getConstructors()[i]));
}
function ok(s) { return !(s.indexOf('Object.') >= 0 || /hashCode|toString\(|getClass|clone|equals|wait\(|notify/.test(s)); }
dump('com.fr.form.ui.FreeButton', /setA|add|Event|Listener|Text|Name|URL|java/i);
dump('com.fr.form.ui.DateEditor', /set(F|format|R|widgetValue|N|d)/i);
dump('com.fr.form.ui.ComboBoxEditor', /set|add|ctor/i);
print('DONE');
