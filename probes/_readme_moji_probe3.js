// _readme_moji_probe3.js - README entry #28..#35 corrupted-entry zone per-line hex + repair channel + full repaired candidates (ASCII-only source)
// Output: logs/_moji_probe3_out.txt; do not write back to README.
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

function strictDecode(bytes) {
  try {
    var d = UTF8.newDecoder().onMalformedInput(CEA.REPORT).onUnmappableCharacter(CEA.REPORT);
    return d.decode(ByteBuffer.wrap(bytes)).toString();
  } catch (e) { return null; }
}
function lenientGBK(bytes) {
  var d = GBK.newDecoder().onMalformedInput(CEA.REPLACE).onUnmappableCharacter(CEA.REPLACE);
  return d.decode(ByteBuffer.wrap(bytes)).toString();
}
function qC(s) { return ("" + s).split('?').length - 1; }
function fC(s) { return ("" + s).split('\uFFFD').length - 1; }
function cC(s) { var n = 0; var s = '' + s; for (var i = 0; i < s.length; i++) { var c = s.charAt(i); if (c >= '\u4E00' && c <= '\u9FFF') n++; } return n; }
function hexs(bytes) { var h = ''; for (var i = 0; i < bytes.length && i < 56; i++) { var x = (bytes[i] & 0xff).toString(16); if (x.length < 2) x = '0' + x; h += x + ' '; } return h; }

var b = Files.readAllBytes(Paths.get('D:/fineagent/README.md'));
var out = [];
function w(s) { out.push('' + s); }

// line split
var recs = []; var soff = 0; var buf = new (J('java.io.ByteArrayOutputStream'))();
for (var i = 0; i <= b.length; i++) {
  var nl = (i < b.length && b[i] === 10);
  var end = (i === b.length);
  if (nl || end) {
    var by = buf.toByteArray();
    recs.push({ off: soff, bytes: by });
    buf = new (J('java.io.ByteArrayOutputStream'))();
    soff = i + 1;
  } else {
    buf.write(b[i]);
  }
  if (end) break;
}
w('totalLines=' + recs.length + ' totalBytes=' + b.length);

// Determine band: start from the line containing "28. **"; end before the line starting with "#36 "
var L0 = -1, L1 = -1;
for (var r = 0; r < recs.length; r++) {
  var s = strictDecode(recs[r].bytes);
  var raw = (s === null) ? lenientGBK(recs[r].bytes) : s;
  if (L0 < 0 && ('' + raw).indexOf('28. **') >= 0) L0 = r;
  if (L0 >= 0 && ('' + ('' + raw)).indexOf('#36 ') === 0) { L1 = r; break; }
  if (L0 >= 0 && L1 < 0 && ('' + raw).indexOf('#37 ') === 0) { L1 = r; break; }
}
w('bandLines=[' + L0 + ',' + L1 + ')');

// Per line: categories + repair
var repaired = []; // spliced bytes (for complete statistics of the final band)
for (var r = L0; r < L1; r++) {
  var by = recs[r].bytes;
  var s0 = strictDecode(by);
  var cls = '', note = '', rep = null;
  if (s0 !== null) {
    var gbk = (new Str(s0)).getBytes('GBK');
    var id = Arrays.equals(gbk, by);
    var rev = strictDecode(gbk);
    if (id) { cls = 'T1-asutf8-valid,gbk(REV)==self'; rep = s0; note = 'q=' + qC(s0) + ' f=' + fC(s0) + ' cjk=' + cC(s0); }
    else if (rev !== null && cC(rev) > cC(s0)) { cls = 'T2-utf8-can-reverse'; rep = rev; note = 'q=' + qC(rev) + ' f=' + fC(rev) + ' cjk=' + cC(rev); }
    else { cls = 'T3-asutf8-valid-no-reverse'; rep = s0; note = 'q=' + qC(s0) + ' f=' + fC(s0) + ' cjk=' + cC(s0); }
  } else {
    var g = lenientGBK(by);
    var rt = (new Str(g)).getBytes('GBK');
    if (Arrays.equals(rt, by)) {
      var once = strictDecode(rt);
      if (once !== null && cC(once) > 0) { cls = 'T4-rawgbk-double-reverse'; rep = once; note = 'q=' + qC(once) + ' f=' + fC(once) + ' cjk=' + cC(once); }
      else { cls = 'T5-rawgbk-rev-not-utf8'; rep = g; note = 'q=' + qC(g) + ' f=' + fC(g) + ' cjk=' + cC(g); }
    } else {
      var u = (new Str(by, UTF8));
      var g2u = (new Str(u)).getBytes('GBK');
      var r2 = strictDecode(g2u);
      if (r2 !== null && cC(r2) > 0) { cls = 'T6-mixed-utf8len+gbkrev'; rep = r2; note = 'q=' + qC(r2) + ' f=' + fC(r2) + ' cjk=' + cC(r2); }
      else { cls = 'T7-mixed-unrepairable'; rep = u; note = 'q=' + qC(u) + ' f=' + fC(u) + ' cjk=' + cC(u); }
    }
  }
  w('L' + r + '|off=' + recs[r].off + '|CLS=' + cls + '|' + note);
  w('HEX: ' + hexs(by));
  w('REP>>> ' + rep);
  repaired.push(rep);
}

var sb = new (J('java.lang.StringBuilder'))();
for (var i = 0; i < out.length; i++) { sb.append(out[i]); sb.append('\n'); }
var payload = (new Str(sb.toString())).getBytes('UTF-8');
Files.write(Paths.get('D:/fineagent/logs/_moji_probe3_out.txt'), payload, SO.CREATE, SO.WRITE, SO.TRUNCATE_EXISTING);
print('WROTE logs/_moji_probe3_out.txt bytes=' + payload.length + ' band=[' + L0 + ',' + L1 + ')');
