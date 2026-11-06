// probe_ti.js — TemplateInfoAttrMark 构造/方法面（C1：与 Id/Theme 同族）
var Class = Java.type('java.lang.Class');
try {
  var c = Class.forName('com.fr.base.iofile.attr.TemplateInfoAttrMark');
  print('super=' + String(c.getSuperclass()).replace('class ', ''));
  var cs = c.getConstructors();
  for (var i = 0; i < cs.length; i++) print('CTOR ' + String(cs[i]).replace('public ', ''));
  var ms = c.getMethods();
  for (var j = 0; j < ms.length; j++) { var s = String(ms[j]).replace('public ', ''); if (/set[A-Z]|get[A-Z]/.test(s) && !/getClass/.test(s)) print('  ' + s); }
} catch (e) { print('FAIL ' + e); }
print('DONE');
