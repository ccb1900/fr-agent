// probes/probe_tabledata_api.js — r5 P1：查 EmbeddedTableData 的只读 API（列名/列型/行值），
//   为 replace_dataset 结果回归提供"再读回逐格比对"的可靠读口（不猜测方法名）。
var J = function (n) { return Java.type(n); };
var C = J('com.fr.data.impl.EmbeddedTableData');
var OUT = [];
['getColumnCount', 'getColumnName', 'getColumnClass', 'getColumnType', 'getRowCount', 'getValueAt', 'getRowAt', 'getCellValue'].forEach(function (m) {
  var ok = false;
  try { var arr = C.class.getMethods(); for (var i = 0; i < arr.length; i++) { if (String(arr[i].getName()) === m) { ok = true; OUT.push(m + ' -> ' + String(arr[i].toGenericString())); break; } } } catch (e) { OUT.push(m + ' PROBE ERR ' + e); }
  if (!ok) OUT.push(m + ' -> (absent)');
});
// 直接构造并读回（内存，不落盘）
try {
  var etd = new C();
  etd.setDsName('probe_ds');
  etd.addColumn('a', J('java.lang.Class').forName('java.lang.Integer'));
  etd.addColumn('b', J('java.lang.Class').forName('java.lang.String'));
  etd.addRow(J('java.util.Arrays').asList([J('java.lang.Integer').valueOf(7), 'ok']));
  OUT.push('constructed rows=' + etd.getRowCount() + ' cols=' + etd.getColumnCount());
} catch (e2) { OUT.push('CONSTRUCT FAIL ' + e2); }
print(OUT.join('\n'));
J('java.lang.System').exit(0);
