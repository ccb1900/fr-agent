// agent/tools/semantic.js — S2 Semantic 模型只读管理（Nashorn；零引擎、不进 FR 实例锁）
//   Action: list | inspect。list 扫 models/*/*/model.json 输出域清单；inspect 输出单域语义结构。
//   不修改 model.json、不做语义生命周期（S3+ 才考虑）、不引第二套校验器。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');

var runId = runIdOf();
var action = System.getenv('AGENT_SEMANTIC_ACTION') || '';
var modelsRoot = System.getenv('AGENT_SEMANTIC_MODELS_ROOT') || (ROOT + '/models');
var resultDir = System.getenv('AGENT_SEMANTIC_RUNS') ? (System.getenv('AGENT_SEMANTIC_RUNS') + '/' + runId) : runDirOf(runId);
var outFile = resultDir + '/semantic.json';
Files.createDirectories(Pth.get(resultDir));

function genv(k) { var v = System.getenv(k); return (v == null || String(v) === '') ? null : String(v); }
function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }   // 形状助手（publish 的 review 检查用；disk 上此前漏定义 → ReferenceError）
function isStr(v) { return typeof v === 'string'; }
function finish(rc, obj) {
  writeJson(outFile, obj);
  print('{"ok":' + (rc === 0) + ',"runId":"' + runId + '","action":"' + action + '","result":"logs/agent/runs/' + runId + '/semantic.json"}');
  System.exit(rc);
}
function bail(code, message, next, extra) {
  var o = { tool: 'semantic', action: action, runId: runId, ok: false, error: { code: code, message: message }, nextActions: next || [], zeroEngine: true };
  if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
  finish(code === 'SEMANTIC_USAGE' ? 2 : 1, o);
}

// 扫 models/ 下所有含 model.json 的子目录
function scanModels() {
  var domains = [], diagnostics = [];
  var p = Pth.get(modelsRoot);
  if (!Files.exists(p) || !Files.isDirectory(p)) return { domains: domains, diagnostics: diagnostics };
  var ds; try { ds = Files.newDirectoryStream(p); } catch (e) { return { domains: domains, diagnostics: [{ code: 'SCAN_FAILED', path: modelsRoot, message: String(e) }] }; }
  try { var it = ds.iterator(); while (it.hasNext()) {
    var d = it.next();
    if (!Files.isDirectory(d)) continue;
    var dn = String(d.getFileName());
    if (dn.charAt(0) === '.') continue;
    var modelPath = modelsRoot + '/' + dn + '/model.json';   // P2-1：与扫描根一致（此前硬编码 ROOT/models）
    if (!Files.exists(Pth.get(modelPath))) continue;
    var model = null;
    try { model = JSON.parse(readUtf(modelPath)); } catch (eJ) { diagnostics.push({ code: 'UNREADABLE_MODEL', path: modelPath, message: String(eJ) }); continue; }
    if (!model || typeof model !== 'object') { diagnostics.push({ code: 'UNREADABLE_MODEL', path: modelPath, message: 'not a JSON object' }); continue; }
    domains.push({
      domain: dn, modelVersion: model.modelVersion || null, label: model.domain || dn,
      source: model.source || null,
      entityCount: (model.entities || []).length,
      metricCount: (model.metrics || []).length,
      dimensionCount: (model.dimensions || []).length,
      relationshipCount: (model.relationships || []).length,
      relPath: 'models/' + dn + '/model.json',
      abs: modelPath
    });
  } } finally { try { ds.close(); } catch (eC) { } }
  domains.sort(function (a, b) { return a.domain < b.domain ? -1 : 1; });
  return { domains: domains, diagnostics: diagnostics };
}

var scanned = scanModels();

if (action === 'list') {
  finish(0, { tool: 'semantic', action: 'list', runId: runId, ok: true, zeroEngine: true,
    modelsRoot: modelsRoot, models: scanned.domains, diagnostics: scanned.diagnostics,
    count: scanned.domains.length });
}

