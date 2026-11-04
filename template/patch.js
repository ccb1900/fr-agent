// template/patch.js — I6 薄壳：在读回的 WorkBook 上执行【R0 探针冻结的白名单】mutation（触 com.fr）
//   仅两类（data/template_patch_readback_truth.txt 证 export→re-read 成立）：
//     replace_cell_value → ws.getCellElement(c,r).setValue(String|Formula)   （R0 (a) PASS）
//     replace_dataset    → wb.putTableData(name, EmbeddedTableData)          （R0 (b) PASS；make_report.js:71 同路）
//   其余 op（style/column-width/column/filter/params/title）探针未过 → TemplateOps 已列 UNIMPLEMENTED，本件拒（不半成品）。
//   每 op 执行前经 TemplateLocator.exists 校验目标真实存在（越界/不存在→拒，不静默新建）。
var TemplatePatch = (function () {
  var J = function (n) { return Java.type(n); };
  var Class = J('java.lang.Class');
  var DS_JTYPE = { text: 'java.lang.String', string: 'java.lang.String', number: 'java.lang.Integer', integer: 'java.lang.Integer', long: 'java.lang.Long', float: 'java.lang.Double', decimal: 'java.math.BigDecimal', boolean: 'java.lang.Boolean', date: 'java.sql.Date', datetime: 'java.sql.Timestamp' };
  // r5 P2：类型转换只做"已由 validator 定死"的转换；未知列型/错误值型一律抛（不静默回退 String、
  //   boolean 不再用 !!v——字符串 "false" 是 truthy，会把 false 写成本 true）。
  function javaValue(t, v) {
    if (v == null) return null;
    if (t === 'number' || t === 'integer') return J('java.lang.Integer').valueOf(v);
    if (t === 'long') return J('java.lang.Long').valueOf(v);
    if (t === 'float') return J('java.lang.Double').valueOf(v);
    if (t === 'decimal') return new (J('java.math.BigDecimal'))(String(v));
    if (t === 'boolean') {
      if (typeof v !== 'boolean') throw new Error('[patch] boolean 列收到非布尔值: ' + JSON.stringify(v));
      return J('java.lang.Boolean').valueOf(v);
    }
    if (t === 'date') return J('java.sql.Date').valueOf(String(v));
    if (t === 'datetime') return J('java.sql.Timestamp').valueOf(String(v).replace('T', ' '));
    if (t === 'text' || t === 'string') return String(v);
    throw new Error('[patch] 未知列型（validator 应已拦）: ' + t);
  }

  // 返回 {applied:bool, before:{...}}（before 供 diff 预期集：改了哪个格/哪个集旧值）
  function apply(wb, op, descriptor) {
    var ex = TemplateLocator.exists(op, descriptor);
    if (!ex.ok) throw new Error('[patch] 目标不可定位: ' + ex.reason);
    if (op.op === 'replace_cell_value') {
      var sh = wb.getReport(op.sheet);
      var ce = sh.getCellElement(op.cell.c, op.cell.r);
      if (!ce) throw new Error('[patch] 格不存在（不新建）: sheet' + op.sheet + ' (' + op.cell.c + ',' + op.cell.r + ')');
      var oldText = (function () { try { var v = ce.getValue(); return v == null ? '' : String(v); } catch (e) { return ''; } })();
      var newVal = op.value.kind === 'formula' ? new (J('com.fr.base.Formula'))(op.value.text) : J('java.lang.String').valueOf(op.value.text);
      ce.setValue(newVal);
      return { before: { cell: { sheet: op.sheet, c: op.cell.c, r: op.cell.r, oldText: oldText, newText: op.value.text } } };
    }
    if (op.op === 'replace_dataset') {
      if (!TemplateInspector.datasetExists(wb, op.name)) throw new Error('[patch] 数据集不存在（不静默新建）: ' + op.name);
      var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
      etd.setDsName(op.name);
      op.columns.forEach(function (c) {
        var jt = DS_JTYPE[c.type];
        if (!jt) throw new Error('[patch] 未知列型（validator 应已拦）: ' + c.type);
        etd.addColumn(c.name, Class.forName(jt));
      });
      op.rows.forEach(function (src) {
        var row = [];
        for (var i = 0; i < src.length; i++) row.push(javaValue(op.columns[i].type, src[i]));
        etd.addRow(J('java.util.Arrays').asList(row));
      });
      wb.putTableData(op.name, etd);
      return { before: { dataset: { name: op.name, rowCount: op.rows.length, cols: op.columns.map(function (c) { return c.name; }) } } };
    }
    throw new Error('[patch] 非白名单 op（TemplateOps 应已拦）: ' + op.op);
  }
  return { apply: apply };
})();
