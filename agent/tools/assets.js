// agent/tools/assets.js — D2 Dataset 资产管理入口（Nashorn；零 FR 引擎、不进 FR 实例锁）
//   Action: list | inspect | create | validate | publish。
//   工具层只做：IO（原子写 via _lib.js）+ 调 DatasetDef/DatasetRegistry/SqlBuilder 纯函数 + 生成真实证据。
//   不引第二套校验器、不自造写路径、不做语义管理（S1–S4）。
//   validate 需 JDBC（sample_data 同规：plain JVM + WEB-INF/lib 驱动 + dbpass 凭据 + setReadOnly）。
//   契约与验收：docs/architecture/dataset-semantic-plan.md §8、verify/fast_assets_read.js。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function isStr(v) { return typeof v === 'string'; }
function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');                 // runIdOf/runDirOf/tryJson/writeJson/absOf
load(ROOT + '/semantic/model/vocab.js');            // SqlBuilder 的 JOIN_SAFE_CARDINALITY 前置
load(ROOT + '/semantic/query/sqlbuilder.js');
load(ROOT + '/semantic/dataset/definition.js');
load(ROOT + '/semantic/dataset/registry.js');

var runId = runIdOf();
var runDir = runDirOf(runId);
var action = System.getenv('AGENT_ASSETS_ACTION') || '';
// 资产根：默认 models/（域内 datasets/*.json）；env 可指向隔离测试目录。
//   注意：env 是本机操作员/测试夹具注入，不是外部 Agent 输入；最终 IO 前仍按 expectedPath 校验身份。
var assetsDir = System.getenv('AGENT_ASSETS_DIR') || (ROOT + '/models');
var runsDir = System.getenv('AGENT_ASSETS_RUNS');   // 测试隔离用；生产留空走 _lib 的 runDirOf
var resultDir = runsDir ? (runsDir + '/' + runId) : runDir;
var outFile = resultDir + '/assets.json';
Files.createDirectories(Pth.get(resultDir));

function genv(k) { var v = System.getenv(k); return (v == null || String(v) === '') ? null : String(v); }
function finish(rc, obj) {
  writeJson(outFile, obj);
  var relResult = 'logs/agent/runs/' + runId + '/assets.json';   // 合同行路径恒为此（runsDir 隔离时由测试直接读文件）
  print('{"ok":' + (rc === 0) + ',"runId":"' + runId + '","action":"' + action + '","result":"' + relResult + '"}');
  System.exit(rc);
}
function bail(code, message, next, extra) {
  var o = { tool: 'assets', action: action, runId: runId, ok: false, error: { code: code, message: message }, nextActions: next || [], zeroEngine: true };
  if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
  finish(code === 'ASSETS_USAGE' ? 2 : 1, o);
}

// 从发现路径取 models/... 形式，供 DatasetDef 的 PATH_ID_MISMATCH 身份校验使用。
function relOf(rootDir, abs) {
  var a = String(abs).replace(/\\/g, '/');
  var m = /(models\/.+)$/.exec(a);
  return m ? m[1] : a.slice(String(rootDir).replace(/\\/g, '/').length + 1);
}
// 递归收集 *.json（生产布局是 models/<domain>/datasets/<name>.json，必须能走到；只跳过点开头的目录/文件）。
function walk(dir, acc) {
  var it;
  try { it = Files.newDirectoryStream(Pth.get(dir)); } catch (e) { return; }
  try {
    var entries = [];
    var iter = it.iterator();
    while (iter.hasNext()) entries.push(iter.next());
  } finally { try { it.close(); } catch (eC) { } }
  entries.sort();                                   // 确定序（Path 按 toString 字典序）
  entries.forEach(function (p) {
    var nm = String(p.getFileName());
    if (nm.charAt(0) === '.') return;
    if (Files.isDirectory(p)) { walk(String(p).replace(/\\/g, '/'), acc); return; }
    if (/\.json$/.test(nm)) acc.push(String(p).replace(/\\/g, '/'));
  });
}
function scanDocs(dir) {
  var docs = [], diagnostics = [];
  var base = String(dir).replace(/\\/g, '/');
  var p;
  try { p = Pth.get(base); } catch (eP) { return { docs: docs, diagnostics: [{ code: 'BAD_ASSETS_DIR', path: base, message: String(eP) }] }; }
  if (!Files.exists(p) || !Files.isDirectory(p)) return { docs: docs, diagnostics: diagnostics };   // 空目录=合法空清单
  var abs = [];
  walk(base, abs);
  abs.forEach(function (a) {
    // 资产根是 models/<domain>/datasets/*.json：只收 /datasets/ 段下的文件，
    //   否则 models/production/model.json（模型本体，非数据集）会被当候选报 BAD_ID（2026-11-09 自查）。
    if (a.indexOf('/datasets/') < 0) return;
    var nm = a.slice(a.lastIndexOf('/') + 1);
    var doc = tryJson(a);
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) { diagnostics.push({ code: 'UNREADABLE_JSON', path: relOf(base, a), message: 'not a JSON object' }); return; }
    docs.push({ relPath: relOf(base, a), abs: a, doc: doc });
  });
  docs.sort(function (x, y) { return x.relPath < y.relPath ? -1 : (x.relPath > y.relPath ? 1 : 0); });
  return { docs: docs, diagnostics: diagnostics };
}

