function dump(name, flt) {
  try {
    var cls = java.lang.Class.forName(name);
    print('== ' + name + ' EXT ' + String(cls.getSuperclass()));
    var ms = cls.getMethods();
    var seen = {};
    for (var i = 0; i < ms.length; i++) { var mn = ms[i].getName(); if (/^(set|add|get)[A-Z]/.test(mn)) { var sig = String(ms[i]).replace(/^[^ ]+ /, ''); if (!seen[sig] && (!flt || flt.test(sig))) { seen[sig] = 1; print('  ' + sig); } } }
    var cs = cls.getConstructors();
    for (var i2 = 0; i2 < cs.length; i2++) print('  ctor ' + String(cs[i2]).replace(/^[^ ]+ /, ''));
  } catch (e) { print('== ' + name + ' MISSING: ' + e.message); }
}
dump('com.fr.report.cell.cellattr.core.DiagonalCellLine');
dump('com.fr.base.present.BarcodePresent');
dump('com.fr.report.cell.cellattr.core.group.CustomGrouper');
dump('com.fr.report.cell.cellattr.SubReport', /./);
dump('com.fr.report.cell.cellattr.CellGUIAttr', /Frozen|setFrozen/);
print('DONE');
