// probe_hla2.js — 批A 条件属性满血：缺的 4 个 Action + ObjectCondition API 面
function safeDump(name, filter) {
  try {
    var cls = java.lang.Class.forName(name);
    print('== ' + name + ' EXT ' + String(cls.getSuperclass()) + ' iface=' + String(cls.getInterfaces()));
    var ms = cls.getMethods();
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]);
      if (/hashCode|toString\(\)|getClass|clone|equals\(|wait\(|notifyAll|getName\(\)/.test(s)) continue;
      if (/String\ Name/.test(String(cls)) === null) { }
      if (!filter || filter.test(s)) print('  ' + s);
    }
    print('  -- ctors --');
    var cs = cls.getConstructors();
    for (var i = 0; i < cs.length; i++) print('  ' + String(cs[i]));
  } catch (e) { print('== ' + name + ' MISSING: ' + e.message); }
}
safeDump('com.fr.report.cell.cellattr.highlight.ValueHighlightAction');
safeDump('com.fr.report.cell.cellattr.highlight.BorderHighlightAction');
safeDump('com.fr.report.cell.cellattr.highlight.HyperlinkHighlightAction');
safeDump('com.fr.report.cell.cellattr.highlight.WidgetHighlightAction');
safeDump('com.fr.data.condition.ObjectCondition');
safeDump('com.fr.report.cell.cellattr.core.CellBorderStyle');
print('DONE');