if (action === 'inspect') {
  var domain = genv('AGENT_SEMANTIC_DOMAIN');
  if (!domain) bail('SEMANTIC_USAGE', 'AGENT_SEMANTIC_DOMAIN required for inspect',
    ['fr_agent.ps1 -Verb semantic -Action inspect -Target <domain>', 'run semantic -Action list for available domains']);
  var hit = null;
  scanned.domains.forEach(function (m) { if (m.domain === domain) hit = m; });
  if (!hit) bail('MODEL_NOT_FOUND', 'domain not found: ' + domain,
    ['run semantic -Action list for available domains'], { requestedDomain: domain });
  var model = JSON.parse(readUtf(hit.abs));
  // S3：datasetRef 交叉验证——模型引用的 Dataset 必须存在且已发布且模型版本一致（读时检查，不改模型）
  var datasetRefCheck = null;
  if (model.datasetRef) {
    var dsRefParts = model.datasetRef.split('.');
    if (dsRefParts.length !== 2) datasetRefCheck = { ok: false, reason: 'BAD_DATASET_REF@' + model.datasetRef + ' (expected <domain>.<name>)' };
    else {
      var dsRefPath = modelsRoot + '/' + dsRefParts[0] + '/datasets/' + dsRefParts[1] + '.json';   // P2-1：与扫描根一致
      if (!Files.exists(Pth.get(dsRefPath))) datasetRefCheck = { ok: false, reason: 'DATASET_NOT_FOUND@' + model.datasetRef };
      else {
        var dsDoc = null;
        try { dsDoc = JSON.parse(readUtf(dsRefPath)); } catch (eDs) { }
        if (!dsDoc || dsDoc.status !== 'published') datasetRefCheck = { ok: false, reason: 'DATASET_NOT_PUBLISHED@' + model.datasetRef + ' (status=' + (dsDoc ? dsDoc.status : 'unreadable') + ')' };
        else {
          var mvMatch = !!dsDoc.model && dsDoc.model.modelVersion === model.modelVersion;
          datasetRefCheck = { ok: mvMatch, datasetId: dsDoc.id, datasetVersion: dsDoc.datasetVersion, modelVersionMatch: mvMatch };
          if (!mvMatch) datasetRefCheck.reason = 'MODEL_VERSION_MISMATCH@' + model.datasetRef + ' (dataset expects ' + (dsDoc.model ? dsDoc.model.modelVersion : '?') + ', model is ' + model.modelVersion + ')';
        }
      }
    }
  }
  // S3 修复（审查轮 P1-2）：datasetRefCheck 不通过时不能被 ok:true 吞掉——以 warnings 显式透出
  var warnings = (datasetRefCheck && !datasetRefCheck.ok) ? [datasetRefCheck.reason] : [];
  finish(0, { tool: 'semantic', action: 'inspect', runId: runId, ok: true, zeroEngine: true,
    domain: domain, modelVersion: model.modelVersion, source: model.source,
    warnings: warnings,
    entities: (model.entities || []).map(function (e) { return { name: e.name, label: e.label, table: e.table, key: e.key || [], properties: (e.properties || []).map(function (p) { return { name: p.name, column: p.column, type: p.type }; }) }; }),
    dimensions: (model.dimensions || []).map(function (d) { return { name: d.name, label: d.label, table: d.table, column: d.column, rule: d.rule || null }; }),
    metrics: (model.metrics || []).map(function (m) { return { name: m.name, label: m.label, kind: (m.expression || {}).kind, format: m.format || null, expression: m.expression }; }),
    relationships: (model.relationships || []).map(function (r) { return { name: r.name, label: r.label, from: r.from, to: r.to, source: r.source, cardinality: r.cardinality || null, joinSafe: !!(r.source === 'confirmed'), requiresConfirmation: !!r.requiresConfirmation }; }),
    rules: model.rules || null,
    datasetRef: model.datasetRef || null,   // S3：可选的 Dataset 交叉引用
    datasetRefCheck: datasetRefCheck        // S3：引用验证结果（null=模型无 datasetRef）
  });
}

