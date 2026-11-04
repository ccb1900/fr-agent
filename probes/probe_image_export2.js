// probes/probe_image_export2.js — r5：bootstrap 后验证 ImageExporter 是否可用（隔离 runraw 语境）
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
load('D:/fineagent/runtime/paths.js');
load('D:/fineagent/template/reader.js');
load(Paths.runtime('bootstrap.js'));
var OUT = [];
try { Runtime.initialize(); OUT.push('bootstrap OK'); } catch (e0) { OUT.push('bootstrap FAIL ' + e0); }
try {
  var wb = TemplateReader.readCpt('fineagent/销售明细_api.cpt');
  OUT.push('readCpt OK');
  var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
  OUT.push('execute OK pages=' + rb.getReportCount());
  var ex = new (J('com.fr.io.exporter.ImageExporter'))();
  OUT.push('ImageExporter instance=' + ex.getClass().getName() + ' exportType=' + (typeof ex.export));
  var os = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_r5_export_probe.png');
  ex.export(os, rb); os.close();
  OUT.push('export OK bytes=' + Files.size(Pth.get('D:/fineagent/logs/_r5_export_probe.png')));
} catch (e) { OUT.push('EXPORT FAIL: ' + e); }
print(OUT.join('\n'));
J('java.lang.System').exit(0);