// ---------- 单资产审计（复用生产契约，不在这层复刻；路径身份用真实发现路径） ----------
function auditOne(entry, model) {
  return {
    audit: DatasetDef.audit(entry.doc, entry.relPath),   // 传真实 relPath：文件名与 id 不符必须 PATH_ID_MISMATCH
    binding: DatasetDef.bindDrift(entry.doc, model)
  };
}

// ---------- 主流程 ----------
var model = null;
try { model = JSON.parse(readUtf('models/production/model.json')); } catch (eM) { model = null; }   // list 不强依赖模型
var scanned = scanDocs(assetsDir);
var diagnostics = scanned.diagnostics.slice();

// 顺序很关键（D2.1 复审定稿）：registry 先对"所有带字符串 id 的文档"做身份唯一性裁决（硬约束①），
//   registry.errors 非空即 fail-closed；之后才用契约审计做展示过滤。
//   反过来先按 audit 过滤会让 misplaced 副本在进入 registry 前就被剔掉，重复 id 门永远轮不到触发。
var idBearing = scanned.docs.filter(function (en) { return en.doc && typeof en.doc.id === 'string'; });
var reg = DatasetRegistry.build(idBearing.map(function (en) { return { relPath: en.relPath, doc: en.doc }; }));

var base = { tool: 'assets', action: action, runId: runId, ok: true, zeroEngine: true,
  assetsDir: assetsDir, diagnostics: diagnostics, registryErrors: reg.errors };

// 硬约束 ①：registry.errors 非空 → 所有管理操作停止（含只读）
if (reg.errors.length) {
  base.ok = false;
  base.error = { code: 'REGISTRY_ERRORS', message: 'duplicate/unparseable asset ids; refuse to continue' };
  base.nextActions = ['inspect registryErrors', 'remove or rename the colliding asset file so one id maps to one path', 're-run assets -Action list'];
  finish(1, base);
}

// 逐文档契约审计：不合格者记诊断、不进清单（但已在 registry 之上，不会掩盖 id 冲突）
var accepted = [];
scanned.docs.forEach(function (en) {
  var a = auditOne(en, model);
  if (a.audit.length || a.binding.length) {
    diagnostics.push({ code: 'CONTRACT_AUDIT_FAILED', path: en.relPath, message: a.audit.concat(a.binding).join(', ') });
    return;
  }
  accepted.push(en);
});

if (action === 'list') {
  base.assets = accepted.map(function (en) {
    return { id: en.doc.id, domain: en.doc.domain, status: en.doc.status, version: en.doc.datasetVersion, relPath: en.relPath, name: en.doc.name || null };
  });
  base.count = base.assets.length;
  finish(0, base);
}

