// probe_fontmetrics2.js — 这台机器的 JRE 到底能不能用"黑体/SimHei"，各家字体在 FRSize 下的前向宽度
var J = function (n) { return Java.type(n); };
var ge = J('java.awt.GraphicsEnvironment').getLocalGraphicsEnvironment();
var names = ge.getAvailableFontFamilyNames();
var list = [];
for (var i = 0; i < names.length; i++) list.push(String(names[i]));
print('FAMILIES(' + list.length + '): ' + list.join(' | '));
var g = new (J('java.awt.image.BufferedImage'))(10, 10, 1).createGraphics();
['SimHei', '黑体', 'Microsoft YaHei', '微软雅黑', 'SimSun', '宋体', 'Dialog', 'SansSerif', 'Monospaced']
  .forEach(function (n) {
    var f = new (J('java.awt.Font'))(n, 0, 36);
    var fm = g.getFontMetrics(f);
    print('FONT ' + n + ' real=' + f.getFontName() + ' family=' + f.getFamily() +
      ' w0=' + fm.stringWidth('0') + ' w0000=' + fm.stringWidth('0000') +
      ' w行=' + fm.stringWidth('行') + ' wABCD=' + fm.stringWidth('ABCD') +
      ' h=' + fm.getHeight() + ' can显示行=' + f.canDisplay('行'));
  });
