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
  // ISO 形态：月 01-12 日 01-31 时 00-23 分秒 00-59；拒 2026-99-99 / 29:80（形状对但日历错，审查轮 P2）。
  //   不引日期库、不做闰年/大小月精细校验——D2 由 java 生成标准戳，这里只是入参防御。
  var ISO_AT_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])([T ]([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]([01]\d|2[0-3]):?[0-5]\d)?)?$/;

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
      if (list == null) { E(e, 'REQUIRED', 'selection.' + k); return; }   // ADR §4：两者都必填（纯维度清单资产若真要支持，改 ADR 再改这里）
      if (!isArr(list) || !list.length) { E(e, 'BAD_' + k.toUpperCase(), 'selection.' + k); return; }
      if (list.some(function (x) { return termsOf([x])[0] == null; })) E(e, 'BAD_' + k.toUpperCase(), 'selection.' + k);
      if (list.some(function (x) { return isObj(x) && Object.keys(x).some(function (kk) { return !hasOwn(REF_KEYS, kk); }); })) E(e, 'ILLEGAL_REF_KEY', 'selection.' + k);
    });
    return e;
  }
  function auditGrain(ds) {
    var e = [];
    if (!isObj(ds.grain) || !isStr(ds.grain.description) || !ds.grain.description) { E(e, 'BAD_GRAIN', 'grain'); return e; }
    if (!isArr(ds.grain.keys) || !ds.grain.keys.length) { E(e, 'BAD_GRAIN', 'grain.keys'); return e; }
    var seen = Object.create(null);
    ds.grain.keys.forEach(function (k) { if (seen[k]) E(e, 'DUPLICATE_GRAIN_KEY', 'grain.keys'); seen[k] = 1; });
    var dims = termsOf(ds.selection && ds.selection.dimensions);
    ds.grain.keys.forEach(function (k) { if (dims.indexOf(k) < 0) E(e, 'GRAIN_NOT_IN_DIMENSIONS', 'grain.keys'); });
    return e;
  }
  function auditAsserts(ds) {
    var e = [];
    if (ds.asserts == null) return e;
    if (!isObj(ds.asserts) || !isArr(ds.asserts.fields)) { E(e, 'BAD_ASSERTS', 'asserts'); return e; }
    var seen = Object.create(null);
    ds.asserts.fields.forEach(function (f, i) {
      var p = 'asserts.fields[' + i + ']';
      if (!isObj(f) || !isStr(f.name) || !f.name) { E(e, 'BAD_ASSERTED_FIELD', p); return; }
      if (!isStr(f.role) || !hasOwn(FIELD_ROLES, f.role)) E(e, 'BAD_ASSERTED_ROLE', p);
      if (seen[f.name]) E(e, 'DUPLICATE_FIELD', 'asserts.fields');
      seen[f.name] = 1;
    });
    return e;
  }
  // 阶梯必须有门槛：draft=无承诺；validated=已有数据级证据；published=数据证据 + 业务确认。
  //   为什么：状态词若不自带门槛，"validated" 就成了免费广告（AGENTS 五态不混写）。
  //   门槛是"有指向真实产物的证据条目"，不是"我声称验证过"。
  // 证据条目必须是"绑定到本资产本版本"的记录，不是一句自报路径：
  //   {ref, datasetId, modelVersion, sourceRef, at} 全必填，且三个身份字段与本资产逐字相等。
  //   为什么：一条字符串路径可以是别人的采样、可以是旧版本的采样、也可以纯手打——"validated" 就又成了免费广告。
  //   分工（分层不破）：本层只判形状与绑定（纯函数，零 IO）；ref 指向的文件是否真实存在/类型是否对
  //   = 工具层职责（D2 的 assets validate/publish），由它产生这些记录而非接受 Agent 手填。
  function evidenceEntryOk(x, ds) {
    if (!isObj(x)) return 'SHAPE';
    var req = ['ref', 'datasetId', 'modelVersion', 'sourceRef', 'at'];
    for (var i = 0; i < req.length; i++) { if (!isStr(x[req[i]]) || !x[req[i]]) return 'MISSING_' + req[i].toUpperCase(); }
    if (!ISO_AT_RE.test(x.at)) return 'BAD_AT_FORMAT';
    if (x.datasetId !== ds.id) return 'DATASET_ID_MISMATCH';
    if (!isObj(ds.model) || x.modelVersion !== ds.model.modelVersion) return 'MODEL_VERSION_MISMATCH';
    if (!isObj(ds.source) || x.sourceRef !== ds.source.ref) return 'SOURCE_REF_MISMATCH';
    return null;
  }
  function dataEvidence(ds) {
    if (!isObj(ds) || !isObj(ds.validation)) return [];
    var out = [];
    ['samples', 'executions'].forEach(function (k) {
      if (!isArr(ds.validation[k])) return;
      ds.validation[k].forEach(function (x) { if (!evidenceEntryOk(x, ds)) out.push(x); });
    });
    return out;
  }
  // 被拒原因（供工具层与人读，不把"有证据"和"证据无效"混成同一个词）
  function evidenceProblems(ds) {
    var e = [];
    if (!isObj(ds)) return e;
    if (ds.validation != null && !isObj(ds.validation)) { e.push('BAD_VALIDATION@validation'); return e; }
    if (!isObj(ds.validation)) return e;
    var any = false;
    ['samples', 'executions'].forEach(function (k) {
      if (ds.validation[k] == null) return;
      if (!isArr(ds.validation[k])) { e.push('BAD_VALIDATION@validation.' + k); return; }
      ds.validation[k].forEach(function (x, i) {
        any = true;
        var why = evidenceEntryOk(x, ds);
        if (why) e.push('EVIDENCE_' + why + '@validation.' + k + '[' + i + ']');
      });
    });
    if (!any) e.push('EMPTY_VALIDATION@validation');
    return e;
  }
  // 统一规则（2026-11-09 审查轮 P1：validated 曾可混入无效证据，因为只数有效条目）：
  //   · 任何状态：给了证据条目就必须全部有效（形状+绑定+时间戳），draft 也不许藏垃圾
  //   · validated / published：还须至少一条有效证据（空/全无效都不算）
  //   · published：额外要求业务 review（阶梯单调 published ⊇ validated）
  function auditLifecycle(ds) {
    var e = [];
    if (ds.review != null && !isObj(ds.review)) E(e, 'BAD_REVIEW', 'review');
    evidenceProblems(ds).forEach(function (c) { if (c.indexOf('EMPTY_VALIDATION') !== 0) e.push(c); });
    var hasEvidence = dataEvidence(ds).length > 0;
    if (!hasEvidence && ds.status === 'validated') E(e, 'VALIDATED_WITHOUT_DATA_EVIDENCE', 'validation');
    if (!hasEvidence && ds.status === 'published') E(e, 'PUBLISHED_WITHOUT_DATA_EVIDENCE', 'validation');
    if (ds.status === 'published' && !(isObj(ds.review) && isStr(ds.review.by) && ds.review.by && isStr(ds.review.at) && ds.review.at)) E(e, 'PUBLISHED_WITHOUT_REVIEW', 'review');
    return e;
  }
  // 全量审计（纯函数，不改入参）
  function audit(ds, relPath) {
    if (!isObj(ds)) return ['INVALID_TYPE@spec'];
    return auditIdentity(ds, relPath).concat(auditRefs(ds), auditSelection(ds), auditGrain(ds), auditAsserts(ds), auditLifecycle(ds));
  }

  // 粒度声明 vs 实际 SQL 分组维（必须同序全等）——需要 SqlBuilder 产物，故由工具层/D2 与契约门调用。
  //   只检查"grain ⊆ dimensions"不够：dimensions=[a,b]、grain=[a] 时审计通过，但 SQL 按 (a,b) 分组，
  //   资产写的"一行代表什么"与实际不符——正是本项目最忌讳的静默口径漂移。
  function grainDrift(ds, groupDims) {
    var e = [];
    var g = isObj(ds) && isObj(ds.grain) ? ds.grain.keys : null;
    if (!isArr(g) || !isArr(groupDims)) { e.push('BAD_GRAIN@grain.keys'); return e; }
    if (g.length !== groupDims.length) { e.push('GRAIN_GROUPBY_LENGTH@grain.keys'); return e; }
    for (var i = 0; i < g.length; i++) if (g[i] !== groupDims[i]) { e.push('GRAIN_GROUPBY_ORDER@grain.keys[' + i + ']'); break; }
    return e;
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
  // 报表级范围键白名单（越界即拒，不静默覆盖资产结构选择）
  function scopeProblems(reportScope) {
    var e = [];
    if (reportScope == null) return e;
    if (!isObj(reportScope)) { e.push('INVALID_TYPE@reportScope'); return e; }
    Object.keys(reportScope).forEach(function (k) { if (!hasOwn(REPORT_SCOPE_KEYS, k)) e.push('ILLEGAL_SCOPE_KEY@' + k); });
    return e;
  }
  function toReportDataset(ds, reportScope) {
    var bad = scopeProblems(reportScope);
    if (bad.length) throw new Error('[DatasetDef] illegal report scope: ' + bad.join(', '));   // fail-closed：调用方须先过 scopeProblems
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
    dataEvidence: dataEvidence, evidenceProblems: evidenceProblems, grainDrift: grainDrift, scopeProblems: scopeProblems,
    auditIdentity: auditIdentity, auditRefs: auditRefs, auditSelection: auditSelection,
    auditGrain: auditGrain, auditAsserts: auditAsserts, auditLifecycle: auditLifecycle, audit: audit,
    bindDrift: bindDrift, selectionArgs: selectionArgs, toReportDataset: toReportDataset,
    columnsOf: columnsOf, assertsMatch: assertsMatch
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DatasetDef;
