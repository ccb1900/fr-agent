// test_jsev.js — 批E 能力自检：事件 JS 体系（linkTo.js 参数回填 + dialog 弹窗属性 + width/height/title）
// 官方一手：ParameterJavaScript(589 处)/ReportletHyperlinkDialogAttr(26)；超链组多件（钻取 + 动态参数回填）
var SPEC = {
  outName: '能力自检_事件JS',
  title: '事件 JS 体系自检（超链组多件/弹窗属性/参数回填）',
  columns: [
    { label: '机型', name: '机型', type: 'text', widthPt: 150 },
    { label: '产量', name: '产量', type: 'number', widthPt: 120, format: '#,##0' }
  ],
  heightsPt: { title: 60, header: 40, row: 36, total: 36 },
  data: [['L1', 120], ['L2', 200]],
  link: {
    by: '机型', reportlet: 'fineagent/销售明细_api.cpt', name: '看明细',
    title: '明细钻取', width: 900, height: 600,
    dialog: { title: '钻取明细窗', center: true },
    params: [{ name: 'machine', formula: '=$$$' }],
    js: [{ name: '回填机台', recalc: true, params: [{ name: 'lastMachine', formula: '=$$$' }] }]
  }
};
