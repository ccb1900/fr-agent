// probe_hla2b.js — CellBorderStyle 全 API 面（BorderHighlightAction 的参数件）
try {
  var c = java.lang.Class.forName('com.fr.base.CellBorderStyle');
  print('== CellBorderStyle EXT ' + String(c.getSuperclass()));
  var ms = c.getMethods();
  for (var i = 0; i < ms.length; i++) { var s = String(ms[i]); if (/hashCode|getClass|wait\(|notifyAll/.test(s)) continue; print('  ' + s); }
  print('  -- ctors --');
  var cs = c.getConstructors();
  for (var i = 0; i < cs.length; i++) print('  ' + String(cs[i]));
} catch (e) { print('MailFAIL' + e.message); }
try {
  var d = java.lang.Class.forName('com.fr.report.cell.cellattr.core.style.CellBorderStyle');
  print('== alt-pkg CellBorderStyle FOUND ' + d);
} catch (e2) { print('alt-pkg missing (正常,只证实 com.fr.base 命名)'); }
print('DONE');
