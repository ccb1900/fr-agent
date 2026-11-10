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
  // S3：datasetRef 交叉验证——模型引用的 Dataset 必须存在且已发布（读时检查，不改模型）
  var datasetRefCheck = null;
  if (model.datasetRef) {
    var dsRefParts = model.datasetRef.split('.');
    var dsRefPath = modelsRoot + '/' + dsRefParts[0] + '/datasets/' + dsRefParts[1] + '.json';   // P2-1：与扫描根一致
    if (!Files.exists(Pth.get(dsRefPath))) datasetRefCheck = { ok: false, reason: 'DATASET_NOT_FOUND@' + model.datasetRef };
    else {
      var dsDoc = null;
      try { dsDoc = JSON.parse(readUtf(dsRefPath)); } catch (eDs) { }
      if (!dsDoc || dsDoc.status !== 'published') datasetRefCheck = { ok: false, reason: 'DATASET_NOT_PUBLISHED@' + model.datasetRef + ' (status=' + (dsDoc ? dsDoc.status : 'unreadable') + ')' };
      else datasetRefCheck = { ok: true, datasetId: dsDoc.id, datasetVersion: dsDoc.datasetVersion, modelVersionMatch: dsDoc.model && dsDoc.model.modelVersion === model.modelVersion };
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

bail('SEMANTIC_USAGE', 'unknown action: ' + action, ['use -Action list or -Action inspect']);
