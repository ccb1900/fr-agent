// probe_c3_titleA2.js — 'A' 来源深挖：原值 charCodes + 纯 round-trip（无 setValue）+ setValue 空串。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
load('D:/fineagent/runtime/paths.js');
var R = Paths.root;
load(R + '/template/inspector.js'); load(R + '/template/reader.js');
load(Paths.runtime('bootstrap.js')); Runtime.initialize();
var OUT = R + '/logs/_c3_probe';
function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(p)), 'UTF-8')); }
function titleOf(f) { var m = readUtf(f).match(/生产日报图表页[^<]*/); return m ? m[0] : '(none)'; }
// 1) 原值逐字符码点
var wb1 = TemplateReader.readCpt('fineagent/生产日报图C_api.cpt');
var v1 = String(wb1.getReport(0).getCellElement(0, 0).getValue());
var codes = [];
for (var i = v1.length - 6; i < v1.length; i++) codes.push(v1.charCodeAt(i));
print('1 orig tail codes: ' + codes.join(',') + ' orig=[' + v1 + '] len=' + v1.length);
// 2) 纯 round-trip（不 setValue）
TemplateReader.exportCpt(wb1, OUT + '/C_roundtrip.cpt');
print('2 roundtrip title: [' + titleOf(OUT + '/C_roundtrip.cpt') + ']');
// 3) setValue 空
var wb3 = TemplateReader.readCpt('fineagent/生产日报图C_api.cpt');
wb3.getReport(0).getCellElement(0, 0).setValue(J('java.lang.String').valueOf('XYZ'));
TemplateReader.exportCpt(wb3, OUT + '/D_setxyz.cpt');
print('3 setXYZ title: [' + titleOf(OUT + '/D_setxyz.cpt') + ']');
exit(0);
