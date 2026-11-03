// probe_parse_prod.js — data/prod_profile_raw.txt（生产 SSMS 贴入 A 行数段 + B 列定义段）→ data/db_laser_tables_prod.json
// 数据纪律（AGENTS §4）：列名/类型/顺序照抄生产 sys.* 直查；kind/小数位/样本只在生产与 demo 同名列之间继承，
// 生产独有列不臆造样本，只给布局宽度下限（minw，参与列宽反算，不属于数据事实）。
var J = function (n) { return Java.type(n); };
function readTxt(p) { var F = J('java.nio.file.Files'), P = J('java.nio.file.Paths'), S = J('java.lang.String'); return String(new S(F.readAllBytes(P.get(p)), 'UTF-8')).replace(/^\uFEFF/, ''); }

var demo = JSON.parse(readTxt('D:/fineagent/data/db_laser_tables.json'));
var dmap = {};
demo.forEach(function (t) { dmap[t.table] = t; });
var dcol = function (tb, nm) { var d = dmap[tb]; if (!d || !d.cols) return null; for (var i = 0; i < d.cols.length; i++) if (d.cols[i].name === nm) return d.cols[i]; return null; };

var raw = readTxt('D:/fineagent/data/prod_profile_raw.txt');
var lines = raw.split(/\r?\n/);
var rowsCnt = {}, order = [], colsRaw = {};
for (var li = 0; li < lines.length; li++) {
  if (!lines[li]) continue;
  var f = lines[li].split('\t');
  if (f.length === 2 && f[0].indexOf('t_collector_laser') === 0) { if (!rowsCnt[f[0]]) { rowsCnt[f[0]] = f[1]; order.push(f[0]); } }
  else if (f.length === 7 && f[0].indexOf('t_collector_laser') === 0) {
    if (!colsRaw[f[0]]) colsRaw[f[0]] = [];
    colsRaw[f[0]].push({ no: +f[1], name: f[2], dtype: (f[3] || '').toUpperCase(), maxlen: f[4] === '' ? null : +f[4], prec: +f[5], dec: +f[6] });
  }
}
print('parsed tables=' + order.length);

var CODE_SUFFIX = /(no|seq|block|key|_code|_id|_prog)$/i;
// 实证长文列（截图：prg='C:\PBA\NPRG\SYSTEM\COLLIMATE' 类路径/汇总/备注/消息）——宽度下限 24 防字母竖排
var LONGTXT = /^(prog_path|prg|prg_filename|error_msg|result_summary|result_detail|note|caption|alarm|header|path|cond_file)$/;

var result = [];
for (var ti = 0; ti < order.length; ti++) {
  var tbl = order[ti];
  var key = tbl.replace(/^t_collector_/, '');
  var d = dmap[key];
  var pc = colsRaw[tbl];
  var names = pc.map(function (c) { return c.name; });
  // 日期/时间列：demo 同名继承优先，生产独有结构按名称启发式
  var dateCol = null, timeCol = null;
  if (d && d.dateCol && names.indexOf(d.dateCol) >= 0) dateCol = d.dateCol;
  if (d && d.timeCol && names.indexOf(d.timeCol) >= 0) timeCol = d.timeCol;
  if (!dateCol) for (var i = 0; i < names.length; i++) if (/date/i.test(names[i])) { dateCol = names[i]; break; }
  if (!timeCol) for (var i = 0; i < names.length; i++) if (/^biz_time$/i.test(names[i]) || /^time$/i.test(names[i])) { timeCol = names[i]; break; }

  var cols = [];
  for (var ci = 0; ci < pc.length; ci++) {
    var p = pc[ci], nm = p.name;
    var dc = dcol(key, nm);
    var kind, maxDec = 0, maxInt = 0, valsDistinct = 0, sample = '', minw = null;
    if (dc && p.dtype !== 'BIGINT' && p.dtype !== 'DATE' && p.dtype !== 'DATETIME2') {
      kind = dc.kind; maxDec = dc.maxDec || 0; maxInt = dc.maxInt || 0; valsDistinct = dc.valsDistinct || 0; sample = dc.sample || '';
    } else if (p.dtype === 'BIGINT') {
      kind = 'num'; maxInt = 9;
    } else if (p.dtype === 'DATE' || p.dtype === 'DATETIME2') {
      kind = 'code'; maxInt = 10;
    } else {
      kind = 'code';
      if (LONGTXT.test(nm)) minw = 24;
    }
    // 生产实况覆盖（2026-10-28 渲染截图：file_key 18 位原生 bigint）
    if (nm === 'file_key') { maxInt = 18; kind = 'num'; }
    if (nm === 'row_number') { maxInt = 5; kind = 'num'; }
    if (nm === 'records') { maxInt = 7; }
    var col = { name: nm, dtype: p.dtype, maxlen: p.maxlen, kind: kind, maxDec: maxDec, maxInt: maxInt, valsDistinct: valsDistinct, sample: sample };
    if (minw) col.minw = minw;
    cols.push(col);
  }
  result.push({ table: key, rows: rowsCnt[tbl], dateCol: dateCol, timeCol: timeCol, dmin: null, dmax: null, cols: cols, sampleCount: 0 });
  print('P ' + key + ' rows=' + rowsCnt[tbl] + ' date=' + dateCol + ' time=' + timeCol + ' cols=' + cols.length + (d ? '' : ' [demo无此表→新画像]'));
}

var sb = new (J('java.lang.StringBuilder'))();
sb.append(JSON.stringify(result, null, 1));
var fw = new (J('java.io.FileWriter'))('D:/fineagent/data/db_laser_tables_prod.json');
fw.write(sb.toString()); fw.close();
print('WROTE data/db_laser_tables_prod.json tables=' + result.length);

// 抽验：sensor prg（长文列）、zaxis stage 应缺席、twin_scale Date/Time、file_key 18 位
var out = JSON.parse(readTxt('D:/fineagent/data/db_laser_tables_prod.json'));
out.forEach(function (t) {
  if (t.table === 'laser_sensor') t.cols.forEach(function (c) { if (c.name === 'prg' || c.name === 'file_key') print('CHK sensor ' + c.name + ' kind=' + c.kind + ' maxInt=' + c.maxInt + ' sample=' + (c.sample || '').substring(0, 40) + ' minw=' + (c.minw || '-')); });
  if (t.table === 'laser_zaxis') print('CHK zaxis cols=' + t.cols.map(function (c) { return c.name; }).join(','));
  if (t.table === 'laser_twin_scale_dsp') print('CHK twin date=' + t.dateCol + ' time=' + t.timeCol);
  if (t.table === 'laser_files') print('CHK files date=' + t.dateCol + ' cols=' + t.cols.length);
});
print('DONE');
