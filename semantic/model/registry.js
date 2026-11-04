// semantic/model/registry.js — I3 模型索引底座（零 java；输入=已 parse 的 model 对象；离线可测）
//   把 model.json 建成 by-name 索引 + resolver 用的术语表。不校验合法性（那是 validator），只组织。
var ModelRegistry = (function () {
  function index(model) {
    var entities = {}, metrics = {}, dimensions = {}, relationships = [], rules = (model && model.rules) || {};
    ((model && model.entities) || []).forEach(function (e) { if (e && e.name) entities[e.name] = e; });
    ((model && model.metrics) || []).forEach(function (m) { if (m && m.name) metrics[m.name] = m; });
    ((model && model.dimensions) || []).forEach(function (d) { if (d && d.name) dimensions[d.name] = d; });
    ((model && model.relationships) || []).forEach(function (r) { if (r) relationships.push(r); });
    return {
      model: model,
      entities: entities, metrics: metrics, dimensions: dimensions, relationships: relationships, rules: rules,
      entityNames: Object.keys(entities),
      // 术语表（resolver 用）：业务标签 + 实体属性名 + 列名 + 指标名/标签 + 维度名/标签，每条带 target 与 confidence 依据
      terms: buildTerms(entities, metrics, dimensions)
    };
  }

  // 一个术语可能指向多个候选（如"评分"→指标 平均分 + 实体属性 score）——这正是要暴露的歧义，不合并。
  function buildTerms(entities, metrics, dimensions) {
    var terms = {}; // term -> [{target, kind, ref, confidence}]
    function add(term, cand) {
      if (!term) return;
      var t = String(term);
      (terms[t] || (terms[t] = [])).push(cand);
    }
    Object.keys(entities).forEach(function (en) {
      var e = entities[en];
      (e.properties || []).forEach(function (p) {
        add(p.name, { target: 'property', ref: en + '.' + p.name, column: (e.table || '') + '.' + p.column, confidence: 'high' });
        add(p.label, { target: 'property', ref: en + '.' + p.name, column: (e.table || '') + '.' + p.column, confidence: 'medium' });
        if (p.column) add(p.column, { target: 'column', ref: (e.table || '') + '.' + p.column, confidence: 'high' });
      });
    });
    Object.keys(metrics).forEach(function (mn) {
      add(mn, { target: 'metric', ref: mn, confidence: 'high' });
      add(metrics[mn].label, { target: 'metric', ref: mn, confidence: 'medium' });
    });
    Object.keys(dimensions).forEach(function (dn) {
      add(dn, { target: 'dimension', ref: dn, confidence: 'high' });
      add(dimensions[dn].label, { target: 'dimension', ref: dn, confidence: 'medium' });
    });
    return terms;
  }

  return { index: index };
})();
