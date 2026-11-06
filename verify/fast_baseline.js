// verify/fast_baseline.js — A段(阶段2) 快速层三铁证 MD5 门（零引擎；AGENTS §6 铁证口径收进 fast 层）
//   铁证三件（README.md:315 / AGENTS §6）：
//     demo_api.cpt              = CBEB42E3CE48E46E362B9AE80168026F（仓库根，改 lib/object|ir|cpt 必逐字节复核）
//     demo_template_final.cpt   = 6161F402B340321B4ABF68B68E301828（v2 模板基线）
//     销售明细_api.png          = A8EF39AB648D5F00DDAE0481D0313110（部署目录渲染产物——文件存在才比对；
//                                  缺文件输出 SKIP 行（不计 PASS，不假绿），存在但 MD5 不符=FAIL exit 1）
//   跑法：java -cp "<FR>/jre/lib/ext/nashorn.jar" jdk.nashorn.tools.Shell verify/fast_baseline.js
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var MD = J('java.security.MessageDigest');
var FAILS = 0;

function md5Of(path) {
  var bytes = Files.readAllBytes(P.get(path));
  var d = MD.getInstance('MD5').digest(bytes);
  var sb = new (J('java.lang.StringBuilder'))();
  for (var i = 0; i < d.length; i++) sb.append(J('java.lang.String').format('%02x', [new (J('java.lang.Byte'))(d[i])]));
  return String(sb).toUpperCase();
}
function expect(name, path, want) {
  try {
    if (!Files.exists(P.get(path))) { print('BASELINE SKIP (file absent, not counted as PASS): ' + name + ' @ ' + path); return; }
    var got = md5Of(path);
    if (got === want) print('BASELINE PASS: ' + name + ' = ' + got);
    else { FAILS++; print('BASELINE FAIL: ' + name + ' got=' + got + ' want=' + want); }
  } catch (e) { FAILS++; print('BASELINE FAIL (unreadable): ' + name + ' @ ' + path + ' -> ' + e); }
}

expect('demo_api.cpt', ROOT + '/demo_api.cpt', 'CBEB42E3CE48E46E362B9AE80168026F');
expect('demo_template_final.cpt(v2)', ROOT + '/demo_template_final.cpt', '6161F402B340321B4ABF68B68E301828');
var deployDir = J('java.lang.System').getenv('BR_DEPLOYDIR') ||
  (ROOT + '/../software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent').replace('/', J('java.io.File').separator);
expect('销售明细_api.png(部署产物)', deployDir + J('java.io.File').separator + '销售明细_api.png', 'A8EF39AB648D5F00DDAE0481D0313110');

print('BASELINE END, fails=' + FAILS);
exit(FAILS ? 1 : 0);
