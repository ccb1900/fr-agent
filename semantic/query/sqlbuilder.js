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
  function build(model, sel, opts) {
    opts = opts || {};
    var DETAIL = (opts && opts.detail === true) || (!!sel && sel.detail === true);   // W3：detail=明细（行级 DISTINCT，不 GROUP BY；spec_compiler 放 sel，直调走 opts；null-safe）
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
    // I5.4：先解析全部维度（只做 JOIN 集合判定 + 收集 {table,column,alias,rule}），不在此阶段拼 SQL，
    //   再统一按 hasJoin 决定列限定 → 消除"维度顺序决定哪些列被限定"的顺序依赖。
    var dimSpecs = [], dateDim = null;
    (sel.dimensions || []).forEach(function (dn, i) {   // detail 模式也走同一路：property 与模型维度名册共用 resolve 逻辑（detail 更按 property 定位）
      var path = 'dimensions[' + i + ']';
      var d = dimsByName[dn];
      if (!d && DETAIL) {
        // W3：detail 展示列=实体 property（`Entity.prop` 前缀可剥；裸物理列名也直取）——不走维度名册、不进 GROUP BY
        var pn = String(dn).replace(/^[A-Za-z_][A-Za-z0-9_]*\./, '');
        var pm = props[pn] || props[dn];
        if (pm) d = { name: pn, table: table, column: pm.column, rule: null };
      }
      if (!d) { E(errs, 'UNKNOWN_REF', path, '维度不在模型: ' + dn); return; }
      var leaf = String(d.column || '').split('.').pop();
      var colTable = (!d.table || d.table === table) ? table : d.table;
      if (colTable !== table) {
        var j = ensureJoin(colTable);
        if (!j) { E(errs, 'UNSUPPORTED_CROSS_TABLE', path, '维度 ' + dn + ' 属表 ' + colTable + '，与实体主表 ' + table + ' 无 confirmed 安全关系，拒绝跨表（JOIN 需确认关系）'); return; }
      }
      var spec = { alias: d.name, table: colTable, column: leaf, rule: d.rule };
      dimSpecs.push(spec);
      if (d.rule === 'dateNormalize') dateDim = spec;   // I5.4：dateRange 保留 {table,column} 归属，不丢表名
    });
    var hasJoin = joins.length > 0;
    function qualOf(tbl, col) { return hasJoin ? tbl + '.' + col : col; }   // 有 JOIN 时所有列统一限定；单表全裸列（向后兼容）
    // 统一生成维度 SELECT/GROUP BY（此时 JOIN 集合已定，与维度顺序无关）
    dimSpecs.forEach(function (s) {
      var qual = qualOf(s.table, s.column);
      if (s.rule === 'dateNormalize') {
        selectBits.push('convert(varchar(10), TRY_CAST(' + qual + ' AS date), 23) AS ' + s.alias);
        groupBits.push('TRY_CAST(' + qual + ' AS date)');
      } else {
        selectBits.push(qual + ' AS ' + s.alias);
        groupBits.push(qual);
      }
      baseCols.push({ alias: s.alias, role: 'dim', column: s.column });
    });
    // 指标（度量必须落在实体主表；跨表度量改 grain → 仍拒；列限定同样用统一 hasJoin）
    (sel.metrics || []).forEach(function (mn, i) {
      var path = 'metrics[' + i + ']';
      var m = metricsByName[mn];
      if (!m) { E(errs, 'UNKNOWN_REF', path, '指标不在模型: ' + mn); return; }
      var mtable = m.expression && m.expression.table;
      if (mtable && mtable !== table) { E(errs, 'UNSUPPORTED_CROSS_TABLE', path, '指标 ' + mn + ' 度量表 ' + mtable + ' 与实体主表 ' + table + ' 跨表（度量 grain 改变，JOIN 不承载跨表度量）'); return; }
      var frag = metricSelect(m, errs, path, table, hasJoin);
      if (!frag) return;
      if (frag.base) {
        selectBits.push(frag.sql);
        if (frag.measureCol) measures[frag.measureCol] = 1;
        baseCols.push({ alias: frag.alias, role: 'metric', kind: m.expression.kind });
      } else {
        baseCols.push({ alias: frag.alias, role: 'derived', numerator: frag.numerator, denominator: frag.denominator, scale: frag.scale, kind: 'ratio' });
      }
    });
    var aliasSet = {}; baseCols.forEach(function (b) { aliasSet[b.alias] = 1; });
    baseCols.forEach(function (b) {
      if (b.role === 'derived') {
        if (!aliasSet[b.numerator]) E(errs, 'UNKNOWN_REF', 'ratio.' + b.alias, 'ratio 分子未选入: ' + b.numerator);
        if (!aliasSet[b.denominator]) E(errs, 'UNKNOWN_REF', 'ratio.' + b.alias, 'ratio 分母未选入: ' + b.denominator);
      }
    });

    // WHERE：基筛 + dateRange（用 dateDim 的 {table,column}，跨表日期维也不会错挂主表）+ 非日期 filters
    var where = [];
    Object.keys(measures).forEach(function (mc) { where.push('TRY_CAST(' + qualOf(table, mc) + ' AS float) IS NOT NULL'); });
    if (sel.dateRange && (sel.dateRange.from || sel.dateRange.to)) {
      if (!dateDim && DETAIL) {
        // W3：detail 直读行的日期区间——dims 未选 dateNormalize 维度时允许按实体文本日期列直筛
        //   （biz_date/biz_time 存'YYYY-MM-DD[ HH:mm]'，文本序等价日期序：BETWEEN 直接可比）
        var candList = dimSpecs.length ? dimSpecs : [];
        var pickCol = null;
        if (candList.length) pickCol = { table: candList[0].table, column: candList[0].column };
        else {
          Object.keys(props).forEach(function (pk) {
            var pv = props[pk];
            if (!pickCol && pv.column && (/date|time/i.test(pk) || /date|time/i.test(String(pv.type || '')))) pickCol = { table: table, column: pv.column };
          });
        }
        if (pickCol) dateDim = pickCol;
      }
      if (!dateDim) E(errs, 'INVALID_SHAPE', 'dateRange', 'dateRange 需选中 dateNormalize 维度');
      else {
        var dr = IsoDate.range(sel.dateRange);
        if (dr.ok) where.push('TRY_CAST(' + qualOf(dateDim.table, dateDim.column) + ' AS date) BETWEEN ' + "'" + sel.dateRange.from + "' AND '" + sel.dateRange.to + "'");
        else dr.errors.forEach(function (e) { E(errs, e.code, 'dateRange' + (e.path.indexOf('.') >= 0 ? '.' + e.path.split('.').pop() : ''), e.message); });
      }
    }
    // 语义 op→SQL Server op 统一映射（I5.4：== → =，禁直出）；like 仅文本列（数值列拒）
    var OP_SQL = { '==': '=', '=': '=', '!=': '!=', '>': '>', '>=': '>=', '<': '<', '<=': '<=' };
    var NUMERIC_TYPES = { number: 1, integer: 1, long: 1, float: 1, decimal: 1 };
    var SAFE_TOKEN = /^[\w.\- ]{1,64}$/;
    var CN_TOKEN = /^[一-龥\w.\- ]{1,64}$/;
    (sel.filters || []).forEach(function (fl, i) {
      var fp = 'filters[' + i + ']';
      if (!isObj(fl)) { E(errs, 'INVALID_TYPE', fp, 'filter 须对象'); return; }
      var colMeta = props[fl.field] || (dimsByName[fl.field] && (!dimsByName[fl.field].table || dimsByName[fl.field].table === table) ? { column: dimsByName[fl.field].column, type: 'text' } : null);
      if (!colMeta) { E(errs, 'UNKNOWN_REF', fp + '.field', 'filter 字段非实体表可过滤列（跨表 filter 暂拒）: ' + fl.field); return; }
      var leaf = String(colMeta.column || '').split('.').pop();
      var qualCol = qualOf(table, leaf);
      var rawOp = fl.op == null ? '=' : fl.op;
      var isLike = /^like$/i.test(String(rawOp));
      var isNumCol = !!NUMERIC_TYPES[colMeta.type];
      // I5.4：操作符×字段类型约束——数值列拒 like/contains；文本列拒比较 op（只允许 =/!=/like）
      if (isNumCol) {
        if (isLike || rawOp === 'contains') { E(errs, 'INVALID_ENUM', fp + '.op', '数值列不许 like/contains: ' + rawOp); return; }
        var sqlOp = OP_SQL[rawOp];
        if (!sqlOp) { E(errs, 'INVALID_ENUM', fp + '.op', 'filter op 越白名单: ' + rawOp); return; }
        if (!(typeof fl.value === 'number' && isFinite(fl.value))) { E(errs, 'INVALID_NUMBER', fp + '.value', '数值列 filter 值须有限数: ' + fl.value); return; }
        where.push('TRY_CAST(' + qualCol + ' AS float) ' + sqlOp + ' ' + fl.value);
      } else {
        if (isLike) {
          var v = String(fl.value == null ? '' : fl.value);
          if (!SAFE_TOKEN.test(v) && !CN_TOKEN.test(v)) { E(errs, 'INVALID_TYPE', fp + '.value', '文本 filter 值含非法字符: ' + v); return; }
          where.push(qualCol + " LIKE '%" + v + "%'");
        } else {
          // I5.4 复审（2026-11-09）：文本列白名单=|=|!=|like——与报错文案一致收紧。
          //   此前文案说"只允许 =|!=|like"，OP_SQL 却放行 >/< >= <=（字符串比较，语义歧义）。
          //   影响面实证：examples/verify 全量 0 处文本比较 filter（仅 daily_filtered 用 like），收紧零破坏。
          var sqlOp2 = hasOwn({ '=': 1, '==': 1, '!=': 1 }, String(rawOp)) ? OP_SQL[rawOp] : null;
          if (!sqlOp2) { E(errs, 'INVALID_ENUM', fp + '.op', '文本列 filter 只允许 =|!=|like，收到: ' + rawOp); return; }
          var v2 = String(fl.value == null ? '' : fl.value);
          if (!SAFE_TOKEN.test(v2) && !CN_TOKEN.test(v2)) { E(errs, 'INVALID_TYPE', fp + '.value', '文本 filter 值含非法字符: ' + v2); return; }
          where.push(qualCol + " " + sqlOp2 + " '" + v2 + "'");
        }
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
    // 确定性全序（night-shift）：MSSQL 对 GROUP BY 后未列入 ORDER BY 的键列不保证行序——多维度分组时
    //   "同首列、其余维度不同"的行会抖动（真值 day@machine 对拍与报表可复现性都受害）。规则：
    //   无 sort → ORDER BY 1（首列）+ 其余 GROUP 列（单列组时即 ORDER BY 1，保持历史文本）；
    //   有 sort → sort 主序 + 全部 GROUP 列 tie-breaker（冗余排序键合法且消抖）。
    var order;
    if (DETAIL) { order = orderBits.length ? orderBits.join(', ') : (groupBits.length > 1 ? ('1, ' + groupBits.slice(1).join(', ')) : '1'); } else if (orderBits.length) {
      order = orderBits.join(', ');
      if (groupBits.length) order += ', ' + groupBits.join(', ');
    } else {
      order = groupBits.length > 1 ? ('1, ' + groupBits.slice(1).join(', ')) : '1';
    }

    // W3：detail=明细（行级直读）——DISTINCT + 无 GROUP BY；groupDims=[]（真值粒度『一行一条』）。
    //   ORDER BY 规则照常（全部列均已 SELECT，MSSQL DISTINCT 合法性成立）。
    var sql = 'SELECT' + (DETAIL ? ' DISTINCT' : '') + topSql + ' ' + selectBits.join(', ') + ' FROM ' + table +
      (joins.length ? ' ' + joins.join(' ') : '') +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      (groupBits.length && !DETAIL ? ' GROUP BY ' + groupBits.join(', ') : '') +
      ' ORDER BY ' + order;
    // 单点自检：受控 SQL 必单语句、无 ;（配 ir.js SQL_READONLY），违约即拒（不产脏 SQL）
    if (/;/.test(sql) || !/^(SELECT|WITH)\b/i.test(sql)) { E(errs, 'SQL_READONLY', 'sql', '生成的 SQL 违单语句/只读约束'); return { errors: errs }; }
    return { sql: sql, baseAliases: baseAliases, derived: derived, groupDims: (DETAIL ? [] : (sel.dimensions || []).slice()), detail: DETAIL, errors: [] };
  }

  return { build: build };
})();
