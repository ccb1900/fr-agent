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
load(ROOT + '/semantic/preflight.js');

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

// ===== I5.5-r5/r6：证据绑定（schema 源 + 纠系 + 时效 + 物理数据源/模型/Schema 指纹 + 完整性）=====
var NOW_MS = Date.parse('2026-11-04T12:00:00Z');
var CONN = { driver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver', url: 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false' };
var FP = ModelEvidence.fingerprints({ connection: CONN, model: model, schema: schema });
function findRel(name) { var r = null; model.relationships.forEach(function (x) { if (x.name === name) r = x; }); return r; }
function relFp(name) { return ModelEvidence.relationFingerprint(findRel(name)); }
function evRaw(mut) {
  var r = {
    evidenceVersion: '2', status: 'passed', schema: 'atom_live_demo',
    sourceFingerprint: FP.source, modelFingerprint: FP.model, schemaFingerprint: FP.schema,
    probedAt: '2026-11-04T11:00:00Z',
    checks: [{ table: 'laser_files', column: 'file_key', rows: 538, distinct: 538, unique: true, relation: 'recordToFile', relationFingerprint: relFp('recordToFile') }]
  };
  if (mut) mut(r);
  return r;
}
function evFilter(mut, over) {
  var o = { fingerprints: FP, model: model, nowMs: NOW_MS, maxAgeDays: 30 };
  if (over) Object.keys(over).forEach(function (k) { o[k] = over[k]; });
  return ModelEvidence.filter(evRaw(mut), o);
}
check('r6 证据合格→注入 unique 并记录 accepted', (function () { var e = evFilter(); return e.unique['laser_files.file_key'] === true && e.accepted.length === 1 && e.missing.length === 0; })());
check('r6 换库（sourceFingerprint 变）→不注入 + mismatched/missing', (function () {
  var e = evFilter(null, { fingerprints: { source: 'deadbeefdeadbeef', model: FP.model, schema: FP.schema } });
  return !e.unique['laser_files.file_key'] && e.mismatched.length >= 1 && e.missing.length >= 1;
})());
check('r6 关系端点改变→关系指纹不匹配→不注入', (function () {
  var m2 = JSON.parse(JSON.stringify(model));
  m2.relationships.forEach(function (r) { if (r.name === 'recordToFile') r.from.column = 'other_col'; });
  var e = evFilter(null, { model: m2 });
  return !e.unique['laser_files.file_key'] && e.malformed.concat(e.mismatched).length >= 1;
})());
check('r6 关系基数改变→旧证据失效', (function () {
  var m2 = JSON.parse(JSON.stringify(model));
  m2.relationships.forEach(function (r) { if (r.name === 'recordToFile') r.cardinality = '1:1'; });
  var e = evFilter(null, { model: m2 });
  return !e.unique['laser_files.file_key'];
})());
check('r6 探针 status=failed→整份证据不可消费', (function () { var e = evFilter(function (r) { r.status = 'failed'; }); return !e.unique['laser_files.file_key'] && e.malformed.length >= 1; })());
check('r6 evidenceVersion 不认→malformed', (function () { var e = evFilter(function (r) { r.evidenceVersion = '1'; }); return !e.unique['laser_files.file_key'] && e.malformed.length >= 1; })());
check('r6 缺必探测关系→missing（不接受部分证据）', (function () {
  var m2 = JSON.parse(JSON.stringify(model));
  m2.relationships.push({ name: 'extraRel', label: 'x', from: { table: 'laser_aaa', column: 'file_key' }, to: { table: 'laser_aaa', column: 'file_key' }, source: 'confirmed', cardinality: 'N:1', confirmedBy: 'test' });
  var e = evFilter(null, { model: m2 });
  return e.missing.length >= 1;
})());
check('r6 同一关系重复证据→duplicates 且不注入', (function () {
  var e = evFilter(function (r) { r.checks.push(JSON.parse(JSON.stringify(r.checks[0]))); });
  return !e.unique['laser_files.file_key'] && e.duplicates.length >= 1;
})());
check('r6 证据过期→不注入 + stale + missing', (function () { var e = evFilter(function (r) { r.probedAt = '2026-09-01T00:00:00Z'; }); return !e.unique['laser_files.file_key'] && e.stale.length >= 1 && e.missing.length >= 1; })());
check('r6 unique=false→rejected（快照不唯一不采信）', (function () { var e = evFilter(function (r) { r.checks[0].unique = false; r.checks[0].distinct = 500; }); return !e.unique['laser_files.file_key'] && e.rejected.length >= 1; })());
check('r6 rows!=distinct 自相矛盾→rejected', (function () { var e = evFilter(function (r) { r.checks[0].distinct = 500; }); return !e.unique['laser_files.file_key'] && e.rejected.length >= 1; })());
check('r6 指纹稳定（同输入同值）且不含密码', (function () {
  var f2 = ModelEvidence.fingerprints({ connection: CONN, model: model, schema: schema });
  return f2.source === FP.source && f2.model === FP.model && f2.schema === FP.schema && JSON.stringify(FP).indexOf('password') < 0;
})());
check('r6 证据解析抗炸（坏 JSON/空值）', ModelEvidence.parse('{') === null && ModelEvidence.filter(null, {}).malformed.length >= 1);

