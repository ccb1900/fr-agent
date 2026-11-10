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
if (!intentPath) { print('{"ok":false,"error":"AGENT_INTENT required (intent JSON file path)","nextActions":["write the intent JSON (outName/dimensions/metrics or dataset.kind=sql) to a file and pass -Intent <path>","run -Verb discover to see model dimensions/metrics and ReportSpec capabilities"]}'); System.exit(2); }
var intent = null;
try { intent = JSON.parse(readUtf(absOf(intentPath))); } catch (e) { intent = null; }
if (!intent) { print('{"ok":false,"error":"intent JSON unreadable: ' + intentPath + '","nextActions":["check the file exists and is valid JSON (UTF-8)","pass the path relative to FR_AGENT_HOME or absolute"]}'); System.exit(2); }

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

// B-复审B-2（2026-11-07）：与 make_api.js 同源——SCHEMA_MODEL env 覆盖时 plan/create 必须用同一模型文件
//   （此前 plan.js 硬编码缺省路径，env 覆盖场景下 plan ready 的指标集 create 期可能被另一模型拒）。
//   genv 为顶层函数声明（ES5 提升），先于本行定义位置亦可调用。
var model = JSON.parse(readUtf(genv('SCHEMA_MODEL', 'models/production/model.json')));
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
// W9（走查 P2-9）：能力级提示前置——intent 涉及运行期交互（params/分页/筛选类字段）时，在 plan 阶段直接给账本级提示，
//   不等 spec 校验回头解释（与铁律"语义未决必须问"配套：能力缺口也是"未决"）。
function capabilityLevelQuestions(intent) {
  var out = [];
  var isDetail = !!(intent.presentation && intent.presentation.type === 'detail');
  if (isDetail) out.push('明细表（presentation.type=detail）=行级直读：metrics 必须为空、所有列放 dimensions 作展示列、showTotal 需明确 false（编译器在 detail 下也不输出合计）');
  var hasParams = !!(intent.params != null && (Array.isArray(intent.params) ? intent.params.length : 1)) ||
    !!(intent.presentation && Array.isArray(intent.presentation.params) && intent.presentation.params.length) ||
    (isDetail === false && String(JSON.stringify(intent)).indexOf('"page"') >= 0);
  if (hasParams) out.push('运行期参数控件（params.panel）当前 capabilityManifest=unavailable(webInteraction)：可给编译期固定值（如 dateRange/params 默认值），Web 改参重查询不在承诺内——需要请用户先选此折中或放弃该形态');
  var wantsFilter = !!(intent.dataset && Array.isArray(intent.dataset.filters) && intent.dataset.filters.length);
  if (wantsFilter) out.push('dataset.filters=编译期固定筛选（sql 路）；运行期筛选控件不可用（webInteraction）——同样需要向用户言明边界');
  if (String(JSON.stringify(intent)).indexOf('topN') >= 0 && !((intent.dataset || {}).sort || []).length) out.push('dataset.topN 需要 dataset.sort 提供确定序（否则编译拒）');
  return out;
}
if (intent.dataset && intent.dataset.kind === 'sql') {
  var isDetailIntent = !!(intent.presentation && intent.presentation.type === 'detail');
  if (isDetailIntent) {
    // W3：detail=明细表——metrics 必空（fail-closed）；dims 走 property/column 归一（W4：候选可与 Intent 语法同形）
    if (Array.isArray(intent.metrics) && intent.metrics.length) {
      writeJson(runDir + '/plan.json', { tool: 'plan', runId: runId, status: 'rejected', reason: 'DETAIL_WITH_METRICS', issues: [{ code: 'INVALID_SHAPE', message: '明细表不需要 metrics——把业务列全部放 dimensions 作展示列（行级直读无聚合）' }], unresolvedQuestions: capabilityLevelQuestions(intent), intentPath: intentPath });
      print('{"ok":false,"runId":"' + runId + '","status":"rejected","result":"logs/agent/runs/' + runId + '/plan.json"}');
      System.exit(1);
    }
    // W4（走查 P1-4）：实体上下文过滤——Intent 已声明 entity，属性候选优先命中该实体
    //   （否则 fileKey 之类会同时命中多实体的同名属性，照抄候选必然再歧义）。
    var entNameS = intent.dataset && intent.dataset.entity;
    var resolveTermS = function (t) {
      var r = resolveTerm(t);
      if (r && Array.isArray(r.candidates) && entNameS) {
        var scoped = r.candidates.filter(function (c) { return c && c.ref && String(c.ref).indexOf(String(entNameS) + '.') === 0; });
        if (scoped.length === 1) return { term: r.term, status: 'resolved', candidates: scoped, requiresConfirmation: false };
        if (scoped.length > 1) return { term: r.term, status: 'ambiguous', candidates: scoped, requiresConfirmation: true };
      }
      return r;
    };
    var dres = TermNorm.normalizeDetailColumns(intent.dataset.dimensions, resolveTermS);
    if (!dres.ok || !dres.dims.length) {
      writeJson(runDir + '/plan.json', { tool: 'plan', runId: runId, status: 'rejected', reason: 'AMBIGUOUS_DETAIL_COLUMNS', issues: dres.ambiguous.concat(dres.unknown.map(function (u) { return { code: 'UNKNOWN_REF', term: u }; })),
        unresolvedQuestions: capabilityLevelQuestions(intent).concat(dres.ambiguous.length ? ['明细列存在歧义候选（见 issues）: ' + dres.ambiguous.map(function (a) { return a.term; }).join(', ')] : [], dres.unknown.length ? ['明细列在模型中未找到（不编造）: ' + dres.unknown.join(', ')] : []), intentPath: intentPath });
      print('{"ok":false,"runId":"' + runId + '","status":"rejected","result":"logs/agent/runs/' + runId + '/plan.json"}');
      System.exit(1);
    }
    intent.dataset.dimensions = dres.dims;   // [{term,label?...}] —— refOverrides 吃 label，展示文案可定制
    if (!Array.isArray(intent.dataset.metrics)) intent.dataset.metrics = [];
    if (intent.presentation.showTotal == null) { intent.presentation.showTotal = false; }   // 明细无聚合：缺省置 false（assumption 留痕，见下方 ready 装配）
    intent._detailAssumption = 'detail 明细表无聚合：presentation.showTotal 已缺省置 false；dims=展示列（实体 property/列可直上报表）';
  } else {
    if (Array.isArray(intent.dataset.dimensions)) intent.dataset.dimensions = TermNorm.normalizeList(intent.dataset.dimensions, resolveTerm);
    if (Array.isArray(intent.dataset.metrics)) intent.dataset.metrics = TermNorm.normalizeList(intent.dataset.metrics, resolveTerm);
  }
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
// W8（走查 P2-8）：intentHash=意图文件字节的 MD5——同 Intent 重试可对拍；同 RunId 复跑零集成（零引擎 verb 幂等，产物覆盖）
try {
  var mdI = J('java.security.MessageDigest').getInstance('MD5');
  var digI = mdI.digest(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get(absOf(intentPath))));
  var hexI = '';
  for (var di2 = 0; di2 < digI.length; di2++) { var bb2 = digI[di2] & 255; hexI += (bb2 < 16 ? '0' : '') + J('java.lang.Integer').toHexString(bb2); }
  res.intentHash = hexI.toUpperCase();
} catch (eH) { }
// W9：能力级问题（detail/参数/分页/筛选）连同 planner 未决问题一起透出
var capQ = capabilityLevelQuestions(intent);
if (capQ.length) res.unresolvedQuestions = (res.unresolvedQuestions || []).concat(capQ);
if (intent._detailAssumption) {
  res.assumptions = (res.assumptions || []).concat([intent._detailAssumption]);
  delete intent._detailAssumption;
}
writeJson(runDir + '/plan.json', res);
var ok = res.status === 'ready';
print('{"ok":' + ok + ',"runId":"' + runId + '","status":"' + res.status + '","result":"logs/agent/runs/' + runId + '/plan.json"}');
System.exit(ok ? 0 : 1);
