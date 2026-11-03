// probe_webpage.js — WebPage 分页 API 面反射词汇（不启 FR 引擎，可 java + nashorn 直跑）
// 反编译弦外：官方语料 grep 'WebPage' 找序列化形态；反射拿 setter 面。
var J = function (n) { return Java.type(n); };

function dumpMethods(clsName, filter) {
  try {
    var c = J('java.lang.Class').forName(clsName);
    print('=== ' + clsName + ' ==>');
    var ms = c.getMethods();
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      var name = m.getName();
      if (!filter || filter.test(name)) { print('  ' + String(m)); }
    }
    var ctors = c.getConstructors();
    for (var i = 0; i < ctors.length; i++) { print('  ctor ' + String(ctors[i])); }
  } catch (e) { print('=== ' + clsName + ' UNAVAILABLE: ' + e); }
}

dumpMethods('com.fr.web.attr.ReportWebAttr', /Web|Page|set|add/);
dumpMethods('com.fr.report.web.WebPage', null);
dumpMethods('com.fr.report.report.WorkSheet', /Web|Attr/);