if (action === 'create') {
  // D2.2 硬约束②：create 只能产 draft——调用方给 published/validated 一律强制降级，review 字段剔除
  //   （review 是业务确认的语义，工具自填=伪造确认；证据留 D2.3 validate 生成）
  var docPath = genv('AGENT_ASSETS_DOC');
  if (!docPath) bail('ASSETS_USAGE', 'AGENT_ASSETS_DOC required for create (path to an asset JSON file)',
    ['write the asset JSON (contract: docs/architecture/dataset-contract.md)', 'fr_agent.ps1 -Verb assets -Action create -Doc <file>']);
  if (!model) bail('MODEL_UNAVAILABLE', 'models/production/model.json unreadable; create needs it for binding + derived columns',
    ['run -Verb discover first; fix the model file']);
  var doc = tryJson(absOf(docPath));
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) bail('ASSETS_USAGE', 'asset doc unreadable / not a JSON object: ' + docPath,
    ['check the file exists and is valid UTF-8 JSON']);
  if (typeof doc.id !== 'string' || !DatasetDef.ID_RE.test(doc.id) || !doc.domain)
    bail('ASSET_DOC_INVALID', 'doc.id outside ' + DatasetDef.ID_RE + ' or doc.domain missing', ['run assets -Action list for id shape examples'], { requestedId: doc.id || null });
  var exp = DatasetDef.expectedPath(doc);                          // models/<domain>/datasets/<name>.json
  var tail = exp ? exp.slice('models/'.length) : null;             // <domain>/datasets/<name>.json
  if (!tail) bail('ASSET_DOC_INVALID', 'cannot derive target path from id: ' + doc.id);
  if (String(assetsDir).replace(/[\\/]+$/, '').slice(-'models'.length) !== 'models')
    bail('ASSETS_USAGE', 'AGENT_ASSETS_DIR must end with /models (asset home), got: ' + assetsDir);
  var target = assetsDir + '/' + tail;
  if (exists(target)) bail('ASSET_ALREADY_EXISTS', 'refusing to overwrite: ' + target,
    ['inspect the existing asset', 'use a new id for a new dataset'], { requestedId: doc.id, target: target });
  doc.status = 'draft';
  if (doc.review != null) delete doc.review;
  if (doc.validation != null) delete doc.validation;
  var audit = DatasetDef.audit(doc, exp);
  var binding = DatasetDef.bindDrift(doc, model);
  if (audit.length || binding.length) {
    diagnostics.push({ code: 'CONTRACT_AUDIT_FAILED', path: exp, message: audit.concat(binding).join(', ') });
    bail('CONTRACT_AUDIT_FAILED', audit.concat(binding).join(', '),
      ['fix the listed contract violations', 'run assets -Action list for id/status examples'], { diagnostics: diagnostics });
  }
  var built = SqlBuilder.build(model, DatasetDef.selectionArgs(doc));
  if ((built.errors || []).length) bail('SQL_BUILD_FAILED', built.errors.map(function (x) { return x.code + '@' + x.path; }).join(', '),
    ['fix selection terms against the model'], { diagnostics: diagnostics });
  var am = DatasetDef.assertsMatch(doc, DatasetDef.columnsOf(built));
  if (am.length) bail('ASSERTED_FIELDS_MISMATCH', am.join(', '),
    ['asserts.fields must equal the derived columns exactly (name+role, same order)', 'or drop asserts.fields'], { diagnostics: diagnostics });
  var cg = DatasetDef.grainDrift(doc, built.groupDims || []);
  if (cg.length) bail('GRAIN_DRIFT', cg.join(', '),
    ['grain.keys must exactly match the SQL GROUP BY dimensions (order + count)'], { diagnostics: diagnostics });
  writeJson(target, doc);                                          // 原子写：复用 _lib.js（不自造写路径）
  var back = tryJson(target);
  var reAudit = (back && typeof back === 'object') ? DatasetDef.audit(back, exp) : ['UNREADABLE@' + target];
  if (reAudit.length) bail('WRITE_ROUNDTRIP_FAILED', reAudit.join(', '),
    ['inspect the written file manually; this is a tool defect, not a caller error'], { diagnostics: diagnostics });
  base.created = exp;
  base.status = doc.status;
  base.audit = [];
  base.nextActions = ['assets -Action validate (D2.3) to generate real data evidence', 'assets -Action publish (D2.4) after evidence + review'];
  finish(0, base);
}

