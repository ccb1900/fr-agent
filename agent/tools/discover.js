// agent/tools/discover.js — fr-agent 工具层 verb: discover（零引擎）；r10-A runId 化 + r10-B CapabilityManifest 接入
//   输出 runDir/discover.json：实体/维度/指标/关系（含 JOIN 安全）+ ReportSpec 能力 + **CapabilityManifest 四层能力状态**
//   （r10 P1：Agent 不会把仅完成对象挂接的功能宣传为已完整支持——agentAvailable=四层全 verified 才 true）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');
var runId = runIdOf();
var runDir = runDirOf(runId);
function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(ROOT + '/' + p)), 'UTF-8')); }
load(ROOT + '/lib/report_spec.js');
load(ROOT + '/semantic/model/vocab.js');
load(ROOT + '/application/capability_manifest.js');
var model = JSON.parse(readUtf('models/production/model.json'));
var schemaName = 'schema_' + (model.source || 'atom_live_demo') + '.json';
var schema = JSON.parse(readUtf('data/' + schemaName));

var safeCards = ModelVocab.JOIN_SAFE_CARDINALITY || {};
var manifest = CapabilityManifest.build();
var out = {
  tool: 'discover', runId: runId, schemaSource: model.source, schemaTables: (schema.tables || []).length,
  modelVersion: model.modelVersion, domain: model.domain,
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
