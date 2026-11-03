var J = function (n) { return Java.type(n); };
var CLS = function (n) { return Java.type('java.lang.Class').forName(n); };
function sg(ps) { var a = []; for (var k = 0; k < ps.length; k++) a.push(ps[k].getSimpleName()); return a.join(','); }
['com.fr.form.ui.NumberEditor', 'com.fr.form.ui.TextArea', 'com.fr.form.ui.RadioGroup',
 'com.fr.form.ui.CheckBoxGroup', 'com.fr.form.ui.ComboCheckBox', 'com.fr.form.ui.TreeComboBoxEditor',
 'com.fr.form.ui.IframeEditor', 'com.fr.form.ui.MultiFileEditor'].forEach(function (n) {
  try {
    var C = CLS(n), ct = C.getConstructors(), l = [];
    for (var i = 0; i < ct.length; i++) l.push('(' + sg(ct[i].getParameterTypes()) + ')');
    print('CTOR ' + n + ' :: ' + l.join(' | '));
    var ms = C.getMethods(), keep = {};
    for (var i = 0; i < ms.length; i++) { var nm = ms[i].getName(); if (/^(set|get|add)/.test(nm)) keep[nm + '(' + sg(ms[i].getParameterTypes()) + ')'] = 1; }
    print('  M ' + Object.keys(keep).sort().join(' '));
  } catch (e) { print('MISS ' + n + ' :: ' + e.message); }
});
print('PROBE_WIDGETS_DONE');
