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

  // 单指标 → SQL SELECT 片段（alias 用指标 name，稳定可预测）；joinsPresent 时度量列限定实体表名避免歧义
  function metricSelect(m, errs, path, entTable, joinsPresent) {
    var e = m.expression;
    var QC = function (col) { return joinsPresent && entTable ? entTable + '.' + col : col; };
    if (!isObj(e)) { E(errs, 'INVALID_TYPE', path + '.expression', '指标缺 expression'); return null; }
    switch (e.kind) {
      case 'count':          return { alias: m.name, sql: 'COUNT(*) AS ' + m.name, base: true };
      case 'countThreshold':
        if (!isStr(e.column) || !isStr(e.op) || e.value == null) { E(errs, 'REQUIRED', path + '.expression', 'countThreshold 需 column/op/value'); return null; }
        return { alias: m.name, base: true, measureCol: e.column,
          sql: 'SUM(CASE WHEN ' + numCast(QC(e.column)) + ' ' + e.op + ' ' + e.value + ' THEN 1 ELSE 0 END) AS ' + m.name };
      case 'sum':            if (!isStr(e.column)) { E(errs, 'REQUIRED', path + '.expression.column', 'sum 需 column'); return null; }
        return { alias: m.name, base: true, measureCol: e.column, sql: 'SUM(' + numCast(QC(e.column)) + ') AS ' + m.name };
      case 'weightedAvg':    if (!isStr(e.column)) { E(errs, 'REQUIRED', path + '.expression.column', 'weightedAvg 需 column'); return null; }
        return { alias: m.name, base: true, measureCol: e.column, sql: 'AVG(' + numCast(QC(e.column)) + ') AS ' + m.name };
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

    // I5.2：可安全 JOIN 的确认可用关系索引（confirmed + N:1/1:1，from.table=实体表）→ to.table
    var joinByTable = {};
    (model.relationships || []).forEach(function (r) {
      if (!r || r.source !== 'confirmed') return;
      if (!ModelVocab.JOIN_SAFE_CARDINALITY[r.cardinality]) return;
      if (!r.from || !r.to || r.from.table !== table) return;
      if (!joinByTable[r.to.table]) joinByTable[r.to.table] = { refTable: r.to.table, onEnt: r.from.column, onRef: r.to.column };
    });

    var selectBits = [], groupBits = [], measures = {}, baseCols = [], joins = [], joinSeen = {};
    function ensureJoin(refTable) {
      var j = joinByTable[refTable];
      if (!j) return null;
      if (!joinSeen[refTable]) { joinSeen[refTable] = 1; joins.push('INNER JOIN ' + refTable + ' ON ' + table + '.' + j.onEnt + ' = ' + refTable + '.' + j.onRef); }
      return j;
    }
    // 有 JOIN 才限定表名（避免歧义），单表查询逐字保持原样（向后兼容既有断言）
    function q(tbl, col) { return joins.length || Object.keys(joinSeen).length ? tbl + '.' + col : col; }

    // 维度：dim.column 为 table.column，取列名；命中 dateNormalize 规则则 TRY_CAST date 归一（#52 口径）
    (sel.dimensions || []).forEach(function (dn, i) {
      var d = dimsByName[dn];
      var path = 'dimensions[' + i + ']';
      if (!d) { E(errs, 'UNKNOWN_REF', path, '维度不在模型: ' + dn); return; }
      var leaf = String(d.column || '').split('.').pop();
      var col, colTable;
      if (!d.table || d.table === table) { col = leaf; colTable = table; }
      else {
        // I5.2：跨表维度——仅当存在 confirmed 安全关系才 INNER JOIN 带出，否则维持 I5.1 跨表拒绝
        var j = ensureJoin(d.table);
        if (!j) { E(errs, 'UNSUPPORTED_CROSS_TABLE', path, '维度 ' + dn + ' 属表 ' + d.table + '，与实体主表 ' + table + ' 无 confirmed 安全关系，拒绝跨表（JOIN 需确认关系，r3 I5.2）'); return; }
        col = leaf; colTable = d.table;
      }
      var qual = joins.length ? colTable + '.' + col : col;
      var normalize = d.rule === 'dateNormalize';
      if (normalize) {
        selectBits.push('convert(varchar(10), TRY_CAST(' + qual + ' AS date), 23) AS ' + d.name);
        groupBits.push('TRY_CAST(' + qual + ' AS date)');
      } else {
        selectBits.push(qual + ' AS ' + d.name);
        groupBits.push(qual);
      }
      baseCols.push({ alias: d.name, role: 'dim', column: col });
    });
    // 指标（度量必须落在实体主表；跨表度量改 grain → 仍拒，JOIN 只用于带出维度不放大度量）
    (sel.metrics || []).forEach(function (mn, i) {
      var path = 'metrics[' + i + ']';
      var m = metricsByName[mn];
      if (!m) { E(errs, 'UNKNOWN_REF', path, '指标不在模型: ' + mn); return; }
      var mtable = m.expression && m.expression.table;
      if (mtable && mtable !== table) { E(errs, 'UNSUPPORTED_CROSS_TABLE', path, '指标 ' + mn + ' 度量表 ' + mtable + ' 与实体主表 ' + table + ' 跨表（度量 grain 改变，JOIN 不承载跨表度量）'); return; }
      var frag = metricSelect(m, errs, path, table, joins.length);
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
    Object.keys(measures).forEach(function (mc) { where.push('TRY_CAST(' + (joins.length ? table + '.' + mc : mc) + ' AS float) IS NOT NULL'); });
    if (sel.dateRange && (sel.dateRange.from || sel.dateRange.to)) {
      var dateCol = null;
      (sel.dimensions || []).forEach(function (dn) { var d = dimsByName[dn]; if (d && d.rule === 'dateNormalize') dateCol = String(d.column || '').split('.').pop(); });
      if (!dateCol) E(errs, 'INVALID_SHAPE', 'dateRange', 'dateRange 需选中 dateNormalize 维度');
      else {
        var dr = IsoDate.range(sel.dateRange);   // I5.1 P4：与 spec_validator 同一日期真相（严格双边+日历有效+from<=to）
        if (dr.ok) where.push('TRY_CAST(' + (joins.length ? table + '.' + dateCol : dateCol) + ' AS date) BETWEEN ' + "'" + sel.dateRange.from + "' AND '" + sel.dateRange.to + "'");
        else dr.errors.forEach(function (e) { E(errs, e.code, 'dateRange' + (e.path.indexOf('.') >= 0 ? '.' + e.path.split('.').pop() : ''), e.message); });
      }
    }

    // I5.3-B 非日期 filters：受控字面量（FR DBTableData 走 ${} 替换非 JDBC prepared，故值必须严格类型化，注入面清零）
    //   仅允许引用实体表上的属性/维度列（跨表 filter → 拒，filter grain 保守）；op∈OPS；数值列值须有限数，文本列须安全 token。
    var NUMERIC_TYPES = { number: 1, integer: 1, long: 1, float: 1, decimal: 1 };
    var SAFE_TOKEN = /^[\w.\- ]{1,64}$/;
    var CN_TOKEN = /^[一-龥\w.\- ]{1,64}$/;
    (sel.filters || []).forEach(function (fl, i) {
      var fp = 'filters[' + i + ']';
      if (!isObj(fl)) { E(errs, 'INVALID_TYPE', fp, 'filter 须对象'); return; }
      var colMeta = props[fl.field] || (dimsByName[fl.field] && (!dimsByName[fl.field].table || dimsByName[fl.field].table === table) ? { column: dimsByName[fl.field].column, type: 'text' } : null);
      if (!colMeta) { E(errs, 'UNKNOWN_REF', fp + '.field', 'filter 字段非实体表可过滤列（跨表 filter 暂拒）: ' + fl.field); return; }
      var leaf = String(colMeta.column || '').split('.').pop();
      var qualCol = joins.length ? table + '.' + leaf : leaf;
      var op = fl.op == null ? '=' : fl.op;
      if (!hasOwn(ModelVocab.OPS, op) && op !== 'like' && op !== 'LIKE') { E(errs, 'INVALID_ENUM', fp + '.op', 'filter op 越白名单: ' + op); return; }
      var isNumCol = NUMERIC_TYPES[colMeta.type];
      if (isNumCol) {
        if (!(typeof fl.value === 'number' && isFinite(fl.value))) { E(errs, 'INVALID_NUMBER', fp + '.value', '数值列 filter 值须有限数: ' + fl.value); return; }
        where.push('TRY_CAST(' + qualCol + ' AS float) ' + op + ' ' + fl.value);
      } else {
        var v = String(fl.value == null ? '' : fl.value);
        if (!SAFE_TOKEN.test(v) && !CN_TOKEN.test(v)) { E(errs, 'INVALID_TYPE', fp + '.value', '文本 filter 值含非法字符（禁引号/;/注释符）: ' + v); return; }
        var up = String(op).toUpperCase();
        if (up === 'LIKE') where.push(qualCol + " LIKE '%" + v + "%'");
        else where.push(qualCol + " " + op + " '" + v + "'");
      }
    });

    var baseAliases = baseCols.filter(function (b) { return b.role !== 'derived'; }).map(function (b) { return { alias: b.alias, role: b.role }; });
    var derived = baseCols.filter(function (b) { return b.role === 'derived'; });
    if (errs.length) return { errors: errs };
    if (!selectBits.length) { E(errs, 'REQUIRED', 'sel', '无可选维度/指标'); return { errors: errs }; }

    // I5.3-A：sort（按已选 SQL 别名 + 方向）+ topN（SELECT TOP n）。派生比率列不在 SQL 里 → 不可按它排序
    var sqlAlias = {}; baseAliases.forEach(function (b) { sqlAlias[b.alias] = 1; });
    var orderBits = [];
    (sel.sort || []).forEach(function (s, i) {
      var sp = 'sort[' + i + ']';
      var f = isStr(s) ? s : (s && s.field);
      var dir = (s && s.dir) || 'asc';
      if (!f || !sqlAlias[f]) { E(errs, sqlAlias[f] ? 'INVALID_SHAPE' : 'UNKNOWN_REF', sp, 'sort 字段须为已选 SQL 列别名(非派生比率): ' + f); return; }
      if (dir !== 'asc' && dir !== 'desc') { E(errs, 'INVALID_ENUM', sp + '.dir', 'sort.dir 只 asc|desc: ' + dir); return; }
      orderBits.push(f + ' ' + dir.toUpperCase());
    });
    var topSql = '';
    if (sel.topN != null) {
      var n = sel.topN && sel.topN.n != null ? sel.topN.n : sel.topN;
      if (!(typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n > 0)) E(errs, 'INVALID_NUMBER', 'topN', 'topN 须正整数');
      else if (!orderBits.length) E(errs, 'INVALID_SHAPE', 'topN', 'topN 需配 sort（否则 TOP n 无确定序，r3 §5.2 查询范围）');
      else topSql = ' TOP ' + n;
    }
    if (errs.length) return { errors: errs };
    var order = orderBits.length ? orderBits.join(', ') : '1';

    var sql = 'SELECT' + topSql + ' ' + selectBits.join(', ') + ' FROM ' + table +
      (joins.length ? ' ' + joins.join(' ') : '') +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      (groupBits.length ? ' GROUP BY ' + groupBits.join(', ') : '') +
      ' ORDER BY ' + order;
    // 单点自检：受控 SQL 必单语句、无 ;（配 ir.js SQL_READONLY），违约即拒（不产脏 SQL）
    if (/;/.test(sql) || !/^(SELECT|WITH)\b/i.test(sql)) { E(errs, 'SQL_READONLY', 'sql', '生成的 SQL 违单语句/只读约束'); return { errors: errs }; }
    return { sql: sql, baseAliases: baseAliases, derived: derived, groupDims: (sel.dimensions || []).slice(), errors: [] };
  }

  return { build: build };
})();
