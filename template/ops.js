// template/ops.js — I6 patch 操作白名单 + 基线禁写名单（冻结点，一处真相；零依赖，可离线测）
//   白名单由 R0 探针冻结：仅 R0 证明"读回→改→export→再读回"能跨写的操作才入。
//   r2 §6.2 其余项（set_cell_style/set_column_width/add·remove_column/add_filter/change_filter_default/set_report_title）
//   探针不过 / 读回无口 / 命名样式有损 → 一律 UNIMPLEMENTED 且标注证据，不半成品、不偷试（AGENTS §5 先证据）。
var TemplateOps = (function () {
  var PATCH_VERSION = '1';

  // R0 探针（data/template_patch_readback_truth.txt）实测 PASS 的两类：
  var WHITELIST = {
    replace_cell_value: { args: ['sheet', 'cell', 'value'] },   // cell.setValue→export→re-read PASS
    replace_dataset: { args: ['name', 'columns', 'rows'] }     // putTableData→export→re-read colCount 变 PASS
  };
  // 明确不做（含 R0 证据/取证理由）——validator 据此把越权 op 判 UNSUPPORTED 并回证据指针
  var UNIMPLEMENTED = {
    set_cell_style: '读回对象 setStyle 无证据 + 命名样式读回即默认化(README:103)→未改部分会损坏',
    set_column_width: 'R0 探针 setColumnWidth 方法签名不合(WrongMethodTypeException UNIT≠int)，读回对象不可靠',
    'add_column': '读回对象加列无证据；跨列引用/展开会波及未改部分',
    'remove_column': '同 add_column；删列牵连 DSColumn 绑定',
    add_filter: '参数/条件面读回无口（getReportParameterAttr 全库 0 命中）',
    change_filter_default: '参数控件读回无口（同上）',
    set_report_title: '报表标题对象级 setter 无证据；若标题是文本格请改用 replace_cell_value'
  };

  // 禁写目标（字节基线件 + 任何绝对/越界路径）——patch 只能写 staging，绝不覆盖这些
  var FORBIDDEN_TARGETS = ['demo_api.cpt', 'demo_template_final.cpt'];

  return {
    PATCH_VERSION: PATCH_VERSION,
    WHITELIST: WHITELIST,
    UNIMPLEMENTED: UNIMPLEMENTED,
    FORBIDDEN_TARGETS: FORBIDDEN_TARGETS,
    capabilities: function () {
      return {
        patchVersion: PATCH_VERSION,
        supported: Object.keys(WHITELIST),
        unimplemented: UNIMPLEMENTED,
        note: 'v1 白名单由 R0 读回/写回探针冻结；写回强制 staging 隔离、原始件保留、命名样式件默认 abort'
      };
    }
  };
})();
