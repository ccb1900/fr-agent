// probe_rpa.js — 零环境审计 ReportParameterAttr 全方法面（找 useParamsTemplate 的 API 口）
var cls = java.lang.Class.forName('com.fr.main.parameter.ReportParameterAttr');
var ms = cls.getMethods();
print('--- ReportParameterAttr 全部方法 ---');
for (var i = 0; i < ms.length; i++) { var n = String(ms[i]); if (!/^wait|notify|equals|toString|hashCode|getClass|clone/.test(n)) print(n); }
print('--- 父类/接口里带 Param 的方法 ---');
var sc = cls.getSuperclass();
print('super=' + String(sc));
for (var i = 0; i < sc.getMethods().length; i++) { var n = String(sc.getMethods()[i]); if (/param/i.test(n)) print(n); }
print('DONE');
