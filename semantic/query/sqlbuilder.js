// semantic/query/sqlbuilder.js — I5 模型→SQL 语义查询生成器（零 java 纯函数；r2 §3.2 兑现：指标"明确聚合语义"→可执行 SQL）
//   不是自由文本 SQL、不是 NL 直翻：只把 ReportSpec 选中的 model 维度/指标（model.json 里已声明的 expression）
//   编译成**受控**的 GROUP BY 聚合查询。#52 真值形态为镜像基准（TRY_CAST 数值/日期归一、score IS NOT NULL 基筛、日期字面烤入禁 ${}）。
//   派生指标（ratio）不进 SQL——引擎无 SUMPRODUCT、且比率应在展示层用 base 列公式算，故只回 base 列 + derived 规格交 IR 公式格。
var SqlBuilder = (function () {
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isStr(v) { return typeof v === 'string'; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  function E(errs, code, path, message) { errs.push({ code: code, path: path, message: message }); }
  function numCast(col) { return 'TRY_CAST(' + col + ' AS float)'; }

  // 单指标 → SQL SELECT 片段（alias 用指标 name，稳定可预测）
  function metricSelect(m, errs, path) {
    var e = m.expression;
    if (!isObj(e)) { E(errs, 'INVALID_TYPE', path + '.expression', '指标缺 expression'); return null; }
    switch (e.kind) {
      case 'count':          return { alias: m.name, sql: 'COUNT(*) AS ' + m.name, base: true };
      case 'countThreshold':
        if (!isStr(e.column) || !isStr(e.op) || e.value == null) { E(errs, 'REQUIRED', path + '.expression', 'countThreshold 需 column/op/value'); return null; }
        return { alias: m.name, base: true, measureCol: e.column,
          sql: 'SUM(CASE WHEN ' + numCast(e.column) + ' ' + e.op + ' ' + e.value + ' THEN 1 ELSE 0 END) AS ' + m.name };
      case 'sum':            if (!isStr(e.column)) { E(errs, 'REQUIRED', path + '.expression.column', 'sum 需 column'); return null; }
        return { alias: m.name, base: true, measureCol: e.column, sql: 'SUM(' + numCast(e.column) + ') AS ' + m.name };
      case 'weightedAvg':    if (!isStr(e.column)) { E(errs, 'REQUIRED', path + '.expression.column', 'weightedAvg 需 column'); return null; }
        return { alias: m.name, base: true, measureCol: e.column, sql: 'AVG(' + numCast(e.column) + ') AS ' + m.name };
      case 'ratio':          return { alias: m.name, base: false, numerator: e.numerator, denominator: e.denominator, scale: e.scale == null ? 1 : e.scale };
      default: E(errs, 'INVALID_ENUM', path + '.expression.kind', 'sqlbuilder 不支持的指标 kind: ' + e.kind); return null;
    }
  }

  // 主入口：model + 选择（entity + 维度名[] + 指标名[] + 可选日期范围{from,to}）→ 受控查询规格
  function build(model, sel) {
    var errs = [];
    if (!isObj(model) || !isObj(sel)) { E(errs, 'INVALID_TYPE', 'sel', 'build(model,sel) 均需对象'); return { errors: errs }; }
    var ent = null;
    (model.entities || []).forEach(function (e) { if (e && e.name === sel.entity) ent = e; });
    if (!ent) { E(errs, 'UNKNOWN_REF', 'entity', '实体不在模型: ' + sel.entity); return { errors: errs }; }
    var table = ent.table;
    var props = {}; (ent.properties || []).forEach(function (p) { if (p && p.name) props[p.name] = p; });
    var metricsByName = {}; (model.metrics || []).forEach(function (m) { if (m && m.name) metricsByName[m.name] = m; });
    var dimsByName = {}; (model.dimensions || []).forEach(function (d) { if (d && d.name) dimsByName[d.name] = d; });

    var selectBits = [], groupBits = [], measures = {}, baseCols = [];
    // 维度：dim.column 为 table.column，取列名；命中 dateNormalize 规则则 TRY_CAST date 归一（#52 口径）
    (sel.dimensions || []).forEach(function (dn, i) {
      var d = dimsByName[dn];
      var path = 'dimensions[' + i + ']';
      if (!d) { E(errs, 'UNKNOWN_REF', path, '维度不在模型: ' + dn); return; }
      // I5.1 P1：跨实体表字段拒绝（JOIN 属 I5.2）——维度所属表必须=实体主表，否则宁拒不产错 SQL
      if (d.table && d.table !== table) { E(errs, 'UNSUPPORTED_CROSS_TABLE', path, '维度 ' + dn + ' 属表 ' + d.table + '，与实体主表 ' + table + ' 跨表，当前不支持（JOIN=I5.2）'); return; }
      var col = String(d.column || '').split('.').pop();
      var normalize = d.rule === 'dateNormalize';
      if (normalize) {
        selectBits.push('convert(varchar(10), TRY_CAST(' + col + ' AS date), 23) AS ' + d.name);
        groupBits.push('TRY_CAST(' + col + ' AS date)');
      } else {
        selectBits.push(col + ' AS ' + d.name);
        groupBits.push(col);
      }
      baseCols.push({ alias: d.name, role: 'dim', column: col });
    });
    // 指标
    (sel.metrics || []).forEach(function (mn, i) {
      var path = 'metrics[' + i + ']';
      var m = metricsByName[mn];
      if (!m) { E(errs, 'UNKNOWN_REF', path, '指标不在模型: ' + mn); return; }
      // I5.1 P1：指标度量表必须=实体主表（跨表如 fileCount 走 laser_files → 拒，不产静默错 SQL）
      var mtable = m.expression && m.expression.table;
      if (mtable && mtable !== table) { E(errs, 'UNSUPPORTED_CROSS_TABLE', path, '指标 ' + mn + ' 度量表 ' + mtable + ' 与实体主表 ' + table + ' 跨表，当前不支持（JOIN=I5.2）'); return; }
      var frag = metricSelect(m, errs, path);
      if (!frag) return;
      if (frag.base) {
        selectBits.push(frag.sql);
        if (frag.measureCol) measures[frag.measureCol] = 1;   // 参与度量的列 → 基筛 IS NOT NULL
        baseCols.push({ alias: frag.alias, role: 'metric', kind: m.expression.kind });
      } else {
        baseCols.push({ alias: frag.alias, role: 'derived', numerator: frag.numerator, denominator: frag.denominator, scale: frag.scale, kind: 'ratio' });
      }
    });
    // 派生 ratio 的两端必须是已选 base 指标（否则追溯断→UNKNOWN_REF，倒逼模型口径闭合）
    var aliasSet = {}; baseCols.forEach(function (b) { aliasSet[b.alias] = 1; });
    baseCols.forEach(function (b) {
      if (b.role === 'derived') {
        if (!aliasSet[b.numerator]) E(errs, 'UNKNOWN_REF', 'ratio.' + b.alias, 'ratio 分子未选入: ' + b.numerator);
        if (!aliasSet[b.denominator]) E(errs, 'UNKNOWN_REF', 'ratio.' + b.alias, 'ratio 分母未选入: ' + b.denominator);
      }
    });

    // WHERE：基筛（有度量列 → IS NOT NULL）+ 可选日期范围（定字面，禁 ${}）
    var where = [];
    Object.keys(measures).forEach(function (mc) { where.push(numCast(mc) + ' IS NOT NULL'); });
    if (sel.dateRange && (sel.dateRange.from || sel.dateRange.to)) {
      var dateCol = null;
      (sel.dimensions || []).forEach(function (dn) { var d = dimsByName[dn]; if (d && d.rule === 'dateNormalize') dateCol = String(d.column || '').split('.').pop(); });
      if (!dateCol) E(errs, 'INVALID_SHAPE', 'dateRange', 'dateRange 需选中 dateNormalize 维度');
      else {
        var dr = IsoDate.range(sel.dateRange);   // I5.1 P4：与 spec_validator 同一日期真相（严格双边+日历有效+from<=to）
        if (dr.ok) where.push('TRY_CAST(' + dateCol + ' AS date) BETWEEN ' + "'" + sel.dateRange.from + "' AND '" + sel.dateRange.to + "'");
        else dr.errors.forEach(function (e) { E(errs, e.code, 'dateRange' + (e.path.indexOf('.') >= 0 ? '.' + e.path.split('.').pop() : ''), e.message); });
      }
    }

    var baseAliases = baseCols.filter(function (b) { return b.role !== 'derived'; }).map(function (b) { return { alias: b.alias, role: b.role }; });
    var derived = baseCols.filter(function (b) { return b.role === 'derived'; });
    if (errs.length) return { errors: errs };
    if (!selectBits.length) { E(errs, 'REQUIRED', 'sel', '无可选维度/指标'); return { errors: errs }; }

    var sql = 'SELECT ' + selectBits.join(', ') + ' FROM ' + table +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      (groupBits.length ? ' GROUP BY ' + groupBits.join(', ') : '') +
      ' ORDER BY 1';
    // 单点自检：受控 SQL 必单语句、无 ;（配 ir.js SQL_READONLY），违约即拒（不产脏 SQL）
    if (/;/.test(sql) || !/^(SELECT|WITH)\b/i.test(sql)) { E(errs, 'SQL_READONLY', 'sql', '生成的 SQL 违单语句/只读约束'); return { errors: errs }; }
    return { sql: sql, baseAliases: baseAliases, derived: derived, groupDims: (sel.dimensions || []).slice(), errors: [] };
  }

  return { build: build };
})();
