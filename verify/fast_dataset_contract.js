// verify/fast_dataset_contract.js — D0 Dataset 契约验证器（零引擎、零连库；喂真 model.json + 真 schema 快照）
//   先造验证器（AGENTS 野心/ub-mode 纪律）：Dataset 契约不是文档主张，而是可运行断言——
//     ① 声明式资产能被**现有** SpecValidator 无错接受 → 不新建第二套报表校验器；
//     ② selection 能被**现有** SqlBuilder 消费出单语句只读 SQL → 不新增 SQL 生成路径；
//     ③ 列（fields）是**派生**的：资产若声明 asserts.fields，必须与 SqlBuilder 派生列逐项相等（含 role）；
//     ④ 资产自一致：id ↔ domain ↔ 文件路径 ↔ model 版本 ↔ schema 快照 五者绑定；
//     ⑤ 负控归属正确的门（不把责任记错对象）：
//          自由文本 query / 未知 dataset 键 → SpecValidator（lib/spec_validator.js:427、白名单 :77）
//          幽灵 entity/dimension/metric term → SqlBuilder UNKNOWN_REF（spec_validator 不管 term 存在性，实测）
//          报表级范围（dateRange/sort/topN）、越权 selection 键、伪造发布态、路径身份不符 → 本契约 audit
//   契约真相在 docs/architecture/dataset-contract.md；本文件只镜像其键集，改契约先改 ADR。
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
function hasCode(list, code, frag) { return codesOf(list).some(function (c) { return c.indexOf(code) === 0 && (!frag || c.indexOf(frag) >= 0); }); }

load(ROOT + '/lib/isodate.js');
load(ROOT + '/lib/report_spec.js');
load(ROOT + '/lib/spec_validator.js');
load(ROOT + '/semantic/model/vocab.js');        // sqlbuilder 引用 ModelVocab.JOIN_SAFE_CARDINALITY
load(ROOT + '/semantic/query/sqlbuilder.js');

var model = jt('models/production/model.json');
var ASSET = 'models/production/datasets/inspection_records.json';

// ---------- 契约常量（镜像 ADR §2/§3，唯一真相在文档） ----------
var SELECTION_KEYS = { entity: 1, dimensions: 1, metrics: 1, filters: 1 };
var REPORT_SCOPE_KEYS = { dateRange: 1, sort: 1, topN: 1 };   // 报表级关注点，写进资产即拒
var STATUSES = { draft: 1, validated: 1, published: 1, deprecated: 1 };
var ID_RE = /^[a-z][a-z0-9_]{1,40}\.[a-z][a-z0-9_]{1,60}$/;

