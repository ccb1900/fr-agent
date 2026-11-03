// _readme_moji_probe4.js - README 这些区域的转换管线大普查（codepoint-hex 输出，零渲染歧义；ASCII-only source）
// 目标：对 4 个采样行逐行给出多通道转换候选 + ASCII 关键字命中计数，定出唯一正确反演通道并给出重建文本。
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

function decL(bytes, cs) {
  var d = cs.newDecoder().onMalformedInput(CEA.REPLACE).onUnmappableCharacter(CEA.REPLACE);
  return d.decode(ByteBuffer.wrap(bytes)).toString();
}
function decS(bytes, cs, name) {
  try {
    var d = cs.newDecoder().onMalformedInput(CEA.REPORT).onUnmappableCharacter(CEA.REPORT);
    return d.decode(ByteBuffer.wrap(bytes)).toString();
  } catch (e) { return null; }
}

var b = Files.readAllBytes(Paths.get('D:/fineagent/README.md'));
var out = [];
function w(s) { out.push('' + s); }

// 按行切分（带 offset）
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
w('totalLines=' + recs.length + ' totalBytes=' + b.length);

// GBK 全 lossless 检查（行级）：GBK(lenient) 再 encode 是否恒等
function gbkRoundTrip(by) {
  var g = decL(by, GBK);
  return Arrays.equals((new Str(g)).getBytes('GBK'), by);
}

// 关键字命中计数（PNG/工具链锚点——任何正确反演都应保留这些 ASCII）
var KEYS = ['make_verify.js', 'TemplateWorkBookIO.readTemplateWorkBook', 'ImageExporter', 'execute', 'PNG MD5', '21 demo', 'verify_table.txt', 'BW', '60785', 'uuid', 'wait', 'atom_live_demo', 'db_laser_aaa_truth.txt', 'ATOM_LIVE', 'whmeiko', 'grep', 'ppArray', 'linkTo params', '=\\u0024\\u0024\\u0024', '\\u0024 {}'];
function keyHits(s) {
  var n = 0; var hits = [];
  for (var k = 0; k < KEYS.length; k++) {
    if (s.indexOf(KEYS[k]) >= 0) { n++; hits.push(KEYS[k]); }
  }
  return n + '[' + hits.slice(0, 6).join(',') + ']';
}

// codepoint-hex 转义（\uXXXX 形式，避开渲染歧义）
function esc(s, maxlen) {
  var r = ''; var s = '' + s; var n = Math.min(s.length, maxlen || 48);
  for (var i = 0; i < n; i++) {
    var c = s.charCodeAt(i).toString(16);
    while (c.length < 4) c = '0' + c;
    r += 'u' + c;
  }
  return r;
}

// 采样行选择：头部样本 L4/L5；band 26/34/61/68/80/98/139/155；尾部 L-complete
var SAMPLES = [4, 5, 116, 118, 126, 134, 155, 156, 248, 250, 251];
for (var t = 0; t < SAMPLES.length; t++) {
  var r = SAMPLES[t]; if (r >= recs.length) continue;
  var by = recs[r].bytes;
  w('--LINE ' + r + ' (off=' + by.length + ' bytes) gbkRT=' + gbkRoundTrip(by));
  w('BYTESHEX: ' + (function () { var h = ''; for (var i = 0; i < by.length && i < 40; i++) { var x = (by[i] & 0xff).toString(16); if (x.length < 2) x = '0' + x; h += x; } return h; })());

  // 通道 1：按 UTF-8 lenient 直接看
  var c1 = decL(by, UTF8);
  w('CH1 utf8len: KEYS=' + keyHits(c1) + ' ESC=' + esc(c1, 26));
  // 通道 2：按 GBK lenient 直接看（文件是 GBK 字节时直接还原）
  var c2 = decL(by, GBK);
  w('CH2 gbklen: KEYS=' + keyHits(c2) + ' ESC=' + esc(c2, 26));
  // 通道 3：GBKlen 解码 -> 再 GBK 编码 -> UTF-8 lenient（double-GBK 通道）
  var g2b = (new Str(c2)).getBytes('GBK');
  var c3 = null;
  var c3s = decS(g2b, UTF8, 'strict'); if (c3s === null) c3s = decL(g2b, UTF8);
  c3 = c3s;
  w('CH3 doublerev: KEYS=' + keyHits(c3) + ' ESC=' + esc(c3, 26));
  // 通道 4：UTF-8 lenient 解码 -> GBK 编码 -> UTF-8 lenient（probe1 曾用的通道）
  var u1 = decL(by, UTF8);
  var u2 = (new Str(u1)).getBytes('GBK');
  var c4 = decS(u2, UTF8, 'strict') || decL(u2, UTF8);
  w('CH4 utf8rev: KEYS=' + keyHits(c4) + ' ESC=' + esc(c4, 26));
}

var sb = new (J('java.lang.StringBuilder'))();
for (var i = 0; i < out.length; i++) { sb.append(out[i]); sb.append('\n'); }
var payload = (new Str(sb.toString())).getBytes('UTF-8');
Files.write(Paths.get('D:/fineagent/logs/_moji_probe4_out.txt'), payload, SO.CREATE, SO.WRITE, SO.TRUNCATE_EXISTING);
print('WROTE logs/_moji_probe4_out.txt bytes=' + payload.length);
