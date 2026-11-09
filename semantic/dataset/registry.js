// semantic/dataset/registry.js — Dataset 资产索引（纯 JS，零 Java/零 IO；R7a/R7b 语义层红线）
//   职责（且仅此）：把"已读入的资产文档"组织成可按域/id/状态查询的索引，并检出重复 id。
//   不读文件、不写文件、不校验契约（那是 definition.js）、不生成 SQL（那是 sqlbuilder）。
//   IO 在工具层（agent/tools/*），本层吃纯数据 → 离线可测、与引擎解耦（同 I2/I3 分层理由）。
var DatasetRegistry = (function () {
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  // entries: [{ relPath, doc }] → { byId, byDomain, list, errors }
  //   映射用 null-prototype：域/id 来自资产内容，`__proto__`、`constructor` 之类键
  //   若落到普通对象上会污染原型或假命中（本轮实测 build 直接 TypeError 崩溃）。
  //   D2 硬约束：errors 非空时管理工具必须停（不得"报着重复 id 还继续用其中一个"）。
  function build(entries) {
    var byId = Object.create(null), byDomain = Object.create(null), list = [], errors = [];
    (entries || []).forEach(function (en) {
      if (!isObj(en) || !isObj(en.doc) || typeof en.doc.id !== 'string') { errors.push('UNPARSEABLE@' + (en && en.relPath)); return; }
      var id = en.doc.id;
      if (byId[id]) { errors.push('DUPLICATE_ID:' + id + '@' + en.relPath); return; }   // 同 id 不静默覆盖
      byId[id] = { id: id, relPath: en.relPath, doc: en.doc, domain: en.doc.domain, status: en.doc.status, version: en.doc.datasetVersion };
      var d = typeof en.doc.domain === 'string' && en.doc.domain ? en.doc.domain : '(none)';
      if (!Object.prototype.hasOwnProperty.call(byDomain, d)) byDomain[d] = [];
      byDomain[d].push(byId[id]);
      list.push(byId[id]);
    });
    list.sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });   // 确定序
    Object.keys(byDomain).forEach(function (k) {
      byDomain[k].sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
    });
    return {
      byId: byId, byDomain: byDomain, list: list, errors: errors,
      domains: function () { return Object.keys(byDomain).sort(); },
      // hasOwn 判定：null-prototype 已够用，这里再显式一次，防未来有人把 map 换成普通对象
      resolve: function (id) { return Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : null; },
      byStatus: function (domain, status) {
        var rows = Object.prototype.hasOwnProperty.call(byDomain, domain) ? byDomain[domain] : [];
        return rows.filter(function (r) { return status == null || r.status === status; });
      }
    };
  }
  return { build: build };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DatasetRegistry;
