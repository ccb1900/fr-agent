// semantic/model/validator.js — I3 模型校验：结构合法性 + 回溯性（零 java，离线可测）
//   双职责：① 模型自身结构（指标显式聚合语义、关系来源枚举…）；② 回溯性——凡引用数据库字段处
//   （实体表/属性列/键列/维度列/指标操作数/关系端点）必须在传入的 I2 schema 里存在，否则 UNKNOWN_REF。
//   这正是 r2 §3 验收"所有映射必须可以追溯到数据库字段"的机器化：不臆造列，逼模型只用真列。
//   契约沿用 I0-01：错误 {code,path,message}；对任意坏输入只产诊断、绝不抛。
var ModelValidator = (function () {
  function E(errs, code, path, message) { errs.push({ code: code, path: path, message: message }); }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isStr(v) { return typeof v === 'string'; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function schemaIndex(schema) {
    var idx = {};
    ((schema && schema.tables) || []).forEach(function (t) {
      if (!t || !t.name) return;
      var cols = {};
      (t.columns || []).forEach(function (c) { if (c && c.name) cols[c.name] = 1; });
      idx[t.name] = cols;
    });
    return idx;
  }
  // I5.5：目标表"声明唯一键"（PK 列 + unique index 单列）→ 供关系基数机器验证
  //   r5 P1：只有**单列** PK / **单列** unique index 才能证明"该列自身唯一"；
  //   复合 PK/UNIQUE 只保证组合唯一，把其中任一列当单列唯一会让 JOIN fan-out 误判（laser_files 即三列复合 PK）。
  function declaredUniqueKeys(schema, tableName) {
    var keys = {};
    ((schema && schema.tables) || []).forEach(function (t) {
      if (!t || t.name !== tableName) return;
      var pk = t.primaryKey || [];
      if (pk.length === 1 && pk[0] && pk[0].column) keys[pk[0].column] = 1;
      (t.indexes || []).forEach(function (ix) {
        if (ix && ix.unique && ix.columns && ix.columns.length === 1 && ix.columns[0].name) keys[ix.columns[0].name] = 1;
      });
    });
    return keys;
  }
  function requireColumn(idx, errs, table, column, path, what) {
    if (!isStr(table) || !table) { E(errs, 'REQUIRED', path, what + ' 缺 table'); return; }
    if (!hasOwn(idx, table)) { E(errs, 'UNKNOWN_REF', path, what + ' 的表不在 schema: ' + table); return; }
    if (!isStr(column) || !column) { E(errs, 'REQUIRED', path, what + ' 缺 column'); return; }
    if (!hasOwn(idx[table], column)) E(errs, 'UNKNOWN_REF', path, what + ' 的列不在 schema 表 ' + table + ': ' + column);
  }

  function validateMetricExpression(exp, idx, path, metricNames, errs) {
    if (!isObj(exp)) { E(errs, 'INVALID_TYPE', path, 'metric.expression 必须是对象（禁裸 formula 串，r2 §3.2）'); return; }
    if (isStr(exp.formula) || exp.formula != null) { E(errs, 'INVALID_TYPE', path + '.formula', '禁用裸 formula——须用显式聚合 kind'); return; }
    var kind = exp.kind;
    if (!isStr(kind) || !hasOwn(ModelVocab.METRIC_KINDS, kind)) { E(errs, 'INVALID_ENUM', path + '.kind', 'metric.kind 越白名单: ' + Object.keys(ModelVocab.METRIC_KINDS).join('|')); return; }
    if (kind === 'ratio') {
      var checkOperand = function (op, pth) {
        if (isStr(op)) { if (!hasOwn(metricNames, op)) E(errs, 'UNKNOWN_REF', pth, 'ratio 引用未定义指标: ' + op); return; }
        if (!isObj(op)) { E(errs, 'INVALID_TYPE', pth, 'ratio 操作数须是指标名或 {table,column}'); return; }
        if (isStr(op.metric)) { if (!hasOwn(metricNames, op.metric)) E(errs, 'UNKNOWN_REF', pth, 'ratio 引用未定义指标: ' + op.metric); return; }
        requireColumn(idx, errs, op.table, op.column, pth, 'ratio 操作数');
        if (op.op != null && !hasOwn(ModelVocab.OPS, op.op)) E(errs, 'INVALID_ENUM', pth + '.op', '未知 op: ' + op.op);
      };
      if (exp.numerator == null) E(errs, 'REQUIRED', path + '.numerator', 'ratio 缺 numerator（r2 §3.2 明确聚合语义）'); else checkOperand(exp.numerator, path + '.numerator');
      if (exp.denominator == null) E(errs, 'REQUIRED', path + '.denominator', 'ratio 缺 denominator'); else checkOperand(exp.denominator, path + '.denominator');
      if (exp.scale != null && !isNum(exp.scale)) E(errs, 'INVALID_NUMBER', path + '.scale', 'ratio scale 须为有限数（r3 任务5 指标参数严格）');
      return;
    }
    // count/countThreshold/sum/weightedAvg 的必带字段
    ModelVocab.METRIC_KINDS[kind].requires.forEach(function (f) {
      if (exp[f] == null || exp[f] === '') E(errs, 'REQUIRED', path + '.' + f, kind + ' 需要 ' + f);
    });
    if (kind !== 'count') requireColumn(idx, errs, exp.table, exp.column, path, kind);
    else if (isStr(exp.table) && !hasOwn(idx, exp.table)) E(errs, 'UNKNOWN_REF', path + '.table', 'count 的表不在 schema: ' + exp.table);
    if (exp.op != null && !hasOwn(ModelVocab.OPS, exp.op)) E(errs, 'INVALID_ENUM', path + '.op', kind + ' 未知 op: ' + exp.op);
    if (kind === 'countThreshold' && exp.value == null) E(errs, 'REQUIRED', path + '.value', 'countThreshold 需要判定阈值 value');
    // 2026-11-07 B段复审：value 原样拼进 SQL 数值比较位（sqlbuilder metricSelect：TRY_CAST(col) op value），
    //   非有限数值在这里拒——字符串会产出坏 SQL 晚失败，且这是模型文件的唯一值安全闸（与 sqlbuilder 数值 filter 同纪律）。
    if (kind === 'countThreshold' && exp.value != null && !isNum(exp.value)) E(errs, 'INVALID_NUMBER', path + '.value', 'countThreshold.value 须有限数值（SQL 数值比较位，禁自由文本）: ' + exp.value);
  }

  // options.uniqueKeyEvidence: { 'table.column': true } —— 外部读数据侧唯一性探针结果注入（本件零 IO/零 java，R7）
  function validate(model, schema, options) {
    var errs = [];
    options = options || {};
    var uniqEvidence = options.uniqueKeyEvidence || {};
    var requireCompleteness = options.requireCompleteness !== false;   // S1 拆分：默认 true（生产）；草稿/测试传 false 只查通用合法性
    if (!isObj(model)) { E(errs, 'INVALID_TYPE', 'model', '模型必须是对象'); return errs; }
    var idx = schemaIndex(schema);
    if (!isStr(schema) && (!isObj(schema) || !Array.isArray(schema.tables))) { E(errs, 'INVALID_TYPE', 'schema', '回溯性校验需 I2 schema（{tables:[{name,columns}]}）'); return errs; }
    if (model.modelVersion != null && String(model.modelVersion) !== ModelVocab.MODEL_VERSION) {
      E(errs, 'UNSUPPORTED_MODEL_VERSION', 'modelVersion', '不支持的 modelVersion: ' + model.modelVersion); return errs;
    }
    if (!isStr(model.domain) || !model.domain) E(errs, 'REQUIRED', 'domain', 'domain 必填');

    // entities
    if (!Array.isArray(model.entities) || !model.entities.length) E(errs, 'REQUIRED', 'entities', 'entities 必填且非空');
    else model.entities.forEach(function (e, i) {
      var ep = 'entities[' + i + ']';
      if (!isObj(e)) { E(errs, 'INVALID_TYPE', ep, '实体须对象'); return; }
      if (!isStr(e.name) || !e.name) E(errs, 'REQUIRED', ep + '.name', '实体 name 必填');
      if (!hasOwn(idx, e.table)) { E(errs, 'UNKNOWN_REF', ep + '.table', '实体表不在 schema: ' + e.table); }
      else {
        (e.key || []).forEach(function (k, ki) { if (!hasOwn(idx[e.table], k)) E(errs, 'UNKNOWN_REF', ep + '.key[' + ki + ']', '键列不在 schema: ' + e.table + '.' + k); });
      }
      if (!Array.isArray(e.properties) || !e.properties.length) E(errs, 'REQUIRED', ep + '.properties', '实体至少一个属性映射');
      else e.properties.forEach(function (p, pi) {
        if (!isObj(p)) { E(errs, 'INVALID_TYPE', ep + '.properties[' + pi + ']', '属性须对象'); return; }
        if (!isStr(p.name) || !p.name) E(errs, 'REQUIRED', ep + '.properties[' + pi + '].name', '属性 name 必填');
        requireColumn(idx, errs, e.table, p.column, ep + '.properties[' + pi + '].column', '属性');
      });
    });

    // metrics（先收集名字集合，供 ratio 前向/后向引用）
    var metricNames = {};
    (Array.isArray(model.metrics) ? model.metrics : []).forEach(function (m) { if (m && m.name) metricNames[m.name] = 1; });
    if (requireCompleteness && (!Array.isArray(model.metrics) || model.metrics.length < 5)) E(errs, 'REQUIRED', 'metrics', 'metrics 至少 5 个（r2 §3 验收）');
    else model.metrics.forEach(function (m, i) {
      var mp = 'metrics[' + i + ']';
      if (!isObj(m)) { E(errs, 'INVALID_TYPE', mp, '指标须对象'); return; }
      if (!isStr(m.name) || !m.name) E(errs, 'REQUIRED', mp + '.name', '指标 name 必填');
      validateMetricExpression(m.expression, idx, mp + '.expression', metricNames, errs);
    });

    // dimensions
    if (requireCompleteness && (!Array.isArray(model.dimensions) || model.dimensions.length < 3)) E(errs, 'REQUIRED', 'dimensions', 'dimensions 至少 3 个');
    else model.dimensions.forEach(function (d, i) {
      var dp = 'dimensions[' + i + ']';
      if (!isObj(d)) { E(errs, 'INVALID_TYPE', dp, '维度须对象'); return; }
      if (!isStr(d.name) || !d.name) E(errs, 'REQUIRED', dp + '.name', '维度 name 必填');
      requireColumn(idx, errs, d.table, d.column, dp, '维度');
    });

    // relationships（≥3；端点回溯；naming-derived 必 requiresConfirmation）
    if (requireCompleteness && (!Array.isArray(model.relationships) || model.relationships.length < 3)) E(errs, 'REQUIRED', 'relationships', 'relationships 至少 3 个');
    else model.relationships.forEach(function (r, i) {
      var rp = 'relationships[' + i + ']';
      if (!isObj(r)) { E(errs, 'INVALID_TYPE', rp, '关系须对象'); return; }
      if (!hasOwn(ModelVocab.RELATION_SOURCES, r.source)) E(errs, 'INVALID_ENUM', rp + '.source', '关系 source 越枚举: fk|pk|naming-derived|confirmed');
      if (r.source === 'naming-derived' && r.requiresConfirmation !== true) E(errs, 'REQUIRED', rp + '.requiresConfirmation', 'naming-derived 关系必须 requiresConfirmation=true（r2 §3.3 不替代业务确认）');
      // I5.2：confirmed 关系必带合法 cardinality（JOIN 前查基数，不硬拼）
      if (r.source === 'confirmed') {
        if (!hasOwn(ModelVocab.CARDINALITYS, r.cardinality)) E(errs, 'REQUIRED', rp + '.cardinality', 'confirmed 关系必须声明合法基数(1:1/N:1/1:N/N:M)');
        if (!isStr(r.confirmedBy) || !r.confirmedBy) E(errs, 'REQUIRED', rp + '.confirmedBy', 'confirmed 关系必须记 confirmedBy 证据（谁确认、依据什么）');
        // I5.5：N:1/1:1 才可能 JOIN-safe；且 to 侧键必须机器可验证唯一（Schema PK/unique index 或注入的数据侧探针证据）
        if (r.cardinality === 'N:1' || r.cardinality === '1:1') {
          var toT = r.to && r.to.table, toC = r.to && r.to.column;
          if (toT && toC) {
            var declared = declaredUniqueKeys(schema, toT);
            var key = toT + '.' + toC;
            var uniqueOk = !!declared[toC] || !!uniqEvidence[key];
            if (!uniqueOk) E(errs, 'UNSUPPORTED_RELATION_KEY', rp + '.to.column', '目标键 ' + key + ' 既非 Schema 声明唯一键(PK/unique index)也无数据侧唯一性探针证据 → 不能作 JOIN-safe 关系（r4 P2: 不靠文本声明）');
          }
        } else if (r.cardinality === '1:N' || r.cardinality === 'N:M') {
          E(errs, 'UNSUPPORTED_CARDINALITY', rp + '.cardinality', 'confirmed 关系基数 ' + r.cardinality + ' 非 JOIN-safe（fan-out 重复行），sqlbuilder 必拒');
        }
      } else if (r.cardinality != null && !hasOwn(ModelVocab.CARDINALITYS, r.cardinality)) {
        E(errs, 'INVALID_ENUM', rp + '.cardinality', '基数越枚举: ' + r.cardinality);
      }
      ['from', 'to'].forEach(function (side) {
        var s = r[side];
        if (!isObj(s)) { E(errs, 'INVALID_TYPE', rp + '.' + side, side + ' 须 {table,column}'); return; }
        requireColumn(idx, errs, s.table, s.column, rp + '.' + side, '关系 ' + side);
      });
    });

    return errs;
  }

  return { validate: validate, schemaIndex: schemaIndex };
})();
