// probes/probe_relation_unique.js — I5.5 关系目标列唯一性实机探针（runraw，只读）
//   审查 P2：confirmed N:1 不能只靠文本声明，须机器验证"被 JOIN 侧键唯一、不 fan-out"。
//   验 laser_files.file_key 是否唯一（COUNT vs COUNT DISTINCT），作为 recordToFile 关系安全性的数据侧证据。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var conn = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var out = [];
try {
  var q = conn.createStatement();
  var rs = q.executeQuery('SELECT COUNT(*) AS n, COUNT(DISTINCT file_key) AS d FROM laser_files');
  while (rs.next()) {
    var n = +rs.getLong('n'), d = +rs.getLong('d');   // 转 JS 数值，避免 Java Long 对象身份比较误判
    out.push('laser_files.file_key rows=' + n + ' distinct=' + d + ' unique=' + (n === d && d > 0));
    out.push('VERDICT recordToFile target-key-unique=' + (n === d && d > 0 ? 'PASS' : 'FAIL'));
    if (!(n === d && d > 0)) out.push('  关系须降级：目标键非唯一，JOIN 会 fan-out 放大度量');
  }
  rs.close(); q.close();
} catch (e) { out.push('PROBE FAIL: ' + e); }
conn.close();
print(out.join('\n'));
try { J('java.nio.file.Files').write(J('java.nio.file.Paths').get('D:/fineagent/data/i55_relation_unique_truth.txt'), J('java.lang.String').valueOf(out.join('\n')).getBytes('UTF-8')); } catch (eW) { }
System.exit(0);
