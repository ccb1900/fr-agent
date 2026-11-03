// probe_font.js — FRFont 是否被缓存/共享（setForeground 会污染同 size+style 的所有 Style）
var J = function (n) { return Java.type(n); };
var CLS = function (n) { return Java.type('java.lang.Class').forName(n); };
var C = CLS('com.fr.general.FRFont');
var ct = C.getConstructors(), out = [];
for (var i = 0; i < ct.length; i++) {
  var ps = ct[i].getParameterTypes(), a = [];
  for (var k = 0; k < ps.length; k++) a.push(ps[k].getSimpleName());
  out.push('(' + a.join(',') + ')');
}
print('FRFont CTOR ' + (out.length ? out.join(' | ') : 'none'));
print('implementsCloneable = ' + (J('java.lang.Cloneable').class.isAssignableFrom(C)));

var a = J('com.fr.general.FRFont').getInstanceFromFRSize('SimHei', 1, 84);
var b = J('com.fr.general.FRFont').getInstanceFromFRSize('SimHei', 1, 84);
print('sameInstance = ' + (a === b) + '  (a=' + a.toString() + ')');
a.setForeground(new (J('java.awt.Color'))(0xC00000));
print('after mutate b.foreground = ' + b.getForeground());

var ms = C.getMethods(), keep = [];
for (var i = 0; i < ms.length; i++) if (/^(getInstance|clone|derive|copy|setForeground|getForeground)/.test(ms[i].getName())) keep.push(ms[i].getName());
var u = {}; keep.forEach(function (x) { u[x] = 1; });
print('FRFont M ' + Object.keys(u).sort().join(','));
print('PROBE_FONT_DONE');