// ---------- D2.3 validate：自己采样/执行/生成绑定证据（工具不接调用方自报） ----------
if (action === 'validate') {
  var vid = genv('AGENT_ASSETS_ID');
  if (!vid) bail('ASSETS_USAGE', 'AGENT_ASSETS_ID required for validate', ['fr_agent.ps1 -Verb assets -Action validate -Target <datasetId>']);
  var vEntry = null;
  for (var vi = 0; vi < accepted.length; vi++) if (accepted[vi].doc.id === vid) { vEntry = accepted[vi]; break; }
  if (!vEntry) bail('ASSET_NOT_FOUND', 'dataset id not found: ' + vid, ['run assets -Action list'], { requestedId: vid });
  if (!model) bail('MODEL_UNAVAILABLE', 'model.json unreadable; validate needs it');
  var vDoc = vEntry.doc;
  var vAudit = DatasetDef.audit(vDoc, vEntry.relPath);
  var vBind = DatasetDef.bindDrift(vDoc, model);
  if (vAudit.length || vBind.length) bail('CONTRACT_AUDIT_FAILED', vAudit.concat(vBind).join(', '),
    ['fix the contract violations before validating'], { diagnostics: diagnostics });
  if (vDoc.status === 'published') bail('ALREADY_PUBLISHED', 'published assets are immutable; deprecate first');
  if (vDoc.status === 'deprecated') bail('DEPRECATED', 'deprecated assets cannot be re-validated');
  var vBuilt = SqlBuilder.build(model, DatasetDef.selectionArgs(vDoc));
  if ((vBuilt.errors || []).length) bail('SQL_BUILD_FAILED', vBuilt.errors.map(function (x) { return x.code + '@' + x.path; }).join(', '),
    ['fix selection terms'], { diagnostics: diagnostics });
  var vCols = DatasetDef.columnsOf(vBuilt);

  // JDBC：sample_data 同规（plain JVM + WEB-INF/lib 驱动 + dbpass 凭据 + setReadOnly + 只读 SQL）
  var sqlUrl = System.getenv('SQL_URL') || 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false';
  var sqlUsr = System.getenv('SQL_USER') || 'sa';
  var sqlPwd = null;
  try { load(ROOT + '/lib/dbpass.js'); sqlPwd = _cred.password; } catch (eP) { }
  if (!sqlPwd) bail('CREDENTIALS_MISSING', 'lib/dbpass.js unreadable', ['create data/db_local.js locally']);
  var conn = null, colLabels = [], rowCount = 0, execErr = null;
  try {
    conn = J('java.sql.DriverManager').getConnection(sqlUrl, sqlUsr, sqlPwd);
    conn.setReadOnly(true);
    var st = conn.createStatement();
    st.setMaxRows(200);   // P1-4（审查轮）：结果行数上限，防全表扫描（与 sample_data LIMIT 同口径）
    var rs = st.executeQuery(vBuilt.sql);
    var meta = rs.getMetaData(), nc = meta.getColumnCount();
    for (var ci = 1; ci <= nc; ci++) colLabels.push(String(meta.getColumnLabel(ci)));
    while (rs.next()) rowCount++;
    rs.close(); st.close();
  } catch (eQ) { execErr = String(eQ); }
  finally { if (conn) { try { conn.close(); } catch (eCl) { } } }
  if (execErr) bail('SQL_EXEC_FAILED', execErr, ['check SQL_URL/SQL_USER env + data/db_local.js credentials', 'ensure the SQL is valid for the target database']);

  // 列对拍：实际返回列 ↔ 派生列 逐项同名同序
  if (colLabels.length !== vCols.length)
    bail('COLUMN_COUNT_MISMATCH', 'expected ' + vCols.length + ' columns, got ' + colLabels.length,
      ['check the model selection and dataset columns'], { expected: vCols.map(function (c) { return c.name; }), actual: colLabels });
  for (var cmi = 0; cmi < vCols.length; cmi++) {
    if (colLabels[cmi] !== vCols[cmi].name)
      bail('COLUMN_NAME_MISMATCH', 'column ' + cmi + ': expected "' + vCols[cmi].name + '", got "' + colLabels[cmi] + '"',
        ['check the model mapping'], { expected: vCols.map(function (c) { return c.name; }), actual: colLabels });
  }

  // grainDrift：粒度声明 vs SQL 实际 GROUP BY 同序全等（审查轮 P2，audit 只查 ⊆ 不查 =）
  var vGrain = DatasetDef.grainDrift(vDoc, vBuilt.groupDims || []);
  if (vGrain.length) bail('GRAIN_DRIFT', vGrain.join(', '),
    ['grain.keys must exactly match the SQL GROUP BY dimensions (order + count)'], { diagnostics: diagnostics });

  // 生成绑定证据（工具自己出 ISO 时间戳，不接调用方手填；ref 用仓库相对路径保可移植）
  var evAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  var rootNorm = ROOT.replace(/\\/g, '/');
  var absNorm = String(resultDir).replace(/\\/g, '/');
  var evRefRel = absNorm.indexOf(rootNorm + '/') === 0 ? absNorm.slice(rootNorm.length + 1) : absNorm;
  var evEntry = { ref: evRefRel, datasetId: vid, modelVersion: model.modelVersion, sourceRef: model.source, at: evAt };
  var evData = { sql: vBuilt.sql, rowCount: rowCount, columns: colLabels, validatedAt: evAt, sourceRef: model.source };
  writeJson(resultDir + '/validate_sample.json', evData);

  if (!isObj(vDoc.validation)) vDoc.validation = { samples: [], executions: [] };
  if (!isArr(vDoc.validation.samples)) vDoc.validation.samples = [];
  vDoc.validation.samples.push(evEntry);
  vDoc.status = 'validated';
  writeJson(vEntry.abs, vDoc);                                     // 原子写回
  var vBack = tryJson(vEntry.abs);
  var vRe = DatasetDef.audit(vBack, vEntry.relPath);
  if (vRe.length) bail('WRITE_ROUNDTRIP_FAILED', vRe.join(', '),
    ['inspect the written file manually; tool defect'], { diagnostics: diagnostics });
  base.action = 'validate';
  base.validatedId = vid;
  base.status = 'validated';
  base.sql = vBuilt.sql;
  base.rowCount = rowCount;
  base.columns = colLabels;
  base.evidence = evEntry;
  base.nextActions = ['assets -Action publish (D2.4) after business review: set review.{by,at} in the asset file'];
  finish(0, base);
}

