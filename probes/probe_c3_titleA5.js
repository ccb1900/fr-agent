// probe_c3_titleA5.js — 锚定 title 格的 CDATA 收敛实证（前版抓到文档首个 CDATA=连接名）。
var J = function (n) { return Java.type(n); };
load('D:/fineagent/runtime/paths.js');
var R = Paths.root;
load(R + '/template/inspector.js'); load(R + '/template/reader.js');
load(Paths.runtime('bootstrap.js')); Runtime.initialize();
function expTitle(v) {
  var wb = TemplateReader.readCpt('fineagent/生产日报图C_api.cpt');
  wb.getReport(0).getCellElement(0, 0).setValue(J('java.lang.String').valueOf(v));
  var os = new (J('java.io.ByteArrayOutputStream'))();
  wb.export(os);
  var xml = String(new (J('java.lang.String'))(os.toByteArray(), 'UTF-8'));
  var anchor = xml.indexOf('<C c="0" r="0"');
  var i = xml.indexOf('CDATA[', anchor);
  return xml.substring(i + 6, i + 6 + v.length + 6);
}
print('plain  : [' + expTitle('ABC') + ']');
print('brace  : [' + expTitle('ABC]') + ']');
print('dbrace : [' + expTitle('ABC]]') + ']');
print('cdata  : [' + expTitle('A]]>B') + ']');
print('paren  : [' + expTitle('生产日报（C段） [REVIEW]') + ']');
exit(0);
