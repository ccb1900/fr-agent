// agent/tools/resolve.js — fr-agent 工具层 verb: resolve（零引擎）；r10-A runId 化
//   输入 env AGENT_TERM（业务词），输出 runDir/resolve.json：resolved/ambiguous/unknown + 候选与置信度。
//   规则沿用 I3：不自动选、未知不臆造。
// 阶段2 B段（2026-11-07）退出码与 plan 对齐（同一裁决规则，外置 Agent 可依赖）：
//   exit 0 = 工具产出了"可向前走"的答案：resolved（直接用）/ ambiguous（有候选可反问用户）；
//   exit 1 = 解析失败（unknown：模型里没有该业务术语）——与 plan 非 ready（ambiguous/rejected）exit 1 同规。
//   合同行 ok 字段同步：ok=true 仅当 status∈{resolved,ambiguous}。
// 错误面（B段 nextActions 纪律）：任何失败 JSON 都带 nextActions（下一步可执行动作）+ 可用名单指向。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');
var runId = runIdOf();
var runDir = runDirOf(runId);
function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(ROOT + '/' + p)), 'UTF-8')); }
load(ROOT + '/semantic/model/vocab.js');
load(ROOT + '/semantic/model/registry.js');
load(ROOT + '/semantic/model/resolver.js');
var term = System.getenv('AGENT_TERM');
if (!term) {
  print('{"ok":false,"error":"AGENT_TERM required (usage: fr_agent.ps1 -Verb resolve -Term <biz-term>)","nextActions":["rerun with -Term","run -Verb discover to list model dimensions/metrics first"]}');
  System.exit(2);
}
var model = JSON.parse(readUtf('models/production/model.json'));
var idx = ModelRegistry.index(model);
var r = ModelResolver.resolve(idx, String(term));
var out = { tool: 'resolve', runId: runId, term: String(term), status: r.status, requiresConfirmation: !!r.requiresConfirmation, candidates: r.candidates || [] };
var usable = (r.status === 'resolved' || r.status === 'ambiguous');
if (!usable) out.nextActions = ['run -Verb discover for the full dimension/metric name list (resolve unknown = term not in model, I3 gap)', 'use a synonym of a listed term, or ask the user for the exact field name'];
writeJson(runDir + '/resolve.json', out);
print('{"ok":' + usable + ',"runId":"' + runId + '","status":"' + r.status + '","result":"logs/agent/runs/' + runId + '/resolve.json"}');
System.exit(usable ? 0 : 1);
