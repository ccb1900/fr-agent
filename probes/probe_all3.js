var J = function (n) { return Java.type(n); };
var CLS = function (n) { return Java.type('java.lang.Class').forName(n); };
function sg(ps) { var a = []; for (var k = 0; k < ps.length; k++) a.push(ps[k].getSimpleName()); return a.join(','); }

try {
  var C = CLS('com.fr.general.ImageWithSuffix');
  var ct = C.getConstructors(), l = [];
  for (var i = 0; i < ct.length; i++) l.push('(' + sg(ct[i].getParameterTypes()) + ')');
  print('ImageWithSuffix CTOR ' + l.join(' | '));
  var ms = C.getMethods(), keep = {};
  for (var i = 0; i < ms.length; i++) { var nm = ms[i].getName(); if (/^(set|get|add|create|insert|put)/.test(nm)) keep[nm + '(' + sg(ms[i].getParameterTypes()) + ')->' + ms[i].getReturnType().getSimpleName()] = 1; }
  print('  M ' + Object.keys(keep).sort().join(' '));
} catch (e) { print('MISS ImageWithSuffix :: ' + e.message); }

try {
  var TM = CLS('com.fr.report.web.ToolBarManager');
  var rt = null;
  var ms2 = TM.getMethods();
  for (var i = 0; i < ms2.length; i++) if (ms2[i].getName() === 'getToolBar') rt = ms2[i].getReturnType();
  print('ToolBarManager.getToolBar -> ' + rt + ' name=' + (rt ? rt.getName() : '?'));
  if (rt) {
    var l2 = [], ct2 = rt.getConstructors();
    for (var i = 0; i < ct2.length; i++) l2.push('(' + sg(ct2[i].getParameterTypes()) + ')');
    print('  ToolBar CTOR ' + l2.join(' | '));
    var m3 = rt.getMethods(), k3 = {};
    for (var i = 0; i < m3.length; i++) { var nm = m3[i].getName(); if (/^(set|get|add|insert|remove)/.test(nm)) k3[nm + '(' + sg(m3[i].getParameterTypes()) + ')'] = 1; }
    print('  ToolBar M ' + Object.keys(k3).sort().join(' '));
  }
} catch (e) { print('MISS ToolBarManager :: ' + e.message); }

try {
  var RA = CLS('com.fr.web.attr.ReportWebAttr');
  var ms4 = RA.getMethods(), k4 = {};
  for (var i = 0; i < ms4.length; i++) { var nm = ms4[i].getName(); if (/ToolBar|WebPage/.test(nm)) k4[nm + '(' + sg(ms4[i].getParameterTypes()) + ')'] = 1; }
  print('ReportWebAttr M ' + Object.keys(k4).sort().join(' '));
} catch (e) { print('MISS ReportWebAttr :: ' + e.message); }
print('PROBE_A3_DONE');
