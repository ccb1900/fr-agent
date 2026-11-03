// crop_diff.js — 裁剪两 PNG 指定区域存盘（裁决字号单位：官方/我方标题区对比）
var J = function (n) { return Java.type(n); };
var args = (typeof arguments !== 'undefined' && arguments.length) ? arguments : [];
var genv = J('java.lang.System').getenv();
var aPath = args[0] || genv.get('CR_A');
var bPath = args[1] || genv.get('CR_B');
var x = parseInt(args[2] || genv.get('CR_X') || '0'), y = parseInt(args[3] || genv.get('CR_Y') || '0'), w = parseInt(args[4] || genv.get('CR_W') || '800'), hh = parseInt(args[5] || genv.get('CR_H') || '120');
var ImageIO = J('javax.imageio.ImageIO');
var a = ImageIO.read(J('java.nio.file.Files').newInputStream(J('java.nio.file.Paths').get(aPath)));
var b = ImageIO.read(J('java.nio.file.Files').newInputStream(J('java.nio.file.Paths').get(bPath)));
function save(img, out) {
  var sub = img.getSubimage(Math.min(x, img.getWidth() - 1), Math.min(y, img.getHeight() - 1), Math.min(w, img.getWidth() - x), Math.min(hh, img.getHeight() - y));
  var t = new (J('java.awt.image.BufferedImage'))(sub.getWidth(), sub.getHeight(), J('java.awt.image.BufferedImage').TYPE_INT_RGB);
  t.getGraphics().drawImage(sub, 0, 0, null);
  ImageIO.write(t, 'png', J('java.nio.file.Files').newOutputStream(J('java.nio.file.Paths').get(out)));
  print('SAVED ' + out);
}
save(a, 'D:/fineagent/_crop_a.png');
save(b, 'D:/fineagent/_crop_b.png');
J('java.lang.System').exit(0);
