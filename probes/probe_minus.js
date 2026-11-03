// reports/probe_minus.js — 诊断：负号在渲染里丢失（栅格值有 '-'，PNG 无）
// 静态文本格 vs 数据集格，左/右对齐，看 '-' 到底在哪一层掉。
var CONN = [{
  name: 'ATOM_LIVE',
  driver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
  url: 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false',
  user: 'sa', password: load('D:/fineagent/lib/dbpass.js')
}];
var W = 120, N = 8;
var widths = [], items = [], det = [], rows = [];
var LIT = ['-47', '−47', 'a-47', '128.8', '-0.5', '-47', '-47', '-47'];
for (var i = 0; i < N; i++) {
  widths.push(W);
  items.push({ c: i, text: LIT[i], st: { align: i >= 5 ? 4 : 2, sizePt: 10.5 } });
  det.push({ c: i, ds: { column: 'V' + i }, st: { align: i >= 5 ? 4 : 2, sizePt: 10.5 } });
}
// 逐层逼近数据浏览器：8pt → 8pt+四边黑框（浏览器明细格的全部样式差异）
var s8 = [], s8b = [], d8b = [];
for (var i2 = 0; i2 < N; i2++) {
  var bd = { top: -16777216, bottom: -16777216, left: -16777216, right: -16777216 };
  s8.push({ c: i2, text: LIT[i2], st: { align: i2 >= 5 ? 4 : 2, sizePt: 8 } });
  s8b.push({ c: i2, text: LIT[i2], st: { align: i2 >= 5 ? 4 : 2, sizePt: 8, edges: bd } });
  d8b.push({ c: i2, ds: { column: 'V' + i2 }, st: { align: i2 >= 5 ? 4 : 2, sizePt: 8, edges: bd } });
}
var VALS = ['-47', '-47', '-47', '-47', '-47', '-47', '-47', '-47'];
var cols = [];
for (var j = 0; j < N; j++) cols.push({ name: 'V' + j, type: 'text' });

var SPEC = {
  outName: '探针_负号',
  connections: CONN,
  IR: {
    sheets: [{
      name: 's1', widthsPt: widths,
      paper: { width: W * N * 12700, height: 300 * 12700, top: 0, left: 0, bottom: 0, right: 0 },
      blocks: [
        { type: 'cells', heightPt: 40, items: items },
        { type: 'cells', heightPt: 40, items: det, dataset: 'ds1' },
        { type: 'cells', heightPt: 40, items: s8 },
        { type: 'cells', heightPt: 40, items: s8b },
        { type: 'cells', heightPt: 40, items: d8b, dataset: 'ds1' }
      ]
    }],
    datasets: [{
      name: 'ds1', columns: cols, rows: [VALS]
    }]
  }
};
