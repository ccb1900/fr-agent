// _bad_ir_test.js — 审计批负测试：无效/恶意 IR 必须被 validate 拦下（期望 make_api EXIT 9 + IR ISSUE 列表）
// 批 A 覆盖：unknown dataset / link.by 不在列 / nav 注入 URL / toolbar 未知 kind（className 逃生口已除）/ filter 引用坏
// 批 B（迭代 1 条件属性严格化）覆盖：when 混写/缺 value/空白 formula/list 子条件坏/then 未知动作+类型坏/
//   scope 坏/op 坏/条件列不在 DS（块级+列级）/highlight 坏 op+缺 value+列不在 DS
var SPEC = {
  title: 'bad-ir-test', dsName: 'ds1',
  IR: {
    sheets: [
      { name: 's1', widthsPt: [100, 100], blocks: [
        { type: 'title', text: 't', span: 2, heightPt: 30 },
        { type: 'header', columns: [{ name: '机型', type: 'text' }], heightPt: 20 },
        { type: 'detail', dataset: '不存在的DS', columns: [{ name: '机型', type: 'text' }], heightPt: 20,
          link: { by: '不在列的链列', reportlet: '' } },
        { type: 'detail', dataset: 'ds1', heightPt: 20,
          columns: [{ name: '机型', type: 'text',
            conditions: [{ when: { column: '幽灵列L', op: '=', value: 'x' }, then: { bg: 1 } }] }],
          highlight: { column: '幽灵列H', op: '@@', value: null, bg: 1 },
          conditions: [
            { when: { formula: 'a>1', column: '机型' }, then: { bg: 1 } },
            { when: { column: '幽灵列V' }, then: { bg: 1 } },
            { when: { formula: '   ' }, then: { bg: 1 } },
            { when: { list: [{ column: '幽灵列N', op: '>' }] }, then: { bg: 1 } },
            { when: { formula: 'row()>0' }, then: { bg: 1, 未知动作: 'x', page: '3' }, scope: '行' }
          ] },
        { type: 'total', label: '合计', span: 1, aggregate: { fn: 'sum', col: 0 }, heightPt: 20 }
      ] }
    ],
    datasets: [
      { name: 'ds1', columns: [{ name: '机型', type: 'text' }], rows: [['A']] }
    ],
    toolbar: { buttons: ['export', { kind: '垃圾按钮', className: 'com.fr.report.web.button.Export' }] },
    param: {
      widgets: [
        { kind: 'nav', url: "' OR 1=1 --", text: '坏链', x: 0, y: 0, w: 80, h: 20 },
        { kind: 'editor', name: 'day', text: '日', x: 100, y: 0, w: 80, h: 20 }
      ],
      filters: [ { column: '不在任何DS的列', op: '=', parameter: '没有的参数' } ]
    }
  }
};
