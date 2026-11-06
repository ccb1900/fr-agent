// probe_c3_titleA4.js — FR 导出层 CDATA 收敛实证：值以 ']' 结尾是否被写层注入 'A'。
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
  var i = xml.indexOf('CDATA[');
  return xml.substring(i + 6, i + 6 + v.length + 4);
}
print('plain  : [' + expTitle('ABC') + ']');
print('brace  : [' + expTitle('ABC]') + ']');
print('dbrace : [' + expTitle('ABC]]') + ']');
print('cdata  : [' + expTitle('A]]>B') + ']');
exit(0);
