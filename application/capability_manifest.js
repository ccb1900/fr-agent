// application/capability_manifest.js — r10-B CapabilityManifest（纯数据+纯函数，零 IO/零 java）
//   动机（r10 P1「IR 能力声明不一致」）：构造 ≠ 序列化 ≠ 渲染 ≠ Agent 可用——四层状态一次说清，
//   Agent 看 discover 拿到的 manifest，不会把"对象挂接完成"宣传成"已完整支持"。
//   证据规则（r10 三原则①）：只有经真实验证的能力才标 verified；pending/rejected 必须带 README/probe 引证。
//   一处真相：本表是能力状态的唯一权威；lib/ir.js CAPABILITIES.chart.deco 注记已指向这里。
var CapabilityManifest = (function () {
  // status 词汇：verified=引擎渲染实证 | constructed=对象挂接成功但渲染未证 | serialization-only=序列化在渲染待达 |
  //               pending=登记未做 | rejected=结构化拒（不硬凑）
  // agentAvailable = 四层全 verified 才 true（Agent 可安全使用）
  function cap(name, construction, serialization, rendering, evidence) {
    var agentAvailable = (construction === 'verified' && serialization === 'verified' && rendering === 'verified');
    return {
      name: name,
      construction: construction,
      serialization: serialization,
      rendering: rendering,
      agentAvailable: agentAvailable,
      evidence: evidence
    };
  }

  // 图表族（README #26/#45/#46/#72/#79/#80）
  var chart = [
    cap('chart.bar', 'verified', 'verified', 'verified', 'README #26 四柱比例+图例实拍'),
    cap('chart.pie', 'verified', 'verified', 'verified', 'README #26/#46'),
    cap('chart.line', 'verified', 'verified', 'verified', 'README #46 B240/F240 全刻度'),
    cap('chart.vbar', 'verified', 'verified', 'verified', 'README #46 240pt 地板定案'),
    cap('chart.vline', 'verified', 'verified', 'verified', 'README #46'),
    cap('chart.varea', 'verified', 'verified', 'verified', 'README #46 G2 参照全绿'),
    cap('chart.vscatter', 'verified', 'verified', 'verified', 'README #79 bubbleSize 修复后散点整齐'),
    cap('chart.vbubble', 'verified', 'verified', 'verified', 'README #79 BubbleTableDefinition 同法'),
    cap('chart.vpie', 'verified', 'verified', 'verified', 'README #46 OneValueCDDefinition（图例 4 见 3 挂账）'),
    cap('chart.vgauge', 'verified', 'verified', 'verified', 'README #46'),
    cap('chart.vmap', 'pending', 'pending', 'pending', 'README #79 绑定 10 参+MapMatchResult+GIS 底图，无轻量通路'),
    cap('chart.heatmap', 'pending', 'pending', 'pending', 'README #80 极端图族登记'),
    cap('chart.tooltip', 'verified', 'verified', 'rendering-untested-web', 'README #72 AttrTooltip 全家序列化；tooltip 为 web 交互行为静态 PNG 不现形'),
    cap('chart.label', 'constructed', 'verified', 'pending', 'README #72 诚实边界：labelAttr 序列化在、柱顶数值未现'),
    cap('chart.stack', 'constructed', 'verified', 'pending', 'README #72 诚实边界：setStackAndAxisCondition 官方形序列化在、渲染仍分组'),
    cap('chart.conditionalSeries', 'constructed', 'verified', 'pending', 'README #72 AttrColor 挂上未染'),
    cap('chart.trendLine', 'verified', 'verified', 'verified', 'README #72 LineStyleInfo 门槛补齐后红趋势线画出'),
    cap('chart.axisYUnit', 'verified', 'verified', 'pending', 'README #72 序列化 customMainUnit=true 在、刻度密度渲染待达'),
    cap('chart.hyperlinkCell', 'pending', 'pending', 'pending', 'README #79 ChartHyperRelateCellLink 挂接面未探完，随地图批')
  ];
  // 条件属性族（README #45/#49/#71）
  var condition = [
    cap('condition.formula', 'verified', 'verified', 'verified', 'README #71 test_hla2 PNG 分片'),
    cap('condition.column', 'verified', 'verified', 'verified', 'README #71 本格值求值语义一手'),
    cap('condition.list', 'verified', 'verified', 'verified', 'README #45/#71'),
    cap('condition.then.value', 'verified', 'verified', 'verified', 'README #71 字面换值+公式换值 PNG'),
    cap('condition.then.border', 'verified', 'verified', 'verified', 'README #71 粗底线 PNG 分片'),
    cap('condition.then.link', 'verified', 'verified', 'serialization-only', 'README #71 超链为浏览器行为静态 PNG 不现形（官方同）'),
    cap('condition.then.widget', 'verified', 'verified', 'serialization-only', 'README #71 PNG 不渲染控件序列化为准（官方同）'),
    cap('condition.then.bg|color|font|rowHeight|colWidth|page', 'verified', 'verified', 'verified', 'README #45/#49')
  ];
  // 填报族（README #76/#80）
  var write = [
    cap('write.structure', 'verified', 'verified', 'serialization-only', 'README #76 ReportWriteAttr/BuiltInSQLSubmiter/IntelliDMLConfig 序列化在'),
    cap('write.submit', 'pending', 'pending', 'pending', 'README #76 WriteActor DML 真提交=独立工单'),
    cap('write.verifiers', 'rejected', 'rejected', 'rejected', 'README #76 VerifyItem≠Verifier 结构化拒'),
    cap('write.toolbarButtons', 'verified', 'verified', 'serialization-only', 'README #76 按钮序列化在（web 行为）'),
    cap('write.editorReg', 'verified', 'verified', 'serialization-only', 'README #76 TextEditor 家族 reg（NumberEditor 等无 setRegex 跳过）')
  ];
  // 页面布局族（README #31/#73/#78）
  var page = [
    cap('page.headerFooter', 'verified', 'verified', 'verified', 'README #73 PDF 文本层逐字命中'),
    cap('page.templateMarks', 'verified', 'verified', 'verified', 'README #73 TemplateId/Theme 序列化+roundtrip'),
    cap('page.repeatHeaderRow', 'verified', 'verified', 'verified', 'README #31 每页重复标题条带'),
    cap('page.freezeWeb', 'pending', 'pending', 'pending', 'README #77 240 demo 零语料'),
    cap('page.diagonal', 'verified', 'verified', 'verified', 'README #33 putBiasCell 斜线表头（DiagonalCellLine 语料缺）'),
    cap('page.multiSheet', 'rejected', 'rejected', 'rejected', 'README #50 UNSUPPORTED_CAPABILITY:multi_sheet'),
    cap('detail.sort', 'rejected', 'rejected', 'rejected', 'README #78 墙破缺语料结构化拒'),
    cap('detail.subreport', 'verified', 'verified', 'verified', 'README #77 整嵌渲染 PNG'),
    cap('detail.barcode', 'verified', 'verified', 'verified', 'README #77 条码 PNG'),
    cap('detail.groupCustom', 'verified', 'verified', 'verified', 'README #77 CustomGrouper 简单形态'),
    cap('dict.custom|tableData|formula', 'verified', 'verified', 'verified', 'README #74 PNG 四件'),
    cap('dict.database|dynamicSQL', 'pending', 'pending', 'pending', 'README #74 需连接面=凭据注入批工单'),
    cap('column.dateTextFormat', 'verified', 'verified', 'verified', 'README #74 日期列中文格式 PNG')
  ];

  function build() {
    return {
      manifestVersion: '1',
      source: 'application/capability_manifest.js（一处真相；lib/ir.js CAPABILITIES 注记引用此处）',
      legend: 'construction=API 构造 | serialization=CPT 序列化 | rendering=FineReport 实际渲染 | agentAvailable=四层全 verified 才 true',
      chart: chart, condition: condition, write: write, page: page
    };
  }

  // Agent 可安全使用的能力名单（扁平）
  function agentAvailableNames() {
    var out = [];
    [chart, condition, write, page].forEach(function (seg) {
      seg.forEach(function (c) { if (c.agentAvailable) out.push(c.name); });
    });
    return out.sort();
  }

  return { build: build, agentAvailableNames: agentAvailableNames };
})();
