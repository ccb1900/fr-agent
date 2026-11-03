// 报表规格：sales_demo + 条件属性（v3.2 首个新能力族的验收用例）
// highlight：销量 ≥ 6000 → 浅红底（TABLE_DESIGN "强调克制"：只命中极限值）
// 浅红 ARGB 0xFFFFDCDC = int -8996（与 FineColor 语义一致）

var SPEC = {
  outName: '销售明细_条件高亮',
  title: '2026 Q3 洋酒销售明细',
  columns: [
    { label: '地区',   name: '地区',   type: 'text',   widthPt: 240 },
    { label: '销售员', name: '销售员', type: 'text',   widthPt: 150 },
    { label: '产品',   name: '产品',   type: 'text',   widthPt: 216 },
    { label: '销量',   name: '销量',   type: 'number', widthPt: 144, format: '#,##0' }
  ],
  heightsPt: { title: 82, header: 50.5, row: 45, total: 45 },
  highlight: { column: '销量', op: '>=', value: 6000, bg: -8996 },
  data: [
    ['华东', '霍华德',   '特调威士忌707', 2370],
    ['华东', '马歇尔',   '特调威士忌707', 4410],
    ['华东', '霍华德',   '人头马X.O',     1800],
    ['华东', '马歇尔',   '茅台1935',      2100],
    ['华北', '安杰利斯卡', '人头马X.O',   1200],
    ['华北', '谢航',     '人头马X.O',     1550],
    ['华北', '安杰利斯卡', '特调威士忌707', 970],
    ['华南', '邵平',     '茅台1935',      6100],
    ['华南', '含枫',     '茅台1935',      1080],
    ['华南', '邵平',     '人头马X.O',     3300],
    ['西南', '李慕白',   '金标轩尼诗',    890],
    ['西南', '陈数',     '金标轩尼诗',    650]
  ]
};