// ---------- S 轨 Semantic 资产化：create（登记草稿域）/ validate（ModelValidator）/ publish（版本快照） ----------
//   边界（2026-11-10 修正）：confirmed 关系的唯一性证据核对在【本层】即全强度执行——连接身份取与
//   plan.js 同源的 SQL_DRIVER/SQL_URL env（规范默认=生产连接），指纹只哈希 driver+url 规范串、零 JDBC；
//   env 覆盖到别的库 → 指纹不匹配 → 拒（数据侧证据不跨库消费）。关系指纹/时效/完整性同规。
//   编译期 preflight（make_api，真实连接）仍是最终闸——本层通过不豁免编译期复核。
//   create：AGENT_SEMANTIC_DOC=<model.json 草稿路径> → 落 models/<domain>/model.json（目标必须不存在）
//   validate：ModelValidator 离线校验（模型↔schema 回溯）→ 诊断透出，不改文件
//   publish：写 versions/<modelVersion>.json 快照 + 状态登记（model.json 不动，状态在 semantic.json）
load(ROOT + '/semantic/model/vocab.js');       // ModelVocab 先载（validator 引用）
load(ROOT + '/semantic/model/validator.js');
load(ROOT + '/semantic/model/evidence.js');    // r6：唯一性证据（confirmed 关系需绑定，与 plan.js 同规）
var _semEvRaw = null;
try { _semEvRaw = JSON.parse(readUtf('data/i55_relation_unique_truth.json')); } catch (eEv) { _semEvRaw = null; }
// 连接身份与 plan.js/make_api 同源（SQL_DRIVER/SQL_URL/SQL_USER env，规范默认=生产 ATOM_LIVE）——
//   证据指纹核对真实可行（07e2 直测：srcMatch=true、unique 全收）；传 null 则源指纹必不匹配、证据全拒。
function semConn() {
  return {
    driver: System.getenv('SQL_DRIVER') || 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
    url: System.getenv('SQL_URL') || 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false',
    user: System.getenv('SQL_USER') || 'sa'
  };
}
var _semEvMaxAge = parseFloat(System.getenv('I55_EVIDENCE_MAX_AGE_DAYS') || '30');
function semUniqEv(modelObj, schema) {
  if (!_semEvRaw) return {};
  try {
    var fp = ModelEvidence.fingerprints({ model: modelObj, schema: schema, connection: semConn() });
    var ev = ModelEvidence.filter(_semEvRaw, { fingerprints: fp, model: modelObj, schema: schema,
      nowMs: new Date().getTime(), maxAgeDays: isFinite(_semEvMaxAge) ? _semEvMaxAge : ModelEvidence.DEFAULT_MAX_AGE_DAYS });
    return { uniqueKeyEvidence: ev.unique, evidenceDetail: { accepted: ev.accepted, missing: ev.missing, mismatched: ev.mismatched.length, stale: ev.stale.length } };
  } catch (eE) { return {}; }
}
if (action === 'create') {
  var docPath = genv('AGENT_SEMANTIC_DOC');
  if (!docPath) bail('SEMANTIC_USAGE', 'AGENT_SEMANTIC_DOC required for create', ['write the domain model.json draft first', 'semantic -Action create -Doc <file>']);
  var newModel = null;
  try { newModel = JSON.parse(readUtf(absOf(docPath))); } catch (eJ) { bail('SEMANTIC_USAGE', 'model draft unreadable: ' + docPath, ['check UTF-8 JSON']); }
  if (!newModel || typeof newModel !== 'object' || Array.isArray(newModel)) bail('SEMANTIC_USAGE', 'not a JSON object');
  if (typeof newModel.domain !== 'string' || !newModel.domain) bail('SEMANTIC_USAGE', 'draft must carry domain field (directory name)');
  var targetDir = modelsRoot + '/' + newModel.domain;
  var targetFile = targetDir + '/model.json';
  if (Files.exists(Pth.get(targetFile))) bail('MODEL_ALREADY_EXISTS', 'refusing to overwrite: ' + targetFile, ['use a new domain']);
  // 引用校验：模型 ↔ schema 快照回溯（ModelValidator 离线）
  load(ROOT + '/semantic/model/validator.js');
  var schemaNameS2 = 'schema_' + (newModel.source || newModel.domain) + '.json';
  var schemaPathS2 = ROOT + '/data/' + schemaNameS2;
  if (!Files.exists(Pth.get(schemaPathS2))) bail('SCHEMA_MISSING', schemaNameS2 + ' missing; run semantic/schema/inspect_main.js first');
  var schemaS2 = JSON.parse(readUtf(schemaPathS2));
  var mvErrs = ModelValidator.validate(newModel, schemaS2, { requireCompleteness: false, uniqueKeyEvidence: semUniqEv(newModel, schemaS2).uniqueKeyEvidence || {} });   // 草稿档：只查通用合法性（S1 两档拆分）
  if (mvErrs.length) bail('MODEL_VALIDATION_FAILED', mvErrs.map(function (e) { return e.code + '@' + e.path; }).join(', '),
    ['fix the model draft against ' + schemaNameS2], { diagnostics: mvErrs.slice(0, 20) });
  Files.createDirectories(Pth.get(targetDir));
  writeJson(targetFile, newModel);
  finish(0, { tool: 'semantic', action: 'create', runId: runId, ok: true, zeroEngine: true, created: targetFile, domain: newModel.domain, validationErrors: 0 });
}

