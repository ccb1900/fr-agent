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
// r11-1 修复：readUtf 统一用 _lib 版（不拼 ROOT；absOf 负责相对→绝对）。
//  原本地版无条件拼 ROOT+'/'，与 absOf 组合产生双重拼接——绝对/相对路径都读不到（r11 P1）。

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

// make_api SQL 路同款前置：preflight 统一检查（r6）——模型回溯 + 唯一性证据指纹/时效。
//   r11-5 分流：仅 sql 数据集意图需要数据库关系证据；内嵌 rows 意图不依赖库，跳过 preflight（否则被关系证据误阻断）。
function genv(k, d) { var v = System.getenv(k); return (v == null || v === '') ? d : String(v); }
var isSqlIntent = !!(intent.dataset && intent.dataset.kind === 'sql');
if (isSqlIntent) {
load(ROOT + '/semantic/model/validator.js');
load(ROOT + '/semantic/model/evidence.js');
load(ROOT + '/semantic/preflight.js');
var evRaw = null;
try {
  evRaw = ModelEvidence.parse(readUtf('data/i55_relation_unique_truth.json'));
} catch (eEv) { evRaw = null; }
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
}

// 术语归一（工具层胶水，r10-C；r14 修正：走 semantic/planner/termnorm.js 纯函数，按候选 target 类型归一，
//   不再取不存在的 candidates[0].name——旧实现恒 undefined 使归一静默失效。ambiguous/unknown/property/column 原样透传）
var idx = ModelRegistry.index(model);
load(ROOT + '/semantic/planner/termnorm.js');
function resolveTerm(t) { return ModelResolver.resolve(idx, String(t)); }
if (intent.dataset && intent.dataset.kind === 'sql') {
  if (Array.isArray(intent.dataset.dimensions)) intent.dataset.dimensions = TermNorm.normalizeList(intent.dataset.dimensions, resolveTerm);
  if (Array.isArray(intent.dataset.metrics)) intent.dataset.metrics = TermNorm.normalizeList(intent.dataset.metrics, resolveTerm);
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
