// application/capability_manifest.js — r10-B/r11-5 CapabilityManifest（一处真相，纯数据零 IO/零 java）
//   动机（r10 P1 + r11 P1）：构造 ≠ 序列化 ≠ 渲染 ≠ 回归 ≠ Agent 可用——五层状态一次说清，
//   Agent 看 discover 拿到的 manifest，不会把"对象挂接完成"宣传成"已完整支持"。
//   r11-5 新增 regression 维度：真实渲染成功 ≠ 有可重复回归证据；agentAvailable 由前四层全 verified 共同决定。
//   证据规则（r10 三原则①）：只有经真实验证的能力才标 verified；pending/rejected 必须带 README/probe/carrier 引证。
//   一处真相：本表是能力成熟度的唯一权威；lib/ir.js CAPABILITIES.chart.deco 注记指向这里。
var CapabilityManifest = (function () {
  // status 词汇：verified=已实证 | constructed=对象挂接成功但渲染未证 | serialization-only=序列化在(渲染属 web/浏览器行为) |
  //               pending=登记未做 | rejected=结构化拒（不硬凑）
  // agentAvailable = construction/serialization/rendering/regression 四层全 verified 才 true
  function cap(name, construction, serialization, rendering, regression, evidence) {
    var agentAvailable = (construction === 'verified' && serialization === 'verified' && rendering === 'verified' && regression === 'verified');
    return {
      name: name,
      construction: construction,
      serialization: serialization,
      rendering: rendering,
      regression: regression,
      agentAvailable: agentAvailable,
      evidence: evidence
    };
  }

  // 图表族（README #26/#45/#46/#72/#79/#80；carrier=test_vanchart/sales_demo_chart，scan_all_specs 可重复）
  var chart = [
    cap('chart.bar', 'verified', 'verified', 'verified', 'verified', 'README #26 四柱比例+图例实拍；carrier sales_demo_chart 每轮 scan'),
    cap('chart.pie', 'verified', 'verified', 'verified', 'verified', 'README #26/#46'),
    cap('chart.line', 'verified', 'verified', 'verified', 'verified', 'README #46 B240/F240 全刻度'),
    cap('chart.vbar', 'verified', 'verified', 'verified', 'verified', 'README #46 240pt 地板定案；test_vanchart scan 覆盖'),
    cap('chart.vline', 'verified', 'verified', 'verified', 'verified', 'README #46'),
    cap('chart.varea', 'verified', 'verified', 'verified', 'verified', 'README #46 G2 参照全绿'),
    cap('chart.vscatter', 'verified', 'verified', 'verified', 'verified', 'README #79 bubbleSize 修复后散点整齐'),
    cap('chart.vbubble', 'verified', 'verified', 'verified', 'verified', 'README #79 BubbleTableDefinition 同法；test_vanchart 第11块'),
    cap('chart.vpie', 'verified', 'verified', 'verified', 'verified', 'README #46 OneValueCDDefinition（图例4见3 另记 vpieLegend 挂账）'),
    cap('chart.vgauge', 'verified', 'verified', 'verified', 'verified', 'README #46'),
    cap('chart.vmap', 'pending', 'pending', 'pending', 'pending', 'README #79 绑定10参+MapMatchResult+GIS 底图，无轻量通路'),
    cap('chart.heatmap', 'pending', 'pending', 'pending', 'pending', 'README #80 极端图族登记'),
    cap('chart.tooltip', 'verified', 'verified', 'serialization-only', 'verified', 'README #72 AttrTooltip 全家序列化；tooltip 为 web 交互行为静态 PNG 不现形（同官方）'),
    cap('chart.label', 'verified', 'verified', 'verified', 'verified', 'probe_r4m9 定案(m5 L_a/m9 n1·n3 双证)：label 必挂命名 ConditionAttr+恒真 ListCondition 才渲染,DefaultAttr 序列化在渲染无;官方 Demo.cpt 条件属性4 同构；carrier test_vanchart 实跑柱顶数值'),
    cap('chart.stack', 'verified', 'verified', 'verified', 'verified', 'probe_r4m3 结案：isStackChart 只认 vanChartPlotType==STACK/STACK_BY_PERCENT,补 setter 后 stackCols>0 实拍堆叠；carrier test_vanchart 实跑'),
    cap('chart.conditionalSeries', 'verified', 'verified', 'verified', 'verified', 'probe_r4m7 D_a 实拍：系列条件染色正类=AttrBackground+ColorBackground(AttrColor 引擎不染)；carrier test_vanchart 实跑'),
    cap('chart.trendLine', 'verified', 'verified', 'verified', 'verified', 'README #72 LineStyleInfo 门槛补齐后红趋势线画出 PNG'),
    cap('chart.axisYUnit', 'verified', 'verified', 'verified', 'verified', 'probe_r4m17 实拍：unit=50 主刻度 0..300 全渲染（无轴标题时）；setTitle 后引擎自动降密度 100 步（交互事实记档）；carrier test_vanchart vline 臂'),
    cap('chart.hyperlinkCell', 'pending', 'pending', 'pending', 'pending', 'README #79 ChartHyperRelateCellLink 挂接面未探完，随地图批')
  ];
  // 条件属性族（README #45/#49/#71；carrier=test_hla2/test_cellattrs，scan 可重复）
  var condition = [
    cap('condition.formula', 'verified', 'verified', 'verified', 'verified', 'README #71 test_hla2 PNG 分片'),
    cap('condition.column', 'verified', 'verified', 'verified', 'verified', 'README #71 本格值求值语义一手'),
    cap('condition.list', 'verified', 'verified', 'verified', 'verified', 'README #45/#71'),
    cap('condition.then.value', 'verified', 'verified', 'verified', 'verified', 'README #71 字面换值+公式换值 PNG'),
    cap('condition.then.border', 'verified', 'verified', 'verified', 'verified', 'README #71 粗底线 PNG 分片'),
    cap('condition.then.link', 'verified', 'verified', 'serialization-only', 'verified', 'README #71 超链为浏览器行为静态 PNG 不现形（官方同）'),
    cap('condition.then.widget', 'verified', 'verified', 'serialization-only', 'verified', 'README #71 PNG 不渲染控件序列化为准（官方同）'),
    cap('condition.then.style', 'verified', 'verified', 'verified', 'verified', 'README #45/#49 bg/color/font/rowHeight/colWidth/page')
  ];
  // 填报族（README #76/#80）
  var write = [
    cap('write.structure', 'verified', 'verified', 'serialization-only', 'verified', 'README #76 ReportWriteAttr/BuiltInSQLSubmiter/IntelliDMLConfig 序列化在（提交属 web 行为）'),
    cap('write.submit', 'pending', 'pending', 'pending', 'pending', 'README #76 WriteActor DML 真提交=独立工单'),
    cap('write.verifiers', 'rejected', 'rejected', 'rejected', 'rejected', 'README #76 VerifyItem≠Verifier 结构化拒'),
    cap('write.toolbarButtons', 'verified', 'verified', 'serialization-only', 'verified', 'README #76 按钮序列化在（web 行为）'),
    cap('write.editorReg', 'verified', 'verified', 'serialization-only', 'verified', 'README #76 TextEditor 家族 reg（NumberEditor 等无 setRegex 跳过）')
  ];
  // 页面/单元格表达力族（README #31/#73/#77/#78/#80）
  var page = [
    cap('page.headerFooter', 'verified', 'verified', 'verified', 'verified', 'README #73 PDF 文本层逐字命中；test_pagehf scan'),
    cap('page.templateMarks', 'verified', 'verified', 'verified', 'verified', 'README #73 TemplateId/Theme 序列化+roundtrip'),
    cap('page.repeatHeaderRow', 'verified', 'verified', 'verified', 'verified', 'README #31 每页重复标题条带'),
    cap('page.freezeWeb', 'pending', 'pending', 'pending', 'pending', 'README #77 240 demo 零语料'),
    cap('page.multiSheet', 'rejected', 'rejected', 'rejected', 'rejected', 'README #50 UNSUPPORTED_CAPABILITY:multi_sheet'),
    cap('cell.sort', 'rejected', 'rejected', 'rejected', 'rejected', 'README #78 墙破缺语料结构化拒'),
    cap('cell.subreport', 'verified', 'verified', 'verified', 'verified', 'README #77 整嵌渲染 PNG；test_g scan'),
    cap('cell.barcode', 'verified', 'verified', 'verified', 'verified', 'README #77 条码 PNG；test_g scan'),
    cap('cell.groupCustom', 'verified', 'verified', 'verified', 'verified', 'README #77 CustomGrouper 简单形态'),
    cap('cell.poly', 'pending', 'pending', 'pending', 'pending', 'README #80 PolyWorkSheet 通路已证，块面 API 未探全')
  ];
  // ReportSpec / 数据集 / 语义 / 模板产品面（README #55/#59/#60/#74/#76/#82）
  var product = [
    cap('spec.rows.sum', 'verified', 'verified', 'verified', 'verified', 'README #55 等价铁证 CBEB42E3；fast_report_spec'),
    cap('spec.sql.model', 'verified', 'verified', 'verified', 'verified', 'README #59 端到端 33531/26531/79.12 逐格真值；fast_sqlbuilder'),
    cap('spec.sql.filters', 'verified', 'verified', 'verified', 'verified', 'README #62 受控字面量引擎 live'),
    cap('spec.sql.sort', 'verified', 'verified', 'verified', 'verified', 'README #62 ORDER BY 别名 live'),
    cap('spec.sql.topN', 'verified', 'verified', 'verified', 'verified', 'README #62 SELECT TOP live'),
    cap('spec.sql.chart', 'verified', 'verified', 'verified', 'verified', 'README #62 presentation.chart bar|pie|line live'),
    cap('spec.dataset.databaseDict', 'pending', 'pending', 'pending', 'pending', 'README #74 Database|DynamicSQLDict 需连接面=凭据注入批工单'),
    cap('template.patch.cellValue', 'verified', 'verified', 'verified', 'verified', 'README #60 replace_cell_value 读回 PASS；integration_runtime S6'),
    cap('template.patch.dataset', 'verified', 'verified', 'verified', 'verified', 'README #60 replace_dataset colCount 读回 PASS'),
    cap('template.patch.style', 'rejected', 'rejected', 'rejected', 'rejected', 'README #60 R0 探针不过/命名样式有损 明确不做'),
    cap('agent.plan', 'verified', 'verified', 'verified', 'verified', 'README #82 plan verb 三态实测；integration_runtime'),
    cap('agent.artifact.isolation', 'verified', 'verified', 'verified', 'verified', 'README #82 runId 目录隔离；integration_runtime S1/3/5/6'),
    cap('agent.runtime.serial', 'verified', 'verified', 'verified', 'verified', 'r12 单实例 Supervisor；integration_runtime maxLiveRuntime=1')
  ];

  function build() {
    return {
      manifestVersion: '2',
      source: 'application/capability_manifest.js（一处真相；lib/ir.js CAPABILITIES 注记引用此处）',
      legend: 'construction=API 构造 | serialization=CPT 序列化 | rendering=FineReport 实际渲染 | regression=可重复回归证据 | agentAvailable=四层全 verified 才 true',
      chart: chart, condition: condition, write: write, page: page, product: product
    };
  }

  // Agent 可安全使用的能力名单（扁平）
  function agentAvailableNames() {
    var out = [];
    [chart, condition, write, page, product].forEach(function (seg) {
      seg.forEach(function (c) { if (c.agentAvailable) out.push(c.name); });
    });
    return out.sort();
  }

  return { build: build, agentAvailableNames: agentAvailableNames };
})();