// ---------- 组合规则（D3 Resolver 的契约前身：无新校验器、无新 SQL 路径） ----------
function toReportDataset(ds, reportScope) {
  var out = { kind: 'sql', connection: ds.source.connection };
  Object.keys(ds.selection).forEach(function (k) { out[k] = ds.selection[k]; });
  if (reportScope) Object.keys(reportScope).forEach(function (k) { out[k] = reportScope[k]; });
  return out;
}
function toReportSpec(ds, reportScope) {
  return {
    specVersion: '1', outName: 'contract_probe', report: { name: '契约探针' },
    dimensions: ds.selection.dimensions, metrics: ds.selection.metrics,
    dataset: toReportDataset(ds, reportScope),
    presentation: { type: 'table', showTotal: true }
  };
}
function termsOf(list) { return (list || []).map(function (x) { return typeof x === 'string' ? x : x.term; }); }
function buildSelection(ds) {
  return SqlBuilder.build(model, {
    entity: ds.selection.entity,
    dimensions: termsOf(ds.selection.dimensions),
    metrics: termsOf(ds.selection.metrics),
    filters: ds.selection.filters
  });
}
// 版本/数据源绑定（资产声明 vs 真实加载物；纯函数）
function bindDrift(ds) {
  var out = [];
  if (!ds.model || ds.model.modelVersion !== model.modelVersion) out.push('MODEL_VERSION_DRIFT@model.modelVersion');
  if (!ds.source || ds.source.ref !== model.source) out.push('SOURCE_REF_DRIFT@source.ref');
  return out;
}
// 资产静态审计（纯函数；返回 code@path 列表，不改入参）
function audit(ds, id, relPath) {
  var errs = [];
  function E(code, path) { errs.push(code + '@' + path); }
  if (ds.datasetVersion !== '1') E('BAD_VERSION', 'datasetVersion');
  if (typeof id !== 'string' || !ID_RE.test(id)) E('BAD_ID', 'id');
  if (!ds.domain) E('BAD_DOMAIN', 'domain');
  if (!ds.status || !STATUSES[ds.status]) E('BAD_STATUS', 'status');
  if (typeof id === 'string' && ID_RE.test(id) && ds.domain && id.split('.')[0] !== ds.domain) E('DOMAIN_ID_MISMATCH', 'domain');
  if (typeof id === 'string' && ID_RE.test(id) && ds.domain) {
    var want = 'models/' + ds.domain + '/datasets/' + id.split('.')[1] + '.json';
    if (relPath !== want) E('PATH_ID_MISMATCH', 'file');
  }
  if (!ds.source || ds.source.type !== 'database' || !ds.source.ref || !ds.source.connection) E('BAD_SOURCE', 'source');
  if (!ds.model || !ds.model.ref || !ds.model.modelVersion) E('BAD_MODEL_REF', 'model');
  if (!ds.selection || !ds.selection.entity) E('BAD_SELECTION', 'selection');
  if (ds.selection) {
    Object.keys(ds.selection).forEach(function (k) {
      if (!SELECTION_KEYS[k]) E(REPORT_SCOPE_KEYS[k] ? 'REPORT_SCOPE_IN_ASSET' : 'ILLEGAL_SELECTION_KEY', 'selection.' + k);
    });
    if (ds.selection.query != null) E('FREE_TEXT_SQL', 'selection.query');
  }
  if (ds.grain) {
    if (!Array.isArray(ds.grain.keys) || !ds.grain.keys.length) E('BAD_GRAIN', 'grain.keys');
    else {
      var seen = {};
      ds.grain.keys.forEach(function (k) { if (seen[k]) E('DUPLICATE_GRAIN_KEY', 'grain.keys'); seen[k] = 1; });
      if (ds.selection && ds.grain.keys.some(function (k) { return termsOf(ds.selection.dimensions).indexOf(k) < 0; })) E('GRAIN_NOT_IN_DIMENSIONS', 'grain.keys');
    }
  }
  if (Array.isArray(ds.asserts && ds.asserts.fields)) {
    var s = {};
    ds.asserts.fields.forEach(function (f) {
      if (!f || !f.name) { E('BAD_ASSERTED_FIELD', 'asserts.fields'); return; }
      if (s[f.name]) E('DUPLICATE_FIELD', 'asserts.fields');
      s[f.name] = 1;
    });
  }
  if (ds.status === 'published' && !(ds.review && ds.review.by && ds.review.at)) E('PUBLISHED_WITHOUT_REVIEW', 'review');
  return errs;
}

// ============================ 1. 资产在位 + 自一致 ============================
check('资产存在：' + ASSET, exists(ASSET));
if (!exists(ASSET)) { print('DATASET CONTRACT ABORT: 资产未落地'); J('java.lang.System').exit(1); }
var ds = jt(ASSET);
var snap = JSON.stringify(ds);

check('契约审计零错（id/domain/status/source/model/selection/grain/asserts）', audit(ds, ds.id, ASSET).length === 0, audit(ds, ds.id, ASSET).join(', '));
check('id 稳定不依赖显示名', ID_RE.test(ds.id), ds.id);
check('路径↔身份绑定（不接受任意路径输入）', ASSET === 'models/' + ds.domain + '/datasets/' + ds.id.split('.')[1] + '.json');
check('source.ref = model.source（数据源单一真相）', ds.source.ref === model.source, ds.source.ref + ' vs ' + model.source);
check('model.modelVersion = 真模型版本（版本绑定可追溯）', ds.model.modelVersion === model.modelVersion);
check('schema 快照在位（结构事实先于资产）', exists('data/schema_' + model.source + '.json'));
check('绑定检查零漂移（版本/数据源对得上真实加载物）', bindDrift(ds).length === 0, JSON.stringify(bindDrift(ds)));
check('资产内无凭据面（password/jdbc: 零命中）', src(ASSET).indexOf('password') < 0 && src(ASSET).indexOf('jdbc:') < 0);
check('资产内无自由文本 SQL 键', src(ASSET).indexOf('"query"') < 0);

// ============================ 2. 可被现有 SpecValidator 接受 ============================
var rs = toReportSpec(ds);
var vErrs = SpecValidator.validate(rs);
check('Dataset 组合成 ReportSpec 后 errors=0', vErrs.length === 0, codesOf(vErrs).join(' | '));
var rsScope = toReportSpec(ds, { dateRange: { from: '2026-09-13', to: '2026-09-22' }, sort: [{ field: 'planned', dir: 'desc' }] });
check('报表侧补 dateRange/sort 后仍合法（范围归报表）', SpecValidator.validate(rsScope).length === 0, codesOf(SpecValidator.validate(rsScope)).join(' | '));

