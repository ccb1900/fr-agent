// semantic/dataset/definition.js — Dataset 资产契约（纯 JS，零 Java/零 IO；R7a/R7b 语义层红线）
//   一处真相：契约键集、身份绑定、生命周期规则、组合规则只在这里定义；
//   verify/fast_dataset_contract.js 与未来 agent/tools/assets.js 都消费本文件（不在测试里复刻契约）。
//   契约文档 = docs/architecture/dataset-contract.md；本文件与其逐条对应，改契约先改 ADR。
//   边界：不做 IO（IO 属工具层 agent/tools/*，理由见 ADR §7），不引用 FineReport 引擎类，不加载后端三件。
var DatasetDef = (function () {
  var DATASET_VERSION = '1';
  // 选择键集 = ReportSpec sql 数据集白名单(lib/spec_validator.js:77) − 报表级键 − 被禁的 query
  var SELECTION_KEYS = { entity: 1, dimensions: 1, metrics: 1, filters: 1 };
  var REPORT_SCOPE_KEYS = { dateRange: 1, sort: 1, topN: 1 };   // 时间窗/排序/行数上限属报表
  var STATUSES = { draft: 1, validated: 1, published: 1, deprecated: 1 };
  var SOURCE_TYPES = { database: 1 };                            // rows 内嵌无外部真相，v1 不作资产
  var FIELD_ROLES = { dim: 1, metric: 1, derived: 1 };           // 与 sqlbuilder.js:165-166 role 同集
  var REF_KEYS = { term: 1, label: 1, widthPt: 1 };               // 与 spec_validator.js:73 REF_KEYS 同集
  var ID_RE = /^[a-z][a-z0-9_]{1,40}\.[a-z][a-z0-9_]{1,60}$/;

  function hasOwn(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function isStr(v) { return typeof v === 'string'; }
  function E(out, code, path) { out.push(code + '@' + path); }

  // ---------- 身份与寻址（不接受任意路径输入） ----------
  function domainOf(id) { return isStr(id) && ID_RE.test(id) ? id.split('.')[0] : null; }
  function nameOf(id) { return isStr(id) && ID_RE.test(id) ? id.split('.')[1] : null; }
  function expectedPath(ds) {
    var d = domainOf(ds && ds.id), n = nameOf(ds && ds.id);
    return d && n ? 'models/' + d + '/datasets/' + n + '.json' : null;
  }
  function termsOf(list) {
    return (list || []).map(function (x) { return isStr(x) ? x : (isObj(x) && isStr(x.term) ? x.term : null); });
  }

  // ---------- 分段审计（每段一职责，便于报错定位与后续复用） ----------
  function auditIdentity(ds, relPath) {
    var e = [];
    if (!isObj(ds)) { E(e, 'INVALID_TYPE', 'spec'); return e; }
    if (ds.datasetVersion !== DATASET_VERSION) E(e, 'BAD_VERSION', 'datasetVersion');
    if (!isStr(ds.id) || !ID_RE.test(ds.id)) E(e, 'BAD_ID', 'id');
    if (!isStr(ds.domain) || !ds.domain) E(e, 'BAD_DOMAIN', 'domain');
    if (!isStr(ds.name) || !ds.name) E(e, 'BAD_NAME', 'name');
    if (!isStr(ds.description) || !ds.description) E(e, 'BAD_DESCRIPTION', 'description');
    if (!isStr(ds.status) || !hasOwn(STATUSES, ds.status)) E(e, 'BAD_STATUS', 'status');
    var d = domainOf(ds.id);
    if (d && isStr(ds.domain) && d !== ds.domain) E(e, 'DOMAIN_ID_MISMATCH', 'domain');
    var want = expectedPath(ds);
    if (want && relPath != null && relPath !== want) E(e, 'PATH_ID_MISMATCH', 'file');
    return e;
  }
  function auditRefs(ds) {
    var e = [];
    if (!isObj(ds.source) || !hasOwn(SOURCE_TYPES, ds.source.type) || !isStr(ds.source.ref) || !ds.source.ref) E(e, 'BAD_SOURCE', 'source');
    if (!isStr(ds.source && ds.source.connection) || !ds.source.connection) E(e, 'BAD_CONNECTION_REF', 'source.connection');
    if (!isObj(ds.model) || !isStr(ds.model.ref) || !ds.model.ref) E(e, 'BAD_MODEL_REF', 'model.ref');
    if (!isStr(ds.model && ds.model.modelVersion) || !ds.model.modelVersion) E(e, 'BAD_MODEL_VERSION', 'model.modelVersion');
    return e;
  }
  function auditSelection(ds) {
    var e = [];
    if (!isObj(ds.selection)) { E(e, 'BAD_SELECTION', 'selection'); return e; }
    Object.keys(ds.selection).forEach(function (k) {
      if (hasOwn(SELECTION_KEYS, k)) return;
      E(e, hasOwn(REPORT_SCOPE_KEYS, k) ? 'REPORT_SCOPE_IN_ASSET' : 'ILLEGAL_SELECTION_KEY', 'selection.' + k);
    });
    if (hasOwn(ds.selection, 'query')) E(e, 'FREE_TEXT_SQL', 'selection.query');   // §5.2 自由文本 SQL 硬拒
    if (!isStr(ds.selection.entity) || !ds.selection.entity) E(e, 'BAD_ENTITY', 'selection.entity');
    ['dimensions', 'metrics'].forEach(function (k) {
      var list = ds.selection[k];
      if (list == null) { if (k === 'dimensions') E(e, 'REQUIRED', 'selection.dimensions'); return; }
      if (!isArr(list) || !list.length) { E(e, 'BAD_' + k.toUpperCase(), 'selection.' + k); return; }
      if (list.some(function (x) { return termsOf([x])[0] == null; })) E(e, 'BAD_' + k.toUpperCase(), 'selection.' + k);
      if (list.some(function (x) { return isObj(x) && Object.keys(x).some(function (kk) { return !hasOwn(REF_KEYS, kk); }); })) E(e, 'ILLEGAL_REF_KEY', 'selection.' + k);
    });
    if (isArr(ds.selection.dimensions) && termsOf(ds.selection.dimensions).some(function (t) { return t == null; })) E(e, 'BAD_DIMENSIONS', 'selection.dimensions');
    return e;
  }
  function auditGrain(ds) {
    var e = [];
    if (!isObj(ds.grain) || !isStr(ds.grain.description) || !ds.grain.description) { E(e, 'BAD_GRAIN', 'grain'); return e; }
    if (!isArr(ds.grain.keys) || !ds.grain.keys.length) { E(e, 'BAD_GRAIN', 'grain.keys'); return e; }
    var seen = {};
    ds.grain.keys.forEach(function (k) { if (seen[k]) E(e, 'DUPLICATE_GRAIN_KEY', 'grain.keys'); seen[k] = 1; });
    var dims = termsOf(ds.selection && ds.selection.dimensions);
    ds.grain.keys.forEach(function (k) { if (dims.indexOf(k) < 0) E(e, 'GRAIN_NOT_IN_DIMENSIONS', 'grain.keys'); });
    return e;
  }
  function auditAsserts(ds) {
    var e = [];
    if (ds.asserts == null) return e;
    if (!isObj(ds.asserts) || !isArr(ds.asserts.fields)) { E(e, 'BAD_ASSERTS', 'asserts'); return e; }
    var seen = {};
    ds.asserts.fields.forEach(function (f, i) {
      var p = 'asserts.fields[' + i + ']';
      if (!isObj(f) || !isStr(f.name) || !f.name) { E(e, 'BAD_ASSERTED_FIELD', p); return; }
      if (!isStr(f.role) || !hasOwn(FIELD_ROLES, f.role)) E(e, 'BAD_ASSERTED_ROLE', p);
      if (seen[f.name]) E(e, 'DUPLICATE_FIELD', 'asserts.fields');
      seen[f.name] = 1;
    });
    return e;
  }
  function auditLifecycle(ds) {
    var e = [];
    if (ds.status === 'published' && !(isObj(ds.review) && isStr(ds.review.by) && ds.review.by && isStr(ds.review.at) && ds.review.at)) E(e, 'PUBLISHED_WITHOUT_REVIEW', 'review');
    if (ds.review != null && !isObj(ds.review)) E(e, 'BAD_REVIEW', 'review');
    return e;
  }
  // 全量审计（纯函数，不改入参）
  function audit(ds, relPath) {
    if (!isObj(ds)) return ['INVALID_TYPE@spec'];
    return auditIdentity(ds, relPath).concat(auditRefs(ds), auditSelection(ds), auditGrain(ds), auditAsserts(ds), auditLifecycle(ds));
  }

  // ---------- 绑定：资产声明 vs 真实加载物（防口径漂移） ----------
  function bindDrift(ds, model) {
    var e = [];
    if (!isObj(model)) { E(e, 'MODEL_UNAVAILABLE', 'model'); return e; }
    if (!isObj(ds) || !isObj(ds.model) || ds.model.modelVersion !== model.modelVersion) E(e, 'MODEL_VERSION_DRIFT', 'model.modelVersion');
    if (!isObj(ds) || !isObj(ds.source) || ds.source.ref !== model.source) E(e, 'SOURCE_REF_DRIFT', 'source.ref');
    return e;
  }

  // ---------- 组合：Dataset → 现有 ReportSpec / SqlBuilder 入参（不新增校验与 SQL 路径） ----------
  function selectionArgs(ds) {
    var s = (isObj(ds) && ds.selection) || {};
    return { entity: s.entity, dimensions: termsOf(s.dimensions), metrics: termsOf(s.metrics), filters: s.filters };
  }
  function toReportDataset(ds, reportScope) {
    var out = { kind: 'sql', connection: ds.source.connection };
    Object.keys(ds.selection).forEach(function (k) { out[k] = ds.selection[k]; });
    if (isObj(reportScope)) Object.keys(reportScope).forEach(function (k) { out[k] = reportScope[k]; });
    return out;
  }
  // 列的唯一真相：SqlBuilder 派生结果（baseAliases:role=dim/metric + derived:role=derived）
  function columnsOf(built) {
    if (!isObj(built) || (built.errors && built.errors.length)) return [];   // 注意：空数组是真值，必须判 length
    return (built.baseAliases || []).concat(built.derived || []).map(function (c) { return { name: c.alias, role: c.role }; });
  }
  function assertsMatch(ds, columns) {
    if (!isObj(ds) || !isObj(ds.asserts) || !isArr(ds.asserts.fields)) return [];   // 未声明=不断言
    var a = ds.asserts.fields.map(function (f) { return f.name + ':' + f.role; });
    var b = (columns || []).map(function (c) { return c.name + ':' + c.role; });
    return JSON.stringify(a) === JSON.stringify(b) ? [] : ['ASSERTED_FIELDS_MISMATCH@asserts.fields'];
  }

  return {
    DATASET_VERSION: DATASET_VERSION, ID_RE: ID_RE,
    SELECTION_KEYS: SELECTION_KEYS, REPORT_SCOPE_KEYS: REPORT_SCOPE_KEYS,
    STATUSES: STATUSES, SOURCE_TYPES: SOURCE_TYPES, FIELD_ROLES: FIELD_ROLES,
    domainOf: domainOf, nameOf: nameOf, expectedPath: expectedPath, termsOf: termsOf,
    auditIdentity: auditIdentity, auditRefs: auditRefs, auditSelection: auditSelection,
    auditGrain: auditGrain, auditAsserts: auditAsserts, auditLifecycle: auditLifecycle, audit: audit,
    bindDrift: bindDrift, selectionArgs: selectionArgs, toReportDataset: toReportDataset,
    columnsOf: columnsOf, assertsMatch: assertsMatch
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DatasetDef;
