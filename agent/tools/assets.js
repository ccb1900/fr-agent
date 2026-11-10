// agent/tools/assets.js — D2 Dataset 资产管理入口（Nashorn；零 FR 引擎、不进 FR 实例锁）
//   Action: list | inspect | create | validate | publish | deprecate | impact。
//   工具层只做：IO（原子写 via _lib.js）+ 调 DatasetDef/DatasetRegistry/SqlBuilder 纯函数 + 生成真实证据。
//   不引第二套校验器、不自造写路径、不做语义管理。
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
//   P2-1（外审）：读不到的目录不再静默——失败计入 scanDiagnostics，清单结论必须对"扫面完整"负责。
var _scanDiags = [];
function walk(dir, acc) {
  var it;
  try { it = Files.newDirectoryStream(Pth.get(dir)); } catch (e) {
    _scanDiags.push({ code: 'SCAN_DIR_UNREADABLE', path: String(dir).replace(/\\/g, '/'), message: String(e) });
    return;
  }
  try {
    var entries = [];
    var iter = it.iterator();
    while (iter.hasNext()) entries.push(iter.next());
  } finally { try { it.close(); } catch (eC) { } }
  entries.sort();                                   // 确定序（Path 按 toString 字典序）
  entries.forEach(function (p) {
    var nm = String(p.getFileName());
    if (nm.charAt(0) === '.') return;
    if (Files.isDirectory(p)) {
      // 跳过 versions/ 子目录（发布快照不可变副本，不是可发现资产）
      if (nm === 'versions') return;
      walk(String(p).replace(/\\/g, '/'), acc); return;
    }
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

// ---------- P1-3 域化模型装载（外审）：模型跟资产走，不再全局硬编 production ----------
//   身份四面体：id 前缀 / doc.domain / model.ref 域段 / 已加载模型 domain 必须一致；
//   只靠 modelVersion 相等判身份不成立（跨域误绑会在 SQL 编译期炸出语义错）。零复刻：ref 形态与 resolver 同规。
var _modelCache = Object.create(null);
function loadModelForDoc(doc) {
  if (!isObj(doc)) return { model: null, prob: 'BAD_MODEL_REF (doc missing)' };
  if (!isObj(doc.model)) return { model: null, prob: 'BAD_MODEL_REF (model.ref missing)' };
  var ref = String(doc.model.ref || '');
  var m = /^models\/([^\/]+)\/model\.json$/.exec(ref);
  if (!m) return { model: null, prob: 'BAD_MODEL_REF (model.ref must be models/<domain>/model.json, got: ' + ref + ')' };
  var dom = m[1];
  var idDom = String(doc.id || '').split('.')[0];
  if (!dom) return { model: null, prob: 'BAD_MODEL_REF (empty domain segment)' };
  if (idDom && idDom !== dom) return { model: null, prob: 'MODEL_REF_DOMAIN_MISMATCH (id prefix ' + idDom + ' vs model.ref domain ' + dom + ')' };
  if (isStr(doc.domain) && doc.domain && doc.domain !== dom) return { model: null, prob: 'MODEL_REF_DOMAIN_MISMATCH (doc.domain ' + doc.domain + ' vs model.ref domain ' + dom + ')' };
  if (Object.prototype.hasOwnProperty.call(_modelCache, dom)) return { model: _modelCache[dom], domain: dom };
  var absM = assetsDir + '/' + dom + '/model.json';   // 模型与数据集同一 models home（默认 ROOT/models，env 测试隔离同根）
  if (!Files.exists(Pth.get(absM))) return { model: null, prob: 'MODEL_UNREADABLE@' + ref };   // 视作身份错误，工具代码统一落在调用方 bail
  var mj = null;
  try { mj = JSON.parse(readUtf(absM)); } catch (eM) { return { model: null, prob: 'MODEL_UNREADABLE@' + ref }; }
  if (!isObj(mj)) return { model: null, prob: 'MODEL_UNREADABLE@' + ref };
  // 注意：模型文件自身的 domain 字段是模型内部域命名（生产=laser_inspection），不与资产域（目录名）比对——
  //   资产身份权威=id 前缀 / doc.domain / model.ref 域段 三方同源（目录域）。
  _modelCache[dom] = mj;
  return { model: mj, domain: dom };
}

// ---------- 主流程 ----------
var scanned = scanDocs(assetsDir);
var diagnostics = scanned.diagnostics.slice();
var scanComplete = _scanDiags.length === 0;   // P2-1：清单/索引结论依据（读不到的目录已入 _scanDiags）

// 顺序很关键（D2.1 复审定稿）：registry 先对"所有带字符串 id 的文档"做身份唯一性裁决（硬约束①），
//   registry.errors 非空即 fail-closed；之后才用契约审计做展示过滤。
//   反过来先按 audit 过滤会让 misplaced 副本在进入 registry 前就被剔掉，重复 id 门永远轮不到触发。
var idBearing = scanned.docs.filter(function (en) { return en.doc && typeof en.doc.id === 'string'; });
var reg = DatasetRegistry.build(idBearing.map(function (en) { return { relPath: en.relPath, doc: en.doc }; }));

var base = { tool: 'assets', action: action, runId: runId, ok: true, zeroEngine: true,
  assetsDir: assetsDir, diagnostics: diagnostics, registryErrors: reg.errors,
  scanComplete: scanComplete, scanDiagnostics: scanComplete ? [] : _scanDiags };   // P2-1 显式化

// 硬约束 ①：registry.errors 非空 → 所有管理操作停止（含只读）
if (reg.errors.length) {
  base.ok = false;
  base.error = { code: 'REGISTRY_ERRORS', message: 'duplicate/unparseable asset ids; refuse to continue' };
  base.nextActions = ['inspect registryErrors', 'remove or rename the colliding asset file so one id maps to one path', 're-run assets -Action list'];
  finish(1, base);
}

// 逐文档契约审计：不合格者记诊断、不进清单（但已在 registry 之上，不会掩盖 id 冲突）
//   P1-3：模型逐资产装载（跨域资产各自绑自己的模型）。
var accepted = [];
scanned.docs.forEach(function (en) {
  var lm = loadModelForDoc(en.doc);
  if (lm.prob) {   // 身份/装载错误逐条记诊断（不再依赖全局模型）
    diagnostics.push({ code: 'MODEL_CONTEXT_FAILED', path: en.relPath, message: lm.prob });
    var a0 = DatasetDef.audit(en.doc, en.relPath);   // 契约审计照做（诊断双证）
    if (a0.length) diagnostics.push({ code: 'CONTRACT_AUDIT_FAILED', path: en.relPath, message: a0.join(', ') });
    return;
  }
  var a = auditOne(en, lm.model);
  if (a.audit.length || a.binding.length) {
    diagnostics.push({ code: 'CONTRACT_AUDIT_FAILED', path: en.relPath, message: a.audit.concat(a.binding).join(', ') });
    return;
  }
  en.model = lm.model;   // 供下游语义动作复用（validate/publish/deprecate/impact 同域模型）
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
  var doc = tryJson(absOf(docPath));
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) bail('ASSETS_USAGE', 'asset doc unreadable / not a JSON object: ' + docPath,
    ['check the file exists and is valid UTF-8 JSON']);
  if (!doc.id || typeof doc.id !== 'string' || !DatasetDef.ID_RE.test(doc.id) || !doc.domain)
    bail('ASSET_DOC_INVALID', 'doc.id outside ' + DatasetDef.ID_RE + ' or doc.domain missing', ['run assets -Action list for id shape examples'], { requestedId: doc.id || null });
  var lmCreate = loadModelForDoc(doc);   // P1-3：creat 也按 doc 的 model.ref 域装载（跨域草案在此拒）
  if (lmCreate.prob) bail('MODEL_CONTEXT_FAILED', lmCreate.prob,
    ['fix the model.ref (models/<domain>/model.json) so id prefix / doc.domain / ref domain all agree'], { requestedModel: (doc.model || {}).ref || null });
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
  var binding = DatasetDef.bindDrift(doc, lmCreate.model);
  if (audit.length || binding.length) {
    diagnostics.push({ code: 'CONTRACT_AUDIT_FAILED', path: exp, message: audit.concat(binding).join(', ') });
    bail('CONTRACT_AUDIT_FAILED', audit.concat(binding).join(', '),
      ['fix the listed contract violations', 'run assets -Action list for id/status examples'], { diagnostics: diagnostics });
  }
  var built = SqlBuilder.build(lmCreate.model, DatasetDef.selectionArgs(doc));
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
  var vDoc = vEntry.doc;
  var vAudit = DatasetDef.audit(vDoc, vEntry.relPath);
  var vBind = DatasetDef.bindDrift(vDoc, vEntry.model);
  if (vAudit.length || vBind.length) bail('CONTRACT_AUDIT_FAILED', vAudit.concat(vBind).join(', '),
    ['fix the contract violations before validating'], { diagnostics: diagnostics });
  if (vDoc.status === 'published') bail('ALREADY_PUBLISHED', 'published assets are immutable; deprecate first');
  if (vDoc.status === 'deprecated') bail('DEPRECATED', 'deprecated assets cannot be re-validated');
  if (vDoc.status === 'validated' && isObj(vDoc.validation) && isArr(vDoc.validation.samples) && vDoc.validation.samples.length > 0)
    bail('ALREADY_VALIDATED', 'validated assets have data evidence; re-validation appends redundant entries',
      ['run assets -Action publish to proceed to publication', 'or edit the asset file to clear validation.samples and re-validate']);
  var vBuilt = SqlBuilder.build(vEntry.model, DatasetDef.selectionArgs(vDoc));
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
  var evRefDirRel = absNorm.indexOf(rootNorm + '/') === 0 ? absNorm.slice(rootNorm.length + 1) : absNorm;
  // P1-2（外审）：ref 必须指向证据**文件**本身——此前只指 run 目录，目录存在即过，文件存在性检查形同虚设
  var evRefRel = evRefDirRel + '/validate_sample.json';
  //   证据文件带同一组身份字段（datasetId/modelVersion/sourceRef/validatedAt）→ publish 可读文件逐项对拍
  var evEntry = { ref: evRefRel, datasetId: vid, modelVersion: vEntry.model.modelVersion, sourceRef: vEntry.model.source, at: evAt, rowLimit: 200, truncated: rowCount >= 200 };
  var evData = { sql: vBuilt.sql, rowCount: rowCount, rowLimit: 200, truncated: rowCount >= 200,
    columns: colLabels, datasetId: vid, modelVersion: vEntry.model.modelVersion, sourceRef: vEntry.model.source, validatedAt: evAt };
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
  var pDoc = pEntry.doc;
  if (pDoc.status === 'published') bail('ALREADY_PUBLISHED', 'already published; published assets are immutable');
  if (pDoc.status !== 'validated') bail('NOT_VALIDATED', 'status must be validated before publish, got: ' + pDoc.status,
    ['run assets -Action validate first']);
  var pAudit = DatasetDef.audit(pDoc, pEntry.relPath);
  var pBind = DatasetDef.bindDrift(pDoc, pEntry.model);
  var pEvProb = DatasetDef.evidenceProblems(pDoc);
  // P1-3 修复（审查轮）：证据 ref 指向的文件必须真实存在且在允许目录内（不能只看 JSON 字段形状）
  // P1-2 强化（外审）：目标是**普通文件**并逐项对拍身份（datasetId/modelVersion/sourceRef/at ↔ 证据文件内容）
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
        if (!exists(absRef)) { pFileProb.push('EVIDENCE_FILE_MISSING@validation.' + ek + '[' + si + '] (' + s.ref + ')'); return; }
        var evPath = Pth.get(absRef);
        if (!Files.isRegularFile(evPath)) { pFileProb.push('EVIDENCE_REF_NOT_FILE@validation.' + ek + '[' + si + '] (' + s.ref + ' is not a regular file)'); return; }
        var evDocF = tryJson(absRef);
        if (!isObj(evDocF)) { pFileProb.push('EVIDENCE_FILE_CORRUPT@validation.' + ek + '[' + si + '] (' + s.ref + ' unreadable as JSON object)'); return; }
        // 身份对拍：证据 json 内记录的身份必须与资产条目逐字段一致（伪造/串条必拒）
        var idMismatch = (evDocF.datasetId !== s.datasetId) || (evDocF.modelVersion !== s.modelVersion) ||
          (String(evDocF.sourceRef) !== String(s.sourceRef)) || (evDocF.validatedAt !== s.at);
        if (idMismatch) pFileProb.push('EVIDENCE_IDENTITY_MISMATCH@validation.' + ek + '[' + si + '] (evidence file identity {datasetId=' + evDocF.datasetId + ',modelVersion=' + evDocF.modelVersion + ',sourceRef=' + evDocF.sourceRef + ',validatedAt=' + evDocF.validatedAt + '} != entry {datasetId=' + s.datasetId + ',modelVersion=' + s.modelVersion + ',sourceRef=' + s.sourceRef + ',at=' + s.at + '})');
      });
    });
  }
  var pBuilt = SqlBuilder.build(pEntry.model, DatasetDef.selectionArgs(pDoc));
  var pBuiltErrs = (pBuilt.errors || []).map(function (x) { return x.code + '@' + x.path; });
  var pGrain = pBuiltErrs.length ? [] : DatasetDef.grainDrift(pDoc, pBuilt.groupDims || []);
  if (pAudit.length || pBind.length || pEvProb.length || pGrain.length || pBuiltErrs.length || pFileProb.length)
    bail('CONTRACT_AUDIT_FAILED', pAudit.concat(pBind, pEvProb, pGrain, pBuiltErrs, pFileProb).join(', '),
      ['fix contract violations and evidence issues before publishing'], { diagnostics: diagnostics });
  if (!(isObj(pDoc.review) && isStr(pDoc.review.by) && pDoc.review.by && isStr(pDoc.review.at) && pDoc.review.at))
    bail('PUBLISHED_WITHOUT_REVIEW', 'business review missing (review.by + review.at must be set by a human)',
      ['have the business owner confirm the metric definitions and set review.{by,at} in the asset file']);
  // S4 发布快照：先写不可变副本（此刻 status 仍为 validated，快照如实记录发布前状态），再翻转主文件。
  //   顺序保证幂等性：crash 在这中间 → 主文件仍 validated → 重试 publish 重新走全链门 + 快照幂等存在跳过。
  var snapDir = pEntry.abs.replace(/[\\/][^\\/]+$/, '') + '/versions';
  Files.createDirectories(Pth.get(snapDir));
  var snapFile = snapDir + '/' + (pDoc.datasetVersion || '1') + '.json';
  if (!exists(snapFile)) writeJson(snapFile, pDoc);
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

