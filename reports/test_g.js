// test_g.js — 批G 能力自检：条码（BarcodePresent）/子报表（SubReport）/自定义分组（CustomGrouper）
// 官方一手：卡片分栏.cpt（BarcodePresent(BarcodeAttr)）；SubReport(TemplateWorkBook) 读已部署模板整嵌；
//   CustomGrouper other/odisplay/more/force（demo 4 张简单形态）。
// diagonal/freeze-web 在 240 demo 零直接语料（_demo_tags 无命中）——诚实登记不硬凑（斜线表头已有 putBiasCell v3.3）。
var SPEC = {
  outName: '能力自检_小特性',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [180, 140, 100],
      blocks: [
        { type: 'cells', heightPt: 34, items: [
          { c: 0, span: 3, text: '小特性自检（条码 / 子报表 / 自定义分组）', st: { bold: true, sizePt: 12 } }
        ] },
        { type: 'space', heightPt: 8 },
        { type: 'cells', heightPt: 55, items: [
          { c: 0, text: 'FA20261105001', st: { align: 0 }, barcode: { type: 1, barHeight: 40, drawingText: true } },
          { c: 2, subreport: 'fineagent/销售明细_api.cpt', st: { align: 0 } }
        ] },
        { type: 'space', heightPt: 8 },
        { type: 'title', text: '自定义分组（CustomGrouper）', span: 3, heightPt: 40 },
        { type: 'header', columns: [
          { label: '订单号', name: 'order', type: 'text' },
          { label: '机台（自定义分组）', name: 'machine', type: 'text', groupCustom: { other: 1, otherDisplay: '其他机台', more: true, force: true } },
          { label: '数量', name: 'qty', type: 'number', format: '#,##0' }
        ], heightPt: 40 },
        { type: 'detail', dataset: 'dsG', columns: [
          { name: 'order', type: 'text' },
          { name: 'machine', type: 'text', groupCustom: { other: 1, otherDisplay: '其他机台', more: true, force: true } },
          { name: 'qty', type: 'number', format: '#,##0' }
        ], heightPt: 45 },
        { type: 'total', label: '合计', span: 2, aggregate: { fn: 'sum', col: 2 }, heightPt: 36 }
      ]
    }],
    datasets: [{
      name: 'dsG',
      columns: [
        { name: 'order', type: 'text' },
        { name: 'machine', type: 'text' },
        { name: 'qty', type: 'number' }
      ],
      rows: [['FA20261105001', 'L1', 12], ['FA20261105002', 'L2', 7]]
    }]
  }
};
