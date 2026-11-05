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
// r11-4：runId 严格化——环境注入优先；本地兜底用 GUID（UUID.randomUUID，严格唯一非秒级+随机）；
//   显式 runId 必须过字符集白名单 ^[A-Za-z0-9_-]{1,64}$（防路径穿越/注入），违规即抛
function runIdOf() {
  var rid = System.getenv('AGENT_RUN_ID');
  if (rid) return checkRunId(String(rid));
  return String(J('java.util.UUID').randomUUID());
}
function checkRunId(rid) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(rid))) throw new Error('[AGENT] illegal runId (charset ^[A-Za-z0-9_-]{1,64}$): ' + rid);
  return String(rid);
}
function runDirOf(rid) { return ROOT + '/logs/agent/runs/' + checkRunId(rid); }

// 原子写 UTF-8 文本（r11-3 修复：不预删目标——先 ATOMIC_MOVE+REPLACE_EXISTING 原子覆盖，
//   失败才降级 REPLACE_EXISTING 普通替换；移动失败时清理 tmp、原目标保留。tmp 与目标同目录保证同盘可原子移动）
function atomicWriteUtf(abs, text) {
  var p = Pth.get(abs);
  var parent = p.toAbsolutePath().getParent();
  Files.createDirectories(parent);
  var tmp = Files.createTempFile(parent, 'agent_', '.tmp');
  Files.write(tmp, J('java.lang.String').valueOf(text).getBytes('UTF-8'));
  try {
    Files.move(tmp, p, J('java.nio.file.StandardCopyOption').ATOMIC_MOVE, J('java.nio.file.StandardCopyOption').REPLACE_EXISTING);
  } catch (eAtomic) {
    try {
      Files.move(tmp, p, J('java.nio.file.StandardCopyOption').REPLACE_EXISTING);
    } catch (eFall) {
      try { Files.delete(tmp); } catch (eTmp) { }
      throw eFall;
    }
  }
}

function writeJson(abs, obj) { atomicWriteUtf(abs, JSON.stringify(obj, null, 1)); }
