// template/validator.js — I6 PatchSpec 校验（零依赖纯函数，沿用 I0-01 {code,path,message} 契约，抗炸）
//   守三件事：① op 必须 ∈ TemplateOps.WHITELIST（R0 探针冻结），越权 op 判 UNSUPPORTED 并回证据；
//   ② 坐标/形状合法（cell c/r 有限非负整数；value 形态；replace_dataset columns/rows 对齐）；
//   ③ 目标安全——sourceCpt/outName 禁路径穿越与基线禁写名（写回只准 staging）。
var TemplateValidator = (function () {
  function E(errs, code, path, message) { errs.push({ code: code, path: path, message: message }); }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isArr(v) { return Array.isArray(v); }
  function isStr(v) { return typeof v === 'string'; }
  function isNonNegInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 0; }
  function unsafePath(s) { return /[\\]|:|\.\.|^\/|\/|\\/.test(String(s)) ; }   // 含分隔符/盘符/.. 皆拒（相对 reportlets 根名单段除外由 caller 传合法 rel）
  // r6-B：列型 ↔ 值型的严格对应（validator 阶段定死；patch 层只做转换，boolean 禁静默 truthy）。
  //   数值列允许"精确字符串"形态（大整数/高精度 Decimal 超出 IEEE-754 时唯一不丢精度的表达）。
  function valueOk(t, v) {
    if (v == null) return true;                                    // 允许空值（保持原列空语义）
    if (t === 'text' || t === 'string') return typeof v === 'string';
    if (t === 'integer' || t === 'long') {
      if (typeof v === 'number') return isFinite(v) && Math.floor(v) === v;
      return isStr(v) && /^[+-]?\d+$/.test(v);
    }
    if (t === 'number' || t === 'float' || t === 'decimal') {
      if (typeof v === 'number') return isFinite(v);
      return isStr(v) && /^[+-]?\d+(\.\d+)?$/.test(v);
    }
    if (t === 'boolean') return typeof v === 'boolean';
    if (t === 'date') return isStr(v) && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);
    if (t === 'datetime') return isStr(v) && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[ T]\d{2}:\d{2}:\d{2}$/.test(v);
    return false;
  }

  function validate(patch) {
    var errs = [];
    if (!isObj(patch)) { E(errs, 'INVALID_TYPE', 'patch', 'PatchSpec 必须是对象'); return errs; }
    if (patch.patchVersion != null && String(patch.patchVersion) !== TemplateOps.PATCH_VERSION) {
      E(errs, 'UNSUPPORTED_PATCH_VERSION', 'patchVersion', '不支持的 patchVersion: ' + patch.patchVersion); return errs;
    }
    // source：必须点名一个 reportlets 相对 .cpt，且不得命中基线禁写名
      if (!isStr(patch.sourceCpt) || !patch.sourceCpt) E(errs, 'REQUIRED', 'sourceCpt', 'sourceCpt 必填（reportlets 相对 .cpt）');
      else {
        TemplateOps.FORBIDDEN_TARGETS.forEach(function (b) { if (String(patch.sourceCpt).indexOf(b) >= 0) E(errs, 'FORBIDDEN_TARGET', 'sourceCpt', '禁改字节基线件: ' + b); });
        if (/[\\:]|\.\./.test(patch.sourceCpt)) E(errs, 'INVALID_PATH', 'sourceCpt', 'sourceCpt 禁路径穿越/盘符/反斜杠: ' + patch.sourceCpt);
        if (/;|--|\$\{/.test(patch.sourceCpt)) E(errs, 'INVALID_PATH', 'sourceCpt', 'sourceCpt 含可疑注入字符');
      }
      if (patch.outName != null && /[\/\\]|\.\.|:/.test(String(patch.outName))) {
        E(errs, 'INVALID_PATH', 'outName', 'outName 必须是裸文件名（无路径/盘符/..）: ' + patch.outName);
      }
    if (!isArr(patch.ops) || !patch.ops.length) { E(errs, 'REQUIRED', 'ops', 'ops 必填且非空'); return errs; }
    patch.ops.forEach(function (op, i) {
      var p = 'ops[' + i + ']';
      if (!isObj(op)) { E(errs, 'INVALID_TYPE', p, 'op 必须是对象'); return; }
      var kind = op.op;
      if (!isStr(kind)) { E(errs, 'REQUIRED', p + '.op', 'op 名必填'); return; }
      if (hasOwn(TemplateOps.UNIMPLEMENTED, kind)) { E(errs, 'UNSUPPORTED_CAPABILITY', p + '.op', 'op "' + kind + '" v1 不做（' + TemplateOps.UNIMPLEMENTED[kind] + '）'); return; }
      if (!hasOwn(TemplateOps.WHITELIST, kind)) { E(errs, 'INVALID_ENUM', p + '.op', '未知 op: ' + kind); return; }
      if (kind === 'replace_cell_value' && !isNonNegInt(op.sheet)) E(errs, 'INVALID_NUMBER', p + '.sheet', 'sheet 索引须为非负整数');
      if (kind === 'replace_cell_value') {
        if (!isObj(op.cell) || !isNonNegInt(op.cell.c) || !isNonNegInt(op.cell.r)) E(errs, 'INVALID_SHAPE', p + '.cell', 'cell 需 {c,r} 非负整数');
        if (!isObj(op.value)) E(errs, 'INVALID_TYPE', p + '.value', 'value 需 {kind,text}');
        else {
          if (op.value.kind !== 'text' && op.value.kind !== 'formula') E(errs, 'INVALID_ENUM', p + '.value.kind', "value.kind ∈ text|formula");
          if (!isStr(op.value.text) || op.value.text === '') E(errs, 'REQUIRED', p + '.value.text', 'value.text 必填');
          else if (op.value.kind === 'formula' && op.value.text.charAt(0) !== '=') E(errs, 'INVALID_TYPE', p + '.value.text', 'formula 须以 = 开头（ir.js 同规）');
        }
      } else if (kind === 'replace_dataset') {
        if (!isStr(op.name) || !op.name) E(errs, 'REQUIRED', p + '.name', '数据集 name 必填');
        if (!isArr(op.columns) || !op.columns.length) E(errs, 'INVALID_ARRAY', p + '.columns', 'columns 须非空数组');
        else {
          var names = {};
          op.columns.forEach(function (c, ci) {
            var cp = p + '.columns[' + ci + ']';
            if (!isObj(c)) { E(errs, 'INVALID_TYPE', cp, '列须 {name,type}'); return; }
            if (!isStr(c.name) || !c.name) E(errs, 'REQUIRED', cp + '.name', '列名必填');
            else if (names[c.name]) E(errs, 'INVALID_SHAPE', cp + '.name', '列名重复: ' + c.name);
            else names[c.name] = 1;
            if (!isStr(c.type) || !hasOwn(TemplateOps.DS_TYPES, c.type)) E(errs, 'INVALID_ENUM', cp + '.type', '列型须 ∈ ' + Object.keys(TemplateOps.DS_TYPES).join('|'));
          });
        }
        if (isArr(op.columns) && isArr(op.rows)) op.rows.forEach(function (r, ri) {
          if (!isArr(r)) { E(errs, 'INVALID_ARRAY', p + '.rows[' + ri + ']', 'row 须数组'); return; }
          if (r.length !== op.columns.length) { E(errs, 'INVALID_SHAPE', p + '.rows[' + ri + ']', 'row 宽度≠columns'); return; }
          for (var ci2 = 0; ci2 < r.length; ci2++) {
            var col = op.columns[ci2];
            if (!isObj(col) || !hasOwn(TemplateOps.DS_TYPES, col.type)) continue;   // 列型错已在上面报，避免重复噪声
            if (!valueOk(col.type, r[ci2])) E(errs, 'INVALID_TYPE', p + '.rows[' + ri + '][' + ci2 + ']', '值型不符列型 ' + col.type + ': ' + JSON.stringify(r[ci2]));
          }
        });
        else if (!isArr(op.rows)) E(errs, 'INVALID_ARRAY', p + '.rows', 'rows 须数组');
      }
    });
    return errs;
  }
  return { validate: validate };
})();
