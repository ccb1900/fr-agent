// template/diff.js — I6.1 结构 diff（判"未改部分不变"）+ 命名样式守卫（零依赖，离线可测）
//   导出字节 MD5 不可用（官方件含 <UUID> 非确定，87/240 self=false，README:126）→ 用语义比较：
//     ① CDATA 文本多重集  ② 关键 XML 属性签名多重集（r4 P1：此前只看 CDATA，属性/非CDATA 改动漏检）
//     ③ 关键节点计数 profile（r4 P1：structDelta 必须纳入 clean）
//   按 op 分类允许的结构变化：replace_cell_value→结构计数全守恒；replace_dataset→仅数据集相关结构可变。
var TemplateDiff = (function () {
  // r5 P2：数字噪声只在已证实的引擎序列化节点上忽略（RowHeight/ColumnWidth 是数字数组），
  //   绝不全局过滤 CDATA——否则数字型业务单元格（123→456）会被当成噪声，真实数据变化漏检。
  var NUMERIC_NOISE_TAGS = { RowHeight: 1, ColumnWidth: 1, Height: 1, Width: 1 };
  function isNumericNoise(t) { return /^[\d,\s.]+$/.test(t) || /^\d{10,}$/.test(t.trim()); }
  function isUuidNoise(t) { return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t); }
  // 取 CDATA 前最近的开标签名（节点上下文；找不到则视为无上下文，不享受数字噪声豁免）
  function ownerTag(s, idx) {
    var head = s.slice(0, idx), m, last = null;
    var re = /<([A-Za-z_][\w:.-]*)/g;
    while ((m = re.exec(head))) last = m[1];
    return last;
  }
  function tokens(xml) {
    var s = String(xml), m, out = [];
    var re = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
    while ((m = re.exec(s))) {
      var t = m[1], tag = ownerTag(s, m.index);
      if (isUuidNoise(t)) continue;                                   // UUID 全局噪声（引擎生成 ID）
      if (tag && NUMERIC_NOISE_TAGS[tag] && isNumericNoise(t)) continue;   // 列宽/行高数字数组
      out.push(t);
    }
    return out;
  }
  // I6.1-B：关键属性签名（只取语义稳定属性，排除 UUID/时间戳等噪声值）
  var SEMANTIC_ATTRS = /^(class|name|customName|columnName|dsName|value|t|type|function|style_name|formula|op|kind|aggregation|cardinality|source)$/;
  var NOISE_ATTR_VAL = /^[0-9a-f]{8}-[0-9a-f]{4}|^\d{10,}$|^\d{4}-\d\d-\d\dT/i;
  // r4 I6.1-B：re-export 时引擎会附加内部标记属性（主题/ForkId/TemplateId），非用户语义变化→噪声过滤
  var ENGINE_CLASS_NOISE = /^com\.fr\.base\.iofile\.attr\.(TemplateThemeAttrMark|ForkIdAttrMark|TemplateIdAttrMark)$/;
  var ENGINE_NAME_NOISE = /兼容主题|TemplateId|ForkId|兼容|mark/i;
  // r5 P2：属性签名带节点上下文（tag/attr=value）——属性在两个节点间移动、总量不变也能被识别
  function attrTokens(xml) {
    var s = String(xml), tm, out = [];
    var tagRe = /<([A-Za-z_][\w:.-]*)([^>]*)>/g;
    while ((tm = tagRe.exec(s))) {
      var tag = tm[1], attrs = tm[2] || '', am;
      var attrRe = /([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"/g;
      while ((am = attrRe.exec(attrs))) {
        if (!SEMANTIC_ATTRS.test(am[1])) continue;
        var v = am[2];
        if (isUuidNoise(v) || NOISE_ATTR_VAL.test(v)) continue;
        if (am[1] === 'class' && ENGINE_CLASS_NOISE.test(v)) continue;
        if (am[1] === 'name' && ENGINE_NAME_NOISE.test(v)) continue;
        out.push(tag + '/' + am[1] + '=' + v);
      }
    }
    return out;
  }
  function countAll(xml, re) { return (String(xml).match(re) || []).length; }
  // 3.2-2（反例先行，stage3 final check S6a）：数据集本体豁免必须限定在 <TableData>…</TableData> 节点内。
  //   旧实现 isDatasetToken 直接按 token 文本判断，`含 >$ 的 ≥10 可打印字符` 宽规则把普通 <O> 单元格文本
  //   （budget>100$ → budget>999$）也豁免了（clean=true 放过非数据区改动，基线实测穿透）。改为按节点
  //   上下文把 CDATA token 分成 dataset/plain 两个多重集：dataset 侧=TableData 节点内的 CDATA（与 tokens()
  //   同一套 UUID/数字噪声过滤），dataset op 的豁免只作用于 dataset 侧；plain 侧（单元格文本/样式/其它
  //   语义）仍严格守恒，不享受 isDatasetToken 豁免。
  function datasetNodeCdata(xml) {
    var s = String(xml), out = {}, m;
    var spanRe = /<TableData[\s>][\s\S]*?<\/TableData\s*>/g;
    while ((m = spanRe.exec(s))) {
      var span = m[0], cm, cRe = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
      while ((cm = cRe.exec(span))) {
        var t = cm[1];
        if (isUuidNoise(t)) continue;
        var tag = ownerTag(span, cm.index);
        if (tag && NUMERIC_NOISE_TAGS[tag] && isNumericNoise(t)) continue;
        out[t] = (out[t] || 0) + 1;
      }
    }
    return out;
  }
  function countsToList(c) {
    var l = [];
    for (var k in c) { if (Object.prototype.hasOwnProperty.call(c, k)) { for (var i = 0; i < c[k]; i++) l.push(k); } }
    return l;
  }
  function subMultiset(list, counts) {
    var c = {}, out = [];
    for (var k in counts) { if (Object.prototype.hasOwnProperty.call(counts, k)) c[k] = counts[k]; }
    list.forEach(function (t) { if ((c[t] || 0) > 0) { c[t]--; } else { out.push(t); } });
    return out;
  }
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

  function multisetDiff(listB, listA) {
    var b = {}, a = {};
    listB.forEach(function (t) { b[t] = (b[t] || 0) + 1; });
    listA.forEach(function (t) { a[t] = (a[t] || 0) + 1; });
    var added = [], removed = [], k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) { var d = a[k] - (b[k] || 0); if (d > 0) for (var i = 0; i < d; i++) added.push(k); }
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) { var d2 = b[k] - (a[k] || 0); if (d2 > 0) for (var j = 0; j < d2; j++) removed.push(k); }
    return { added: added, removed: removed };
  }
  function consume(bag, list) { var out = []; list.forEach(function (x) { var idx = bag.indexOf(x); if (idx >= 0) bag.splice(idx, 1); else out.push(x); }); return out; }

  // expected: {added,removed, ops:[{op:name,...}]} —— ops 决定哪些结构变化被允许
  //   replace_cell_value: 任何结构计数变化都不允许；replace_dataset: 仅 dataCols/tableData 允许变（其余守恒）。
  function diff(beforeXml, afterXml, expected) {
    expected = expected || {};
    var allB = tokens(beforeXml), allA = tokens(afterXml);
    var ms = multisetDiff(allB, allA);
    // 3.2-2：dataset/plain 双侧拆分（dataset 侧 = TableData 节点内的 CDATA 多重集）
    var dsB = datasetNodeCdata(beforeXml), dsA = datasetNodeCdata(afterXml);
    var plainB = subMultiset(allB, dsB), plainA = subMultiset(allA, dsA);
    var msPlain = multisetDiff(plainB, plainA);
    var msDs = multisetDiff(countsToList(dsB), countsToList(dsA));
    var ams = multisetDiff(attrTokens(beforeXml), attrTokens(afterXml));
    var eA = (expected.added || []).slice(), eR = (expected.removed || []).slice();
    var eAttrA = (expected.attrAdded || []).slice(), eAttrR = (expected.attrRemoved || []).slice();
    // expected（PatchSpec 点名的单元格变化）只从 plain 侧抵扣；dataset 侧的豁免由 isDatasetToken 管辖
    var unintendedAdded = consume(eA.slice(), msPlain.added);
    var unintendedRemoved = consume(eR.slice(), msPlain.removed);
    var unintendedAttrAdded = consume(eAttrA.slice(), ams.added);
    var unintendedAttrRemoved = consume(eAttrR.slice(), ams.removed);

    var pb = profile(beforeXml), pa = profile(afterXml);
    var structDelta = {}, unintendedStruct = [];
    var ops = expected.ops || [];
    var hasDatasetOp = ops.some(function (o) { return o.op === 'replace_dataset'; });
    // I6.1-B：replace_dataset 时数据集本体（SQL/连接/列名/Java 类/行值/序列化属性）预期整体替换，
    //   这些 token 从 unintended 豁免；但单元格/样式/其它语义 token 仍严格守恒（不静默放过未改部分）。
    //   3.2-2：isDatasetToken 现在只作用于【TableData 节点内】的 token（msDs）——普通 <O> 单元格文本
    //   不再被文本宽规则误豁免；无 dataset op 时 dataset 侧变化一律算未预期（改数据集却不申报=可疑）。
    function isDatasetToken(t) {
      var s = String(t).trim();
      if (s === '' || /^(ds\d+|ATOM_LIVE)$/.test(s)) return true;        // 空占位 / 数据集名 / 连接名
      if (/SELECT\s|FROM\s|GROUP BY|ORDER BY|TRY_CAST|BETWEEN/.test(s)) return true;
      if (/java\.lang\.|java\.math\.|java\.sql\./.test(s)) return true;
      if (/EmbeddedTableData|DBTableData|NameDatabaseConnection|ATOM_LIVE/.test(s)) return true;
      if (/[,]/.test(s) && /^[\w,.\s"'\-]+$/.test(s)) return true;   // 列名 CSV / 行值 CSV（旧/新集）
      // 阶段3 反例（任务二真跑）：EmbeddedTableData 行值序列化串是【含换行】的多行 token —— \n(<0x20) 不在
      //   [\x20-\x7E] 内，旧正则漏配 → 合法 replace_dataset 被 diff 误杀。扩入 \r\n；中文等非 ASCII 仍不匹配
      //   （豁免不扩大化，fast_template 两断言钉住）。
      if (/^[\x20-\x7E\r\n]{10,}$/.test(s) && /[>"'~$]/.test(s)) return true;  // 内嵌行序列化串（含多行）
      return false;
    }
    var dsAdded = hasDatasetOp ? msDs.added.filter(function (t) { return !isDatasetToken(t); }) : msDs.added.slice();
    var dsRemoved = hasDatasetOp ? msDs.removed.filter(function (t) { return !isDatasetToken(t); }) : msDs.removed.slice();
    unintendedAdded = unintendedAdded.concat(dsAdded);
    unintendedRemoved = unintendedRemoved.concat(dsRemoved);
    if (hasDatasetOp) {
      unintendedAttrAdded = unintendedAttrAdded.filter(function (t) { return !/class=com\.fr\.data\.impl\.(EmbeddedTableData|DBTableData|NameDatabaseConnection)/.test(t); });
      unintendedAttrRemoved = unintendedAttrRemoved.filter(function (t) { return !/class=com\.fr\.data\.impl\.(DBTableData|NameDatabaseConnection)/.test(t); });
    }
    var datasetAllowed = { dataCols: 1, tableData: 1 };   // 数据集替换允许变化的结构项
    Object.keys(pb).forEach(function (k) {
      if (pb[k] !== pa[k]) {
        structDelta[k] = pb[k] + '→' + pa[k];
        if (!(hasDatasetOp && datasetAllowed[k])) unintendedStruct.push(k + ':' + structDelta[k]);
      }
    });

    var clean = unintendedAdded.length === 0 && unintendedRemoved.length === 0 &&
      unintendedAttrAdded.length === 0 && unintendedAttrRemoved.length === 0 &&
      unintendedStruct.length === 0;
    return {
      added: ms.added, removed: ms.removed,
      attrAdded: ams.added, attrRemoved: ams.removed,
      unintended: { added: unintendedAdded, removed: unintendedRemoved, attrAdded: unintendedAttrAdded, attrRemoved: unintendedAttrRemoved, struct: unintendedStruct },
      structDelta: structDelta,
      namedStyleRisk: { before: namedStyles(beforeXml), after: namedStyles(afterXml) },
      clean: clean
    };
  }
  return { diff: diff, namedStyles: namedStyles, profile: profile, tokens: tokens, attrTokens: attrTokens };
})();
