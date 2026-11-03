// test_cellattrs.js — lib 能力自检：条件属性族 / 数据字典 / HTML 显示
// 不参与产品交付，只用于把新 IR 能力跑通并留像素证据。

var SPEC = {
  outName: '能力自检_单元格属性',
  title: '单元格能力自检（条件属性 / 字典 / HTML）',
  columns: [
    {
      label: '序号', name: 'no', type: 'number', widthPt: 90, format: '#,##0',
      // 1) 公式条件：偶数行整行浅底（官方 row()%2==0 形态）
      conditions: [{ name: '偶数行', when: { formula: 'row() % 2 == 0' }, then: { bg: 0xEEF3FA } }]
    },
    {
      label: '判定', name: 'grade', type: 'text', widthPt: 120,
      // 2) 数据字典：A/B/C → 合格/返修/报废
      dict: { A: '合格', B: '返修', C: '报废' }
    },
    {
      label: '说明', name: 'note', type: 'text', widthPt: 260,
      html: true
    },
    {
      label: '分数', name: 'score', type: 'number', widthPt: 110, format: '#,##0.0',
      // 3) 值条件：< 60 → 红底；>= 90 → 绿色加粗
      conditions: [
        { name: '不及格', when: { column: 'score', op: '<', value: 60, valueType: 'number' }, then: { bg: 0xFDE2E2, color: 0xC00000, bold: true } },
        { name: '优良', when: { column: 'score', op: '>=', value: 90, valueType: 'number' }, then: { bg: 0xE4F5E9, color: 0x1E7B34 } }
      ]
    }
  ],
  heightsPt: { title: 82, header: 50.5, row: 45, total: 45 },
  data: [
    [1, 'A', '<b>一次通过</b>', 96],
    [2, 'B', '尺寸偏大', 58],
    [3, 'A', '正常', 88],
    [4, 'C', '<i>程序缺失</i>', 32],
    [5, 'A', '正常', 91]
  ],
  // 4) 块级条件（不带 column = 整行）：分数 < 40 的整行加粗字体
  conditions: [
    { name: '重大异常整行', when: { column: 'score', op: '<', value: 40, valueType: 'number' }, then: { bold: true, sizePt: 12 } }
  ]
};
