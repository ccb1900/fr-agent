// template/diff.js — I6 纯函数：结构 diff（判"未改部分不变"）+ 命名样式守卫（零依赖，离线可测）
//   导出字节 MD5 不可用（官方件含 <UUID> 非确定，87/240 self=false，README:126）→ 改用语义 token diff：
//     CDATA 文本值多重集 + 关键节点计数（<O/<Style/Row/ColumnDefinition/TableData）→ 只有预期改动出现才算"未改部分不变"。
var TemplateDiff = (function () {
  function isNoise(t) {
    // 序列化噪声（README:126 官方件 re-export 非字节稳定：RowHeight/ColumnWidth 数字数组、UUID、时间戳）
    if (/^[\d,\s.]+$/.test(t)) return true;                        // 纯数字/逗号数组（列宽/行高）
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t)) return true;         // UUID
    if (/^\d{10,}$/.test(t.trim())) return true;                   // 长数字串（epoch/雪花键内部）
    return false;
  }
  function tokens(xml) {
    var s = String(xml), m, out = [];
    var re = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
    while ((m = re.exec(s))) { var t = m[1]; if (!isNoise(t)) out.push(t); }   // I6：只比语义内容，忽略序列化噪声
    return out;
  }
  function countAll(xml, re) { return (String(xml).match(re) || []).length; }
  function profile(xml) {
    return {
      cells: countAll(xml, /<O[ >]/g),
      styles: countAll(xml, /<Style[ >]/g),
      rows: countAll(xml, /<Row[ >]/g),
      colDefs: countAll(xml, /<ColumnDefinition[ >]/g),
      tableData: countAll(xml, /<TableData[ >]/g),
      dataCols: countAll(xml, /<ColumnDescriptor[ >]/g)
    };
  }
  function namedStyles(xml) { return countAll(xml, /style_name=/g); }

  // 多重集差（added=after 有 before 无 的净增，removed 反之），忽略次序
  function multisetDiff(before, after) {
    var b = {}, a = {};
    tokens(before).forEach(function (t) { b[t] = (b[t] || 0) + 1; });
    tokens(after).forEach(function (t) { a[t] = (a[t] || 0) + 1; });
    var added = [], removed = [], k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) { var d = a[k] - (b[k] || 0); if (d > 0) for (var i = 0; i < d; i++) added.push(k); }
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) { var d2 = b[k] - (a[k] || 0); if (d2 > 0) for (var j = 0; j < d2; j++) removed.push(b[k] && k); }
    return { added: added, removed: removed };
  }
  // expected: {added:[token], removed:[token]} 预期改动；返回 unintended（超出预期的 CDATA 变化）+ 结构计数是否守恒
  function diff(beforeXml, afterXml, expected) {
    expected = expected || {};
    var eA = (expected.added || []).slice(), eR = (expected.removed || []).slice();
    var ms = multisetDiff(beforeXml, afterXml);
    function consume(bag, list) { var out = []; list.forEach(function (x) { var idx = bag.indexOf(x); if (idx >= 0) bag.splice(idx, 1); else out.push(x); }); return out; }
    var unintendedAdded = consume(eA.slice(), ms.added);
    var unintendedRemoved = consume(eR.slice(), ms.removed);
    var pb = profile(beforeXml), pa = profile(afterXml);
    var structDelta = {};
    Object.keys(pb).forEach(function (k) { if (pb[k] !== pa[k]) structDelta[k] = pb[k] + '→' + pa[k]; });
    return {
      added: ms.added, removed: ms.removed,
      unintended: { added: unintendedAdded, removed: unintendedRemoved },
      structDelta: structDelta,
      namedStyleRisk: { before: namedStyles(beforeXml), after: namedStyles(afterXml) },
      clean: unintendedAdded.length === 0 && unintendedRemoved.length === 0
    };
  }
  return { diff: diff, namedStyles: namedStyles, profile: profile, tokens: tokens };
})();
