// template/locator.js — I6 纯函数：把 op 目标坐标对"inspect 描述符"做存在性/范围校验（零依赖，可离线测）
//   运行时 patch_main 先用 inspector 取 workbook 描述符（sheets 数、各 sheet 格网格、数据集名），
//   再用本件判定 op 指向的格/数据集是否真实存在——不存在即拒（不静默新建、不越界改）。
var TemplateLocator = (function () {
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  // descriptor: {sheetCount:N, sheets:[{rows,cols,datasetNames?[]}], datasetNames:[...]}
  function exists(op, descriptor) {
    var d = descriptor || {};
    var si = op.sheet;
    if (op.op === 'replace_dataset') {
      var names0 = d.datasetNames || [];
      return (names0.indexOf(op.name) >= 0) ? { ok: true } : { ok: false, reason: '数据集不存在，拒绝新建: ' + op.name };
    }
    if (!(typeof si === 'number' && si >= 0 && si < (d.sheetCount || 0))) return { ok: false, reason: 'sheet 越界: ' + si };
    var sh = (d.sheets || [])[si] || {};
    if (op.op === 'replace_cell_value') {
      if (!op.cell) return { ok: false, reason: '缺 cell' };
      if (!(op.cell.c >= 0 && op.cell.c < (sh.cols || 0) && op.cell.r >= 0 && op.cell.r < (sh.rows || 0)))
        return { ok: false, reason: 'cell 越界 (c=' + op.cell.c + ',r=' + op.cell.r + ' / ' + (sh.cols || 0) + 'x' + (sh.rows || 0) + ')' };
      return { ok: true };
    }
    return { ok: false, reason: '未知 op' };
  }
  return { exists: exists };
})();
