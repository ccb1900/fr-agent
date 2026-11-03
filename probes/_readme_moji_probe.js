// _readme_moji_probe.js - README #28-#34 mojibake characterization and reversibility test (ASCII-only source, avoid Nashorn source-code literal encoding issues)
// Output: logs/_moji_probe_out.txt (UTF-8 explicit)
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
var Paths = J('java.nio.file.Paths');
var SO = J('java.nio.file.StandardOpenOption');
var Str = J('java.lang.String');
var Arrays = J('java.util.Arrays');

var b = Files.readAllBytes(Paths.get('D:/fineagent/README.md'));
var text = new Str(b, 'UTF-8');
var out = [];
function w(s) { out.push('' + s); }

var i28 = text.indexOf('#28.');
var i29 = text.indexOf('#29.');
var i30 = text.indexOf('#30.');
var i31 = text.indexOf('#31 ');
var i32 = text.indexOf('#32 ');
var i35 = text.indexOf('#35 ');
var i36 = text.indexOf('#36 ');
var i46 = text.indexOf('#46 ');
w('i28=' + i28 + ' i29=' + i29 + ' i30=' + i30 + ' i31=' + i31 + ' i32=' + i32 + ' i35=' + i35 + ' i36=' + i36 + ' i46=' + i46 + ' totalLen=' + text.length());

// hex dump of raw bytes around #28 anchor (first 120 bytes)
function hexdump(from, len) {
  var sub = text.substring(from, from + len);
  var bb = new Str(sub).getBytes('UTF-8');
  var h = '';
  for (var i = 0; i < bb.length; i++) {
    var x = (bb[i] & 0xff).toString(16);
    if (x.length < 2) x = '0' + x;
    h += x + ' ';
  }
  return h;
}
w('HEX@#28: ' + hexdump(i28, 100));
w('HEX@#35: ' + hexdump(i35, 100));

// reversibility test: region.getBytes('GBK') then decode as UTF-8
function reverseDemo(a, bnd) {
  var region = text.substring(a, bnd);
  var q0 = (region.split('?').length - 1);
  var gbk = new Str(region).getBytes('GBK');
  var rev = new Str(gbk, 'UTF-8');
  var q1 = (rev.split('?').length - 1);
  w('--- region [' + a + ',' + bnd + ') len=' + region.length() + ' q_before=' + q0 + ' q_after=' + q1);
  w(rev);
}
w('=== REVERSE #28 region ===');
reverseDemo(i28, i29);
w('=== REVERSE #29 region ===');
reverseDemo(i29, i30);
w('=== REVERSE #30..#31 region (head 250 chars) ===');
reverseDemo(i30, i30 + 250);
w('=== REVERSE #31..#32 region (head 250 chars) ===');
reverseDemo(i31, i31 + 250);
w('=== REVERSE #32..#35 region (head 250 chars) ===');
reverseDemo(i32, i32 + 250);
w('=== CONTROL: intact #35 title (head 120 chars) ===');
reverseDemo(i35, i35 + 120);
w('=== full reverse of #28..#35 whole-region (for loss audit) ===');
reverseDemo(i28, i35);

var payload = (out.join('\n')).getBytes('UTF-8');
Files.write(Paths.get('D:/fineagent/logs/_moji_probe_out.txt'), payload,
  SO.CREATE, SO.WRITE, SO.TRUNCATE_EXISTING);
print('WROTE logs/_moji_probe_out.txt bytes=' + payload.length);