// ---------- W1/W2（走查 P0-1/P0-2，semantic 同规镜像）：assets review + revise ----------
if (action === 'review') {
  var aud = genv('AGENT_ASSETS_ID');
  if (!aud) bail('ASSETS_USAGE', 'AGENT_ASSETS_ID required for review', ['fr_agent.ps1 -Verb assets -Action review -Target <datasetId> -ReviewBy "<owner>"']);
  var aby = genv('AGENT_ASSETS_REVIEW_BY');
  if (!aby) bail('ASSETS_USAGE', 'AGENT_ASSETS_REVIEW_BY required (-ReviewBy "<business owner name>")',
    ['the review is recorded by whoever runs this command - the business owner should run it (never invent a name)']);
  var aEntry = null;
  for (var ari = 0; ari < accepted.length; ari++) if (accepted[ari].doc.id === aud) { aEntry = accepted[ari]; break; }
  if (!aEntry) bail('ASSET_NOT_FOUND', 'dataset id not found: ' + aud, ['run assets -Action list'], { requestedId: aud });
  if (aEntry.doc.status === 'deprecated') bail('DEPRECATED', 'deprecated assets cannot take a new review');
  var aNow = new Date().toISOString();
  aEntry.doc.review = { by: aby, at: aNow };
  writeJson(aEntry.abs, aEntry.doc);
  finish(0, { tool: 'assets', action: 'review', runId: runId, ok: true, zeroEngine: true, reviewedId: aud, review: aEntry.doc.review,
    nextActions: ['run assets -Action publish -Target ' + aud] });
}
if (action === 'revise') {
  var rud = genv('AGENT_ASSETS_ID');
  var radoc = genv('AGENT_ASSETS_DOC');
  if (!rud) bail('ASSETS_USAGE', 'AGENT_ASSETS_ID required for revise', ['fr_agent.ps1 -Verb assets -Action revise -Target <datasetId> -Doc <draft.json>']);
  if (!radoc) bail('ASSETS_USAGE', 'AGENT_ASSETS_DOC required for revise', ['write the bumped dataset JSON draft first', 'fr_agent.ps1 -Verb assets -Action revise -Target <datasetId> -Doc <draft.json>']);
  var rrEntry = null;
  for (var rui = 0; rui < accepted.length; rui++) if (accepted[rui].doc.id === rud) { rrEntry = accepted[rui]; break; }
  if (!rrEntry) bail('ASSET_NOT_FOUND', 'dataset id not found: ' + rud, ['run assets -Action list'], { requestedId: rud });
  if (rrEntry.doc.status === 'deprecated') bail('DEPRECATED', 'deprecated assets cannot be revised');
  if (rrEntry.doc.status === 'published') bail('ALREADY_PUBLISHED', 'published assets are immutable - revise happens on a NEW version draft here only while NOT yet published', ['deprecate first, then create a new id']);
  var rNew = tryJson(absOf(radoc));
  if (!rNew || typeof rNew !== 'object' || Array.isArray(rNew)) bail('ASSETS_USAGE', 'draft unreadable / not a JSON object: ' + radoc);
  rNew.id = rud; rNew.domain = rrEntry.doc.domain;
  var rCurV = parseInt(rrEntry.doc.datasetVersion, 10) || 0, rNewV = parseInt(rNew.datasetVersion, 10) || 0;
  if (!(rNewV > rCurV)) bail('VERSION_NOT_BUMPED', 'revise requires datasetVersion > current (' + rrEntry.doc.datasetVersion + '), got: ' + rNew.datasetVersion, ['bump datasetVersion in the draft then re-run revise'], { currentVersion: rrEntry.doc.datasetVersion, draftVersion: rNew.datasetVersion });
  if (rNew.review != null) delete rNew.review;   // review 只能由人经 review 动作登记
  rNew.status = 'draft';
  var rExp = DatasetDef.expectedPath(rNew);
  var rAudit = DatasetDef.audit(rNew, rExp);
  var rBind = DatasetDef.bindDrift(rNew, rrEntry.model);
  if (rAudit.length || rBind.length) bail('CONTRACT_AUDIT_FAILED', rAudit.concat(rBind).join(', '), ['fix contract violations before revising'], {});
  writeJson(rrEntry.abs, rNew);
  var rBack = tryJson(rrEntry.abs);
  var rRe = DatasetDef.audit(rBack, rrEntry.relPath);
  if (rRe.length) bail('WRITE_ROUNDTRIP_FAILED', rRe.join(', '), ['inspect the written file manually; tool defect'], {});
  finish(0, { tool: 'assets', action: 'revise', runId: runId, ok: true, zeroEngine: true, revisedId: rud, datasetVersion: rNew.datasetVersion,
    nextActions: ['assets -Action validate to regenerate evidence for the new version', 'human review via assets -Action review, then publish'] });
}

