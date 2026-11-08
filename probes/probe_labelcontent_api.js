// probe_labelcontent_api.js — 2026-11-08：饼图 label content 反射（活对象路线）
//   AttrLabelDetail/AttrTooltipContent 按类名 ClassNotFound（可能在插件 jar / 静态初始化面），
//   改用活对象：new AttrLabel() -> getAttrLabelDetail() -> getContent()，反射真实类与方法。
var JT = function (n) { return Java.type(n); };
function dumpMethods(o, tag, pat) {
  print('== ' + tag + ' class=' + o.getClass().getName());
  var ms = o.getClass().getMethods();
  for (var i = 0; i < ms.length; i++) {
    var m = ms[i], n = String(m.getName());
    if (m.getParameterTypes().length !== 1) continue;
    if (pat && n.toLowerCase().indexOf(pat) < 0) continue;
    print('  ' + n + '(' + String(m.getParameterTypes()[0].getName()) + ')');
  }
}
try {
  var lab = new (JT('com.fr.plugin.chart.base.AttrLabel'))();
  var ld = lab.getAttrLabelDetail();
  dumpMethods(ld, 'AttrLabelDetail', null);
  var c = ld.getContent && ld.getContent();
  if (c) dumpMethods(c, 'content', null); else print('== content is null');
} catch (e) { print('ERR ' + e); }
