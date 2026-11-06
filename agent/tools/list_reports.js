// agent/tools/list_reports.js — fr-agent 工具层 verb: list_reports（零引擎；阶段2 B段新增）
//   存量报表清单：枚举部署目录（FR reportlets/fineagent）下 .cpt——名称/字节/mtime/伴随 PNG/PDF。
//   用途：外置 Agent 在 modify 前先看存量（sourceCpt 候选 = 相对名 'fineagent/<name>.cpt'）。
//   输出 runDir/list_reports.json + 合同行 {ok,runId,result}。只读，不碰引擎。
//   错误面（B段 nextActions 纪律）：目录不存在 → nextActions 指向 create 先产报表。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');
var runId = runIdOf();
var runDir = runDirOf(runId);

var deployDir = System.getenv('AGENT_DEPLOYDIR');
if (!deployDir) {
  writeJson(runDir + '/list_reports.json', { tool: 'list_reports', runId: runId, ok: false, error: 'AGENT_DEPLOYDIR not set (fr_agent.ps1 must pass config DeployDir)', nextActions: ['rerun via fr_agent.ps1 -Verb list_reports'] });
  print('{"ok":false,"runId":"' + runId + '","result":"logs/agent/runs/' + runId + '/list_reports.json"}');
  System.exit(2);
}
var dir = Pth.get(deployDir);
if (!Files.isDirectory(dir)) {
  writeJson(runDir + '/list_reports.json', { tool: 'list_reports', runId: runId, ok: false, error: 'deploy dir not found: ' + deployDir, nextActions: ['run -Verb create to build a report first (empty deploy dir)'] });
  print('{"ok":false,"runId":"' + runId + '","result":"logs/agent/runs/' + runId + '/list_reports.json"}');
  System.exit(1);
}
var names = Files.newDirectoryStream(dir);
var reports = [];
names.forEach(function (p) {
  var f = Pth.get(deployDir).resolve(p).toString();
  var nm = String(p.getFileName());
  if (!/\.cpt$/i.test(nm)) return;
  var stem = nm.replace(/\.cpt$/i, '');
  var mtime = Files.getLastModifiedTime(Pth.get(f));
  var sibling = function (ext) { var q = Pth.get(deployDir + '/' + stem + ext); return Files.exists(q) ? +Files.size(q) : null; };
  reports.push({
    file: nm,
    sourceCpt: 'fineagent/' + nm,
    bytes: +Files.size(Pth.get(f)),
    mtimeIso: String(mtime),
    pngBytes: sibling('.png'),
    pdfBytes: sibling('.pdf')
  });
});
try { names.close(); } catch (eC) { }
reports.sort(function (a, b) { return a.file < b.file ? -1 : 1; });
var out = {
  tool: 'list_reports', runId: runId, ok: true, deployDir: String(deployDir), count: reports.length, reports: reports,
  nextActions: ['pick a report and run -Verb inspect_template -Target fineagent/<file>.cpt before crafting a patch (modify needs real cell coordinates)', 'run -Verb sample_data to inspect source data (read-only LIMIT sampling)']
};
writeJson(runDir + '/list_reports.json', out);
print('{"ok":true,"runId":"' + runId + '","count":' + reports.length + ',"result":"logs/agent/runs/' + runId + '/list_reports.json"}');
System.exit(0);
