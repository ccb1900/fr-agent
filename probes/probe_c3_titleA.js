// probe_c3_titleA.js — C段断点隔离：title 补丁后 export 里的 'A' 尾巴来自哪一步？
//   A) readCpt→setValue→export（不执行）；B) 同上但先 w.execute() 两次（对齐 patch_main 次序）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
load('D:/fineagent/runtime/paths.js');
var R = Paths.root;
load(R + '/template/inspector.js'); load(R + '/template/reader.js');
load(Paths.runtime('bootstrap.js')); Runtime.initialize();
var OUT = R + '/logs/_c3_probe';
Files.createDirectories(Pth.get(OUT));
function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(p)), 'UTF-8')); }
function dump(tag, wb) {
  var f = OUT + '/' + tag + '.cpt';
  TemplateReader.exportCpt(wb, f);
  var xml = readUtf(f);
  var m = xml.match(/生产日报图表页[^<]*/);
  print(tag + ': title=' + (m ? m[0] : '(not found)'));
}
var target = 'fineagent/生产日报图C_api.cpt';
// A: no execution
var wbA = TemplateReader.readCpt(target);
var ce0 = wbA.getReport(0).getCellElement(0, 0);
print('A oldText=' + ce0.getValue());
ce0.setValue(J('java.lang.String').valueOf('生产日报图表页（C段 形状三：真库+图表） [REVIEW]'));
dump('A_noexec', wbA);
// B: execute twice before export (patch_main order)
var wbB = TemplateReader.readCpt(target);
var ceB = wbB.getReport(0).getCellElement(0, 0);
print('B oldText=' + ceB.getValue());
ceB.setValue(J('java.lang.String').valueOf('生产日报图表页（C段 形状三：真库+图表） [REVIEW]'));
var rb1 = wbB.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
print('B exec1 ok rows=' + rb1.getResultReport(0).getRowCount());
var rb2 = wbB.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
print('B exec2 ok');
dump('B_exec2', wbB);
exit(0);
