// probe_basic5.js — ColumnRow + DSColumn + WorkSheet(float) + DefaultCellElement
var Class = Java.type('java.lang.Class');
function dump(name, pat, tag) {
  print('== ' + name);
  try {
    var c = Class.forName(name);
    var ms = c.getMethods();
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]).replace('public ', '');
      if (pat.test(s)) print('  ' + tag + ' ' + s);
    }
    var cs = c.getConstructors();
    for (var k = 0; k < cs.length; k++) print('  CTOR ' + String(cs[k]).replace('public ', ''));
  } catch (e) { print('  FAIL ' + e); }
}
dump('com.fr.stable.ColumnRow', /valueOf|create|getRow|getColumn/, 'CR');
dump('com.fr.report.cell.cellattr.core.group.DSColumn', /etResult|etGrouper|etColumn|etDS|etCondition|etParameters|etFilter|etGroup/, 'DSC');
dump('com.fr.report.worksheet.WorkSheet', /loat|erge|ellPage/, 'WS');
dump('com.fr.report.cell.DefaultCellElement', /Expand|etRowSpan|etColumnSpan/, 'DE');
print('PROBE END');
