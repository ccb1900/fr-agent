// probes/probe_coord_map_expand.js - 3.2-3 real-engine probe (runraw; engine only; NO deploy-dir writes,
//   NO export: dataset replaced IN MEMORY, executed, grid read, object discarded).
//   Question (night-shift backlog P2, task-5 n=1 observation): when a replace_dataset changes the dataset
//   row count N, where do STATIC template rows land in the execution grid? Task 5 measured one point:
//   template r3 (total label) -> grid r12 at N=10 (shift +9). This probe measures the pattern with n=3
//   (N in [2,5,10]) on the plan-chain report fineagent/<CJK>S3_api.cpt, whose ds1 is an EmbeddedTableData
//   (no DB needed): snapshot ds1 columns+rows, then swap in the FIRST N snapshot rows (same columns/types),
//   execute, and locate static marker texts (title / header row / total label / footnote) in the grid.
//   Printed conclusion: per-marker shift per N, the derived constant k in shift = N - k (= template
//   data-block row count), and whether rows ABOVE the block stay put. ASCII-only source: all CJK literals
//   are \uXXXX escapes so file encoding can never desync the comparisons.
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
load('D:/fineagent/runtime/paths.js');
var R = Paths.root;
load(R + '/template/locator.js'); load(R + '/template/inspector.js'); load(R + '/template/patch.js'); load(R + '/template/reader.js');
load(Paths.runtime('bootstrap.js')); Runtime.initialize();

var SRC = 'fineagent/\u751f\u4ea7\u65e5\u62a5S3_api.cpt';            // 生产日报S3_api.cpt (plan-chain product)
var T_TOTAL = '\u603b\u8ba1';                                        // 总计
var T_HEaders = ['\u4e1a\u52a1\u65e5\u671f', '\u673a\u53f0'];        // 业务日期 / 机台
var T_NOTE = '\u53e3\u5f84';                                         // 口径 (footnote marker, indexOf)

function esc(s) {  // ASCII-safe rendering of engine strings for the console
  return String(s).replace(/[^\x20-\x7E]/g, function (ch) {
    var h = ch.charCodeAt(0).toString(16).toUpperCase();
    while (h.length < 4) h = '0' + h;
    return '\\u' + h;
  });
}
var FAILS = 0;
function log(s) { print(s); }

// execGrid: same shape as template/patch_main.js (execute + ResultReport text dump)
function execGrid(w) {
  try {
    var rb = w.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
    var rp = rb.getResultReport(0), rows = [];
    for (var r = 0; r < rp.getRowCount(); r++) {
      var row = [];
      for (var c = 0; c < rp.getColumnCount(); c++) {
        var cel = rp.getCellElement(c, r), txt = '';
        if (cel != null) {
          if (typeof cel.getText === 'function') txt = String(cel.getText());
          else if (typeof cel.getValue === 'function' && cel.getValue() != null) txt = String(cel.getValue());
          else if (typeof cel.toString === 'function') txt = String(cel.toString());
        }
        row.push(txt);
      }
      rows.push(row);
    }
    return { ok: true, rows: rows, error: null };
  } catch (e) { return { ok: false, rows: null, error: String(e) }; }
}

function gridFindRow(grid, text, exact) {
  for (var r = 0; r < grid.rows.length; r++) {
    for (var c = 0; c < grid.rows[r].length; c++) {
      var v = String(grid.rows[r][c]);
      if (exact ? v === text : v.indexOf(text) >= 0) return r;
    }
  }
  return -1;
}

