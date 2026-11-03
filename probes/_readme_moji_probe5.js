// _readme_moji_probe5.js - 阻走路 ASCII 存证：band 区每行按序输出 ASCII token 流 + 行字节数（重建条的骨架）
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
var Paths = J('java.nio.file.Paths');
var SO = J('java.nio.file.StandardOpenOption');
var Str = J('java.lang.String');
var Arrays = J('java.util.Arrays');
var Charset = J('java.nio.charset.Charset');
var StandardCharsets = J('java.nio.charset.StandardCharsets');
var CEA = J('java.nio.charset.CodingErrorAction');
var ByteBuffer = J('java.nio.ByteBuffer');
var GBK = Charset.forName('GBK');
var UTF8 = StandardCharsets.UTF_8;

function lenientGBK(by) {
  var d = GBK.newDecoder().onMalformedInput(CEA.REPLACE).onUnmappableCharacter(CEA.REPLACE);
  return d.decode(ByteBuffer.wrap(by)).toString();
}

var b = Files.readAllBytes(Paths.get('D:/fineagent/README.md'));
var recs = []; var soff = 0; var buf = new (J('java.io.ByteArrayOutputStream'))();
for (var i = 0; i <= b.length; i++) {
  var nl = (i < b.length && b[i] === 10);
  var end = (i === b.length);
  if (nl || end) {
    recs.push({ off: soff, bytes: buf.toByteArray() });
    buf = new (J('java.io.ByteArrayOutputStream'))();
    soff = i + 1;
  } else { buf.write(b[i]); }
  if (end) break;
}
var out = [];
function w(s) { out.push('' + s); }

// 定位 band：含 "28. **" 的行 -> 以 "#36 " 开头的行前
var L0 = -1, L1 = -1;
for (var r = 0; r < recs.length; r++) {
  var s = (new Str(recs[r].bytes, UTF8)).toString();
  if (L0 < 0 && s.indexOf('28. **') >= 0) L0 = r;
  if (L0 >= 0 && s.indexOf('#36 ') === 0) { L1 = r; break; }
}
w('band=[' + L0 + ',' + L1 + ') off0=' + recs[L0].off + ' off1=' + recs[L1].off);

for (var r = L0; r < L1; r++) {
  var chars = recs[r].bytes;
  var asc = '';
  var tokens = [];
  var cur = '';
  for (var i = 0; i < chars.length; i++) {
    var c = chars[i] & 0xff;
    var isAscii = (c >= 33 && c < 127);
    if (isAscii) {
      if (cur === '') cur = '' + '';
      cur += String.fromCharCode(c);
    } else {
      if (cur !== '') { tokens.push(cur); cur = ''; }
    }
  }
  if (cur !== '') tokens.push(cur);
  w('L' + r + ' off=' + recs[r].off + ' bytes=' + chars.length + ' TOKENS> ' + tokens.join(' | '));
}

var sb = new (J('java.lang.StringBuilder'))();
for (var i = 0; i < out.length; i++) { sb.append(out[i]); sb.append('\n'); }
var payload = (new Str(sb.toString())).getBytes('UTF-8');
Files.write(Paths.get('D:/fineagent/logs/_moji_probe5_out.txt'), payload, SO.CREATE, SO.WRITE, SO.TRUNCATE_EXISTING);
print('WROTE logs/_moji_probe5_out.txt band=[' + L0 + ',' + L1 + ')');
