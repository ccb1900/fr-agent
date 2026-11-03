// 报表规格：sales_demo + 超链钻取（v3.2 尾刀能力族）
// link：点"产品"格 → ReportletHyperlink 跳本目录已产出的销售明细_api.cpt（钻取）
// 超链是浏览器行为，静态 PNG 不现形；验收 = 序列化同构（NameJavaScriptGroup/ReportletHyperlink/路径/名称）+ roundtrip

var SPEC = {
  outName: '销售明细_超链',
  title: '2026 Q3 洋酒销售明细',
  columns: [
    { label: '地区',   name: '地区',   type: 'text',   widthPt: 240 },
    { label: '销售员', name: '销售员', type: 'text',   widthPt: 150 },
    { label: '产品',   name: '产品',   type: 'text',   widthPt: 216 },
    { label: '销量',   name: '销量',   type: 'number', widthPt: 144, format: '#,##0' }
  ],
  heightsPt: { title: 82, header: 50.5, row: 45, total: 45 },
  link: { by: '产品', name: '查看明细', reportlet: 'fineagent/销售明细_api.cpt' },
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
