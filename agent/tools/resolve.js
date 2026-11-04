// agent/tools/resolve.js — fr-agent 工具层 verb: resolve（零引擎）
//   输入 env AGENT_TERM（业务词），输出 logs/agent/resolve.json：resolved/ambiguous/unknown + 候选与置信度。
//   规则沿用 I3：不自动选、未知不臆造。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(ROOT + '/' + p)), 'UTF-8')); }
load(ROOT + '/semantic/model/vocab.js');
load(ROOT + '/semantic/model/registry.js');
load(ROOT + '/semantic/model/resolver.js');
var term = System.getenv('AGENT_TERM');
if (!term) { print('{"ok":false,"error":"AGENT_TERM required"}'); System.exit(2); }
var model = JSON.parse(readUtf('models/production/model.json'));
var idx = ModelRegistry.index(model);
var r = ModelResolver.resolve(idx, String(term));
var out = { tool: 'resolve', term: String(term), status: r.status, requiresConfirmation: !!r.requiresConfirmation, candidates: r.candidates || [] };
var dir = ROOT + '/logs/agent';
Files.createDirectories(Pth.get(dir));
Files.write(Pth.get(dir + '/resolve.json'), J('java.lang.String').valueOf(JSON.stringify(out, null, 1)).getBytes('UTF-8'));
print('{"ok":true,"result":"logs/agent/resolve.json"}');
System.exit(0);
