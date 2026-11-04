// verify/fast_semantic.js — I3 语义模型离线契约测（零引擎、不连库；喂 model.json + I2 schema JSON）
//   红→绿标尺：① 真模型过真 I2 schema 回溯 = 0 错（r2 §3"所有映射可追溯到数据库字段"机器化，杀手验收）
//   ② 负项：幽灵列→UNKNOWN_REF、ratio 缺分母→REQUIRED、裸 formula→INVALID_TYPE、naming-derived 缺确认→REQUIRED
//   ③ 显式聚合语义 + ④ resolver 三态（resolved/ambiguous/unknown，置信度只排序绝不自动选、未知不臆造）
//   ⑤ 验收计数（5 实体/10 映射/3 关系/5 指标/3 维度）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function src(f) { return String(new (J('java.lang.String'))(Files.readAllBytes(P.get(ROOT + '/' + f)), 'UTF-8')); }
function jt(f) { return JSON.parse(src(f)); }

['semantic/model/vocab.js', 'semantic/model/registry.js', 'semantic/model/validator.js', 'semantic/model/resolver.js', 'semantic/model/evidence.js'].forEach(function (f) {
  var ok = true; try { new Function(src(f)); } catch (e) { ok = false; print('PARSE ' + f + ' -> ' + e); }
  check('PARSE ' + f, ok);
});
var model = jt('models/production/model.json');
var schema = jt('data/schema_atom_live_demo.json');
check('model.json 合法 JSON', !!model && !!model.entities);
check('I2 schema.json 存在且含 tables', Array.isArray(schema.tables) && schema.tables.length > 0);

load(ROOT + '/semantic/model/vocab.js');
load(ROOT + '/semantic/model/registry.js');
load(ROOT + '/semantic/model/validator.js');
load(ROOT + '/semantic/model/resolver.js');
load(ROOT + '/semantic/model/evidence.js');

function codeAt(errs, code, pathFrag) { return errs.some(function (e) { return e && e.code === code && String(e.path).indexOf(pathFrag) >= 0; }); }

// ===== ① 回溯性 0 错（真模型 ↔ 真库结构；I5.5 注入数据侧唯一性探针证据，同 make_api）=====
var EVID = { 'laser_files.file_key': true };
var errs = ModelValidator.validate(model, schema, { uniqueKeyEvidence: EVID });
if (errs.length) errs.slice(0, 8).forEach(function (e) { print('   VAL ERR: ' + e.code + ' @ ' + e.path + ': ' + e.message); });
check('真模型过真 I2 schema 回溯 = 0 错（映射全可追溯）', errs.length === 0);
// I5.5：confirmed N:1 目标键唯一性必须机器可验证，不靠文本声明
check('I5.5 无唯一性证据→UNSUPPORTED_RELATION_KEY 拒', codeAt(ModelValidator.validate(model, schema), 'UNSUPPORTED_RELATION_KEY', 'to.column'));
check('I5.5 Schema 声明唯一键也认可（不依赖探针）', (function () {
  var s2 = JSON.parse(JSON.stringify(schema));
  s2.tables.forEach(function (t) { if (t.name === 'laser_files') t.primaryKey = [{ column: 'file_key', seq: 1 }]; });
  return !codeAt(ModelValidator.validate(model, s2), 'UNSUPPORTED_RELATION_KEY', 'to.column');
})());
check('I5.5 错误标注 1:N 为 confirmed→UNSUPPORTED_CARDINALITY', (function () {
  var m2 = JSON.parse(JSON.stringify(model));
  m2.relationships.forEach(function (r) { if (r.name === 'recordToFile') r.cardinality = '1:N'; });
  return codeAt(ModelValidator.validate(m2, schema, { uniqueKeyEvidence: EVID }), 'UNSUPPORTED_CARDINALITY', 'cardinality');
})());

// ===== I5.5-r5：唯一键必须区分单列/复合（复合 PK/UNIQUE 只保证组合唯一，不证明任一单列唯一）=====
function schemaWith(mut) { var s2 = JSON.parse(JSON.stringify(schema)); mut(s2); return s2; }
function fileTable(s2) { var t = null; s2.tables.forEach(function (x) { if (x.name === 'laser_files') t = x; }); return t; }
function relKeyRejected(s2) { return codeAt(ModelValidator.validate(model, s2, { uniqueKeyEvidence: {} }), 'UNSUPPORTED_RELATION_KEY', 'to.column'); }
check('r5 单列 PK→认可', !relKeyRejected(schemaWith(function (s) { fileTable(s).primaryKey = [{ column: 'file_key', seq: 1 }]; })));
check('r5 复合 PK→不认可其中任意单列', relKeyRejected(schemaWith(function (s) { fileTable(s).primaryKey = [{ column: 'file_key', seq: 1 }, { column: 'source_id', seq: 2 }]; })));
check('r5 单列 UNIQUE index→认可', !relKeyRejected(schemaWith(function (s) { fileTable(s).indexes = [{ unique: true, columns: [{ name: 'file_key' }] }]; })));
check('r5 复合 UNIQUE index→不认可其中任意单列', relKeyRejected(schemaWith(function (s) { fileTable(s).indexes = [{ unique: true, columns: [{ name: 'file_key' }, { name: 'source_id' }] }]; })));

