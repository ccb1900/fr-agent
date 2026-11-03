// probe_profile_all.js — 全库 laser 表画像：表清单/行数/列元数据/TOP300 样本直查 → data/db_laser_tables[_prod].json
// 数据纪律（AGENTS §4）：列名/类型/格式全部来自本探针直查，不臆造。
// 2026-10-28 生产通道：给 BR_PURL/BR_PUSER/BR_PPASS/BR_PLIKE/BR_POUT 即对生产库画像（默认 = 演示库原样）。
var J = function (n) { return Java.type(n); };
function genev(k, d) { var v = java.lang.System.getenv(k); return (v == null || String(v) === '') ? d : String(v); }
print('PROBE START');

// 1) 直连 JDBC（凭据只在本探针，不进任何 spec 之外的产物）
var url = genev('BR_PURL', 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false');
var puser = genev('BR_PUSER', 'sa');
var ppass = genev('BR_PPASS', load('D:/fineagent/lib/dbpass.js'));
var PLIKE = genev('BR_PLIKE', 'laser_%');
var POUT = genev('BR_POUT', 'D:/fineagent/data/db_laser_tables.json');
var TSUB = genev('BR_PTSUB', ''); // 表名归一副前缀（生产 t_collector_ → laser_*），供生成器统一键名
var conn = J('java.sql.DriverManager').getConnection(url, puser, ppass);
print('DB OK ' + url + ' LIKE=' + PLIKE + ' OUT=' + POUT);

function q(sql) {
  var rs = conn.createStatement().executeQuery(sql);
  var md = rs.getMetaData(); var n = md.getColumnCount();
  var out = [];
  while (rs.next()) {
    var row = {};
    for (var i = 1; i <= n; i++) {
      var v = rs.getString(i);
      row[md.getColumnLabel(i)] = (v == null) ? null : String(v);
    }
    out.push(row);
  }
  rs.close();
  return out;
}

// 2) 表清单（table LIKE 参数化），行数走分区统计（免全表计数）
var tables = q("SELECT table_name AS table_name FROM INFORMATION_SCHEMA.TABLES WHERE table_name LIKE '" + PLIKE + "' ORDER BY table_name");
print('tables=' + tables.length);

// 行数
var counts = {};
try {
  var rc = q("SELECT p.object_id, SUM(p.row_count) AS rows_s FROM sys.dm_db_partition_stats p WHERE p.index_id IN (0,1) GROUP BY p.object_id");
  var ids = q("SELECT object_id, name FROM sys.objects WHERE name LIKE '" + PLIKE + "'");
  for (var i = 0; i < rc.length; i++) counts[rc[i].object_id] = rc[i].rows_s;
  var idmap = {};
  for (var i = 0; i < ids.length; i++) idmap[ids[i].name] = ids[i].object_id;
} catch (e) { print('count warn: ' + e.message); }

// 3) 每表：列元数据 + TOP300 样本
var RE_DATE = /^20\d{2}[-/]\d{1,2}[-/]\d{1,2}(\s|$)/;
var RE_TIME = /^\d{1,2}:\d{2}:\d{2}$/;
var result = [];
for (var ti = 0; ti < tables.length; ti++) {
  var tname = tables[ti].table_name;
  var cols = q("SELECT column_name, data_type, character_maximum_length, ordinal_position FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='" + tname + "' ORDER BY ordinal_position");
  var rowcnt = null;
  for (var k in idmap) if (k == tname) rowcnt = counts[idmap[k]];
  // TOP 300 样本（直查；无全局排序需求）
  var sample = q("SELECT TOP 300 * FROM [" + tname + "]");
  // 列分类
  var colInfo = [];
  for (var ci = 0; ci < cols.length; ci++) {
    var cn = cols[ci].column_name; var dt = (cols[ci].data_type || '').toUpperCase();
    var vals = [], vset = {}, numeric = 0, dates = 0, times = 0, allNULL = true, maxDec = 0, maxInt = 0, valsDistinct = 0;
    for (var si = 0; si < sample.length; si++) {
      var v = sample[si][cn];
      if (v == null) continue;
      allNULL = false;
      vals.push(v); vset[v] = 1;
      var s = v;
      if (dt === 'NVARCHAR' || dt === 'VARCHAR') {
        if (RE_DATE.test(s)) { dates++; continue; }
        if (RE_TIME.test(s)) { times++; continue; }
        var st = s.replace(/,/g, '');
        if (/^-?\d+(\.\d+)?$/.test(st)) {
          numeric++;
          if (s.indexOf(',') >= 0 && /^\d{1,3}(,\d{3})+/.test(s)) { /* 带千分位样本 */ }
          var ip = st.split('.');
          if (ip.length > 1) { if (ip[1].length > maxDec) maxDec = ip[1].length; }
          if (parseFloat(st) % 1 === 0 && ip[0].replace(/-/,'').length > maxInt) maxInt = ip[0].replace(/-/, '').length;
        }
      } else if (dt === 'DECIMAL' || dt === 'NUMERIC') {
        numeric++;
        if (s.indexOf('.') >= 0) { var dp = s.split('.')[1].length; if (dp > maxDec) maxDec = dp; }
        var ii = s.split('.')[0].replace(/^-/, '').replace(/^0+/,'');
        if (ii.length > maxInt) maxInt = ii.length;
      } else { numeric++; }
    }
    for (var x in vset) valsDistinct++;
    var kind = 'code';
    if (numeric >= 0.9 * vals.length && vals.length > 0) kind = 'num';
    if (kind === 'code' && valsDistinct <= 4 && vals.length > 0) kind = 'cent';
    colInfo.push({ name: cn, dtype: dt, maxlen: cols[ci].character_maximum_length, kind: kind, maxDec: maxDec, maxInt: maxInt, valsDistinct: valsDistinct, sample: vals.slice(0, 8).join(' | ') });
  }
  // 日期/时间列判定（列名+样本双证）
  var dc = null, tc = null;
  for (var ci = 0; ci < colInfo.length; ci++) {
    var L = colInfo[ci].name.toLowerCase();
    if (!dc && (L.indexOf('date') >= 0 || L.indexOf('day') >= 0 || L.indexOf('_d') >= 0) && colInfo[ci].sample.indexOf('20') >= 0) dc = colInfo[ci].name;
    if (!tc && (L.indexOf('time') >= 0) && /^0?\d:|^\d\d:/.test(colInfo[ci].sample)) tc = colInfo[ci].name;
  }
  // 日期范围（TRY_CAST 归一后 MIN/MAX；列见 dc）
  var dmin = null, dmax = null;
  if (dc) {
    var dr = q("SELECT MIN(TRY_CAST([" + dc + "] AS date)) AS a, MAX(TRY_CAST([" + dc + "] AS date)) AS b FROM [" + tname + "]");
    if (dr.length) { dmin = dr[0].a; dmax = dr[0].b; }
  }
  result.push({ table: TSUB ? tname.replace(new RegExp('^' + TSUB), '') : tname, rows: rowcnt, dateCol: dc, timeCol: tc, dmin: dmin, dmax: dmax, cols: colInfo, sampleCount: sample.length });
  print('PROF ' + tname + ' -> key=' + (TSUB ? tname.replace(new RegExp('^' + TSUB), '') : tname) + ' rows=' + rowcnt + ' cols=' + colInfo.length + ' date=' + dc + ' dmin=' + dmin + ' dmax=' + dmax);
}

// 4) 写 JSON
var sb = new (J('java.lang.StringBuilder'))();
sb.append(JSON.stringify(result, null, 1));
var fw = new (J('java.io.FileWriter'))(POUT);
fw.write(sb.toString()); fw.close();
print('WROTE ' + POUT + ' tables=' + result.length);
conn.close();
print('PROBE END');
