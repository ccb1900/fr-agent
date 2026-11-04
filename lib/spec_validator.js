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

  // presentation 校验单点（I1.1 r4 P2）：两分支共用——此前 sql 分支提前 return，showTotal/heightsPt/type
  //   的类型错误在 sql 路无人校验；且 rows 路 compiler 根本不读 presentation.chart（静默忽略=静默少图），
  //   必须在这里明确拒，而不是让用户以为图出了。keys 白名单同样防"写了没人管"的静默丢失。
  var PRESENTATION_KEYS = { type: 1, showTotal: 1, heightsPt: 1, chart: 1, footnote: 1 };
  var CHART_KINDS = { bar: 1, pie: 1, line: 1 };
  // r8 A2：sql 数据集列引用可带 {term,label,widthPt}（表头文案/列宽覆盖）；未知键明确拒，不静默忽略
  var REF_KEYS = { term: 1, label: 1, widthPt: 1 };
  function validatePresentation(rs, errs, isSql) {
    if (rs.presentation == null) return;
    var pp = 'presentation';
    if (!isObj(rs.presentation)) { E(errs, 'INVALID_TYPE', pp, 'presentation must be an object'); return; }
    Object.keys(rs.presentation).forEach(function (k) {
      if (!hasOwn(PRESENTATION_KEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.' + k, 'presentation 无此键（' + Object.keys(PRESENTATION_KEYS).join('|') + '），写了不生效故拒');
    });
    if (rs.presentation.type != null && !hasOwn(ReportSpec.PRESENTATION_TYPES, rs.presentation.type)) E(errs, 'INVALID_ENUM', pp + '.type', 'presentation.type 越词表（v1 只 table）: ' + rs.presentation.type);
    if (rs.presentation.showTotal != null && typeof rs.presentation.showTotal !== 'boolean') E(errs, 'INVALID_TYPE', pp + '.showTotal', 'showTotal must be boolean');
    if (rs.presentation.footnote != null) {
      if (!isStr(rs.presentation.footnote) || rs.presentation.footnote === '') E(errs, 'INVALID_TYPE', pp + '.footnote', 'footnote 须非空字符串（脚注文案）');
    }
    if (rs.presentation.heightsPt != null) {
      if (!isObj(rs.presentation.heightsPt)) E(errs, 'INVALID_TYPE', pp + '.heightsPt', 'heightsPt must be an object');
      else ['title', 'header', 'row', 'total'].forEach(function (k) {
        if (rs.presentation.heightsPt[k] != null && !isNum(rs.presentation.heightsPt[k])) E(errs, 'INVALID_NUMBER', pp + '.heightsPt.' + k, k + ' must be a finite number');
      });
    }
    // chart：只有 sql 路 compiler 会编出 chart 块；rows 路写了就是静默丢弃 → 明确拒
    if (rs.presentation.chart != null) {
      if (!isSql) { E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.chart', 'presentation.chart 仅 sql 数据集支持（rows 内嵌路不出图，见 ReportSpec.capabilities）'); return; }
      var chart = rs.presentation.chart;
      if (!isObj(chart)) { E(errs, 'INVALID_TYPE', pp + '.chart', 'chart 须对象'); return; }
      if (chart.kind != null && !hasOwn(CHART_KINDS, chart.kind)) E(errs, 'INVALID_ENUM', pp + '.chart.kind', 'chart.kind v1 只 bar|pie|line');
      if (!isStr(chart.category) || !chart.category) E(errs, 'REQUIRED', pp + '.chart.category', 'chart.category 必填(维度别名)');
      if (!isStr(chart.value) || !chart.value) E(errs, 'REQUIRED', pp + '.chart.value', 'chart.value 必填(度量别名)');
    }
  }

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
          if (isObj(x)) {
            Object.keys(x).forEach(function (k) {
              if (!hasOwn(REF_KEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', 'dataset.' + key + '[' + i + '].' + k, '列引用只允许 term|label|widthPt（写了不生效故拒）');
            });
            if (x.label != null && (!isStr(x.label) || x.label === '')) E(errs, 'INVALID_TYPE', 'dataset.' + key + '[' + i + '].label', 'label 须非空字符串');
            if (x.widthPt != null && !isNum(x.widthPt)) E(errs, 'INVALID_NUMBER', 'dataset.' + key + '[' + i + '].widthPt', 'widthPt 须有限数');
          }
        });
      });
      if (!anySel) E(errs, 'REQUIRED', 'dataset', 'sql 数据集至少选一个维度或指标');
      if (ds.dateRange != null) {
        var dr = IsoDate.range(ds.dateRange);   // I5.1 P4 单点：严格双边 + 日历有效性 + from<=to（与 sqlbuilder 同一真相）
        dr.errors.forEach(function (e) { E(errs, e.code, 'dataset.' + e.path, e.message); });
      }
      // I5.3-A sort / topN 形状（语义正确性由 sqlbuilder 兜底，这里挡明显非法入参）
      if (ds.sort != null) {
        if (!isArr(ds.sort) || !ds.sort.length) E(errs, 'INVALID_ARRAY', 'dataset.sort', 'sort 须非空数组');
        else ds.sort.forEach(function (s, i) {
          if (!isObj(s) || !isStr(s.field) || !s.field) E(errs, 'REQUIRED', 'dataset.sort[' + i + ']', 'sort 项须 {field}');
          else if (s.dir != null && s.dir !== 'asc' && s.dir !== 'desc') E(errs, 'INVALID_ENUM', 'dataset.sort[' + i + '].dir', 'sort.dir 只 asc|desc');
        });
      }
      if (ds.topN != null) {
        var tn = isObj(ds.topN) ? ds.topN.n : ds.topN;
        if (!(isNum(tn) && tn > 0 && Math.floor(tn) === tn)) E(errs, 'INVALID_NUMBER', 'dataset.topN', 'topN 须正整数');
      }
      // I5.3-B filters 形状（值安全由 sqlbuilder 受控字面量兜底）
      if (ds.filters != null) {
        if (!isArr(ds.filters) || !ds.filters.length) E(errs, 'INVALID_ARRAY', 'dataset.filters', 'filters 须非空数组');
        else ds.filters.forEach(function (f, i) {
          if (!isObj(f)) { E(errs, 'INVALID_TYPE', 'dataset.filters[' + i + ']', 'filter 须对象'); return; }
          if (!isStr(f.field) || !f.field) E(errs, 'REQUIRED', 'dataset.filters[' + i + '].field', 'filter.field 必填');
          if (f.value == null || f.value === '') E(errs, 'REQUIRED', 'dataset.filters[' + i + '].value', 'filter.value 必填');
        });
      }
      // I5.3-C chart 形状（kind 限 legacy 图种；category/value 为已选列别名，编译期由 spec_compiler 校验）
      //   I1.1：presentation 全套校验走共享函数（与 rows 路一处真相，不再提前 return 跳过）
      validatePresentation(rs, errs, true);
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

    // presentation（可选；共享校验：type/showTotal/heightsPt/chart 形状 + 未支持键拒）
    validatePresentation(rs, errs, false);

    return errs;
  }

  return { validate: validate };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpecValidator;
