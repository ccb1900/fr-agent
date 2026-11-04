// agent/tools/_lib.js — 工具层公共库（r10-A）：runId/runDir/原子写，供各 verb 脚本 load。
//   设计：每 verbs 调用 = 一个独立 runId 目录 logs/agent/runs/{runId}/——并发任务互不污染（r10 P1②③）。
//   原子写：先写 .tmp 再 ATOMIC_MOVE（r10 P1⑤），崩一半不产半截 JSON。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';

function readUtf(abs) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(abs)), 'UTF-8')).replace(/^\uFEFF/, ''); }
function exists(abs) { return Files.exists(Pth.get(abs)); }
function absOf(p) { return /^[A-Za-z]:[\\\/]/.test(String(p)) ? String(p) : (ROOT + '/' + String(p)); }
function tryJson(abs) { try { return JSON.parse(readUtf(abs)); } catch (e) { return null; } }

// runId：环境注入（fr_agent.ps1 生成）；无 env 时本地兜底生成（时间戳+随机）
function runIdOf() {
  var rid = System.getenv('AGENT_RUN_ID');
  if (rid) return String(rid);
  var t = new (J('java.text.SimpleDateFormat'))('yyyyMMdd_HHmmss_SSS').format(new (J('java.util.Date'))());
  return 'local_' + t + '_' + Math.floor(Math.random() * 9000 + 1000);
}
function runDirOf(rid) { return ROOT + '/logs/agent/runs/' + rid; }

// 原子写 UTF-8 文本（同目录 .tmp → ATOMIC_MOVE；跨盘不适用，tmp 与目标同目录）
function atomicWriteUtf(abs, text) {
  var p = Pth.get(abs);
  var parent = p.toAbsolutePath().getParent();
  Files.createDirectories(parent);
  var tmp = Files.createTempFile(parent, 'agent_', '.tmp');
  Files.write(tmp, J('java.lang.String').valueOf(text).getBytes('UTF-8'));
  try {
    try { Files.delete(p); } catch (eDel) { }
    Files.move(tmp, p, J('java.nio.file.StandardCopyOption').ATOMIC_MOVE);
  } catch (eMove) {
    Files.move(tmp, p, J('java.nio.file.StandardCopyOption').REPLACE_EXISTING);
  }
}

function writeJson(abs, obj) { atomicWriteUtf(abs, JSON.stringify(obj, null, 1)); }
