// agent/tools/plan2spec.js — r10-D 胶水（工具链内化）：把 plan ready 的 reportSpec 落盘为 create 可用的 -Spec 文件。
//   输入 env AGENT_RUN_ID；输出 runDir/reportSpec.json。Agent 不再手写 JSON 中间产物。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');
var runId = System.getenv('AGENT_RUN_ID');
if (!runId) { print('{"ok":false,"error":"AGENT_RUN_ID required"}'); System.exit(2); }
var runDir = runDirOf(runId);
var plan = tryJson(runDir + '/plan.json');
if (!plan || plan.status !== 'ready' || !plan.reportSpec) { writeJson(runDir + '/reportSpec.json', { ok: false, error: 'plan not ready' }); print('{"ok":false,"error":"plan not ready"}'); System.exit(1); }
writeJson(runDir + '/reportSpec.json', plan.reportSpec);
print('{"ok":true,"runId":"' + runId + '","specPath":"logs/agent/runs/' + runId + '/reportSpec.json"}');
System.exit(0);
