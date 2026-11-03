// bbox_probe.js — 区域内深色文字像素 bbox（标题字号/位置裁决）
var J = function (n) { return Java.type(n); };
var genv = J('java.lang.System').getenv();
var Files = J('java.nio.file.Files');
var a = J('javax.imageio.ImageIO').read(Files.newInputStream(J('java.nio.file.Paths').get(genv.get('CR_A'))));
var TT = J('java.lang.System').getenv('CR_T'); // 亮度阈值（0-255，低于=文字像素）
var T = parseInt(TT || '150', 10);
var x0 = parseInt(genv.get('CR_X') || '0'), y0 = parseInt(genv.get('CR_Y') || '0');
var ww = parseInt(genv.get('CR_W') || String(a.getWidth())), hh = parseInt(genv.get('CR_H') || String(a.getHeight()));
var minX = ww, maxX = -1, minY = hh, maxY = -1, cnt = 0;
for (var y = y0; y < Math.min(y0 + hh, a.getHeight()); y++) {
  for (var x = x0; x < Math.min(x0 + ww, a.getWidth()); x++) {
    var c = a.getRGB(x, y);
    var r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
    if (r < T && g < T && b < T) { // 深色文字（排除浅色边框/底）
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      cnt++;
    }
  }
}
print('BBOX x=' + minX + '..' + maxX + ' (w=' + (maxX - minX + 1) + ') y=' + minY + '..' + maxY + ' (h=' + (maxY - minY + 1) + ') px=' + cnt);
J('java.lang.System').exit(0);
