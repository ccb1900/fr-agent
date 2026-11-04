// test_pagehf.js — 批C 能力自检：页眉页脚（headerfooter 207/240）+ 模板级 attrMark（TemplateId/TemplateTheme）
// 官方一手：档案式报表.cpt（Header/Footer + FormulaHFElement "第N页/共M页"）；探针 _hf7（license 墙 env 后可达）/ _hf9（ReportHF 全 API）
// 像素验证走 PDF（页眉页脚是打印布局概念，分页预览 PDF 每页出现）
var SPEC = {
  outName: '能力自检_页眉页脚',
  title: '页眉页脚自检',
  columns: [
    { label: '编号', name: 'no', type: 'text', widthPt: 120 },
    { label: '数值', name: 'v', type: 'number', widthPt: 160, format: '#,##0' }
  ],
  heightsPt: { title: 60, header: 40, row: 36, total: 36 },
  data: [['a', 1], ['b', 2], ['c', 3]],
  headerFooter: {
    header: { center: [{ text: '激光检测中心 · 页眉（批C 自检）', fontPt: 10, bold: true }], bg: 0xEEF3FA },
    footer: { center: [{ formula: '"第" + $$page_number + "页/共" + $$totalPage_number + "页"', fontPt: 9 }, { date: 'yyyy-MM-dd', fontPt: 9, newLine: true }], right: [{ text: 'fineagent 管线', fontPt: 9 }] }
  },
  templateId: 'b7e3f2a1-4c5d-4e6f-9a8b-1f2e3d4c5b6a',
  templateTheme: { name: '兼容主题', dark: false }
};
