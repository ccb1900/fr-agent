// verify/fast_dataset_contract.js — Dataset 契约门（零引擎、零连库；喂真 model.json + 真 schema 快照）
//   先造验证器（AGENTS/ub-mode 纪律）：契约不是文档主张，而是可运行断言。
//   D1 起本套件**消费生产契约件** semantic/dataset/{definition,registry}.js —— 不在测试里复刻契约，
//   否则门只会自证。报表侧三道既有门按各自职责使用（不新建第二套校验器）：
//     SpecValidator = 键白名单/形状（lib/spec_validator.js:317 返回数组；:427 硬拒自由文本 query）
//     SqlBuilder    = term 存在性 UNKNOWN_REF（实测：spec_validator 不管 term）+ 只读单语句自检
//     ModelValidator/SemanticPreflight = 模型↔schema↔证据（编译期已跑，本套件不重造）
//   契约真相 = docs/architecture/dataset-contract.md；键集定义 = semantic/dataset/definition.js。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond, detail) {
  if (cond) print('CHECK PASS: ' + name);
  else { FAILS++; print('CHECK FAIL: ' + name + (detail == null ? '' : ' :: ' + detail)); }
}
function src(f) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(ROOT + '/' + f)), 'UTF-8')); }
function exists(f) { try { return Files.exists(Pth.get(ROOT + '/' + f)); } catch (e) { return false; } }
function jt(f) { return JSON.parse(src(f)); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function codesOf(list) { return (list || []).map(function (e) { return e.code + '@' + e.path; }); }
function hasCode(list, code, frag) {
  return (list || []).some(function (x) {
    var s = typeof x === 'string' ? x : x.code + '@' + x.path;
    return s.indexOf(code) === 0 && (!frag || s.indexOf(frag) >= 0);
  });
}
function throwsIt(fn) { try { fn(); return false; } catch (e) { return true; } }

load(ROOT + '/lib/isodate.js');
load(ROOT + '/lib/report_spec.js');
load(ROOT + '/lib/spec_validator.js');
load(ROOT + '/semantic/model/vocab.js');              // sqlbuilder 的 JOIN_SAFE_CARDINALITY 前置
load(ROOT + '/semantic/query/sqlbuilder.js');
load(ROOT + '/semantic/dataset/definition.js');
load(ROOT + '/semantic/dataset/registry.js');

var model = jt('models/production/model.json');
var ASSET = 'models/production/datasets/inspection_records.json';

// 契约规定的组合方式：资产给结构选择，报表给时间窗/排序（不新增校验、不新增 SQL 路径）
function toReportSpec(ds, reportScope) {
  return {
    specVersion: '1', outName: 'contract_probe', report: { name: '契约探针' },
    dimensions: ds.selection.dimensions, metrics: ds.selection.metrics,
    dataset: DatasetDef.toReportDataset(ds, reportScope),
    presentation: { type: 'table', showTotal: true }
  };
}
function buildOf(ds) { return SqlBuilder.build(model, DatasetDef.selectionArgs(ds)); }

// ============================ 0. 契约件在位且守边界（契约不寄生于测试） ============================
check('生产契约件在位：semantic/dataset/definition.js', exists('semantic/dataset/definition.js'));
check('生产索引件在位：semantic/dataset/registry.js', exists('semantic/dataset/registry.js'));
check('契约件零 Java 依赖（R7b 语义层红线）',
  src('semantic/dataset/definition.js').indexOf('Java.type') < 0 && src('semantic/dataset/registry.js').indexOf('Java.type') < 0);
check('契约件不触 FR 后端/激活链（R7a）', !/com\.fr\.|SimpleWork|ActivatorToolBox/.test(src('semantic/dataset/definition.js') + src('semantic/dataset/registry.js')));
check('契约件不引 IO（IO 归工具层，ADR §7）', !/java\.nio|Files\.|readAllBytes/.test(src('semantic/dataset/definition.js') + src('semantic/dataset/registry.js')));
check('契约选择键 ⊆ ReportSpec sql 白名单（−报表级−query）',
  ['entity', 'dimensions', 'metrics', 'filters'].every(function (k) { return DatasetDef.SELECTION_KEYS[k]; }) &&   // 每个键都另有正/负控，防"词表写了没测"

  ['dateRange', 'sort', 'topN'].every(function (k) { return DatasetDef.REPORT_SCOPE_KEYS[k] && !DatasetDef.SELECTION_KEYS[k]; }));

// ============================ 1. 资产在位 + 自一致（由生产契约件判定） ============================
check('资产存在：' + ASSET, exists(ASSET));
if (!exists(ASSET)) { print('DATASET CONTRACT ABORT: 资产未落地'); J('java.lang.System').exit(1); }
var ds = jt(ASSET), snap = JSON.stringify(ds);

check('契约审计零错（身份/引用/选择/粒度/断言/生命周期）', DatasetDef.audit(ds, ASSET).length === 0, JSON.stringify(DatasetDef.audit(ds, ASSET)));
check('绑定零漂移（版本与数据源对得上真实加载物）', DatasetDef.bindDrift(ds, model).length === 0, JSON.stringify(DatasetDef.bindDrift(ds, model)));
check('expectedPath = 真实路径（身份不接受任意路径输入）', DatasetDef.expectedPath(ds) === ASSET, DatasetDef.expectedPath(ds));
check('schema 快照在位（结构事实先于资产）', exists('data/schema_' + model.source + '.json'));
check('资产内无凭据面（password/jdbc: 零命中）', src(ASSET).indexOf('password') < 0 && src(ASSET).indexOf('jdbc:') < 0);
check('资产内无自由文本 SQL 键', src(ASSET).indexOf('"query"') < 0);

// ============================ 2. 可被现有 SpecValidator 接受 ============================
check('Dataset 组合成 ReportSpec 后 errors=0', SpecValidator.validate(toReportSpec(ds)).length === 0, codesOf(SpecValidator.validate(toReportSpec(ds))).join(' | '));
check('报表侧补 dateRange/sort 后仍合法（范围归报表）',
  SpecValidator.validate(toReportSpec(ds, { dateRange: { from: '2026-09-13', to: '2026-09-22' }, sort: [{ field: 'planned', dir: 'desc' }] })).length === 0,
  codesOf(SpecValidator.validate(toReportSpec(ds, { dateRange: { from: '2026-09-13', to: '2026-09-22' } }))).join(' | '));

// ============================ 3. 可被现有 SqlBuilder 消费 + 列派生是唯一真相 ============================
var built = buildOf(ds);
check('SqlBuilder 可消费 selection（errors=0）', (built.errors || []).length === 0, codesOf(built.errors).join(' | '));
var cols = DatasetDef.columnsOf(built);
check('派生列非空且维度在前', cols.length >= 3 && cols[0].name === ds.selection.dimensions[0], JSON.stringify(cols));
check('列名唯一', Object.keys(cols.reduce(function (m, c) { m[c.name] = 1; return m; }, {})).length === cols.length);
check('asserts.fields 与派生列逐项相等含 role（列只能断言，不能手写）', DatasetDef.assertsMatch(ds, cols).length === 0, JSON.stringify(cols));
check('grain.keys = 生成 SQL 的 GROUP BY 维（粒度不说谎）', JSON.stringify(ds.grain.keys) === JSON.stringify(built.groupDims), JSON.stringify(built.groupDims));
check('派生比率不进 SQL（展示层公式，README 既定口径）', built.sql.indexOf('completionRate') < 0, built.sql.slice(0, 150));
check('生成 SQL 单语句只读', !/;/.test(built.sql) && /^(SELECT|WITH)\b/i.test(built.sql));
check('SQL 不含 ${} 文本替换面', built.sql.indexOf('${') < 0);
check('确定序·同一资产两次 SQL 全等', buildOf(ds).sql === buildOf(ds).sql);

// ============================ 3b. 索引层行为（list/resolve/域/状态/重复 id） ============================
(function () {
  var reg = DatasetRegistry.build([{ relPath: ASSET, doc: ds }]);
  check('registry 索引零错误', reg.errors.length === 0, JSON.stringify(reg.errors));
  check('registry resolve(id) 命中且带回路径', !!reg.resolve(ds.id) && reg.resolve(ds.id).relPath === ASSET);
  check('registry domains 含 production', reg.domains().indexOf('production') >= 0, JSON.stringify(reg.domains()));
  check('registry byStatus(draft) 命中 1（资产如实为草稿）', reg.byStatus('production', 'draft').length === 1);
  check('registry byStatus(validated) 为空（未做数据验证就不占这个词）', reg.byStatus('production', 'validated').length === 0);
  check('registry byStatus(published) 为空（不虚报已发布）', reg.byStatus('production', 'published').length === 0);
  var dup = DatasetRegistry.build([{ relPath: ASSET, doc: ds }, { relPath: 'models/production/datasets/other.json', doc: clone(ds) }]);
  check('registry 同 id 不静默覆盖（检出 DUPLICATE_ID）', hasCode(dup.errors, 'DUPLICATE_ID'), JSON.stringify(dup.errors));
  check('registry 重复时保留先入者（行为确定）', dup.list.length === 1 && dup.resolve(ds.id).relPath === ASSET);
  var junk = DatasetRegistry.build([{ relPath: 'x.json', doc: null }, { relPath: 'y.json', doc: {} }]);
  check('registry 抗炸：坏输入只产诊断不抛', junk.errors.length === 2 && junk.list.length === 0, JSON.stringify(junk.errors));
  var unsorted = DatasetRegistry.build([
    { relPath: 'b.json', doc: { id: 'production.b', domain: 'production', status: 'draft' } },
    { relPath: 'a.json', doc: { id: 'production.a', domain: 'production', status: 'draft' } }
  ]);
  check('registry 确定序（list 与域内均按 id 升序）', unsorted.list[0].id === 'production.a' && unsorted.byDomain.production[0].id === 'production.a');
})();

// ============================ 4. term 全可回溯到结构画像（AGENTS §4） ============================
(function () {
  var ent = (model.entities || []).filter(function (e) { return e.name === ds.selection.entity; })[0];
  check('entity 在模型内', !!ent, ds.selection.entity);
  var dims = {}, mets = {};
  (model.dimensions || []).forEach(function (d) { dims[d.name] = d; });
  (model.metrics || []).forEach(function (m) { mets[m.name] = m; });
  check('dimensions 全部命中模型', DatasetDef.termsOf(ds.selection.dimensions).filter(function (t) { return !dims[t]; }).length === 0);
  check('metrics 全部命中模型', DatasetDef.termsOf(ds.selection.metrics).filter(function (t) { return !mets[t]; }).length === 0);
  if (!ent) return;
  var schema = jt('data/schema_' + model.source + '.json');
  var tb = (schema.tables || []).filter(function (t) { return t.name === ent.table; })[0];
  check('实体表在 schema 快照内', !!tb, ent.table);
  if (!tb) return;
  var scols = {}; (tb.columns || []).forEach(function (c) { scols[c.name] = 1; });
  var miss = DatasetDef.termsOf(ds.selection.dimensions).filter(function (t) { return dims[t] && dims[t].table === ent.table; })
    .map(function (t) { return { t: t, col: String(dims[t].column).split('.').pop() }; })
    .filter(function (x) { return !scols[x.col]; }).map(function (x) { return x.t + '→' + x.col; });
  check('引用列全部可在结构画像中回溯', miss.length === 0, JSON.stringify(miss));
})();

// ============================ 5. 负控：每条归正确的门 ============================
(function () {
  var bad;
  // —— 报表校验器负责 ——
  bad = clone(ds); bad.selection.query = 'SELECT 1 FROM laser_aaa';
  check('负控·自由文本 SQL 被 SpecValidator 拒', hasCode(SpecValidator.validate(toReportSpec(bad)), 'UNSUPPORTED_CAPABILITY', 'dataset.query'),
    codesOf(SpecValidator.validate(toReportSpec(bad))).join(','));
  check('负控·同一违规契约层也拒（纵深防御，不依赖单一门）', hasCode(DatasetDef.audit(bad, ASSET), 'FREE_TEXT_SQL', 'selection.query'), JSON.stringify(DatasetDef.audit(bad, ASSET)));
  bad = clone(ds); bad.selection.ghostColumn = 1;
  check('负控·未知 dataset 键被 SpecValidator 拒（白名单真生效）',
    hasCode(SpecValidator.validate(toReportSpec(bad)), 'UNSUPPORTED_CAPABILITY', 'dataset.ghostColumn'), codesOf(SpecValidator.validate(toReportSpec(bad))).join(','));
  // —— SqlBuilder 负责 ——
  bad = clone(ds); bad.selection.metrics = ['planned', 'ghostMetric'];
  check('负控·幽灵指标被 SqlBuilder UNKNOWN_REF 拒', hasCode(buildOf(bad).errors, 'UNKNOWN_REF', 'metrics'), JSON.stringify(buildOf(bad).errors));
  bad = clone(ds); bad.selection.entity = 'GhostEntity';
  check('负控·幽灵实体被 SqlBuilder UNKNOWN_REF 拒', hasCode(buildOf(bad).errors, 'UNKNOWN_REF', 'entity'));
  bad = clone(ds); bad.selection.dimensions = ['ghostDim'];
  check('负控·幽灵维度被 SqlBuilder UNKNOWN_REF 拒', hasCode(buildOf(bad).errors, 'UNKNOWN_REF', 'dimensions'));
  // —— 契约层负责（dateRange/sort 一条是 v1.1 新增裁定，非 validator 行为） ——
  bad = clone(ds); bad.selection.dateRange = { from: '2026-09-13', to: '2026-09-22' };
  check('负控·报表级范围烤进资产被拒（契约规则；实测 validator 不管它）',
    hasCode(DatasetDef.audit(bad, ASSET), 'REPORT_SCOPE_IN_ASSET', 'selection.dateRange'), JSON.stringify(DatasetDef.audit(bad, ASSET)));
  bad = clone(ds); bad.selection.sort = [{ field: 'planned' }];
  check('负控·排序烤进资产被拒', hasCode(DatasetDef.audit(bad, ASSET), 'REPORT_SCOPE_IN_ASSET', 'selection.sort'));
  bad = clone(ds); bad.selection.ghostKey = 1;
  check('负控·越权选择键被契约拒', hasCode(DatasetDef.audit(bad, ASSET), 'ILLEGAL_SELECTION_KEY', 'selection.ghostKey'));
  bad = clone(ds); bad.status = 'published'; delete bad.review;
  check('负控·无业务确认不得发布（Agent 不得自确认口径）', hasCode(DatasetDef.audit(bad, ASSET), 'PUBLISHED_WITHOUT_REVIEW', 'review'));
  bad = clone(ds); bad.id = 'sales.other';
  check('负控·id 与域/路径不符即拒（≥2 项）', DatasetDef.audit(bad, ASSET).length >= 2, JSON.stringify(DatasetDef.audit(bad, ASSET)));
  bad = clone(ds); bad.asserts = { fields: [{ name: 'planned', role: 'metric' }, { name: 'planned', role: 'metric' }] };
  check('负控·重复列名被拒', hasCode(DatasetDef.audit(bad, ASSET), 'DUPLICATE_FIELD', 'asserts.fields'));
  bad = clone(ds); bad.asserts = { fields: [{ name: 'planned', role: 'dimension' }] };
  check('负控·role 词表越界被拒（与 sqlbuilder role 同集）', hasCode(DatasetDef.audit(bad, ASSET), 'BAD_ASSERTED_ROLE'));
  bad = clone(ds); bad.grain = { description: 'x', keys: ['ghostDim'] };
  check('负控·粒度键不在维度内被拒', hasCode(DatasetDef.audit(bad, ASSET), 'GRAIN_NOT_IN_DIMENSIONS', 'grain.keys'));
  bad = clone(ds); bad.grain = { description: 'x', keys: ['bizDate', 'bizDate'] };
  check('负控·粒度键重复被拒', hasCode(DatasetDef.audit(bad, ASSET), 'DUPLICATE_GRAIN_KEY', 'grain.keys'));
  bad = clone(ds); bad.description = '';
  check('负控·缺业务说明被拒', hasCode(DatasetDef.audit(bad, ASSET), 'BAD_DESCRIPTION', 'description'));
  bad = clone(ds); bad.source = { type: 'file', ref: model.source, connection: 'X' };
  check('负控·v1 只允许 database 源', hasCode(DatasetDef.audit(bad, ASSET), 'BAD_SOURCE', 'source'));
  bad = clone(ds); bad.source = { type: 'database', ref: 'other_db', connection: ds.source.connection };
  check('负控·数据源与模型 source 不一致被绑定检查拒', DatasetDef.bindDrift(bad, model).length > 0, JSON.stringify(DatasetDef.bindDrift(bad, model)));
  bad = clone(ds); bad.model = { ref: ds.model.ref, modelVersion: '999' };
  check('负控·模型版本漂移被绑定检查拒（绑定不是装饰）', DatasetDef.bindDrift(bad, model).length > 0, JSON.stringify(DatasetDef.bindDrift(bad, model)));
  bad = clone(ds); bad.asserts = { fields: [{ name: 'ghostCol', role: 'metric' }] };
  check('负控·断言列与派生列不符被拒', DatasetDef.assertsMatch(bad, cols).length > 0);
  [null, undefined, 42, [], 'x', {}].forEach(function (junk, i) {
    check('抗炸·audit 垃圾输入只产诊断不抛（#' + i + '）', !throwsIt(function () { return Array.isArray(DatasetDef.audit(junk, ASSET)); }));
  });
  check('抗炸·bindDrift/columnsOf/assertsMatch/selectionArgs 垃圾输入不抛',
    !throwsIt(function () { DatasetDef.bindDrift(null, null); DatasetDef.columnsOf(null); DatasetDef.assertsMatch(null, null); DatasetDef.selectionArgs({}); }));
  check('资产如实为 draft（结构验证≠数据验证，不占 validated 这个词）', ds.status === 'draft' && DatasetDef.dataEvidence(ds).length === 0);
  bad = clone(ds); bad.status = 'validated';
  check('负控·validated 无数据证据即拒（阶梯不免费）', hasCode(DatasetDef.audit(bad, ASSET), 'VALIDATED_WITHOUT_DATA_EVIDENCE', 'validation'), JSON.stringify(DatasetDef.audit(bad, ASSET)));
  bad = clone(ds); bad.status = 'validated'; bad.validation = { samples: ['logs/agent/runs/x/sample.json'] };
  check('正控·补数据证据后 validated 可成立', DatasetDef.audit(bad, ASSET).length === 0, JSON.stringify(DatasetDef.audit(bad, ASSET)));
  bad = clone(ds); bad.status = 'published'; bad.validation = { samples: ['logs/agent/runs/x/sample.json'] };
  check('负控·published 缺业务确认仍拒（即使有数据证据）', hasCode(DatasetDef.audit(bad, ASSET), 'PUBLISHED_WITHOUT_REVIEW', 'review'));
  bad = clone(ds); bad.status = 'published'; bad.review = { by: '业务负责人', at: '2026-11-09' };
  check('负控·published 缺数据证据亦拒（阶梯单调：published ⊇ validated）', hasCode(DatasetDef.audit(bad, ASSET), 'PUBLISHED_WITHOUT_DATA_EVIDENCE', 'validation'));
  bad = clone(ds); bad.validation = 'validated by me';
  check('负控·validation 形状非法被拒', hasCode(DatasetDef.audit(bad, ASSET), 'BAD_VALIDATION', 'validation'));
  // filters 是契约允许键：正负都测（否则删掉 SELECTION_KEYS.filters 也不会红）
  bad = clone(ds); bad.selection.filters = [{ field: 'stage', op: 'like', value: 'L' }];
  check('正控·filters 属合法选择键且可组合可消费',
    DatasetDef.audit(bad, ASSET).length === 0 && SpecValidator.validate(toReportSpec(bad)).length === 0 && (buildOf(bad).errors || []).length === 0,
    JSON.stringify(DatasetDef.audit(bad, ASSET)) + JSON.stringify(buildOf(bad).errors) + codesOf(SpecValidator.validate(toReportSpec(bad))).join(','));
  check('正控·filters 真进 WHERE（不是被静默丢弃）', /LIKE/i.test(buildOf(bad).sql), buildOf(bad).sql.slice(0, 200));
  bad = clone(ds); bad.selection.filters = [{ field: 'stage', op: '>=', value: 'L' }];
  check('负控·非法 filter op 由 SqlBuilder 拒（契约不放松既有闸）', hasCode(buildOf(bad).errors, 'INVALID_ENUM', 'filters[0].op'), JSON.stringify(buildOf(bad).errors));
  bad = clone(ds); bad.selection.filters = [{ field: 'ghostCol', op: '=', value: 1 }];
  check('负控·幽灵 filter 字段被拒', hasCode(buildOf(bad).errors, 'UNKNOWN_REF', 'filters[0].field'));
  check('契约件纯函数·audit 不改入参', JSON.stringify(ds) === snap);
  check('确定序·同一资产两次审计全等', JSON.stringify(DatasetDef.audit(ds, ASSET)) === JSON.stringify(DatasetDef.audit(ds, ASSET)));
})();

// ============================ 6. 兼容：旧链路不回归（AGENTS §1） ============================
check('兼容·DATASET_KINDS 仍 rows|sql（未偷加 catalog kind）',
  JSON.stringify(Object.keys(ReportSpec.DATASET_KINDS).sort()) === '["rows","sql"]', JSON.stringify(Object.keys(ReportSpec.DATASET_KINDS)));
['examples/report-spec/daily_report_auto.json', 'examples/report-spec/cells_rowspan.json', 'examples/report-spec/daily_chart.sql.json'].forEach(function (f) {
  check('兼容·既有报表 spec 仍可校验 ' + f.split('/').pop(), SpecValidator.validate(jt(f)).length === 0, codesOf(SpecValidator.validate(jt(f))).join(' | '));
});
check('兼容·现有装配入口未引用资产目录（make_api/spec_compiler 未被改）',
  src('make_api.js').indexOf('datasets/') < 0 && src('lib/spec_compiler.js').indexOf('datasets/') < 0);
check('兼容·Core/Runner 未反向依赖语义资产层（R1/R2/R7 方向不变）',
  !/semantic\/dataset/.test(src('lib/spec_compiler.js') + src('lib/ir.js') + src('make_api.js')));

// ============================ 7. 门守门（防"写了没登记"的既往教训） ============================
check('本套件已登记进 fast 聚合门（run-fast-tests）', src('scripts/run-fast-tests.ps1').indexOf('fast_dataset_contract.js') >= 0);
check('契约件已登记进 parse 白名单（产品文件）',
  src('verify/fast_parse.js').indexOf('semantic/dataset/definition.js') >= 0 && src('verify/fast_parse.js').indexOf('semantic/dataset/registry.js') >= 0);
check('本套件自身可解析（语法门）', (function () { try { new Function(src('verify/fast_dataset_contract.js')); return true; } catch (e) { print('' + e); return false; } })());
check('资产契约 ADR 在位', exists('docs/architecture/dataset-contract.md'));
check('实施规范在位（阶段表可核对）', exists('docs/architecture/dataset-semantic-plan.md'));

print('DATASET CONTRACT END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