if (action === 'validate') {
  var vd = genv('AGENT_SEMANTIC_DOMAIN');
  if (!vd) bail('SEMANTIC_USAGE', 'AGENT_SEMANTIC_DOMAIN required for validate');
  var vModel = null;
  try { vModel = JSON.parse(readUtf(modelsRoot + '/' + vd + '/model.json')); } catch (eV) { bail('MODEL_NOT_FOUND', vd + '/model.json unreadable'); }
  load(ROOT + '/semantic/model/validator.js');
  var vSchemaName = 'schema_' + (vModel.source || vd) + '.json';
  var vSchemaPath = ROOT + '/data/' + vSchemaName;
  if (!Files.exists(Pth.get(vSchemaPath))) bail('SCHEMA_MISSING', vSchemaName + ' missing');
  var vSchema = JSON.parse(readUtf(vSchemaPath));
  var vErrs = ModelValidator.validate(vModel, vSchema, { requireCompleteness: false, uniqueKeyEvidence: semUniqEv(vModel, vSchema).uniqueKeyEvidence || {} });   // validate=草稿档
  finish(vErrs.length ? 1 : 0, { tool: 'semantic', action: 'validate', runId: runId, ok: vErrs.length === 0, zeroEngine: true,
    domain: vd, errors: vErrs, nextActions: vErrs.length ? ['fix the listed UNKNOWN_REF/INVALID_* items'] : ['semantic -Action publish when business review is done'] });
}

if (action === 'publish') {
  var pd = genv('AGENT_SEMANTIC_DOMAIN');
  if (!pd) bail('SEMANTIC_USAGE', 'AGENT_SEMANTIC_DOMAIN required for publish');
  var pModelPath = modelsRoot + '/' + pd + '/model.json';
  var pModel = null;
  try { pModel = JSON.parse(readUtf(pModelPath)); } catch (eP) { bail('MODEL_NOT_FOUND', pd + '/model.json unreadable'); }
  load(ROOT + '/semantic/model/validator.js');
  var pSchemaName = 'schema_' + (pModel.source || pd) + '.json';
  var pSchemaPath = ROOT + '/data/' + pSchemaName;
  if (!Files.exists(Pth.get(pSchemaPath))) bail('SCHEMA_MISSING', pSchemaName + ' missing');
  var pSchema = JSON.parse(readUtf(pSchemaPath));
  var pErrs = ModelValidator.validate(pModel, pSchema, { uniqueKeyEvidence: semUniqEv(pModel, pSchema).uniqueKeyEvidence || {} });   // publish=完整档（证据核对全强度：连接同源+过期+关系指纹）
  if (pErrs.length) bail('MODEL_VALIDATION_FAILED', pErrs.map(function (e) { return e.code + '@' + e.path; }).join(', '),
    ['fix before publish'], { diagnostics: pErrs.slice(0, 20) });
  if (!(isObj(pModel.review) && isStr(pModel.review.by) && pModel.review.by))   // review 直接放 model.json（人填）
    bail('PUBLISHED_WITHOUT_REVIEW', 'model.json must carry review.{by,at} set by the business owner');
  var snapDirP = modelsRoot + '/' + pd + '/versions';
  Files.createDirectories(Pth.get(snapDirP));
  var snapFileP = snapDirP + '/' + (pModel.modelVersion || '1') + '.json';
  if (!Files.exists(Pth.get(snapFileP))) writeJson(snapFileP, pModel);
  finish(0, { tool: 'semantic', action: 'publish', runId: runId, ok: true, zeroEngine: true,
    domain: pd, modelVersion: pModel.modelVersion, snapshot: snapFileP });
}

bail('SEMANTIC_USAGE', 'unknown action: ' + action, ['use -Action list, inspect, create, validate or publish']);