// ---------- D2.4 publish：重检资产 + 证据 + review → 状态升级 ----------
if (action === 'publish') {
  var pid = genv('AGENT_ASSETS_ID');
  if (!pid) bail('ASSETS_USAGE', 'AGENT_ASSETS_ID required for publish', ['fr_agent.ps1 -Verb assets -Action publish -Target <datasetId>']);
  var pEntry = null;
  for (var pi = 0; pi < accepted.length; pi++) if (accepted[pi].doc.id === pid) { pEntry = accepted[pi]; break; }
  if (!pEntry) bail('ASSET_NOT_FOUND', 'dataset id not found: ' + pid, ['run assets -Action list'], { requestedId: pid });
  if (!model) bail('MODEL_UNAVAILABLE', 'model.json unreadable');
  var pDoc = pEntry.doc;
  if (pDoc.status === 'published') bail('ALREADY_PUBLISHED', 'already published; published assets are immutable');
  if (pDoc.status !== 'validated') bail('NOT_VALIDATED', 'status must be validated before publish, got: ' + pDoc.status,
    ['run assets -Action validate first']);
  var pAudit = DatasetDef.audit(pDoc, pEntry.relPath);
  var pBind = DatasetDef.bindDrift(pDoc, model);
  var pEvProb = DatasetDef.evidenceProblems(pDoc);
  // P1-3 修复（审查轮）：证据 ref 指向的文件必须真实存在且在允许目录内（不能只看 JSON 字段形状）
  var pFileProb = [];
  if (isObj(pDoc.validation)) {
    ['samples', 'executions'].forEach(function (ek) {
      if (!isArr(pDoc.validation[ek])) return;
      pDoc.validation[ek].forEach(function (s, si) {
        if (!isObj(s) || !isStr(s.ref) || !s.ref) return;
        var rel = String(s.ref).replace(/\\/g, '/');
        if (rel.indexOf('logs/agent/runs/') !== 0) { pFileProb.push('EVIDENCE_REF_OUTSIDE_ALLOWED_DIR@validation.' + ek + '[' + si + ']'); return; }
        if (rel.indexOf('..') >= 0) { pFileProb.push('EVIDENCE_REF_TRAVERSAL@validation.' + ek + '[' + si + ']'); return; }
        var absRef = absOf(rel);
        if (!exists(absRef)) pFileProb.push('EVIDENCE_FILE_MISSING@validation.' + ek + '[' + si + '] (' + s.ref + ')');
      });
    });
  }
  var pBuilt = SqlBuilder.build(model, DatasetDef.selectionArgs(pDoc));
  var pBuiltErrs = (pBuilt.errors || []).map(function (x) { return x.code + '@' + x.path; });
  var pGrain = pBuiltErrs.length ? [] : DatasetDef.grainDrift(pDoc, pBuilt.groupDims || []);
  if (pAudit.length || pBind.length || pEvProb.length || pGrain.length || pBuiltErrs.length || pFileProb.length)
    bail('CONTRACT_AUDIT_FAILED', pAudit.concat(pBind, pEvProb, pGrain, pBuiltErrs, pFileProb).join(', '),
      ['fix contract violations and evidence issues before publishing'], { diagnostics: diagnostics });
  if (!(isObj(pDoc.review) && isStr(pDoc.review.by) && pDoc.review.by && isStr(pDoc.review.at) && pDoc.review.at))
    bail('PUBLISHED_WITHOUT_REVIEW', 'business review missing (review.by + review.at must be set by a human)',
      ['have the business owner confirm the metric definitions and set review.{by,at} in the asset file']);
  pDoc.status = 'published';
  writeJson(pEntry.abs, pDoc);
  var pBack = tryJson(pEntry.abs);
  var pRe = DatasetDef.audit(pBack, pEntry.relPath);
  if (pRe.length) bail('WRITE_ROUNDTRIP_FAILED', pRe.join(', '),
    ['inspect the written file manually; tool defect'], { diagnostics: diagnostics });
  base.action = 'publish';
  base.publishedId = pid;
  base.status = 'published';
  base.nextActions = ['asset is now published; new datasets should use a new id'];
  finish(0, base);
}

