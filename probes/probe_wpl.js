// probe_wpl.js — WParameterLayout/WLayout 方法面：Display / DelayDisplayContent / UseParamsTemplate API
function dump(n, f) {
  try {
    var cls = java.lang.Class.forName(n);
    print('== ' + n + ' EXT ' + String(cls.getSuperclass()));
    var ms = cls.getMethods();
    for (var i = 0; i < ms.length; i++) { var s = String(ms[i]); if (/hashCode|getClass\(|clone|equals\(|wait\(|notifyAll/.test(s)) continue; if (!f || f.test(s)) print('  ' + s); }
  } catch (e) { print('== ' + n + ' MISSING'); }
}
dump('com.fr.form.ui.container.WParameterLayout', /Delay|Display|Params|set[A-Z]/);
dump('com.fr.form.ui.container.WLayout', /Delay|Display|Params|set[A-Z]/);
print('DONE');
