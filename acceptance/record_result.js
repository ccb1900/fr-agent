// acceptance/record_result.js — 验收结果记录器（Nashorn ES5，零引擎）
//   用法（环境变量，与仓库既有工具一致；Nashorn Shell 不透传脚本参数）：
//     ACCEPTANCE_RESULT=logs/acceptance/A01-result.json          # 必填：待校验/记录的结果 JSON
//     ACCEPTANCE_WRITE=1                                       # 可选：校验通过后写入 acceptance/results/<taskId>/<runId>.json
//     FR_AGENT_HOME=D:/fineagent                               # 可选：仓库根（缺省 D:/fineagent）
//   退出码：0=合法且非 UNSAFE；3=合法但 UNSAFE（硬失败记录，已写盘）；1=非法（JSON 不落盘）；2=用法错误
//   校验规则见 acceptance/result_schema.js（证据层级/评分/能力闭包/部署安全）。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var Files = J('java.nio.file.Files');
var Paths = J('java.nio.file.Paths');

var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
function readText(p) {
  return String(new (J('java.lang.String'))(Files.readAllBytes(Paths.get(p)), 'UTF-8')).replace(/^\uFEFF/, '');
}
function writeText(p, text) { Files.write(Paths.get(p), J('java.lang.String').valueOf(text).getBytes('UTF-8')); }
function sha256File(p) {
  var Files2 = J('java.nio.file.Files'), Paths2 = J('java.nio.file.Paths');
  var bytes = Files2.readAllBytes(Paths2.get(absOf(p)));
  var md = J('java.security.MessageDigest').getInstance('SHA-256');
  var d = md.digest(bytes);
  var HEX = '0123456789abcdef', out = '';
  for (var i = 0; i < d.length; i++) {
    var b = d[i] & 0xff;
    out += HEX.charAt((b >> 4) & 0xf) + HEX.charAt(b & 0xf);
  }
  return out;
}
function absOf(p) { return /^[A-Za-z]:[\\\/]/.test(String(p)) ? String(p) : (ROOT + '/' + String(p)); }
function fail(msg, code) { print(JSON.stringify({ ok: false, error: msg })); System.exit(code); }

var resPath = System.getenv('ACCEPTANCE_RESULT');
if (!resPath) fail('ACCEPTANCE_RESULT required (path to a result JSON)', 2);

load(ROOT + '/acceptance/result_schema.js');
load(ROOT + '/application/capability_manifest.js');

var result = null;
try { result = JSON.parse(readText(absOf(resPath))); } catch (e) { fail('result JSON unreadable: ' + resPath + ' -> ' + e, 1); }
if (!result || !result.taskId) fail('result.taskId required', 1);

var bench = null;
try { bench = JSON.parse(readText(ROOT + '/acceptance/benchmark.json')); } catch (e) { fail('benchmark.json unreadable -> ' + e, 1); }
var entry = null;
bench.tasks.forEach(function (t) { if (t.id === result.taskId) entry = t; });
if (!entry) fail('unknown taskId (not in acceptance/benchmark.json): ' + result.taskId, 1);

var task = null;
try { task = JSON.parse(readText(ROOT + '/' + entry.path)); } catch (e) { fail('task file unreadable: ' + entry.path + ' -> ' + e, 1); }
var oracle = null;
try { oracle = JSON.parse(readText(ROOT + '/acceptance/fixtures/sales/expected.json')).keys; } catch (e) { fail('expected.json unreadable -> ' + e, 1); }

var mf = CapabilityManifest.build();
var capabilities = Object.create(null);
['chart', 'condition', 'write', 'page', 'product'].forEach(function (seg) {
  mf[seg].forEach(function (c) { capabilities[c.name] = c; });
});

var write = System.getenv('ACCEPTANCE_WRITE') === '1';
function exists(p) {
  try { return Files.exists(Paths.get(absOf(p))); } catch (e) { return false; }
}
var verdict = ResultSchema.validate(result, task, {
  oracle: oracle,
  capabilities: capabilities,
  requireFiles: write,
  fileExists: write ? exists : null,
  fileSha256: function (p) { try { return sha256File(p); } catch (e) { return null; } }
});

var out = {
  ok: verdict.ok,
  taskId: result.taskId,
  level: result.level,
  total: verdict.total,
  errors: verdict.errors,
  warnings: verdict.warnings,
  written: null
};

if (write) {
  if (!verdict.ok) {
    out.written = null;
    print(JSON.stringify(out));
    System.exit(1);
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(result.runId))) fail('illegal runId before write', 1);
  var dir = ROOT + '/acceptance/results/' + result.taskId;
  Files.createDirectories(Paths.get(dir));
  var target = dir + '/' + result.runId + '.json';
  if (Files.exists(Paths.get(target))) fail('result already recorded (refusing overwrite): acceptance/results/' + result.taskId + '/' + result.runId + '.json', 1);
  writeText(target, JSON.stringify(result, null, 2) + '\n');
  out.written = 'acceptance/results/' + result.taskId + '/' + result.runId + '.json';
}

print(JSON.stringify(out));
if (!verdict.ok) System.exit(1);
if (result.level === 'UNSAFE') System.exit(3);
System.exit(0);
