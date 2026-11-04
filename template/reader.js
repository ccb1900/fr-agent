// template/reader.js — I6 薄壳：CPT 读回/写回（触 com.fr TemplateWorkBookIO；reportlets 相对名口径同 make_verify/make_report）
var TemplateReader = (function () {
  var J = function (n) { return Java.type(n); };
  function readCpt(relName) {
    if (/[\\]|\.\.|^file:|^\/|[a-zA-Z]:/.test(String(relName))) throw new Error('[template.reader] 只接受 reportlets 相对 .cpt 名: ' + relName);
    var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook(relName);
    if (!wb) throw new Error('[template.reader] 读回为空: ' + relName);
    return wb;
  }
  function exportCpt(wb, absFile) {
    var os = new (J('java.io.ByteArrayOutputStream'))();
    wb.export(os);
    J('java.nio.file.Files').write(J('java.nio.file.Paths').get(absFile), os.toByteArray());
    return absFile;
  }
  function xmlOf(absFile) { return String(new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get(absFile)), 'UTF-8')); }
  return { readCpt: readCpt, exportCpt: exportCpt, xmlOf: xmlOf };
})();
