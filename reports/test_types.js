// test_types.js — I0-05 数据类型映射端到端自检（r2.md 任务 0.4 交付件）
// rawIR 形态（官方重建同路）：compile 自动 total 块的 lastNumberIdx 词汇不含新类型，rawIR 精确控块+跳 styleCount 门。
// 覆盖 IR 词表全部型别 + null 可空语义；验收面=管线全绿 + RESULT_DUMP 栅格逐格核对：
//   integer/long/decimal/boolean/date/datetime 值按字面显示、null 格为空（不是 'null' 串、不是 0）。
// 跑法：REPORT_SPEC=reports/test_types.js RESULT_DUMP=logs/u5_types_grid.txt run.ps1 make_api.js
var COLS = [
  { label: '文本', name: 'c_str', type: 'text', widthPt: 90 },
  { label: '整数', name: 'c_int', type: 'integer', widthPt: 70 },
  { label: '长整', name: 'c_long', type: 'long', widthPt: 110 },
  { label: '浮点', name: 'c_flt', type: 'float', widthPt: 80 },
  { label: '高精度', name: 'c_dec', type: 'decimal', widthPt: 140, format: '#,##0.00000' },
  { label: '布尔', name: 'c_bool', type: 'boolean', widthPt: 60 },
  { label: '日期', name: 'c_date', type: 'date', widthPt: 110, format: 'yyyy-MM-dd' },
  { label: '日期时间', name: 'c_dts', type: 'datetime', widthPt: 170, format: 'yyyy-MM-dd HH:mm:ss' }
];
var SPEC = {
  outName: '类型映射自检',
  allowNoFormula: false, // total 块带 SUM 公式，roundtrip 断言照常
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: COLS.map(function (c) { return c.widthPt; }),
      blocks: [
        { type: 'title', text: 'I0-05 数据类型映射自检', span: COLS.length, heightPt: 30 },
        { type: 'header', columns: COLS, heightPt: 20 },
        { type: 'detail', dataset: 'ds1', columns: COLS, heightPt: 20 },
        { type: 'total', label: '整数列合计', span: 1, aggregate: { fn: 'sum', col: 1 }, heightPt: 20 }
      ]
    }],
    datasets: [{
      name: 'ds1',
      columns: COLS,
      rows: [
        ['基础行', 42, '9000000001', 1.5, '12.3456789012345', true, '2026-09-13', '2026-09-13 08:30:00'],
        ['负值与false', -5, '-2147483649', -0.25, '0.0000000001', false, '1999-12-31', '1999-12-31 23:59:59'],
        [null, null, null, null, null, null, null, null]
      ]
    }]
  }
};
