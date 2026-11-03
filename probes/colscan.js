// colscan.js — 扫某行上所有竖边框 x 坐标（边框色直配 -13725210），+ 网格列宽落点
var J = function (n) { return Java.type(n); };
var genv = J('java.lang.System').getenv();
var Files = J('java.nio.file.Files');
var a = J('javax.imageio.ImageIO').read(Files.newInputStream(J('java.nio.file.Paths').get(genv.get('CR_A'))));
var y = parseInt(genv.get('CR_Y') || '400', 10);
var TARGET = -13725210; // 边框统一色（渲染 AA 有 ±插值，给容差直配）
var tol = parseInt(genv.get('CR_TOL') || '10', 10);
var tr = (TARGET >> 16) & 0xFF, tg = (TARGET >> 8) & 0xFF, tb = TARGET & 0xFF;
var hits = [];
var prev = false;
for (var x = 0; x < a.getWidth(); x++) {
  var c = a.getRGB(x, y);
  var r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
  var near = Math.abs(r - tr) <= tol && Math.abs(g - tg) <= tol && Math.abs(b - tb) <= tol;
  if (near && !prev) hits.push(x);
  prev = near;
}
print('ROW y=' + y + ' borderX=' + hits.join(','));
J('java.lang.System').exit(0);
