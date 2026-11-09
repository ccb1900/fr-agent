// agent/tools/assets.js — D2.1 Dataset 资产只读管理入口（Nashorn；零引擎、不进 FR 实例锁）
//   Action: list | inspect。工具层只做：读资产目录 → Registry.build → DatasetDef.audit → 诊断/合同输出。
//   不写文件（结果文件由本脚本 writeJson 落到 runDir，属既有 verb 惯例）、不执行 SQL、不引第二套校验器。
//   复用：_lib.js（runId/tryJson/writeJson/absOf）、semantic/dataset/{definition,registry}.js（生产契约）、
//        semantic/query/sqlbuilder.js（inspect 的派生列与 grainDrift 判定；纯函数，零连库）。
//   契约与验收：docs/architecture/dataset-semantic-plan.md §8 D2.1、verify/fast_assets_read.js。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
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
  print('{"ok":' + (rc === 0) + ',"runId":"' + runId + '","action":"' + action + '","result":"' +
    (runsDir ? 'logs/agent/runs/' + runId + '/assets.json' : 'logs/agent/runs/' + runId + '/assets.json') + '"}');
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
