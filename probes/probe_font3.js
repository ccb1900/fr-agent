var J = function (n) { return Java.type(n); };
var CLS = function (n) { return Java.type('java.lang.Class').forName(n); };
var C = CLS('com.fr.general.FRFont');
var ct = C.getDeclaredConstructors(), out = [];
for (var i = 0; i < ct.length; i++) {
  var ps = ct[i].getParameterTypes(), a = [];
  for (var k = 0; k < ps.length; k++) a.push(ps[k].getName());
  out.push('(' + a.join(',') + ')');
}
print('FRFont DECLARED CTOR ' + (out.length ? out.join(' | ') : 'none'));
var ms = C.getDeclaredMethods(), keep = [];
for (var i = 0; i < ms.length; i++) if (/^(getInstance|clone|derive|copy|setForeground)/.test(ms[i].getName())) {
  var ps = ms[i].getParameterTypes(), a = [];
  for (var k = 0; k < ps.length; k++) a.push(ps[k].getSimpleName());
  keep.push(ms[i].getName() + '(' + a.join(',') + ')');
}
print('FRFont DM ' + keep.join('  '));

var g = J('com.fr.general.FRFont').getInstanceFromFRSize('SimHei', 1, 84);
var d = g.deriveFont(2.0); // 试试派生（无参/单参？）
print('deriveFont same = ' + (g === d) + ' fg=' + d.getForeground());

var S = CLS('com.fr.base.Style');
var sm = S.getMethods(), sk = [];
for (var i = 0; i < sm.length; i++) if (/oreground|Color|FRFont|Font/.test(sm[i].getName())) sk.push(sm[i].getName());
var u = {}; sk.forEach(function (x) { u[x] = 1; });
print('Style M ' + Object.keys(u).sort().join(','));
print('PROBE_FONT3_DONE');
