// reports/test_legacy_axis.js — 审查轮2 P1-B 真引擎回归：legacy bar（无 legend）+ axisY 公共键
//   验证：① ir 放行 → object 真消费（部署 XML ValueAxis/TextAttr 带 FRFont size=80/foreground/ShowAxisLabel）；
//   ② 渲染 PNG 非空；③ 不引入 legend 门槛；④ title 归 Van 专属（legacy 不传，实证 setTitle 不序列化）。
//   跑法：REPORT_SPEC=reports/test_legacy_axis.js run.ps1 -Script make_api.js（末轮用默认 spec 回补铁证）
var SPEC = {
  outName: '能力自检_legacy_axis',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [700],
      blocks: [
        { type: 'cells', heightPt: 30, items: [{ c: 0, span: 1, text: 'P1-B legacy axisY 回归（无 legend）' }] },
        { type: 'chart', kind: 'bar', dataset: 'ds', category: '机型', values: ['产量'], heightPt: 300,
          axisY: { fontPt: 10, color: 0x333333, showLabel: true }, }
      ]
    }],
    datasets: [{
      name: 'ds',
      columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }],
      rows: [['A线', 120], ['B线', 200], ['C线', 160]]
    }]
  }
};