if (action === 'inspect') {
  var id = genv('AGENT_ASSETS_ID');
  if (!id) bail('ASSETS_USAGE', 'AGENT_ASSETS_ID required for inspect', ['fr_agent.ps1 -Verb assets -Action inspect -Target <datasetId>']);
  var hit = reg.resolve(id);
  if (!hit) bail('ASSET_NOT_FOUND', 'dataset id not found: ' + id, ['run assets -Action list for available ids'], { requestedId: id });
  var entry = null;
  for (var i = 0; i < accepted.length; i++) if (accepted[i].doc.id === id) { entry = accepted[i]; break; }
  if (!entry) bail('CONTRACT_AUDIT_FAILED', 'asset ' + id + ' is indexed but fails contract audit', ['run assets -Action list and read diagnostics for this id'], { requestedId: id });
  var detail = auditOne(entry, model);
  var cols = [], grain = [];
  if (model) {
    var built = SqlBuilder.build(model, DatasetDef.selectionArgs(entry.doc));
    cols = DatasetDef.columnsOf(built);
    grain = DatasetDef.grainDrift(entry.doc, built.groupDims || []);
  }
  base.requestedId = id;
  base.doc = entry.doc;
  base.relPath = entry.relPath;
  base.audit = detail.audit;
  base.binding = detail.binding;
  base.columns = cols;
  base.grainDrift = grain;
  base.evidenceProblems = DatasetDef.evidenceProblems(entry.doc);
  base.nextActions = (entry.doc.status === 'draft') ? ['assets -Action validate (D2.3)', 'assets -Action publish (D2.4) after evidence + review'] : [];
  finish(0, base);
}

bail('ASSETS_USAGE', 'unknown action: ' + action, ['use -Action list or -Action inspect', 'run assets -Action list to see available ids']);