try {
  var wb0 = TemplateReader.readCpt(SRC);
  var desc = TemplateInspector.describe(wb0);
  if (desc.ok !== true) { log('PROBE FAIL: describe: ' + JSON.stringify(desc.error)); System.exit(1); }
  var snap = TemplateInspector.datasetSnapshot(wb0, 'ds1');
  if (snap.ok !== true) { log('PROBE FAIL: ds1 snapshot: ' + snap.error); System.exit(1); }
  log('SRC=' + esc(SRC) + ' ds1 N0=' + snap.rows.length + ' cols=' + JSON.stringify(snap.columns.map(function (c) { return c.name; })));

  // template static map (rows 0..9, cols 0..9) - non-empty cells only
  var sh0 = wb0.getReport(0);
  var tplRows = Math.min(+sh0.getRowCount(), 10), tplCols = Math.min(+sh0.getColumnCount(), 10);
  var tpl = [];   // [r][c] -> text ('' skipped)
  for (var r = 0; r < tplRows; r++) {
    var line = [];
    for (var c = 0; c < tplCols; c++) {
      var t = TemplateInspector.cellText(wb0, 0, c, r);
      var v = (t.ok === true) ? String(t.text) : '';
      tpl[r] = tpl[r] || [];
      if (v !== '') { tpl[r][c] = v; line.push('c' + c + '=' + esc(v)); }
    }
    if (line.length) log('TPL r' + r + ': ' + line.join(' | '));
  }
  function rowOf(pred) { for (var rr = 0; rr < tpl.length; rr++) { if (tpl[rr]) { for (var cc in tpl[rr]) { if (pred(String(tpl[rr][cc]), rr)) return rr; } } } return -1; }
  var tHeader = rowOf(function (v) { return T_HEaders.indexOf(v) >= 0; });
  var tTotal = rowOf(function (v) { return v === T_TOTAL; });
  var tNote = -1;
  for (var rn = (tTotal >= 0 ? tTotal + 1 : 0); rn < tpl.length; rn++) { if (tpl[rn]) { for (var cn in tpl[rn]) { if (String(tpl[rn][cn]).indexOf(T_NOTE) >= 0) { tNote = rn; break; } } } if (tNote >= 0) break; }
  log('MARKERS tpl: header=r' + tHeader + ' total=r' + tTotal + ' note=r' + tNote);
  if (tTotal < 0) { log('PROBE FAIL: total label not found in template'); System.exit(1); }

  // first text-typed column value = data-block anchor in the grid
  var anchorCol = 0;
  for (var sc = 0; sc < snap.columns.length; sc++) { if (snap.columns[sc].type === 'text') { anchorCol = sc; break; } }
  var anchorVal = String(snap.rows[0][anchorCol]);

  var results = [];
  var NS = [2, 5, 10];
  for (var ni = 0; ni < NS.length; ni++) {
    var N = NS[ni];
    var wb = TemplateReader.readCpt(SRC);
    var op = { op: 'replace_dataset', name: 'ds1', columns: snap.columns, rows: snap.rows.slice(0, N) };
    TemplatePatch.apply(wb, op, desc);
    var grid = execGrid(wb);
    if (grid.ok !== true) { log('PROBE FAIL: execute N=' + N + ': ' + grid.error); System.exit(1); }
    var gHeader = tHeader >= 0 ? gridFindRow(grid, T_HEaders[0], true) : -1;
    var gTotal = gridFindRow(grid, T_TOTAL, true);
    var gNote = tNote >= 0 ? gridFindRow(grid, T_NOTE, false) : -1;
    var gBlock = gridFindRow(grid, anchorVal, true);
    log('MAP N=' + N + ' gridRows=' + grid.rows.length + ' blockStart=' + gBlock +
        ' header ' + tHeader + '->' + gHeader + ' (shift ' + (gHeader - tHeader) + ')' +
        ' total ' + tTotal + '->' + gTotal + ' (shift ' + (gTotal - tTotal) + ')' +
        ' note ' + tNote + '->' + gNote + ' (shift ' + (tNote >= 0 && gNote >= 0 ? gNote - tNote : 'n/a') + ')');
    results.push({ N: N, blockStart: gBlock, sHeader: gHeader - tHeader, sTotal: gTotal - tTotal,
      sNote: (tNote >= 0 && gNote >= 0) ? gNote - tNote : null });
  }

  // pattern: rows above the block shift 0; rows below shift = N - k with ONE constant k
  var ks = [];
  for (var ri = 0; ri < results.length; ri++) {
    var x = results[ri];
    ks.push(x.N - x.sTotal);
    if (x.sNote !== null) ks.push(x.N - x.sNote);
    if (x.sHeader !== 0) { log('PATTERN VIOLATION: above-block row moved at N=' + x.N + ' shift=' + x.sHeader); FAILS++; }
    if (x.blockStart !== results[0].blockStart) { log('PATTERN VIOLATION: data block start moved at N=' + x.N + ' (' + x.blockStart + ' vs ' + results[0].blockStart + ')'); FAILS++; }
  }
  var k0 = ks[0], same = ks.every(function (k) { return k === k0; });
  log('PATTERN below-block shift = N - ' + k0 + ' for N in [' + NS.join(',') + '] ; k constant=' + same +
      ' ; cross-check task5 n=1 (total +9 @N=10): ' + (k0 === 1 ? 'CONSISTENT' : 'k=' + k0 + ' recheck'));
  if (!same) FAILS++;
  log('PROBE ' + (FAILS === 0 ? 'PASS' : 'FAIL') + ' (n=' + NS.length + ', mapping rows below data block = template row + (N - ' + k0 + '))');
  System.exit(FAILS === 0 ? 0 : 1);
} catch (e) {
  log('PROBE FAIL: ' + e);
  System.exit(1);
}