// ============================ 3. 可被现有 SqlBuilder 消费 + 列派生唯一真相 ============================
var built = buildSelection(ds);
check('SqlBuilder 可消费 selection（errors=0）', (built.errors || []).length === 0, codesOf(built.errors).join(' | '));
var derivedCols = (built.baseAliases || []).concat(built.derived || []);
check('派生列非空且维度在前', derivedCols.length >= 3 && derivedCols[0].alias === ds.selection.dimensions[0], JSON.stringify(derivedCols.map(function (c) { return c.alias; })));
check('列名唯一', Object.keys(derivedCols.reduce(function (m, c) { m[c.alias] = 1; return m; }, {})).length === derivedCols.length);
check('asserts.fields 与派生列逐项相等（含 role；列不得手写）',
  JSON.stringify((ds.asserts && ds.asserts.fields || []).map(function (f) { return f.name + ':' + f.role; })) === JSON.stringify(derivedCols.map(function (c) { return c.alias + ':' + c.role; })),
  JSON.stringify(derivedCols.map(function (c) { return c.alias + ':' + c.role; })));
check('grain.keys = 生成 SQL 的 GROUP BY 维（粒度不说谎）', JSON.stringify(ds.grain.keys) === JSON.stringify(built.groupDims), JSON.stringify(built.groupDims));
check('派生比率不进 SQL（展示层公式，README 既定口径）', built.sql.indexOf('completionRate') < 0, built.sql.slice(0, 160));
check('生成 SQL 单语句只读', !/;/.test(built.sql) && /^(SELECT|WITH)\b/i.test(built.sql));
check('SQL 不含 ${} 文本替换面', built.sql.indexOf('${') < 0);

// ============================ 4. term 全可回溯到结构画像（AGENTS §4） ============================
(function () {
  var ent = (model.entities || []).filter(function (e) { return e.name === ds.selection.entity; })[0];
  check('entity 在模型内', !!ent, ds.selection.entity);
  var dims = {}, mets = {};
  (model.dimensions || []).forEach(function (d) { dims[d.name] = d; });
  (model.metrics || []).forEach(function (m) { mets[m.name] = m; });
  check('dimensions 全部命中模型', termsOf(ds.selection.dimensions).filter(function (t) { return !dims[t]; }).length === 0);
  check('metrics 全部命中模型', termsOf(ds.selection.metrics).filter(function (t) { return !mets[t]; }).length === 0);
  if (!ent) return;
  var schema = jt('data/schema_' + model.source + '.json');
  var tb = (schema.tables || []).filter(function (t) { return t.name === ent.table; })[0];
  check('实体表在 schema 快照内', !!tb, ent.table);
  if (!tb) return;
  var cols = {}; (tb.columns || []).forEach(function (c) { cols[c.name] = 1; });
  var miss = termsOf(ds.selection.dimensions).filter(function (t) { return dims[t] && dims[t].table === ent.table; })
    .map(function (t) { return { t: t, col: String(dims[t].column).split('.').pop() }; })
    .filter(function (x) { return !cols[x.col]; }).map(function (x) { return x.t + '→' + x.col; });
  check('引用列全部可在结构画像中回溯', miss.length === 0, JSON.stringify(miss));
})();

