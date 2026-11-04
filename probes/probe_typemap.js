// probes/probe_typemap.js — I0-05 实机探针：FR 对 8 候选数据类型的真实接纳/显示/执行保真
//   r2.md 任务 0.4 铁律："具体 FineReport 日期对象映射必须通过实际运行探针确认，不能凭 Java 类型名称猜测"。
//   探针面（一手实证三问）：
//     Q1 addColumn(Class) + execute 后，结果格里每格的 Java 类与显示文本是什么？（决定 object.js 值转换形态）
//     Q2 null 行如何保真（null 语义不吞）？
//     Q3 wb.export → TemplateWorkBookIO 读回 → 再 execute：序列化往返后类型/显示是否不变？（cpt 保真）
//   附 PNG 渲染地板（date/timestamp 出图不炸）。runraw.ps1 跑法（不杀 java，不占 FineDB 写锁之外的资源）。
var J = function (n) { return Java.type(n); };
load('D:/fineagent/runtime/paths.js');
load(Paths.runtime('bootstrap.js'));
Runtime.initialize();
var Class = J('java.lang.Class');
var out = [];

var COLS = [
  ['c_str', 'java.lang.String'], ['c_int', 'java.lang.Integer'], ['c_long', 'java.lang.Long'],
  ['c_dbl', 'java.lang.Double'], ['c_dec', 'java.math.BigDecimal'], ['c_bool', 'java.lang.Boolean'],
  ['c_dsql', 'java.sql.Date'], ['c_ts', 'java.sql.Timestamp'], ['c_udate', 'java.util.Date']
];
var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
etd.setDsName('dsT');
COLS.forEach(function (c) { etd.addColumn(c[0], Class.forName(c[1])); });
var D = J('java.sql.Date'), T = J('java.sql.Timestamp'), UD = J('java.util.Date');
etd.addRow(J('java.util.Arrays').asList([
  'txt', J('java.lang.Integer').valueOf(7), J('java.lang.Long').valueOf('9000000001'),
  J('java.lang.Double').valueOf(1.5), new (J('java.math.BigDecimal'))('12.3456'),
  J('java.lang.Boolean').valueOf(true), D.valueOf('2026-09-13'), T.valueOf('2026-09-13 08:30:00'),
  new (UD)(1757000000000)
]));
etd.addRow(J('java.util.Arrays').asList([null, null, null, null, null, null, null, null, null]));

function mkCells(wb) {
  var ws = new (J('com.fr.report.worksheet.WorkSheet'))();
  wb.addReport('S1', ws);   // object.js 440-441 同形：addReport(name, sheet)
  wb.putTableData('dsT', etd);
  COLS.forEach(function (c, i) {
    var dsc = new (J('com.fr.report.cell.cellattr.core.group.DSColumn'))();
    dsc.setDSName('dsT');
    dsc.setColumnName(c[0]);
    dsc.setGrouper(new (J('com.fr.report.cell.cellattr.core.group.FunctionGrouper'))());
    try { dsc.setColumn(J('com.fr.general.data.TableDataColumn').createColumn(c[0])); } catch (eCol) { }
    var ce = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(i, 0);   // object.js CellC 同形
    ce.setValue(dsc);
    ws.addCellElement(ce);
  });
  return ws;
}

function dumpGrid(tag, rb) {
  var rp = rb.getResultReport(0);
  out.push('== ' + tag + ' rows=' + rp.getRowCount() + ' cols=' + rp.getColumnCount());
  for (var r = 0; r < Math.min(rp.getRowCount(), 3); r++) {
    for (var c = 0; c < rp.getColumnCount(); c++) {
      var cel = rp.getCellElement(c, r);
      var v = null, vt = '(noval)', txt = '';
      try { v = cel.getValue(); } catch (e) { }
      if (v != null) { try { vt = v.getClass().getName(); } catch (e2) { vt = '?'; } }
      try { txt = (typeof cel.getText === 'function') ? String(cel.getText()) : ''; } catch (e3) { txt = '(gettext-fail)'; }
      out.push('  R' + r + ' ' + COLS[c][0] + ' val=' + vt + ' text=' + JSON.stringify(txt));
    }
  }
}

var wb = new (J('com.fr.main.impl.WorkBook'))();
mkCells(wb);
var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
dumpGrid('FRESH-EXECUTE', rb);

// Q3 序列化往返：导出 → 读回（模板根相对路径语义，README #52 一手）→ 再 execute
var deploy = Paths.demoDeployDir();
var fP = J('java.nio.file.Paths'), F = J('java.nio.file.Files');
F.createDirectories(fP.get(deploy));
var os = new (J('java.io.FileOutputStream'))(deploy + '/_typemap_probe.cpt');
wb.export(os); os.close();
var wb2 = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('fineagent/_typemap_probe.cpt');
var td2 = wb2.getTableData('dsT');
var clsDump = [];
for (var ci = 0; ci < COLS.length; ci++) {
  try { clsDump.push(COLS[ci][0] + '=' + td2.getColumnClass(ci).getName()); } catch (eC) { clsDump.push(COLS[ci][0] + '=?'); }
}
out.push('== READBACK columnClass: ' + clsDump.join(' '));
dumpGrid('READBACK-EXECUTE', wb2.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))()));

// PNG 渲染地板（date/timestamp/decimal 出图不炸）
try {
  var osP = new (J('java.io.FileOutputStream'))(deploy + '/_typemap_probe.png');
  new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
  osP.close();
  var sz = J('java.nio.file.Files').size(fP.get(deploy + '/_typemap_probe.png'));
  out.push('== PNG bytes=' + sz + (sz > 1000 ? ' RENDER-OK' : ' RENDER-SUSPECT'));
} catch (eP) { out.push('== PNG FAIL: ' + eP); }

// 探针产物自清（不留部署目录，AGENTS 纪律：渲染件由用户目检时才落）
try { F.deleteIfExists(fP.get(deploy + '/_typemap_probe.cpt')); F.deleteIfExists(fP.get(deploy + '/_typemap_probe.png')); } catch (eCl) { }

print(out.join('\n'));
print('TYPEMAP PROBE END');
J('java.lang.System').exit(0);
