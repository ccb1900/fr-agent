// reports/probe_minus2.js — 定位负号丢失的阈值：字号 × 字体
// 一手观察：8pt SimHei 下 "-47" 的 '-' 只占位不描墨（advance 已消耗，像素全白），10.5pt 正常。
var W = 160, N = 4;
var SIZES = [8, 9, 10, 10.5];
var rows = [], blocks = [];
SIZES.forEach(function (fp, r) {
  var items = [
    { c: 0, text: '-47.5', st: { align: 2, sizePt: fp } },
    { c: 1, text: '-47.5', st: { align: 2, sizePt: fp, name: 'Microsoft YaHei' } },
    { c: 2, text: '-47.5', st: { align: 2, sizePt: fp, name: '宋体' } },
    { c: 3, text: '-47.5', st: { align: 2, sizePt: fp, name: 'Arial' } }
  ];
  blocks.push({ type: 'cells', heightPt: 34, items: items });
});
var SPEC = {
  outName: '探针_负号2',
  connections: [],
  IR: {
    sheets: [{
      name: 's1', widthsPt: [W, W, W, W],
      paper: { width: W * N * 12700, height: 200 * 12700, top: 0, left: 0, bottom: 0, right: 0 },
      blocks: blocks
    }],
    datasets: [{ name: 'ds1', columns: [{ name: 'V', type: 'text' }], rows: [['-47.5']] }]
  }
};
