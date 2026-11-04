// agent/tools/plan.js — fr-agent 工具层 verb: plan（r10-C：Planner 正式接入工具调用链；零引擎）
//   输入 env AGENT_INTENT（意图 JSON 文件路径：outName/reportName/dataset{kind:sql,entity,dimensions:[业务词|{term}],metrics,dateRange,filters,sort,topN,presentation}）
//   组装 Planner ctx（resolve/validateSpec/capability/caps/model 五注入），调 ReportPlanner.plan：
//   三态输出 runDir/plan.json：{status: ready|ambiguous|rejected, reportSpec, assumptions, unresolvedQuestions, validationWarnings}。
//   Agent 拿 ready 的 reportSpec 直接走 create（不再人工拼 JSON 中间产物——r10-D 前置）。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');
var runId = runIdOf();
var runDir = runDirOf(runId);
function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(ROOT + '/' + p)), 'UTF-8')); }

var intentPath = System.getenv('AGENT_INTENT');
if (!intentPath) { print('{"ok":false,"error":"AGENT_INTENT required (intent JSON file path)"}'); System.exit(2); }
var intent = null;
try { intent = JSON.parse(readUtf(absOf(intentPath))); } catch (e) { intent = null; }
if (!intent) { print('{"ok":false,"error":"intent JSON unreadable: ' + intentPath + '"}'); System.exit(2); }

// Planner 五注入（I4 接口契约 docs/agent-planner-interface.md；I5.1 教训：装载面必须前置 model/vocab）
load(ROOT + '/semantic/model/vocab.js');
load(ROOT + '/semantic/model/registry.js');
load(ROOT + '/semantic/model/resolver.js');
load(ROOT + '/semantic/planner/capability.js');
load(ROOT + '/semantic/planner/planner.js');
load(ROOT + '/lib/report_spec.js');
load(ROOT + '/lib/isodate.js');
load(ROOT + '/lib/spec_validator.js');
load(ROOT + '/lib/spec_compiler.js');

var model = JSON.parse(readUtf('models/production/model.json'));
var schemaName = 'schema_' + (model.source || 'atom_live_demo') + '.json';
var schema = JSON.parse(readUtf('data/' + schemaName));

// make_api SQL 路同款前置：preflight 统一检查（r6）——模型回溯 + 唯一性证据指纹/时效（与 make_api/preflight
//   同一套 env 默认，保证 plan 与 compile 判定一致）。ModelValidator 单独调会缺证据 → UNSUPPORTED_RELATION_KEY 误拒。
load(ROOT + '/semantic/model/validator.js');
load(ROOT + '/semantic/model/evidence.js');
load(ROOT + '/semantic/preflight.js');
var evRaw = null;
try {
  evRaw = ModelEvidence.parse(readUtf('data/i55_relation_unique_truth.json'));
} catch (eEv) { evRaw = null; }
function genv(k, d) { var v = System.getenv(k); return (v == null || v === '') ? d : String(v); }
var drvC = genv('SQL_DRIVER', 'com.microsoft.sqlserver.jdbc.SQLServerDriver');
var urlC = genv('SQL_URL', 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false');
var usrC = genv('SQL_USER', 'sa');
var evMaxAge = parseFloat(genv('I55_EVIDENCE_MAX_AGE_DAYS', '30'));
var pf = SemanticPreflight.run({
  reportSpec: intent, model: model, schema: schema, evidenceRaw: evRaw,
  connection: { driver: drvC, url: urlC, user: usrC },
  nowMs: new Date().getTime(),
  maxAgeDays: isFinite(evMaxAge) ? evMaxAge : ModelEvidence.DEFAULT_MAX_AGE_DAYS
});
if (!pf.ok) {
  writeJson(runDir + '/plan.json', { tool: 'plan', runId: runId, status: 'rejected', reason: 'PREFLIGHT_FAILED', issues: pf.diagnostics.filter(function (d) { return d.severity !== 'info'; }), intentPath: intentPath });
  print('{"ok":false,"runId":"' + runId + '","status":"rejected","result":"logs/agent/runs/' + runId + '/plan.json"}');
  System.exit(1);
}

// 术语归一（工具层胶水，r10-C）：intent 中的业务词（中文名/label/列名）先经 resolver 归一为模型 name，
//   使 I4 planner 的模型成员校验（按 name）能吃到 label 术语；ambiguous/unknown 原样透传给 planner
//   走 unresolvedQuestions/不编造语义（I4 契约不变，planner 本体零改动）。
var idx = ModelRegistry.index(model);
function normalizeTerm(raw) {
  var t = (raw && typeof raw === 'object') ? raw.term : raw;
  if (t == null) return raw;
  var r = ModelResolver.resolve(idx, String(t));
  if (r.status === 'resolved' && r.candidates && r.candidates[0] && r.candidates[0].name) {
    if (raw && typeof raw === 'object') { var o = JSON.parse(JSON.stringify(raw)); o.term = r.candidates[0].name; return o; }
    return r.candidates[0].name;
  }
  return raw;
}
if (intent.dataset && intent.dataset.kind === 'sql') {
  if (Array.isArray(intent.dataset.dimensions)) intent.dataset.dimensions = intent.dataset.dimensions.map(normalizeTerm);
  if (Array.isArray(intent.dataset.metrics)) intent.dataset.metrics = intent.dataset.metrics.map(normalizeTerm);
}
var ctx = {
  model: model,
  schema: schema,
  resolve: function (term) { return ModelResolver.resolve(idx, String(term)); },
  validateSpec: function (spec) { return SpecValidator.validate(spec); },
  capability: PlannerCapability,
  caps: ReportSpec.capabilities()
};
var res = ReportPlanner.plan(intent, ctx);
res.tool = 'plan';
res.runId = runId;
res.intentPath = intentPath;
writeJson(runDir + '/plan.json', res);
var ok = res.status === 'ready';
print('{"ok":' + ok + ',"runId":"' + runId + '","status":"' + res.status + '","result":"logs/agent/runs/' + runId + '/plan.json"}');
System.exit(ok ? 0 : 1);
