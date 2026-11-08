// probe_border_hosts.js — 2026-11-08：柱缘描边宿主穷举（只读反射，Class.forName 不初始化）
//   扫描核心 jar 中全部 com/fr/**chart** 类，输出任何"参数类型含 AttrBorder*"的方法。
//   目的：回答 seriesBorder 到底是"挂错宿主"还是"引擎无宿主"——不做单类猜测。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ZipFile = J('java.util.zip.ZipFile'), File = J('java.io.File');
var CL = J('java.lang.Thread').currentThread().getContextClassLoader();
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FR = J('java.lang.System').getenv('FR_HOME') || 'D:/software/FineReport_11.0';
var dirs = [FR + '/lib', FR + '/server/lib', FR + '/webapps/webroot/WEB-INF/lib'];
var names = {};
dirs.forEach(function (d) {
  var dir = new File(d);
  var fs = dir.listFiles();
  if (!fs) return;
  for (var i = 0; i < fs.length; i++) {
    var f = fs[i];
    if (!/\.jar$/i.test(String(f.getName()))) continue;
    var z = null;
    try { z = new ZipFile(f); } catch (e) { continue; }
    var en = z.entries();
    while (en.hasMoreElements()) {
      var e = en.nextElement(), n = String(e.getName());
      if (n.slice(-6) !== '.class') continue;
      if (n.indexOf('com/fr/') !== 0) continue;
      if (n.indexOf('chart') < 0) continue;               // 只看图表域
      if (n.indexOf('$') >= 0) continue;
      names[n.slice(0, -6).replace(/\//g, '.')] = 1;
    }
    z.close();
  }
});
var keys = Object.keys(names).sort();
print('SCAN classes=' + keys.length);
var hits = 0, errs = 0;
keys.forEach(function (cn) {
  var C = null;
  try { C = J('java.lang.Class').forName(cn, false, CL); } catch (e) { errs++; return; }
  if (!C) return;
  var ms = null;
  try { ms = C.getMethods(); } catch (e2) { errs++; return; }
  for (var i = 0; i < ms.length; i++) {
    var m = ms[i], ps = m.getParameterTypes();
    for (var k = 0; k < ps.length; k++) {
      var pn = String(ps[k].getName());
      if (pn.indexOf('AttrBorder') >= 0) {
        print('HOST ' + cn + ' :: ' + String(m.getName()) + '(' + pn + ')');
        hits++;
      }
    }
  }
});
print('DONE hits=' + hits + ' reflectErrors=' + errs);
