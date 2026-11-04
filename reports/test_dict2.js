// test_dict2.js — 批D 能力自检：字典三形态（custom/tableData/formula）+ 日期列格式（SimpleDateFormatThreadSafe）
//   tableData 字典自引用 ds1（键=grade 列 idx0 → 值=同列 idx0 映射演示）；formula 字典拼接；日期列 yyyy年MM月dd日 格式
var SPEC = {
  outName: '能力自检_字典格式',
  title: '字典三形态 + 日期格式自检（批D）',
  columns: [
    { label: '档位', name: 'grade', type: 'text', widthPt: 110,
      dict: { A: '合格', B: '返修', C: '报废' } },
    { label: '机台（数据集字典）', name: 'machine', type: 'text', widthPt: 150,
      dict: { tableData: { ds: 'dsD', keyIdx: 1, valIdx: 1 } } },
    { label: '档位说明（公式字典）', name: 'note', type: 'text', widthPt: 170,
      dict: { formula: '=CONCATENATE($$$, "-档说明")' } },
    { label: '检测日（日期格式）', name: 'day', type: 'date', widthPt: 150, format: 'yyyy年MM月dd日' },
    { label: '数量', name: 'qty', type: 'number', widthPt: 100, format: '#,##0' }
  ],
  heightsPt: { title: 60, header: 40, row: 36, total: 36 },
  data: [
    ['A', 'M1', '', '2026-11-05', 12],
    ['B', 'M2', '', '2026-11-04', 7],
    ['C', 'M1', '', '2026-11-03', 5]
  ]
};