// ---------- S4 deprecate：validated/published → deprecated（带原因；不可逆） ----------
if (action === 'deprecate') {
  var did = genv('AGENT_ASSETS_ID');
  if (!did) bail('ASSETS_USAGE', 'AGENT_ASSETS_ID required for deprecate', ['fr_agent.ps1 -Verb assets -Action deprecate -Target <datasetId>']);
  var dEntry = null;
  for (var di = 0; di < accepted.length; di++) if (accepted[di].doc.id === did) { dEntry = accepted[di]; break; }
  if (!dEntry) bail('ASSET_NOT_FOUND', 'dataset id not found: ' + did, ['run assets -Action list'], { requestedId: did });
  var dDoc = dEntry.doc;
  if (dDoc.status === 'deprecated') bail('ALREADY_DEPRECATED', 'already deprecated');
  if (!isObj(dDoc.deprecation) || !isStr(dDoc.deprecation.reason) || !dDoc.deprecation.reason)
    bail('DEPRECATION_REASON_REQUIRED', 'deprecation.reason required (set in the asset file before calling deprecate)',
      ['edit the asset JSON to add deprecation:{reason:"..."} then re-run deprecate']);
  dDoc.status = 'deprecated';
  writeJson(dEntry.abs, dDoc);
  base.action = 'deprecate';
  base.deprecatedId = did;
  base.status = 'deprecated';
  base.nextActions = ['asset is deprecated; existing reports can still reference it but new reports should not'];
  finish(0, base);
}