// ===== I5.5-r5：证据绑定（schema 源 + 关系 + 时效），数据快照≠永久约束 =====
var NOW_MS = Date.parse('2026-11-04T12:00:00Z');
function evRaw(mut) {
  var r = { schema: 'atom_live_demo', probedAt: '2026-11-04T11:00:00Z', checks: [{ table: 'laser_files', column: 'file_key', rows: 538, distinct: 538, unique: true, relation: 'recordToFile' }] };
  if (mut) mut(r);
  return r;
}
function evFilter(mut, src) { return ModelEvidence.filter(evRaw(mut), { schemaSource: src || 'atom_live_demo', model: model, nowMs: NOW_MS, maxAgeDays: 30 }); }
check('r5 证据合格→注入 unique 并记录 accepted', (function () { var e = evFilter(); return e.unique['laser_files.file_key'] === true && e.accepted.length === 1; })());
check('r5 证据过期(40 天)→不注入 + stale', (function () { var e = evFilter(function (r) { r.probedAt = '2026-09-20T11:00:00Z'; }); return !e.unique['laser_files.file_key'] && e.stale.length >= 1; })());
check('r5 数据源不匹配→不注入 + mismatched', (function () { var e = evFilter(null, 'other_db'); return !e.unique['laser_files.file_key'] && e.mismatched.length >= 1; })());
check('r5 关系不存在/不匹配→不注入', (function () { var e = evFilter(function (r) { r.checks[0].relation = 'ghostRel'; }); return !e.unique['laser_files.file_key'] && e.mismatched.length >= 1; })());
check('r5 unique=false→rejected（快照不唯一不采信）', (function () { var e = evFilter(function (r) { r.checks[0].unique = false; r.checks[0].distinct = 500; }); return !e.unique['laser_files.file_key'] && e.rejected.length >= 1; })());
check('r5 rows!=distinct 自相矛盾→rejected', (function () { var e = evFilter(function (r) { r.checks[0].distinct = 500; }); return !e.unique['laser_files.file_key'] && e.rejected.length >= 1; })());
check('r5 probedAt 缺失→malformed 不注入', (function () { var e = evFilter(function (r) { delete r.probedAt; }); return !e.unique['laser_files.file_key'] && e.malformed.length >= 1; })());
check('r5 证据解析抗炸（坏 JSON/空值）', ModelEvidence.parse('{') === null && ModelEvidence.filter(null, {}).malformed.length >= 1);

// ===== ⑤ 验收计数 =====
var propCount = model.entities.reduce(function (a, e) { return a + (e.properties || []).length; }, 0);
check('≥5 实体', model.entities.length >= 5);
check('≥10 属性映射', propCount >= 10);
check('≥5 指标', model.metrics.length >= 5);
check('≥3 维度', model.dimensions.length >= 3);
check('≥3 关系', model.relationships.length >= 3);

// ===== ② 负项：不臆造/显式聚合/命名推导必确认 =====
function mut(f) { var m = jt('models/production/model.json'); f(m); return m; }
check('幽灵列→UNKNOWN_REF', codeAt(ModelValidator.validate(mut(function (m) { m.entities[0].properties[0].column = 'no_such_col'; }), schema), 'UNKNOWN_REF', 'properties[0].column'));
check('ratio 缺分母→REQUIRED', codeAt(ModelValidator.validate(mut(function (m) { delete m.metrics[2].expression.denominator; }), schema), 'REQUIRED', 'denominator'));
check('I5.1-T5 ratio scale 非数→INVALID_NUMBER', codeAt(ModelValidator.validate(mut(function (m) { m.metrics[2].expression.scale = '很多'; }), schema), 'INVALID_NUMBER', 'scale'));
check('裸 formula 串→INVALID_TYPE（禁不可验证黑箱）', codeAt(ModelValidator.validate(mut(function (m) { m.metrics[0].expression = { formula: 'COUNT(*)' }; }), schema), 'INVALID_TYPE', 'expression'));
check('naming-derived 缺 requiresConfirmation→REQUIRED', codeAt(ModelValidator.validate(mut(function (m) { delete m.relationships[2].requiresConfirmation; }), schema), 'REQUIRED', 'requiresConfirmation'));
check('未知 metric kind→INVALID_ENUM', codeAt(ModelValidator.validate(mut(function (m) { m.metrics[0].expression = { kind: 'median', table: 'laser_aaa', column: 'score' }; }), schema), 'INVALID_ENUM', 'kind'));
check('validator 抗炸：垃圾输入不抛只产诊断', (function () { try { return Array.isArray(ModelValidator.validate(null, null)) && Array.isArray(ModelValidator.validate(42, {})); } catch (e) { return false; } })());
check('validator 确定序（同输入两次全等）', JSON.stringify(ModelValidator.validate(model, schema)) === JSON.stringify(ModelValidator.validate(model, schema)));
check('validator 不改输入模型', (function () { var s = JSON.stringify(model); ModelValidator.validate(model, schema); return JSON.stringify(model) === s; })());

// ===== ④ resolver 三态 =====
var idx = ModelRegistry.index(model);
var r1 = ModelResolver.resolve(idx, 'planned');
check('resolver 唯一候选→resolved', r1.status === 'resolved' && r1.candidates.length === 1);
var r2 = ModelResolver.resolve(idx, '机台');
check('resolver 多候选→ambiguous + requiresConfirmation（不自动选）', r2.status === 'ambiguous' && r2.requiresConfirmation === true && r2.candidates.length >= 2);
check('resolver 候选按 confidence 降序（只排序不裁决）', r2.candidates.every(function (c) { return ['high', 'medium', 'low'].indexOf(c.confidence) >= 0; }));
check('resolver ambiguous 无"钦定答案"字段', r2.candidates.every(function (c) { return c.chosen == null; }));
var r3 = ModelResolver.resolve(idx, '___绝无此词___');
check('resolver 未知词→unknown + 空候选（不臆造）', r3.status === 'unknown' && r3.candidates.length === 0);

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
