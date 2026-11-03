// probe_hl_api.js — 条件属性家族 API 面反射 + 组装可行性（官方 XML 形状为准）
var J = function (n) { return Java.type(n); };
var CLS = function (n) { return Java.type('java.lang.Class').forName(n); };

var CLASSES = [
  'com.fr.report.cell.cellattr.highlight.DefaultHighlight',
  'com.fr.report.cell.cellattr.highlight.HighlightGroup',
  'com.fr.report.cell.cellattr.highlight.BackgroundHighlightAction',
  'com.fr.report.cell.cellattr.highlight.ForegroundHighlightAction',
  'com.fr.report.cell.cellattr.highlight.FRFontHighlightAction',
  'com.fr.report.cell.cellattr.highlight.RowHeightHighlightAction',
  'com.fr.report.cell.cellattr.highlight.ColWidthHighlightAction',
  'com.fr.report.cell.cellattr.highlight.BorderHighlightAction',
  'com.fr.report.cell.cellattr.highlight.PageHighlightAction',
  'com.fr.report.cell.cellattr.highlight.HyperlinkHighlightAction',
  'com.fr.report.cell.cellattr.highlight.WidgetHighlightAction',
  'com.fr.data.condition.CommonCondition',
  'com.fr.data.condition.FormulaCondition',
  'com.fr.data.condition.ListCondition',
  'com.fr.data.condition.ObjectCondition',
  'com.fr.base.present.DictPresent',
  'com.fr.base.present.CustomDictionary',
  'com.fr.report.cell.cellattr.CellSortAttr',
  'com.fr.report.cell.cellattr.core.group.DSColumn'
];

function show(name) {
  try {
    var c = CLS(name);
    var ctors = c.getConstructors();
    var line = [];
    for (var i = 0; i < ctors.length; i++) {
      var ps = ctors[i].getParameterTypes();
      var a = [];
      for (var k = 0; k < ps.length; k++) a.push(ps[k].getSimpleName());
      line.push('(' + a.join(',') + ')');
    }
    print('CTOR ' + name + ' :: ' + (line.length ? line.join(' | ') : 'none'));
    var ms = c.getMethods(), keep = [];
    for (var m = 0; m < ms.length; m++) {
      var nm = ms[m].getName();
      if (/^(set|add|get|put|create)/.test(nm)) keep.push(nm);
    }
    var uniq = {};
    keep.forEach(function (x) { uniq[x] = 1; });
    print('  M ' + Object.keys(uniq).sort().join(','));
  } catch (e) {
    print('MISS ' + name + ' :: ' + e.message);
  }
}
CLASSES.forEach(show);
print('REFLECT DONE');
