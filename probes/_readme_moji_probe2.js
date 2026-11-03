// _readme_moji_probe2.js - README corrupted-entry zone line-by-line classification + repair channel determination (ASCII-only source)
// Output: logs/_moji_probe2_out.txt (UTF-8 explicit). Only reads and classifies, do not write back to README.
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

function strictDecode(bytes, cs) {
  try {
    var d = cs.newDecoder().onMalformedInput(CEA.REPORT).onUnmappableCharacter(CEA.REPORT);
    return d.decode(ByteBuffer.wrap(bytes)).toString();
  } catch (e) { return null; }
}
function lenientDecode(bytes, cs) {
  var d = cs.newDecoder().onMalformedInput(CEA.REPLACE).onUnmappableCharacter(CEA.REPLACE);
  return d.decode(ByteBuffer.wrap(bytes)).toString();
}
function qCount(s) { return s.split('?').length - 1; }
function fffdCount(s) { return s.split('\uFFFD').length - 1; }
function cjkCount(s) { var n = 0; for (var i = 0; i < s.length(); i++) { var c = s.charAt(i); if (c >= '\u4E00' && c <= '\u9FFF') n++; } return n; }
function hexs(bytes, from, len) { var h = ''; var e = Math.min(from + len, bytes.length); for (var i = from; i < e; i++) { var x = (bytes[i] & 0xff).toString(16); if (x.length < 2) x = '0' + x; h += x; } return h; }

var b = Files.readAllBytes(Paths.get('D:/fineagent/README.md'));
var textAll = new Str(b, UTF8);
var out = [];
function w(s) { out.push('' + s); }

// Positioning (ASCII anchor)
var bandStart = textAll.indexOf('28. **');   // corrupted zone start (28/sans #)
var anchor31 = textAll.indexOf('#31 ');
var anchor35 = textAll.lastIndexOf('#35 '); // true entry #35 (the last #35 in the whole file)
var anchor36 = textAll.lastIndexOf('#36 ');
w('bandStart=' + bandStart + ' anchor31=' + anchor31 + ' anchor35=' + anchor35 + ' anchor36=' + anchor36);
w('CTX@anchor35[-40,60]: ' + textAll.substring(Math.max(0, anchor35 - 40), anchor35 + 60).replace(/\r/g, ' ').replace(/\n/g, ' | '));
w('CTX@anchor31[-40,60]: ' + textAll.substring(Math.max(0, anchor31 - 40), anchor31 + 60).replace(/\r/g, ' ').replace(/\n/g, ' | '));

// line split: byte scan
var lines = []; var cur = new (J('java.io.ByteArrayOutputStream'))(); var off = 0; var lineNo = 0; var lineOff = [];
for (var i = 0; i <= b.length; i++) {
  var isEnd = i === b.length;
  var isNewline = !isEnd && b[i] === 10;
  if (isNewline || isEnd) {
    lines.push({ no: lineNo, off: off, bytes: cur.toByteArray(), hadNl: isNewline });
    lineOff.push(off);
    cur = new (J('java.io.ByteArrayOutputStream'))();
    off = i + 1; lineNo++;
  } else {
    cur.write(b[i]);
  }
}

// Find the line number where bandStart's char offset belongs to (rough conversion: stop when scanning to that line)
var startCharAcc = 0; var bandLine0 = -1;
for (var li = 0; li < lines.length; li++) {
  var s = strictDecode(lines[li].bytes, UTF8) || lenientDecode(lines[li].bytes, UTF8);
  if (s.indexOf('28. **') >= 0) { bandLine0 = li; break; }
}
var bandLineEnd = -1;
for (var li = bandLine0 + 1; li < lines.length; li++) {
  var s = strictDecode(lines[li].bytes, UTF8);
  if (s !== null && s.indexOf('#35 ') === 0 && cjkCount(s.substring(0, 20)) > 2 && fffdCount(s) === 0) { bandLineEnd = li; break; }
}
w('bandLine0=' + bandLine0 + ' bandLineEnd=' + bandLineEnd);

