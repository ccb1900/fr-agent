// _readme_moji_fix.js - README segment #28-#35 mojibake fix: byte-level splice (ASCII-only source, payload in logs/_readme_band_new.txt)
// Safety: dynamic anchor locate -> prefix/suffix MD5 proof -> splice -> write; abort on anchor mismatch (concurrent-writer guard)
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
var Paths = J('java.nio.file.Paths');
var SO = J('java.nio.file.StandardOpenOption');
var MD = J('java.security.MessageDigest').getInstance('MD5');
var Arrays = J('java.util.Arrays');
var System = J('java.lang.System');

var P = 'D:/fineagent/README.md';
var BANDP = 'D:/fineagent/logs/_readme_band_new.txt';
var BACKUP = 'D:/fineagent/logs/README.md.fix_backup_20261103';

function md5Bytes(arr) {
  MD.reset();
  var dg = MD.digest(arr);
  var sb = '';
  for (var i = 0; i < dg.length; i++) { var h = (dg[i] & 0xFF).toString(16); sb += ((h.length < 2 ? '0' : '') + h); }
  return sb.toUpperCase();
}

function findAscii(hay, needle) {
  var n = needle.length;
  outer: for (var i = 0; i <= hay.length - n; i++) {
    for (var j = 0; j < n; j++) {
      if ((hay[i + j] & 0xff) !== needle.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}

var b = Files.readAllBytes(Paths.get(P));
var off0 = findAscii(b, '28. **v3.3');
var off1 = -1;
for (var i = 0; i <= b.length - 4; i++) {
  if ((b[i] & 0xff) !== 0x23) continue;
  if ((b[i+1] & 0xff) !== 0x33 || (b[i+2] & 0xff) !== 0x36 || (b[i+3] & 0xff) !== 0x20) continue;
  if (i > 0 && (b[i-1] & 0xff) === 0x0A) { off1 = i; break; }
}
print('off0=' + off0 + ' off1=' + off1 + ' total=' + b.length);
if (off0 < 0 || off1 < 0 || off1 <= off0) { print('ABORT: anchors not found'); System.exit(9); }

var before = md5Bytes(Arrays.copyOfRange(b, 0, off0));
var after = md5Bytes(Arrays.copyOfRange(b, off1, b.length));
print('PREFIX_MD5=' + before + ' (' + off0 + ' bytes)');
print('SUFFIX_MD5=' + after + ' (' + (b.length - off1) + ' bytes)');

Files.write(Paths.get(BACKUP), b, SO.CREATE, SO.WRITE, SO.TRUNCATE_EXISTING);

var band = Files.readAllBytes(Paths.get(BANDP));
if (band.length < 100) { print('ABORT: band payload too small'); System.exit(9); }
if ((band[band.length-1] & 0xff) !== 0x0A) { print('ABORT: band payload must end with LF'); System.exit(9); }

var out = new (J('java.io.ByteArrayOutputStream'))(b.length + band.length);
out.write(Arrays.copyOfRange(b, 0, off0));
out.write(band);
out.write(Arrays.copyOfRange(b, off1, b.length));
var nb = out.toByteArray();
print('NEW_SIZE=' + nb.length + ' (was ' + b.length + ', delta=' + (nb.length - b.length) + ')');

if (md5Bytes(Arrays.copyOfRange(nb, 0, off0)) !== before) { print('ABORT: prefix md5 mismatch after splice'); System.exit(9); }
if (md5Bytes(Arrays.copyOfRange(nb, off0 + band.length, nb.length)) !== after) { print('ABORT: suffix md5 mismatch after splice'); System.exit(9); }

Files.write(Paths.get(P), nb, SO.CREATE, SO.WRITE, SO.TRUNCATE_EXISTING);
print('FIXED: README.md band replaced');
print('BACKUP_AT=' + BACKUP);
