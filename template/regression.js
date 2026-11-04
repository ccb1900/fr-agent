// template/regression.js — I6.1-C 执行/渲染回归裁决（纯函数，零依赖，离线可测）
//   不变量：任一执行/渲染失败 = 回归失败；绝不比较错误文本（两边都失败同串 ≠ 数据一致）。
//   标题/表头格属结果栅格一部分，replace_cell_value 改标题会改前两行→只比数据区(r>=2)。
var TemplateRegression = (function () {
  function dataGrid(g) { return String(g).split('\n').slice(2).join('\n'); }
  // before/after: {ok:bool, grid:string, error:string|null}
  function execution(before, after, hasDatasetOp) {
    if (!before.ok || !after.ok) return { pass: false, reason: '执行失败: before=' + (before.error || 'ok') + ' after=' + (after.error || 'ok') };
    if (hasDatasetOp) return { pass: true, reason: 'dataset 替换预期数据变化（结构/列型由集成测另证）' };
    return dataGrid(before.grid) === dataGrid(after.grid)
      ? { pass: true, reason: '数据区栅格逐格不变（标题改动属预期）' }
      : { pass: false, reason: '数据区意外变动' };
  }
  // png before/after: {ok:bool, bytes:number, error:string|null}
  function render(pngBefore, pngAfter) {
    if (!pngBefore.ok || !pngAfter.ok) return { pass: false, reason: '渲染失败: before=' + (pngBefore.error || 'ok') + ' after=' + (pngAfter.error || 'ok') };
    return { pass: true, reason: 'png before=' + pngBefore.bytes + 'B after=' + pngAfter.bytes + 'B（像素 diff 终验另计）' };
  }
  return { execution: execution, render: render, dataGrid: dataGrid };
})();
