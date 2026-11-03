// 报表规格：sales_demo + 参数面板（v3.2 第二个能力族的验收用例）
// 参数面板：workbook 级。布局照官方 GettingStarted.cpt 三件套语系：
//   Label(地区:) → EditorHolder(地区) → FormSubmitButton(查询)，绝对定位 BoundsAttr
// editor 的 name 即参数名（官方语料：widgetName = 参数 key）
// 注意：本用例是面板结构验证——数据过滤（DSColumn 绑 $参数）是下一批（setCondition）

var SPEC = {
  outName: '销售明细_参数面板',
  title: '2026 Q3 洋酒销售明细',
  columns: [
    { label: '地区',   name: '地区',   type: 'text',   widthPt: 240 },
    { label: '销售员', name: '销售员', type: 'text',   widthPt: 150 },
    { label: '产品',   name: '产品',   type: 'text',   widthPt: 216 },
    { label: '销量',   name: '销量',   type: 'number', widthPt: 144, format: '#,##0' }
  ],
  heightsPt: { title: 82, header: 50.5, row: 45, total: 45 },
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
  ],
  paramPanel: {
    title: '参数',
    showWindow: true,
    delayPlaying: true,
    align: 1,            // 官方 Attributes align="1"
    windowPosition: 1,   // 官方 windowPosition="1"
    designWidth: 520,
    designHeight: 81,
    widgets: [
      { kind: 'label',  name: 'Label地区', text: '地区:', x: 40,  y: 25, w: 80, h: 21 },
      { kind: 'editor', name: '地区', value: '华东', x: 130, y: 25, w: 80, h: 21 },
      { kind: 'submit', text: '查询', x: 230, y: 25, w: 80, h: 21 }
    ],
    // 参数过滤（v3.2 二批）：DSColumn.setCondition 绑 $地区；runner 把编辑器默认值送进 execute()
    // 验收基准：渲染只剩华东 4 行，合计=2370+4410+1800+2100=10680（全表 26420 不符即失败）
    filters: [{ column: '地区', op: '=', parameter: '地区' }]
  }
};
