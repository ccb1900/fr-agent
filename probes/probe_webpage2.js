// probe_webpage2.js — WorkSheet 的 WebAttr 挂载面 + ReportWebAttr 构造词表
var J = function (n) { return Java.type(n); };

function dump(clsName, pat) {
  try {
    var c = J('java.lang.Class').forName(clsName);
    print('=== ' + clsName + ' ==>');
    var ms = c.getMethods();
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]);
      if (!pat || pat.test(s)) print('  ' + s);
    }
  } catch (e) { print('=== ' + clsName + ' UNAVAILABLE: ' + e); }
}

dump('com.fr.report.worksheet.WorkSheet', /Web|Attr|Report/);
dump('com.fr.main.impl.WorkBook', /Web|Attr|Report/);
dump('com.fr.report.web.WebPage', /ctor|<init>|class/);
try {
  var C = J('com.fr.report.web.WebPage');
  var ctors = C.getConstructors();
  for (var i = 0; i < ctors.length; i++) print('WebPage ctor: ' + String(ctors[i]));
} catch (e) { print('WebPage ctors unavailable: ' + e); }
