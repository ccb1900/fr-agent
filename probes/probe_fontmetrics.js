// probe_fontmetrics.js — 一手实测 Java2D 字体度量：黑体(SimHei) 的 ASCII 与 CJK 前向宽度比
var GraphicsEnvironment = Java.type('java.awt.GraphicsEnvironment');
var Font = Java.type('java.awt.Font');
var BufferedImage = Java.type('java.awt.image.BufferedImage');
var g = new BufferedImage(10, 10, 1).createGraphics();
var names = ['SimHei', 'Microsoft YaHei', 'SimSun'];
var Arrays = Java.type('java.util.Arrays');
var avail = Arrays.asList(GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames());
names.forEach(function (n) {
  var present = avail.indexOf(n) >= 0;
  [9, 10.5, 12].forEach(function (pt) {
    [1, 0].forEach(function (style) {
      var f = new Font(n, style, Math.round(pt * 4));  // FRFont size 单位 = pt×4，AWT size = 点数(72dpi)
      var fm = g.getFontMetrics(f);
      print(n + ' present=' + present + ' pt=' + pt + ' style=' + style +
        ' awtSize=' + f.getSize2D() +
        ' w0=' + fm.stringWidth('0') + ' w0000=' + fm.stringWidth('0000') +
        ' w行=' + fm.stringWidth('行') + ' w行行=' + fm.stringWidth('行行') +
        ' h=' + fm.getHeight() + ' asc=' + fm.getAscent());
    });
  });
});
