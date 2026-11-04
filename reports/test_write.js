// test_write.js — 批F 能力自检：填报章（ReportWriteAttr/BuiltInSQLSubmiter/IntelliDMLConfig + 编辑器 reg + write 工具栏按钮族）
// 官方一手：产品月销量情况录入表.cpt（SubmitVisitor/ColumnConfig-ColumnRow）；探针 _wa8/9（addAttributeTarget 序列化=1、PhoneReg=1）
// staging 表 zprobe_write_staging 由探针在演示库自建自删（管线 spec 只引用连接名，凭据不落模板）
var SPEC = {
  outName: '能力自检_填报章',
  title: '填报章自检（write 结构/reg 校验/write 按钮族）',
  columns: [
    { label: '月份', name: '月份', type: 'text', widthPt: 110 },
    { label: '数量', name: '数量', type: 'number', widthPt: 110, format: '#,##0' }
  ],
  heightsPt: { title: 60, header: 40, row: 36, total: 36 },
  data: [['2026-11', 12], ['2026-10', 7]],
  write: {
    name: '内置SQL1',
    connection: 'ATOM_LIVE',
    table: { schema: '', name: 'zprobe_write_staging' },
    columns: [
      { name: '月份', isKey: true, cell: [0, 2] },
      { name: '数量', isKey: false, cell: [1, 2] }
    ],

  },
  toolbar: { buttons: ['submit', 'verify', 'appendRow', 'deleteRow', 'showCellValue'] },
  paramPanel: {
    title: '填报参数',
    designWidth: 400,
    designHeight: 80,
    widgets: [
      { kind: 'editor', name: '录入人', value: '', reg: { custom: '^.{1,10}$', err: '录入人 1-10 字' }, x: 20, y: 20, w: 120, h: 22 },
      { kind: 'number', name: '数量上限', value: 100, reg: 'none', x: 160, y: 20, w: 100, h: 22 },
      { kind: 'submit', text: '提交', x: 280, y: 20, w: 80, h: 22 }
    ]
  }
};