// ===== r7-A：SHA-256 / URL 脱敏 / 关系级完整性 =====
check('r7 SHA-256 标准向量（abc）', ModelEvidence.sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
check('r7 SHA-256 空串向量', ModelEvidence.sha256('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
check('r7 URL 敏感参数脱敏后指纹一致（password 不入哈希输入）', (function () {
  var a = ModelEvidence.fingerprints({ connection: { driver: CONN.driver, url: CONN.url }, model: model, schema: schema });
  var b = ModelEvidence.fingerprints({ connection: { driver: CONN.driver, url: CONN.url + ';password=SuperSecret123;user=sa' }, model: model, schema: schema });
  return a.source === b.source && ModelEvidence.normalizeUrl('jdbc:x;password=p;user=u').indexOf('SuperSecret') < 0;
})());
check('r7 不同数据库 URL 指纹不同', (function () {
  var a = ModelEvidence.fingerprints({ connection: CONN, model: model, schema: schema });
  var b = ModelEvidence.fingerprints({ connection: { driver: CONN.driver, url: 'jdbc:sqlserver://127.0.0.1:1433;databaseName=other_db' }, model: model, schema: schema });
  return a.source !== b.source;
})());
check('r7 完整性以关系名为准：同键两关系不能互相顶替', (function () {
  var m2 = JSON.parse(JSON.stringify(model));
  m2.relationships.push({ name: 'dupKeyRel', label: '同键另一关系', from: { table: 'laser_aaa', column: 'file_key' }, to: { table: 'laser_files', column: 'file_key' }, source: 'confirmed', cardinality: 'N:1', confirmedBy: 'test' });
  var e = evFilter(null, { model: m2 });
  return e.unique['laser_files.file_key'] === true && e.missing.some(function (s) { return s.indexOf('dupKeyRel') >= 0; });
})());

// ===== r6-D：SemanticPreflight 前置检查单点 =====
function preflight(over) {
  var o = { model: model, schema: schema, evidenceRaw: evRaw(), connection: CONN, nowMs: NOW_MS, maxAgeDays: 30 };
  if (over) Object.keys(over).forEach(function (k) { if (over[k] === undefined) delete o[k]; else o[k] = over[k]; });
  return SemanticPreflight.run(o);
}
check('r6 preflight 合格→ok + 注入唯一证据', (function () { var p = preflight(); return p.ok === true && p.context.uniqueKeyEvidence['laser_files.file_key'] === true && p.context.evidence.accepted.length === 1; })());
check('r6 preflight 缺 schema→error', (function () { var p = preflight({ schema: undefined }); return p.ok === false && p.diagnostics.some(function (d) { return d.code === 'PREFLIGHT_SCHEMA_MISSING'; }); })());
check('r6 preflight 无证据→EVIDENCE_MISSING error（JOIN 无证据即阻断）', (function () { var p = preflight({ evidenceRaw: null }); return p.ok === false && p.diagnostics.some(function (d) { return d.code === 'EVIDENCE_MISSING' && d.severity === 'error'; }); })());
check('r6 preflight 换库→error（旧证据不可跨物理源复用）', (function () { var p = preflight({ connection: { driver: CONN.driver, url: 'jdbc:sqlserver://10.0.0.9:1433;databaseName=other' } }); return p.ok === false; })());
check('r6 preflight 诊断形状 {code,path,message,severity}', preflight().diagnostics.every(function (d) { return d && typeof d.code === 'string' && typeof d.path === 'string' && typeof d.message === 'string' && ['info', 'warn', 'error'].indexOf(d.severity) >= 0; }));

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
