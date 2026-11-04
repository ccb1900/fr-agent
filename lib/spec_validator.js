// lib/spec_validator.js — I1（r2.md）ReportSpec 结构+语义校验（三职责之二：只查合法性，不产 IR）
//   契约完全沿用 I0-01 ir.js：错误 = {code, path(JSON 路径), message}；对任意坏输入只产诊断、绝不抛。
//   红线：本文件不被 ir.js 引用（现有 ir.js 不被 ReportSpec 逻辑污染，r2 §1.2）；单向依赖 ReportSpec 词表。
//   ES5：全 var + function；白名单查表 Object.prototype.hasOwnProperty.call；数值 isFinite 闸；对象拒数组。
var SpecValidator = (function () {
  function E(errs, code, path, message) { errs.push({ code: code, path: path, message: message }); }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isArr(v) { return Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isStr(v) { return typeof v === 'string'; }

  // outName 会被 runner 拼成 <outName>_api.cpt 落部署目录——禁路径分隔/穿越/盘符/控制符，
  //   落实 r2 §1.3 "不允许 Agent 指定任意文件系统输出位置"（目录由 BR_DEPLOYDIR env 控，spec 无权指路径）。
  var OUTNAME_BAD = /[\/\\:*?"<>|]|\.\.|[\r\n]/;

  function validate(rs) {
    var errs = [];
    if (!isObj(rs)) { E(errs, 'INVALID_TYPE', 'spec', 'ReportSpec must be an object'); return errs; }

    // 版本契约（ir.js 同纪律：认当前版、拒未知、缺省=当前版）
    if (rs.specVersion != null && String(rs.specVersion) !== ReportSpec.SPEC_VERSION) {
      E(errs, 'UNSUPPORTED_SPEC_VERSION', 'specVersion', 'unsupported specVersion "' + rs.specVersion + '"（本 backend 只识别 specVersion="' + ReportSpec.SPEC_VERSION + '"）');
      return errs;
    }

    // v1 明确拒的能力键（存在即报，指向应接管的迭代——不是静默忽略）
    if (hasOwn(rs, 'filters')) E(errs, 'UNSUPPORTED_CAPABILITY', 'filters', 'filters 暂不支持（' + ReportSpec.capabilities().filters + ' → ' + ReportSpec.REJECTED.filters + '）');
    if (hasOwn(rs, 'chart')) E(errs, 'UNSUPPORTED_CAPABILITY', 'chart', 'chart 暂不支持（' + ReportSpec.capabilities().chart + ' → ' + ReportSpec.REJECTED.chart + '）');

    // report（可选元信息；name 用作 IR title）
    if (rs.report != null) {
      if (!isObj(rs.report)) E(errs, 'INVALID_TYPE', 'report', 'report must be an object');
      else if (rs.report.name != null && !isStr(rs.report.name)) E(errs, 'INVALID_TYPE', 'report.name', 'report.name must be string');
    }

    // outName 必填 + 路径安全
    if (rs.outName == null) E(errs, 'REQUIRED', 'outName', 'outName is required');
    else if (!isStr(rs.outName)) E(errs, 'INVALID_TYPE', 'outName', 'outName must be a string');
    else if (rs.outName === '') E(errs, 'REQUIRED', 'outName', 'outName must not be empty');
    else if (OUTNAME_BAD.test(rs.outName)) E(errs, 'INVALID_PATH', 'outName', 'outName must be a bare file name (no path/.. /drive): ' + rs.outName);

    // ---- I5：SQL 数据集（模型驱动）形态 ----
    if (rs.dataset && isObj(rs.dataset) && rs.dataset.kind === 'sql') {
      var ds = rs.dataset;
      if (ds.query != null) E(errs, 'UNSUPPORTED_CAPABILITY', 'dataset.query', '禁自由文本 SQL（§5.2）；须用 model 维度/指标引用由 sqlbuilder 生成');
      if (!isStr(ds.entity) || !ds.entity) E(errs, 'REQUIRED', 'dataset.entity', 'sql 数据集需 entity（模型实体名）');
      if (!isStr(ds.connection) || !ds.connection) E(errs, 'REQUIRED', 'dataset.connection', 'sql 数据集需 connection（数据连接名，凭据不在此）');
      var anySel = false;
      ['dimensions', 'metrics'].forEach(function (key) {
        var arr = ds[key];
        if (arr == null) return;
        if (!isArr(arr) || !arr.length) { E(errs, 'INVALID_ARRAY', 'dataset.' + key, key + ' 须非空数组（模型维度/指标名）'); return; }
        anySel = anySel || arr.length > 0;
        arr.forEach(function (x, i) {
          var name = isStr(x) ? x : (isObj(x) ? x.term : null);
          if (!isStr(name) || !name) E(errs, 'REQUIRED', 'dataset.' + key + '[' + i + ']', '须为模型 ' + key + ' 名（字符串或 {term}）');
        });
      });
      if (!anySel) E(errs, 'REQUIRED', 'dataset', 'sql 数据集至少选一个维度或指标');
      if (ds.dateRange != null) {
        var dr = IsoDate.range(ds.dateRange);   // I5.1 P4 单点：严格双边 + 日历有效性 + from<=to（与 sqlbuilder 同一真相）
        dr.errors.forEach(function (e) { E(errs, e.code, 'dataset.' + e.path, e.message); });
      }
      return errs;
    }

    // dimensions（分组键，恒 text）
    if (!hasOwn(rs, 'dimensions')) E(errs, 'REQUIRED', 'dimensions', 'dimensions is required');
    else if (!isArr(rs.dimensions)) E(errs, 'INVALID_ARRAY', 'dimensions', 'dimensions must be an array');
    else if (!rs.dimensions.length) E(errs, 'REQUIRED', 'dimensions', 'dimensions must not be empty');
    else rs.dimensions.forEach(function (d, i) {
      var dp = 'dimensions[' + i + ']';
      if (!isObj(d)) { E(errs, 'INVALID_TYPE', dp, 'dimension must be an object'); return; }
      if (!isStr(d.field) || d.field === '') E(errs, 'REQUIRED', dp + '.field', 'dimension.field required (non-empty string)');
      if (!isStr(d.label) || d.label === '') E(errs, 'REQUIRED', dp + '.label', 'dimension.label required');
      if (d.aggregation != null) E(errs, 'INVALID_ENUM', dp + '.aggregation', 'dimension must not carry aggregation（分组键非度量）');
      if (d.widthPt != null && !isNum(d.widthPt)) E(errs, 'INVALID_NUMBER', dp + '.widthPt', 'widthPt must be a finite number');
      if (d.format != null && !isStr(d.format)) E(errs, 'INVALID_TYPE', dp + '.format', 'format must be string');
    });

    // metrics（度量，aggregation v1=sum-only）
    if (!hasOwn(rs, 'metrics')) E(errs, 'REQUIRED', 'metrics', 'metrics is required');
    else if (!isArr(rs.metrics)) E(errs, 'INVALID_ARRAY', 'metrics', 'metrics must be an array');
    else if (!rs.metrics.length) E(errs, 'REQUIRED', 'metrics', 'metrics must not be empty');
    else rs.metrics.forEach(function (m, i) {
      var mp = 'metrics[' + i + ']';
      if (!isObj(m)) { E(errs, 'INVALID_TYPE', mp, 'metric must be an object'); return; }
      if (!isStr(m.field) || m.field === '') E(errs, 'REQUIRED', mp + '.field', 'metric.field required');
      if (!isStr(m.label) || m.label === '') E(errs, 'REQUIRED', mp + '.label', 'metric.label required');
      if (m.aggregation == null) E(errs, 'REQUIRED', mp + '.aggregation', 'metric.aggregation required (sum in v1)');
      else if (hasOwn(ReportSpec.AGGREGATIONS, m.aggregation)) { /* ok */ }
      else if (hasOwn(ReportSpec.AGG_UNIMPLEMENTED, m.aggregation)) E(errs, 'UNSUPPORTED_CAPABILITY', mp + '.aggregation', 'aggregation "' + m.aggregation + '" 已规划未实现（v1 sum-only，见 Ir 能力清单）');
      else E(errs, 'INVALID_ENUM', mp + '.aggregation', 'unknown aggregation "' + m.aggregation + '"（v1 只: sum）');
      if (m.dataType != null && !hasOwn(ReportSpec.COLUMN_TYPES, m.dataType)) E(errs, 'INVALID_ENUM', mp + '.dataType', 'metric.dataType 越列型词表: ' + Object.keys(ReportSpec.COLUMN_TYPES).join('|'));
      if (m.widthPt != null && !isNum(m.widthPt)) E(errs, 'INVALID_NUMBER', mp + '.widthPt', 'widthPt must be a finite number');
      if (m.format != null && !isStr(m.format)) E(errs, 'INVALID_TYPE', mp + '.format', 'format must be string');
    });

    // dataset（内嵌 rows；query.type=semantic 拒 = I2/I3）
    if (!hasOwn(rs, 'dataset')) E(errs, 'REQUIRED', 'dataset', 'dataset is required');
    else if (!isObj(rs.dataset)) E(errs, 'INVALID_TYPE', 'dataset', 'dataset must be an object');
    else {
      if (rs.dataset.query != null || rs.dataset.source != null) E(errs, 'UNSUPPORTED_CAPABILITY', 'dataset', 'dataset.query/source(semantic) 暂不支持（' + ReportSpec.REJECTED.semanticQuery + '）');
      var colCount = (isArr(rs.dimensions) ? rs.dimensions.length : 0) + (isArr(rs.metrics) ? rs.metrics.length : 0);
      if (rs.dataset.rows == null) E(errs, 'REQUIRED', 'dataset.rows', 'dataset.rows is required');
      else if (!isArr(rs.dataset.rows)) E(errs, 'INVALID_ARRAY', 'dataset.rows', 'dataset.rows must be an array');
      else rs.dataset.rows.forEach(function (row, ri) {
        var rp = 'dataset.rows[' + ri + ']';
        if (!isArr(row)) { E(errs, 'INVALID_ARRAY', rp, 'row must be an array'); return; }
        if (colCount && row.length !== colCount) E(errs, 'INVALID_SHAPE', rp, 'row width ' + row.length + ' != columns ' + colCount);
        row.forEach(function (cell, ci) {
          if (cell != null && typeof cell === 'object') E(errs, 'INVALID_TYPE', rp + '[' + ci + ']', 'cell value must be scalar');
        });
      });
    }

    // presentation（可选；type=v1 table；showTotal 布尔；heightsPt 有限数）
    if (rs.presentation != null) {
      var pp = 'presentation';
      if (!isObj(rs.presentation)) E(errs, 'INVALID_TYPE', pp, 'presentation must be an object');
      else {
        if (rs.presentation.type != null && !hasOwn(ReportSpec.PRESENTATION_TYPES, rs.presentation.type)) E(errs, 'INVALID_ENUM', pp + '.type', 'presentation.type 越词表（v1 只 table）: ' + rs.presentation.type);
        if (rs.presentation.showTotal != null && typeof rs.presentation.showTotal !== 'boolean') E(errs, 'INVALID_TYPE', pp + '.showTotal', 'showTotal must be boolean');
        if (rs.presentation.heightsPt != null) {
          if (!isObj(rs.presentation.heightsPt)) E(errs, 'INVALID_TYPE', pp + '.heightsPt', 'heightsPt must be an object');
          else ['title', 'header', 'row', 'total'].forEach(function (k) {
            if (rs.presentation.heightsPt[k] != null && !isNum(rs.presentation.heightsPt[k])) E(errs, 'INVALID_NUMBER', pp + '.heightsPt.' + k, k + ' must be a finite number');
          });
        }
      }
    }

    return errs;
  }

  return { validate: validate };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpecValidator;
