// test_hla2.js — 批A 能力自检：条件动作满血（then.value / then.border / then.link / then.widget）
// 官方一手依据：公司评级.cpt（Value=Formula 直塞）/ 签约情况分析-phone.cpt（Border line 0=断开/2=粗 + 跨列用 FormulaCondition）
//             / 每日资金收支余分析-phone.cpt（Hyperlink=NameJavaScriptGroup 整组）/ 产品月销量情况录入表.cpt（Widget=内嵌 TextEditor 子树）
// 数值为自检手工定值（不连库，真值即本文件）；评分置最后一列（F）=总分列（totalCol 聚合格不得被标签 span 吞并）
// **教案（本轮像素实证）**：cell 级 highlight 条件的 when.column=对本格值求值（列名不跨格求值，
//   空串→0：'<60' 恒真、'>0' 恒假）；跨列判断一律走 when.formula 相对公式（本格锚 + 行自动偏移，官方语料同款）。
var SPEC = {
  outName: '能力自检_条件动作满血',
  title: '条件动作满血自检（换值 / 粗细边框 / 动态超链 / 内嵌控件）',
  columns: [
    { label: '编号', name: 'no', type: 'text', widthPt: 90, align: 0 },
    {
      label: '粗底线预警', name: 'bord', type: 'text', widthPt: 110,
      // 1) then.border：低评（F 列<60）格下方画粗底线（官方 line 0=断开/2=粗；color=FineColor ARGB 直塞）
      conditions: [{ name: '低评粗底线', when: { formula: '=F3<60' }, then: { border: { bottom: { line: 2, color: -9721345 } } } }]
    },
    {
      label: '档位', name: 'gradef', type: 'text', widthPt: 130, align: 0,
      // 2) then.value{formula}：显示层换成公式结果（官方 公司评级.cpt 同形态：本列格内相对公式）
      conditions: [{ name: '公式换值', when: { formula: '=F3>0' }, then: { value: { formula: '=IF(F3>=60,"达标","补考")' } } }]
    },
    {
      label: '复核', name: 'revl', type: 'text', widthPt: 120,
      // 3) then.link：合格行挂条件超链（组形态=HyperlinkHighlightAction(NameJavaScriptGroup)）
      conditions: [{ name: '合格行可钻取', when: { formula: '=F3>=60' }, then: { link: { reportlet: 'fineagent/销售明细_api.cpt', name: '看原表' } } }]
    },
    {
      label: '现场录入', name: 'wgt', type: 'text', widthPt: 120,
      // 4) then.widget：格子内嵌编辑器（官方=TextEditor 子树；PNG 不渲染控件序列化为准）
      conditions: [{ name: '需人工复核', when: { formula: '=F3>0' }, then: { widget: { kind: 'editor', name: '备注框', value: '待录入' } } }]
    },
    {
      label: '评分', name: 'score', type: 'number', widthPt: 110, format: '#,##0',
      // 5) then.value 字面换值：本列条件（本格值求值语义）→ <60 显示「不合格」红字浅红底；>=90 绿灯
      conditions: [
        { name: '低于60换值', when: { column: 'score', op: '<', value: 60, valueType: 'number' }, then: { bg: 0xFDE2E2, color: 0xC00000, value: '不合格' } },
        { name: '90以上绿灯', when: { column: 'score', op: '>=', value: 90, valueType: 'number' }, then: { bg: 0xE4F5E9, color: 0x1E7B34 } }
      ]
    }
  ],
  heightsPt: { title: 60, header: 45, row: 45, total: 36 },
  data: [
    ['L1', '', '', '', '', 58],
    ['L2', '', '', '', '', 96],
    ['L3', '', '', '', '', 72]
  ]
};