// Per-line classification and repair
for (var li = bandLine0; li < bandLineEnd; li++) {
  var L = lines[li];
  var bytes = L.bytes;
  var s0 = strictDecode(bytes, UTF8);
  var cls = '', repaired = null, note = '';

  if (s0 !== null) {
    var gbk = (new Str(s0)).getBytes('GBK');
    var rev = strictDecode(gbk, UTF8);
    if (rev !== null && cjkCount(rev) > cjkCount(s0) && s0.length() > 0) {
      var sameBytes = Arrays.equals(gbk, bytes);
      cls = sameBytes ? 'R0-identity(isOriginalBytesNCouldBeRevOffNonZero)' : 'R2-utf8-single-corrupt';
      if (!sameBytes) {
        var gbk2 = (new Str(rev)).getBytes('GBK');
        var pass2 = (new Str(gbk2, UTF8));
        repaired = rev;
        note = 'q_rev=' + qCount(rev) + ' fffd_rev=' + fffdCount(rev) + ' cjk_rev=' + cjkCount(rev);
      } else { note = 'revGBKeqBytes=true: possibly already intact or raw-GBK'; repaired = s0; }
    } else {
      cls = 'A-utf8-valid-no-reverse-work';
      if (fffdCount(s0) > 0) cls = 'A2-utf8-with-baked-FFFD';
      if (qCount(s0) > 0) cls = 'A2-utf8-with-baked-Q';
      repaired = s0;
      note = 'fffd=' + fffdCount(s0) + ' q=' + qCount(s0) + ' cjk=' + cjkCount(s0);
    }
  } else {
    var sG = lenientDecode(bytes, GBK);
    var rt = (new Str(sG)).getBytes('GBK');
    var lossless = Arrays.equals(rt, bytes);
    if (lossless) {
      cls = 'R3-raw-GBK-non-utf8';
      var g1 = (new Str(sG)).getBytes('GBK');
      var once = strictDecode(g1, UTF8);
      if (once !== null && cjkCount(once) > 0) { repaired = once; note = 'double-rev q=' + qCount(once) + ' fffd=' + fffdCount(once) + ' cjk=' + cjkCount(once); }
      else { repaired = sG; note = 'gbk-decoded-only(=moji string) q=' + qCount(sG) + ' cjk=' + cjkCount(sG); }
    } else {
      cls = 'X-mixed-lossy';
      var cand = null; var cands = [];
      // utf8 lenient decode then reverse
      var sU = lenientDecode(bytes, UTF8);
      var g2 = (new Str(sU)).getBytes('GBK');
      var r2 = strictDecode(g2, UTF8);
      if (r2 !== null && cjkCount(r2) > 0) cands.push('utf8lenient+gbkrev q=' + qCount(r2) + ' fffd=' + fffdCount(r2) + ' cjk=' + cjkCount(r2));
      // gbk lenient decode then reverse
      var r3 = strictDecode((new Str(sG)).getBytes('GBK'), UTF8);
      if (r3 !== null && cjkCount(r3) > 0) cands.push('gbklenient+gbkrev q=' + qCount(r3) + ' fffd=' + fffdCount(r3) + ' cjk=' + cjkCount(r3));
      repaired = (r3 !== null && cjkCount(r3) > 0) ? r3 : sU;
      note = 'cands=[' + cands.join(' ;') + '] fffd0=' + fffdCount(sU) + ' fffdG=' + fffdCount(sG);
    }
  }
  w('L' + lineOff[li] + '|CLS=' + cls + '|' + note + '|PRE>>' + (('' + repaired).substring(0, 70).replace(/\n/g, ' ', '')));
}

w('=== FULL REPAIRED BAND DUMP ===');
for (var li = bandLine0; li < bandLineEnd; li++) {
  var L = lines[li];
  var bytes = L.bytes;
  var rep = null;
  var s0 = strictDecode(bytes, UTF8);
  if (s0 !== null) {
    var gbk = (new Str(s0)).getBytes('GBK');
    var rev = strictDecode(gbk, UTF8);
    if (rev !== null && cjkCount(rev) > cjkCount(s0) && !Arrays.equals(gbk, bytes)) rep = rev; else rep = s0;
  } else {
    var sG = lenientDecode(bytes, GBK);
    var once = strictDecode((new Str(sG)).getBytes('GBK'), UTF8);
    rep = (once !== null && cjkCount(once) > 0) ? once : sG;
    if (once !== null && cjkCount(once) + qCount(once) + fffdCount(once) < (qCount(sG) + fffdCount(sG))) rep = once;
  }
  var lineStr = new Str(bytes, ISO88591_placeholder) ;
  w('--- L' + lineOff[li] + ' ---');
  w('' + rep);
}

var ISO = null;
var sb = new (J('java.lang.StringBuilder'))();
for (var i = 0; i < out.length; i++) { sb.append(out[i]); sb.append('\n'); }
var payload = (new Str(sb.toString())).getBytes('UTF-8');
Files.write(Paths.get('D:/fineagent/logs/_moji_probe2_out.txt'), payload, SO.CREATE, SO.WRITE, SO.TRUNCATE_EXISTING);
print('WROTE logs/_moji_probe2_out.txt bytes=' + payload.length);
