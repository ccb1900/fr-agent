// probe_br_truth.js — 数据浏览器分页/筛选真值（独立口径，直查 SQL Server）
//
// 与模板口径的关系（这是要点，不是重复）：
//   模板里的 SQL 由 lib/browser.js 生成、参数经 FR 的 ${} 文本替换注入；
//   本探针把同样的过滤/排序/分页语义用字面量手写一遍（不走 browser.js），
//   两边逐格对上，才能同时证明"模板 SQL 生成对了"和"FR 真按参数取了那一页"。
// 跑法：powershell -NoProfile -ExecutionPolicy Bypass -File runraw.ps1 -Script "D:/fineagent/probes/probe_br_truth.js"
var J = function (n) { return Java.type(n); };
var URL = 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false';
var conn = J('java.sql.DriverManager').getConnection(URL, 'sa', load('D:/fineagent/lib/dbpass.js'));

function q(sql) {
  var st = conn.createStatement();
  var rs = st.executeQuery(sql);
  var md = rs.getMetaData();
  var n = md.getColumnCount();
  var rows = [];
  while (rs.next()) {
    var r = [];
    for (var k = 1; k <= n; k++) {
      var o = rs.getObject(k);
      r.push(o == null ? '' : String(o));
    }
    rows.push(r);
  }
  rs.close(); st.close();
  return rows;
}

// 列序 = 各 spec 的 cols 声明序（= 报表明细列序）
var COLS = {
  laser_aaa: ['file_key', 'row_number', 'biz_date', 'biz_time', 'stage', 'result_x', 'result_y',
    'workpiece_x', 'workpiece_y', 'main_prog_no', 'main_prog_seq', 'main_prog_block',
    'sub_prog_no', 'sub_prog_seq', 'sub_prog_block', 'machine_x', 'machine_y', 'size', 'score'],
  laser_aaa_gosa: ['file_key', 'row_number', 'biz_date', 'biz_time', 'stage', 'max_err_r', 'max_err_x', 'max_err_y'],
  laser_pwr: ['file_key', 'row_number', 'biz_date', 'biz_time', 'stage', 'cond_no', 'output_power',
    'frequency', 'on_time', 'base_energy', 'judgement', 'measured_energy', 'tolerance', 'collimator_no',
    'base_rate', 'cur_rate', 'mask_no2', 'gain', 'bias', 'beam_on_time', 'blower_on_time', 'ready_on_time',
    'measured_freq', 'freq_limit', 'shot_group', 'display_freq', 'cond_file', 'pulse_class']
};

function pred(d1, d2, stage) {
  var w = " WHERE TRY_CAST([biz_date] AS date) >= '" + d1 + "' AND TRY_CAST([biz_date] AS date) <= '" + d2 + "'";
  if (stage) w += " AND [stage] = '" + stage + "'";
  return w;
}
// 全序四键：日期(TRY_CAST 归一) → 时间(文本 HH:MM:SS 即字典序=时序) → file_key → row_number
// 与 lib/browser.js 的 ROW_NUMBER() OVER(...) 同一口径；(file_key,row_number) 唯一性见下面 ## KEY_UNIQUE 段
function oracle(table, d1, d2, stage, size, page) {
  var sel = COLS[table].map(function (c) { return '[' + c + ']'; }).join(', ');
  var ord = ' ORDER BY TRY_CAST([biz_date] AS date), [biz_time], [file_key], [row_number]';
  var off = (page - 1) * size;
  var rows = q('SELECT ' + sel + ' FROM [' + table + ']' + pred(d1, d2, stage) + ord +
    ' OFFSET ' + off + ' ROWS FETCH NEXT ' + size + ' ROWS ONLY');
  var meta = q('SELECT COUNT(*) FROM [' + table + ']' + pred(d1, d2, stage))[0][0];
  return { rows: rows, total: meta };
}

var out = '';
// 全序键唯一性：若 (file_key,row_number) 有重复，ROW_NUMBER 与 OFFSET/FETCH 都可能各自任意打破并列 → 对拍不成立，先自证
out += '## KEY_UNIQUE\n';
['laser_aaa', 'laser_aaa_gosa', 'laser_pwr'].forEach(function (t) {
  var d = q('SELECT COUNT(*) FROM (SELECT [file_key],[row_number] FROM [' + t + ']' +
    ' GROUP BY [file_key],[row_number] HAVING COUNT(*)>1) X')[0][0];
  out += t + '|dup_key_pairs=' + d + '\n';
});
out += '\n';
function emit(tag, o) {
  out += '## ' + tag + '|total=' + o.total + '|rows=' + o.rows.length + '\n';
  o.rows.forEach(function (r) { out += r.join('|') + '\n'; });
  out += '\n';
}

// D1..D2 = 全区间；aaa 第 1 页 / 第 2 页 / L 工序筛选；gosa 第 1 页；pwr 第 1 页
emit('aaa_p1_size50', oracle('laser_aaa', '2026-09-13', '2026-09-22', '', 50, 1));
emit('aaa_p2_size50', oracle('laser_aaa', '2026-09-13', '2026-09-22', '', 50, 2));
emit('aaa_p1_size10_stageL', oracle('laser_aaa', '2026-09-13', '2026-09-22', 'L', 10, 1));
emit('aaa_p2_size10_stageL', oracle('laser_aaa', '2026-09-13', '2026-09-22', 'L', 10, 2));
emit('gosa_p1_size50', oracle('laser_aaa_gosa', '2026-09-13', '2026-09-22', '', 50, 1));
emit('pwr_p1_size20', oracle('laser_pwr', '2026-09-13', '2026-09-22', '', 20, 1));
// 窄日期段（只有 9/13 一天）：证明日期范围真的在过滤，而不是恒定全表
emit('aaa_p1_size20_d13', oracle('laser_aaa', '2026-09-13', '2026-09-13', '', 20, 1));

conn.close();
J('java.nio.file.Files').write(J('java.nio.file.Paths').get('D:/fineagent/data/db_br_truth.txt'),
  J('java.lang.String').valueOf(out).getBytes('UTF-8'));
print('WROTE db_br_truth.txt chars=' + out.length);
