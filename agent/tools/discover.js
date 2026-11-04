// agent/tools/discover.js — fr-agent 工具层 verb: discover（零引擎，nashorn 快跑）
//   输出 logs/agent/discover.json：可用实体/维度/指标/关系（含 JOIN 安全）+ ReportSpec 能力清单。
//   Agent 只读这份结构化能力，不接触 Java 对象/CPT XML。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(ROOT + '/' + p)), 'UTF-8')); }
load(ROOT + '/lib/report_spec.js');
load(ROOT + '/semantic/model/vocab.js');
var model = JSON.parse(readUtf('models/production/model.json'));
var schemaName = 'schema_' + (model.source || 'atom_live_demo') + '.json';
var schema = JSON.parse(readUtf('data/' + schemaName));

var safeCards = ModelVocab.JOIN_SAFE_CARDINALITY || {};
var out = {
  tool: 'discover', schemaSource: model.source, schemaTables: (schema.tables || []).length,
  modelVersion: model.modelVersion, domain: model.domain,
  entities: (model.entities || []).map(function (e) {
    return { name: e.name, label: e.label, table: e.table, key: e.key || [], properties: (e.properties || []).map(function (p) { return { name: p.name, label: p.label, column: p.column, type: p.type }; }) };
  }),
  dimensions: (model.dimensions || []).map(function (d) { return { name: d.name, label: d.label, table: d.table, column: d.column }; }),
  metrics: (model.metrics || []).map(function (m) { return { name: m.name, label: m.label, kind: (m.expression || {}).kind, format: m.format || null }; }),
  relationships: (model.relationships || []).map(function (r) {
    return { name: r.name, label: r.label, from: r.from, to: r.to, source: r.source, cardinality: r.cardinality || null, joinSafe: !!(r.source === 'confirmed' && safeCards[r.cardinality]) };
  }),
  capabilities: ReportSpec.capabilities()
};
var dir = ROOT + '/logs/agent';
Files.createDirectories(Pth.get(dir));
var outPath = dir + '/discover.json';
Files.write(Pth.get(outPath), J('java.lang.String').valueOf(JSON.stringify(out, null, 1)).getBytes('UTF-8'));
print('{"ok":true,"result":"logs/agent/discover.json"}');
J('java.lang.System').exit(0);
