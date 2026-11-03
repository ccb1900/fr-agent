// make_pixel_diff.js — v3.3 渲染 diff 验收线工具
// 用法（shell 参数替代 HOME 选项）：DyuPixelDiff.js <old.png> <new.png> [channelThresh]
// 输出：尺寸一致性 + 差分像素占比（通道差 > 阈值记 1），<5% 丟分 = PASS
var J = function (n) { return Java.type(n); };
var args = (typeof arguments !== 'undefined' && arguments.length) ? arguments : [];
var genv = J('java.lang.System').getenv();
var aPath = args[0] || genv.get('PD_A') || 'D:/fineagent/verify_png/demo/NewbieGuide/' + '第一张报表_1.png';
var bPath = args[1] || genv.get('PD_B') || 'D:/fineagent/rebuild_first.png';
var thresh = parseInt(args[2] || genv.get('PD_T') || '32', 10); // 通道差阈值（容忍抗锯齿噪声）

var ImageIO = J('javax.imageio.ImageIO');
var Files = J('java.nio.file.Files');
var a = ImageIO.read(Files.newInputStream(J('java.nio.file.Paths').get(aPath)));
var b = ImageIO.read(Files.newInputStream(J('java.nio.file.Paths').get(bPath)));
if (a === null || b === null) { print('DECODE FAIL'); exit(1); }
var wa = a.getWidth(), ha = a.getHeight(), wb = b.getWidth(), hb = b.getHeight();
print('A=' + wa + 'x' + ha + '  B=' + wb + 'x' + hb + '  thresh=' + thresh);
var w = Math.min(wa, wb), h = Math.min(ha, hb);
var diff = 0, total = w * h;
// 热区定位：diff 掩码 + 横带统计（2245px / 20 带）
var BANDS = 24, bandH = Math.ceil(h / BANDS), bandCnt = [];
for (var bi = 0; bi < BANDS; bi++) bandCnt.push(0);
var heat = new (J('java.awt.image.BufferedImage'))(w, h, J('java.awt.image.BufferedImage').TYPE_INT_RGB);
var g = heat.getGraphics();
g.drawImage(b, 0, 0, null);
for (var y = 0; y < h; y++) {
  var bIdx = Math.floor(y / bandH);
  for (var x = 0; x < w; x++) {
    var ca = a.getRGB(x, y), cb = b.getRGB(x, y);
    if (ca === cb) continue;
    var dr = Math.abs(((ca >> 16) & 0xFF) - ((cb >> 16) & 0xFF));
    var dg = Math.abs(((ca >> 8) & 0xFF) - ((cb >> 8) & 0xFF));
    var db = Math.abs((ca & 0xFF) - (cb & 0xFF));
    if (dr > thresh || dg > thresh || db > thresh) { diff++; bandCnt[bIdx]++; }
  }
}
// 差异像素标品红
for (var y2 = 0; y2 < h; y2++) {
  for (var x2 = 0; x2 < w; x2++) {
    var ca2 = a.getRGB(x2, y2), cb2 = b.getRGB(x2, y2);
    if (ca2 === cb2) continue;
    var dr2 = Math.abs(((ca2 >> 16) & 0xFF) - ((cb2 >> 16) & 0xFF));
    var dg2 = Math.abs(((ca2 >> 8) & 0xFF) - ((cb2 >> 8) & 0xFF));
    var db2 = Math.abs((ca2 & 0xFF) - (cb2 & 0xFF));
    if (dr2 > thresh || dg2 > thresh || db2 > thresh) heat.setRGB(x2, y2, 0xFFFF00FF | 0);
  }
}
g.dispose();
var heatPath = (args[3] || 'D:/fineagent/heatmap.png');
J('javax.imageio.ImageIO').write(heat, 'png', Files.newOutputStream(J('java.nio.file.Paths').get(heatPath)));
print('HEATMAP=' + heatPath);
for (var bi2 = 0; bi2 < BANDS; bi2++) {
  if (bandCnt[bi2] > 0) {
    var pctB = bandCnt[bi2] * 100.0 / (w * bandH);
    print('BAND y=' + (bi2 * bandH) + '-' + ((bi2 + 1) * bandH) + ' diff=' + bandCnt[bi2] + ' = ' + pctB.toFixed(2) + '%');
  }
}
var pct = total ? (diff * 100.0 / total) : 100;
print('DIFF pixels=' + diff + '/' + total + ' = ' + pct.toFixed(2) + '%');
print(pct < 5 ? 'PASS (<5%)' : 'FAIL (>=5%)');
J('java.lang.System').exit(0);
