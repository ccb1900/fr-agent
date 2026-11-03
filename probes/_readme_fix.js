// _readme_fix.js — README.md 截回原始 38553 字节（清除上次乱码尾巴）+ 以纯字节搬运追加 logs/_readme_app.txt 的 UTF-8 内容
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
var Paths = J('java.nio.file.Paths');
var P = 'D:/fineagent/README.md';
var PREFIX = 38553; // 本次事故前的原始字节长度（探针上次打印 size=38553）

var all = Files.readAllBytes(Paths.get(P));
print('当前大小=' + all.length);
if (all.length < PREFIX) { print('ABORT: 比 PREFIX 短，存疑不写'); } else {
  var head = J('java.util.Arrays').copyOfRange(all, 0, PREFIX);
  var tail = Files.readAllBytes(Paths.get('D:/fineagent/logs/_readme_app.txt'));
  var out = new (J('java.io.ByteArrayOutputStream'))();
  out.write(head); out.write(new (J('java.lang.String'))('\n').getBytes('UTF-8')); out.write(tail);
  Files.write(Paths.get(P), out.toByteArray(),
    J('java.nio.file.StandardOpenOption').CREATE, J('java.nio.file.StandardOpenOption').WRITE, J('java.nio.file.StandardOpenOption').TRUNCATE_EXISTING);
  print('RESTORED head=' + head.length + ' appended=' + tail.length + ' 新大小=' + out.size());
}