// ============================ 5. 负控：每条都归正确的门 ============================
(function () {
  var bad;
  // —— SpecValidator 负责 ——
  bad = clone(ds); bad.selection.query = 'SELECT 1 FROM laser_aaa';
  check('负控·自由文本 SQL 被 SpecValidator 拒', hasCode(SpecValidator.validate(toReportSpec(bad)), 'UNSUPPORTED_CAPABILITY', 'dataset.query'), codesOf(SpecValidator.validate(toReportSpec(bad))).join(','));
  check('负控·自由文本 SQL 亦被契约 audit 拒', audit(bad, bad.id, ASSET).indexOf('FREE_TEXT_SQL@selection.query') >= 0);
  bad = clone(ds); bad.selection.ghostKey = 1;
  check('负控·越权 selection 键被拒', audit(bad, bad.id, ASSET).indexOf('ILLEGAL_SELECTION_KEY@selection.ghostKey') >= 0, audit(bad, bad.id, ASSET).join(','));
  bad = clone(ds); bad.selection.ghostColumn = 'x';
  check('负控·未知 dataset 键被 SpecValidator 拒（白名单真生效）',
    hasCode(SpecValidator.validate(toReportSpec(bad)), 'UNSUPPORTED_CAPABILITY', 'dataset.ghostColumn'),
    codesOf(SpecValidator.validate(toReportSpec(bad))).join(','));
  // —— SqlBuilder 负责（实测：spec_validator 不管 term 存在性） ——
  bad = clone(ds); bad.selection.metrics = ['planned', 'ghostMetric'];
  check('负控·幽灵指标被 SqlBuilder UNKNOWN_REF 拒', hasCode(buildSelection(bad).errors, 'UNKNOWN_REF', 'metrics'), JSON.stringify(buildSelection(bad).errors));
  bad = clone(ds); bad.selection.entity = 'GhostEntity';
  check('负控·幽灵实体被 SqlBuilder UNKNOWN_REF 拒', hasCode(buildSelection(bad).errors, 'UNKNOWN_REF', 'entity'));
  bad = clone(ds); bad.selection.dimensions = ['ghostDim'];
  check('负控·幽灵维度被 SqlBuilder UNKNOWN_REF 拒', hasCode(buildSelection(bad).errors, 'UNKNOWN_REF', 'dimensions'));
  // —— 本契约 audit 负责（新增规则，明确标注不来自 validator） ——
  bad = clone(ds); bad.selection.dateRange = { from: '2026-09-13', to: '2026-09-22' };
  check('负控·报表级范围写进资产被拒（契约规则，非 validator 行为）', audit(bad, bad.id, ASSET).indexOf('REPORT_SCOPE_IN_ASSET@selection.dateRange') >= 0, audit(bad, bad.id, ASSET).join(','));
  bad = clone(ds); bad.status = 'published'; delete bad.review;
  check('负控·无业务确认不得发布（Agent 不得自确认口径）', audit(bad, bad.id, ASSET).indexOf('PUBLISHED_WITHOUT_REVIEW@review') >= 0);
  bad = clone(ds); bad.id = 'sales.other';
  check('负控·id 与 domain/路径不符即拒', audit(bad, bad.id, ASSET).length >= 2, audit(bad, bad.id, ASSET).join(','));
  bad = clone(ds); bad.asserts = { fields: [{ name: 'planned', role: 'metric' }, { name: 'planned', role: 'metric' }] };
  check('负控·重复列名被拒', audit(bad, bad.id, ASSET).indexOf('DUPLICATE_FIELD@asserts.fields') >= 0);
  bad = clone(ds); bad.grain = { description: 'x', keys: ['ghostDim'] };
  check('负控·粒度键不在维度内被拒', audit(bad, bad.id, ASSET).indexOf('GRAIN_NOT_IN_DIMENSIONS@grain.keys') >= 0);
  bad = clone(ds); bad.model = { ref: 'models/production/model.json', modelVersion: '999' };
  check('负控·模型版本漂移被绑定检查拒（版本绑定不是装饰）', bindDrift(bad).length > 0, JSON.stringify(bindDrift(bad)));
  bad = clone(ds); bad.source = { type: 'database', ref: 'other_db', connection: ds.source.connection };
  check('负控·数据源与模型 source 不一致被绑定检查拒', bindDrift(bad).length > 0, JSON.stringify(bindDrift(bad)));
  // —— 纯函数纪律 ——
  check('audit 不改入参（可重复调用）', JSON.stringify(ds) === snap);
  check('确定序·同一资产两次审计全等', JSON.stringify(audit(ds, ds.id, ASSET)) === JSON.stringify(audit(ds, ds.id, ASSET)));
  check('确定序·同一资产两次 SQL 全等', buildSelection(ds).sql === buildSelection(ds).sql);
})();

// ============================ 6. 兼容：旧链路不回归（AGENTS §1） ============================
check('兼容·DATASET_KINDS 仍 rows|sql（未偷加 catalog kind）',
  JSON.stringify(Object.keys(ReportSpec.DATASET_KINDS).sort()) === '["rows","sql"]', JSON.stringify(Object.keys(ReportSpec.DATASET_KINDS)));
['examples/report-spec/daily_report_auto.json', 'examples/report-spec/cells_rowspan.json', 'examples/report-spec/daily_chart.sql.json'].forEach(function (f) {
  check('兼容·既有报表 spec 仍可校验 ' + f.split('/').pop(), SpecValidator.validate(jt(f)).length === 0, codesOf(SpecValidator.validate(jt(f))).join(' | '));
});
check('兼容·Dataset 资产目录未被报表 spec 读取路径引用（未改现有编译入口）',
  src('make_api.js').indexOf('datasets/') < 0 && src('lib/spec_compiler.js').indexOf('datasets/') < 0);

// ============================ 7. 门守门：新套件必须被登记 ============================
check('本套件已登记进 fast 聚合门（run-fast-tests）', src('scripts/run-fast-tests.ps1').indexOf('fast_dataset_contract.js') >= 0);
check('本套件自身可解析（语法门）', (function () { try { new Function(src('verify/fast_dataset_contract.js')); return true; } catch (e) { print('' + e); return false; } })());
check('资产契约 ADR 在位', exists('docs/architecture/dataset-contract.md'));

print('DATASET CONTRACT END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
