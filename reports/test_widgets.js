// test_widgets.js — v4.2 参数面板控件族自检（NumberEditor/TextArea/RadioGroup/CheckBoxGroup/
// ComboCheckBox/TreeComboBoxEditor/IframeEditor）。只验证对象图与序列化，不做数据过滤。
// iframe url 用相对路径（#48 安全批 B：nav/iframe 仅相对路径，绝对 scheme URL 在 IR 校验即拒）。

var SPEC = {
  outName: '能力自检_控件族',
  title: '面板控件族自检',
  columns: [
    { label: '键', name: 'k', type: 'text', widthPt: 200 },
    { label: '值', name: 'v', type: 'number', widthPt: 160, format: '#,##0' }
  ],
  heightsPt: { title: 60, header: 40, row: 36, total: 36 },
  data: [['a', 1], ['b', 2]],
  paramPanel: {
    title: '参数',
    designWidth: 720,
    designHeight: 150,
    widgets: [
      { kind: 'number', name: '数量', value: 20, minValue: 1, maxValue: 100, allowDecimals: false, x: 20, y: 20, w: 120, h: 22 },
      { kind: 'textarea', name: '备注', value: '多行文本', x: 160, y: 20, w: 180, h: 60 },
      { kind: 'radio', name: '班次', values: ['白班', '夜班'], value: '白班', x: 360, y: 20, w: 140, h: 22 },
      { kind: 'checkbox', name: '产线', values: ['A', 'B', 'C'], value: 'A', x: 520, y: 20, w: 160, h: 22 },
      { kind: 'combocheck', name: '机台', values: ['laser1', 'laser5'], value: 'laser5', x: 20, y: 90, w: 160, h: 22 },
      { kind: 'treecombo', name: '车间', values: ['一车间', '二车间'], value: '一车间', x: 200, y: 90, w: 160, h: 22 },
      { kind: 'iframe', name: '帮助', url: 'help.html', x: 380, y: 90, w: 200, h: 40 },
      { kind: 'submit', text: '查询', x: 600, y: 90, w: 80, h: 22 }
    ]
  }
};
