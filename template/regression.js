// template/regression.js — I6.1-C/r5 执行/渲染/数据集回归裁决（纯函数，零依赖，离线可测）
//   不变量：任一执行/渲染/数据集失败 = 回归失败；绝不比较错误文本（两边都失败同串 ≠ 数据一致）。
//   r5 P1：dataset 替换不再"能执行就 PASS"——按 PatchSpec 逐列名/列型/行数/逐格比对读回快照。
//   r5 P2：执行对比按【实际修改坐标】屏蔽（不再固定跳前两行）；渲染做像素级 diff（尺寸+比例+bbox）。
var TemplateRegression = (function () {
  function isArr(v) { return Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  // 列型等价：声明类型 ↔ 读回 Java 类映射后的类型（number 落到具体整型/浮点属正常）
  var TYPE_EQUIV = {
    number: { integer: 1, long: 1, float: 1, decimal: 1 },
    integer: { integer: 1, long: 1 },
    long: { long: 1, integer: 1 },
    float: { float: 1, decimal: 1 },
    decimal: { decimal: 1, float: 1 },
    text: { text: 1 },
    string: { text: 1 },
    boolean: { boolean: 1 },
    date: { date: 1 },
    datetime: { datetime: 1, date: 1 }
  };
  function typeOk(declared, actual) {
    var eq = TYPE_EQUIV[declared];
    return !!eq && eq[actual] === 1;
  }
  // 值归一：null→''；数值按**十进制字符串规范化**比较（不走 IEEE-754：
  //   9007199254740992 与 ...93 必须可区分；1.50 ≡ 1.5、007 ≡ 7）。文本原样（不 trim）。
  function canonNum(s) {
    var m = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(String(s).trim());
    if (!m) return null;
    var ip = m[2].replace(/^0+/, ''); if (ip === '') ip = '0';
    var fp = (m[3] || '').replace(/0+$/, '');
    if (ip === '0' && fp === '') return '0';
    return (m[1] === '-' ? '-' : '') + ip + (fp ? '.' + fp : '');
  }
  function normCell(v) {
    if (v == null) return '';
    var s = String(v), n = canonNum(s);
    if (n != null) return n;
    // C段断点（2026-11-07）：引擎对象（ChartPainter 等）的默认 toString=「类名@十六进制哈希」，两次执行
    //   实例身份必不同——该形态不含报表内容，按类名归一，否则任何含图表的报表补丁都被「未预期单元格变动」误杀
    //   （probe_c3_titleA 系列实证：r14 c0 ChartPainter@5a4e… → ChartPainter@17f8…）。
    var m = /^([a-zA-Z][a-zA-Z0-9_.$]*)@[0-9a-fA-F]+$/.exec(s);
    if (m) return m[1];
    return s;
  }

  // before/after: {ok:bool, rows:[[text]]|null, error:string|null}
  // opts: {changedCells:[{c,r}], hasDatasetOp:bool}
  function execution(before, after, opts) {
    opts = opts || {};
    if (!before || !before.ok || !after || !after.ok) {
      return { pass: false, reason: '执行失败: before=' + ((before && before.error) || 'ok') + ' after=' + ((after && after.error) || 'ok') };
    }
    if (opts.hasDatasetOp) return { pass: true, reason: 'dataset 替换：数据一致性由 dataset 回归（列名/列型/行数/逐格）判定' };
    var b = before.rows, a = after.rows;
    if (!isArr(b) || !isArr(a)) return { pass: false, reason: '执行结果栅格形态非法（rows 非数组）' };
    if (b.length !== a.length) return { pass: false, reason: '行数变化: before=' + b.length + ' after=' + a.length };
    var changes = opts.changedCells || [];
    function masked(r, c, bv, av) {
      for (var i = 0; i < changes.length; i++) {
        var ch = changes[i];
        if (!ch || ch.r !== r) continue;
        if (ch.c === c) return true;   // 精确坐标
        // 合并单元格：同一标题值会复制到被合并的各列，同"旧值→新值"的重复格也是预期变化
        if (typeof ch.oldText === 'string' && bv === ch.oldText && av === ch.newText) return true;
      }
      return false;
    }
    for (var r = 0; r < b.length; r++) {
      if (!isArr(b[r]) || !isArr(a[r]) || b[r].length !== a[r].length) return { pass: false, reason: '第 ' + r + ' 行列数不一致' };
      for (var c = 0; c < b[r].length; c++) {
        if (masked(r, c, b[r][c], a[r][c])) continue;   // 仅屏蔽 PatchSpec 点名的单元格/其合并重复
        if (normCell(b[r][c]) !== normCell(a[r][c])) {
          return { pass: false, reason: '未预期单元格变动 r=' + r + ' c=' + c + ': "' + b[r][c] + '" → "' + a[r][c] + '"' };
        }
      }
    }
    // r6-C：关键单元格内容断言——修改后执行结果必须真的反映新值（防"对象改了但出表仍旧值"）
    var keys = opts.keyCells || [];
    for (var k = 0; k < keys.length; k++) {
      var kc = keys[k];
      if (!kc || !isNum(kc.c) || !isNum(kc.r)) continue;
      if (!a[kc.r] || normCell(a[kc.r][kc.c]) !== normCell(kc.expect)) {
        return { pass: false, reason: '关键单元格未反映修改 r=' + kc.r + ' c=' + kc.c + ': 期望="' + kc.expect + '" 实际="' + (a[kc.r] ? a[kc.r][kc.c] : '(越界)') + '"' };
      }
    }
    return { pass: true, reason: '除 PatchSpec 指定坐标外，执行栅格逐格不变；关键单元格内容与预期一致' };
  }

  // expected: {columns:[{name,type}], rows:[[raw]]}（来自 PatchSpec op）
  // actual:   {ok:true, columns:[{name,type}], rows:[[string]]} 或 {ok:false,error}（Inspector 严格读回）
  function dataset(expected, actual) {
    if (!actual || actual.ok !== true) return { pass: false, reason: '数据集读回失败: ' + ((actual && actual.error) || '快照缺失') };
    var E = (expected && expected.columns) || [], A = actual.columns;
    if (E.length !== A.length) return { pass: false, reason: '列数不符: spec=' + E.length + ' actual=' + A.length };
    for (var i = 0; i < E.length; i++) {
      if (String(E[i].name) !== String(A[i].name)) return { pass: false, reason: '第 ' + i + ' 列名不符: "' + E[i].name + '" vs "' + A[i].name + '"' };
      if (!typeOk(E[i].type, A[i].type)) return { pass: false, reason: '第 ' + i + ' 列型不符: ' + E[i].type + ' vs ' + A[i].type };
    }
    var ER = (expected && expected.rows) || [];
    if (ER.length !== actual.rows.length) return { pass: false, reason: '行数不符: spec=' + ER.length + ' actual=' + actual.rows.length };
    for (var r = 0; r < ER.length; r++) {
      if (!isArr(ER[r]) || !isArr(actual.rows[r]) || ER[r].length !== actual.rows[r].length) return { pass: false, reason: '第 ' + r + ' 行宽度不符' };
      for (var c = 0; c < ER[r].length; c++) {
        if (normCell(ER[r][c]) !== normCell(actual.rows[r][c])) {
          return { pass: false, reason: '第 ' + r + ' 行第 ' + c + ' 格不符: spec="' + ER[r][c] + '" actual="' + actual.rows[r][c] + '"' };
        }
      }
    }
    return { pass: true, reason: '读回数据集与 PatchSpec 逐列/逐格一致（' + E.length + '列×' + ER.length + '行）' };
  }

  // png before/after: {ok, bytes, error}; stats: {width,height,widthAfter,heightAfter,diffPixels,ratio,bbox}
  //   opts: {maxRatio} 默认 0.05（标题/文字重排允许小幅像素漂移；尺寸变化必失败）
  function render(pngBefore, pngAfter, stats, opts) {
    opts = opts || {};
    if (!pngBefore || !pngBefore.ok || !pngAfter || !pngAfter.ok) {
      return { pass: false, reason: '渲染失败: before=' + ((pngBefore && pngBefore.error) || 'ok') + ' after=' + ((pngAfter && pngAfter.error) || 'ok') };
    }
    if (!stats || !isNum(stats.width) || stats.width <= 0) return { pass: false, reason: '像素 diff 未执行（stats 缺失）' };
    if (stats.width !== stats.widthAfter || stats.height !== stats.heightAfter) {
      return { pass: false, reason: '渲染尺寸变化: ' + stats.width + 'x' + stats.height + ' → ' + stats.widthAfter + 'x' + stats.heightAfter };
    }
    var maxRatio = isNum(opts.maxRatio) ? opts.maxRatio : 0.05;
    var ratio = isNum(stats.ratio) ? stats.ratio : (stats.diffPixels / (stats.width * stats.height));
    if (!(ratio <= maxRatio)) return { pass: false, reason: '像素差异 ' + (ratio * 100).toFixed(2) + '% > 阈值 ' + (maxRatio * 100) + '%（bbox=' + (stats.bbox || 'n/a') + '）' };
    // r6-C：确有修改时渲染必须真的变化（0 像素差 = 修改没落到画面上，不能算通过）
    if (opts.expectPixelChange === true && !(stats.diffPixels > 0)) {
      return { pass: false, reason: 'Patch 已执行但渲染零像素差异（修改未反映到画面）' };
    }
    return { pass: true, reason: '像素差异 ' + (ratio * 100).toFixed(2) + '% ≤ ' + (maxRatio * 100) + '%（bbox=' + (stats.bbox || 'n/a') + '）' };
  }

  return { execution: execution, dataset: dataset, render: render, TYPE_EQUIV: TYPE_EQUIV };
})();
