// agent/tools/discover.js — fr-agent 工具层 verb: discover（零引擎）；r10-A runId 化 + r10-B CapabilityManifest 接入
//   输出 runDir/discover.json：实体/维度/指标/关系（含 JOIN 安全）+ ReportSpec 能力 + **CapabilityManifest 四层能力状态**
//   （r10 P1：Agent 不会把仅完成对象挂接的功能宣传为已完整支持——agentAvailable=四层全 verified 才 true）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');
var runId = runIdOf();
var runDir = runDirOf(runId);
// r24-CWD：本地 readUtf 死定义已删——它被上行 load(_lib.js) 的同名函数覆盖（惰性死代码，误导读者
//   以为本 verb CWD 无关）；现在统一用 _lib.readUtf（内部 absOf 解析相对路径）。
load(ROOT + '/lib/report_spec.js');
load(ROOT + '/semantic/model/vocab.js');
load(ROOT + '/application/capability_manifest.js');
var model = JSON.parse(readUtf('models/production/model.json'));
var schemaName = 'schema_' + (model.source || 'atom_live_demo') + '.json';
var schema = JSON.parse(readUtf('data/' + schemaName));

// S1：扫描 models/ 下所有含 model.json 的子目录 = 可用域清单（当前可能只有 production）
var availableDomains = [];
try {
  var mds = Files.newDirectoryStream(Pth.get(ROOT + '/models'));
  try { var mit = mds.iterator(); while (mit.hasNext()) {
    var md = mit.next();
    if (!Files.isDirectory(md)) continue;
    var dn = String(md.getFileName());
    if (dn.charAt(0) === '.') continue;
    if (Files.exists(Pth.get(ROOT + '/models/' + dn + '/model.json'))) availableDomains.push(dn);
  } } finally { try { mds.close(); } catch (eC) { } }
  availableDomains.sort();
} catch (eD) { }

var safeCards = ModelVocab.JOIN_SAFE_CARDINALITY || {};
var manifest = CapabilityManifest.build();
var out = {
  tool: 'discover', runId: runId, schemaSource: model.source, schemaTables: (schema.tables || []).length,
  modelVersion: model.modelVersion, domain: model.domain,
  availableDomains: availableDomains,   // S1：多域发现（当前可能只有 production）
  entities: (model.entities || []).map(function (e) {
    return { name: e.name, label: e.label, table: e.table, key: e.key || [], properties: (e.properties || []).map(function (p) { return { name: p.name, label: p.label, column: p.column, type: p.type }; }) };
  }),
  dimensions: (model.dimensions || []).map(function (d) { return { name: d.name, label: d.label, table: d.table, column: d.column }; }),
  metrics: (model.metrics || []).map(function (m) { return { name: m.name, label: m.label, kind: (m.expression || {}).kind, format: m.format || null }; }),
  relationships: (model.relationships || []).map(function (r) {
    return { name: r.name, label: r.label, from: r.from, to: r.to, source: r.source, cardinality: r.cardinality || null, joinSafe: !!(r.source === 'confirmed' && safeCards[r.cardinality]) };
  }),
  capabilities: ReportSpec.capabilities(),
  // r10-B：能力清单升级——agentAvailable 名单=Agent 可安全使用；其余见 manifest 四层状态与证据
  capabilityManifest: manifest,
  agentAvailable: CapabilityManifest.agentAvailableNames()
};
writeJson(runDir + '/discover.json', out);
print('{"ok":true,"runId":"' + runId + '","result":"logs/agent/runs/' + runId + '/discover.json"}');
J('java.lang.System').exit(0);
