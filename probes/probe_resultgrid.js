// probe_resultgrid.js — 计算结果栅格取数面考古：PageRWorkBook / Report 家族
var J = function (n) { return Java.type(n); };
function show(full, re) {
  var c;
  try { c = J('java.lang.Class').forName(full); } catch (e) { print('MISS ' + full); return; }
  print('==== ' + full + ' SUPER=' + (c.getSuperclass() ? c.getSuperclass().getName() : 'none') +
    ' IF=' + Java.from(c.getInterfaces()).map(function (x) { return x.getName(); }).join(','));
  var ms = c.getMethods();
  for (var i = 0; i < ms.length; i++) {
    if (!re.test(ms[i].getName())) continue;
    if (ms[i].getParameterTypes().length > 1) continue;
    print('  ' + ms[i].getReturnType().getSimpleName() + ' ' + ms[i].getName() + '(' +
      Java.from(ms[i].getParameterTypes()).map(function (t) { return t.getSimpleName(); }).join(',') + ')');
  }
}
show('com.fr.main.workbook.PageRWorkBook', /Page|page|Cell|cell|Count|Result|report|Report|getSheet|Print/i);
function allMethods(full) {
  var c;
  try { c = J('java.lang.Class').forName(full); } catch (e) { print('MISS ' + full); return; }
  print('---- ALL ' + full);
  var ms2 = c.getMethods();
  for (var z = 0; z < ms2.length; z++) {
    if (ms2[z].getDeclaringClass().getName().startsWith('com.fr') && ms2[z].getParameterTypes().length === 0) {
      print('  ' + ms2[z].getReturnType().getSimpleName() + ' ' + ms2[z].getName() + '()');
    }
  }
}
allMethods('com.fr.report.report.Report');
// getPageReport / getResultReport 的返回类型里找取格面
var prw2 = J('java.lang.Class').forName('com.fr.main.workbook.PageRWorkBook');
var ms3 = prw2.getMethods();
for (var y = 0; y < ms3.length; y++) {
  var nm = ms3[y].getName();
  if (nm === 'getPageReport' || nm === 'getResultReport') {
    var rt2 = ms3[y].getReturnType();
    print('RET ' + nm + ' -> ' + rt2.getName());
    allMethods(rt2.getName());
    var rt3 = rt2;
    while (rt3 && rt3.getName() !== 'java.lang.Object') { allMethods(rt3.getName()); rt3 = rt3.getSuperclass(); }
  }
}
allMethods('com.fr.page.PageAttributeGetter');
// getCellElement(int,int) 的返回类型 → 文本/值取法
var RS = J('java.lang.Class').forName('com.fr.report.report.ResultReport');
var msr = RS.getMethods();
for (var w = 0; w < msr.length; w++) {
  if (!/getCellElement|^getValue|getPreviewValue/.test(msr[w].getName())) continue;
  print('M ' + msr[w].getName() + '(' + Java.from(msr[w].getParameterTypes()).map(function (t) { return t.getSimpleName(); }).join(',') + ') -> ' + msr[w].getReturnType().getName());
}
var ct = null;
for (var v = 0; v < msr.length; v++) if (msr[v].getName() === 'getCellElement' && msr[v].getParameterTypes().length === 2) ct = msr[v].getReturnType();
if (ct) {
  print('CELL CLASS = ' + ct.getName());
  var cm = ct.getMethods();
  for (var u = 0; u < cm.length; u++) {
    if (/Text|Value|toString|String/i.test(cm[u].getName()) && cm[u].getParameterTypes().length === 0) {
      print('   ' + cm[u].getReturnType().getSimpleName() + ' ' + cm[u].getName() + '()  [decl ' + cm[u].getDeclaringClass().getSimpleName() + ']');
    }
  }
}
show('com.fr.main.WorkBook', /Page|page|Cell|cell|Count|Result|report|Report/i);

// getReport(int) 的确切返回类型 → 再挖它的取格面
var prw = J('java.lang.Class').forName('com.fr.main.workbook.PageRWorkBook');
var msAll = prw.getMethods();
for (var q = 0; q < msAll.length; q++) {
  if (msAll[q].getName() !== 'getReport') continue;
  var rt = msAll[q].getReturnType();
  print('getReport returns: ' + rt.getName());
  show(rt.getName(), /Page|Cell|Count|Result|get|Print|Row|Col/i);
}
['com.fr.report.Report', 'com.fr.main.Report', 'com.fr.report.core.Report', 'com.fr.print.Page',
 'com.fr.report.worksheet.WorkSheet'].forEach(function (n) { show(n, /getPage|CellElement|getRowCount|getColumnCount|getText|PreviewCell/i); });