// ---------- S4 impact：静态依赖分析（谁引用了这个 Dataset id） ----------
if (action === 'impact') {
  var iid = genv('AGENT_ASSETS_ID');
  if (!iid) bail('ASSETS_USAGE', 'AGENT_ASSETS_ID required for impact', ['fr_agent.ps1 -Verb assets -Action impact -Target <datasetId>']);
  var scanRoots = [ROOT + '/examples/report-spec', ROOT + '/verify/fixtures', ROOT + '/models'];
  var affected = [];
  var impactScanDiags = [];   // P2-1：扫描不完整时不得给"无引用=可安全退役"结论
  scanRoots.forEach(function (rootDir) {
    var stack = [rootDir];
    while (stack.length) {
      var cur = stack.pop();
      var ds;
      try { ds = Files.newDirectoryStream(Pth.get(cur)); } catch (e) {
        impactScanDiags.push({ code: 'SCAN_DIR_UNREADABLE', path: String(cur).replace(/\\/g, '/'), message: String(e) });
        continue;
      }
      try { var it2 = ds.iterator(); while (it2.hasNext()) {
        var f = it2.next();
        var fn = String(f.getFileName());
        if (fn.charAt(0) === '.') continue;
        if (Files.isDirectory(f)) { stack.push(String(f).replace(/\\/g, '/')); continue; }
        if (!/\.json$/.test(fn)) continue;
        var fp2 = String(f).replace(/\\/g, '/');
        if (/\/versions\/[^\/]+\.json$/.test(fp2)) continue;   // P2-2：versions/ 是本资产的不可变副本，不是"引用者"
        var txt = '';
        try { txt = readUtf(fp2); } catch (eR) { impactScanDiags.push({ code: 'SCAN_FILE_UNREADABLE', path: fp2, message: String(eR) }); continue; }
        if (txt.indexOf('"' + iid + '"') >= 0) {
          // 排除自身与 versions/ 快照：impact 是"谁引用了我"，不是"我在哪"
          if (fp2.indexOf('/datasets/') >= 0) {
            var selfDoc = null; try { selfDoc = JSON.parse(txt); } catch (eJ) { }
            if (selfDoc && selfDoc.id === iid) continue;   // 自身资产文件
          }
          affected.push(fp2);
        }
      } } finally { try { ds.close(); } catch (eC2) { } }
    }
  });
  base.action = 'impact';
  base.impactId = iid;
  base.referencedBy = affected;
  base.scanComplete = impactScanDiags.length === 0;   // P2-1 显式化
  if (impactScanDiags.length) base.scanDiagnostics = impactScanDiags;
  base.nextActions = impactScanDiags.length
    ? ['SCAN INCOMPLETE: fix unreadable paths (see scanDiagnostics) and re-run before drawing any retirement conclusion']
    : (affected.length ? ['review the referencing files before changing this dataset'] : ['no static references found in examples/verify/models']);
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
  var detail = auditOne(entry, entry.model);   // P1-3：inspect 也用资产自己的域模型
  var cols = [], grain = [];
  if (entry.model) {
    var built = SqlBuilder.build(entry.model, DatasetDef.selectionArgs(entry.doc));
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
