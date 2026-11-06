// application/capability_manifest.js — r10-B/r11-5 CapabilityManifest（一处真相，纯数据零 IO/零 java）
//   动机（r10 P1 + r11 P1）：构造 ≠ 序列化 ≠ 渲染 ≠ 回归 ≠ Agent 可用——五层状态一次说清，
//   Agent 看 discover 拿到的 manifest，不会把"对象挂接完成"宣传成"已完整支持"。
//   r11-5 新增 regression 维度：真实渲染成功 ≠ 有可重复回归证据；agentAvailable 由前四层全 verified 共同决定。
//   证据规则（r10 三原则①）：只有经真实验证的能力才标 verified；pending/rejected 必须带 README/probe/carrier 引证。
//   §5步2（2026-11-06 闭环审计实施）：新增 regressionScope——标注 regression=verified 究竟回归了哪一层
//   （ir/object/cpt/serialization/rendering/agent）。四层各自独立：序列化层回归合法，不因渲染未验而错误降级；
//   每个 regression=verified 必须带具体测试入口（carrier/probe/fast/scan/integration），禁"一句 README"（对账器 verify/fast_manifest_evidence.js 硬红线）。
//   一处真相：本表是能力成熟度的唯一权威；lib/ir.js CAPABILITIES.chart.deco 注记指向这里。
var CapabilityManifest = (function () {
  // status 词汇：verified=已实证 | constructed=对象挂接成功但渲染未证 | serialization-only=序列化在(渲染属 web/浏览器行为) |
  //               pending=登记未做 | rejected=结构化拒（不硬凑）
  // agentAvailable = construction/serialization/rendering/regression 四层全 verified 才 true
  // regressionScope ∈ {ir,object,cpt,serialization,rendering,agent}：regression=verified 时必填，标明回归覆盖的最高层；pending/rejected 传 null
  // agentOverride（可选，2026-11-06）：显式声明 agentAvailable。用于"四层 rawIR 全 verified、但 ReportSpec/Planner 无入口"的能力
  //   ——按 R3-0 口径，Agent 可用必须有 plan→create 证据，不能因 rawIR 载体自动广告。
  function cap(name, construction, serialization, rendering, regression, evidence, regressionScope, agentOverride) {
    var four = (construction === 'verified' && serialization === 'verified' && rendering === 'verified' && regression === 'verified');
    var agentAvailable = (agentOverride !== undefined) ? agentOverride : four;
    return {
      name: name,
      construction: construction,
      serialization: serialization,
      rendering: rendering,
      regression: regression,
      regressionScope: regressionScope || null,
      agentAvailable: agentAvailable,
      evidence: evidence
    };
  }

  // 图表族（README #26/#45/#46/#72/#79/#80；carrier=test_vanchart/sales_demo_chart，scan_all_specs 可重复）
  var chart = [
    cap('chart.bar', 'verified', 'verified', 'verified', 'verified', 'README #26 四柱比例+图例实拍；carrier sales_demo_chart 每轮 scan', 'rendering'),
    cap('chart.pie', 'verified', 'verified', 'verified', 'verified', 'README #26/#46；carrier sales_demo_chart（legacy chart 族级代表，pie 臂无独立载体，见审计 §3.2）', 'cpt'),
    cap('chart.line', 'verified', 'verified', 'verified', 'verified', 'README #46 B240/F240 全刻度；carrier sales_demo_chart（legacy chart 族级代表）', 'cpt'),
    cap('chart.vbar', 'verified', 'verified', 'verified', 'verified', 'README #46 240pt 地板定案；carrier test_vanchart scan 覆盖', 'cpt'),
    cap('chart.vline', 'verified', 'verified', 'verified', 'verified', 'README #46；carrier test_vanchart vline 臂', 'cpt'),
    cap('chart.varea', 'verified', 'verified', 'verified', 'verified', 'README #46 G2 参照全绿；carrier test_vanchart varea 臂', 'cpt'),
    cap('chart.vscatter', 'verified', 'verified', 'verified', 'verified', 'README #79 bubbleSize 修复后散点整齐；carrier test_vanchart vscatter 臂', 'cpt'),
    cap('chart.vbubble', 'verified', 'verified', 'verified', 'verified', 'README #79 BubbleTableDefinition 同法；carrier test_vanchart 第11块', 'cpt'),
    cap('chart.vpie', 'verified', 'verified', 'verified', 'verified', 'README #46 OneValueCDDefinition（图例4见3 另记 vpieLegend 挂账）；carrier test_vanchart vpie 臂', 'cpt'),
    cap('chart.vgauge', 'verified', 'verified', 'verified', 'verified', 'README #46；carrier test_vanchart vgauge 臂', 'cpt'),
    cap('chart.vmap', 'pending', 'pending', 'pending', 'pending', 'README #79 绑定10参+MapMatchResult+GIS 底图；引擎渲染可行性已证（probe_r4m19 官方 mapfather.cpt 无头实拍），fr-agent 生成链路未接通'),
    cap('chart.heatmap', 'pending', 'pending', 'pending', 'pending', 'README #80 极端图族登记'),
    cap('chart.tooltip', 'verified', 'verified', 'serialization-only', 'verified', 'README #72 AttrTooltip 全家序列化；probe_r4m15 XML 断言；tooltip 为 web 交互行为静态 PNG 不现形（同官方）', 'serialization'),
    cap('chart.label', 'verified', 'verified', 'verified', 'verified', 'probe_r4m9 定案：label 必挂命名 ConditionAttr+恒真 ListCondition 才渲染；官方 Demo.cpt 条件属性4 同构；carrier test_vanchart 实跑柱顶数值（§5步4 真引擎 PNG：logs/_visual_mid.png 堆叠段白字数值可见）。**范围限定=已验证形态（命名条件+恒真/单图三件组合 m10）；vpie label.summary 经 test_vanchart 真引擎 PNG 目检仅序列化、总结文字未可见渲染，不升层；不推导所有条件组合/复合嵌套**', 'rendering'),
    cap('chart.stack', 'verified', 'verified', 'verified', 'verified', 'probe_r4m3 结案：isStackChart 只认 vanChartPlotType==STACK/STACK_BY_PERCENT,补 setter 后实拍堆叠；carrier test_vanchart 实跑。**范围限定=vbar/varea 的 STACK/STACK_BY_PERCENT 单图，不推导自定义组合图**', 'rendering'),
    cap('chart.conditionalSeries', 'verified', 'verified', 'verified', 'verified', 'probe_r4m7 D_a 实拍：系列条件染色正类=AttrBackground+ColorBackground；carrier test_vanchart 实跑。**范围限定=系列级染色（恒真/CommonCondition 两臂），不等于任意复杂条件语义已验证**', 'rendering'),
    cap('chart.trendLine', 'verified', 'verified', 'verified', 'verified', 'README #72 LineStyleInfo 门槛补齐后红趋势线画出 PNG；carrier test_vanchart vline trend 臂', 'rendering'),
    cap('chart.axisYUnit', 'verified', 'verified', 'verified', 'verified', 'probe_r4m17 实拍：unit=50 主刻度全渲染（无轴标题分支）；setTitle 后引擎自动降密度（交互事实记档）；carrier test_vanchart vline 臂。★审计 §2：0..300 无标题全刻度形态待补独立载体。§5步4 legacy axisX：reports/test_visual_deco.js 真引擎 PNG 目检 X 轴类目标签字号明显放大(fontPt:14 生效)，公共键 legacy 路径视觉验证通过', 'rendering'),
    cap('chart.hotTooltip', 'verified', 'verified', 'serialization-only', 'verified', 'probe_r4m14b Plot.setHotTooltipStyle(AttrContents) 方法面+probe_r4m15 XML 断言；官方 newHotTooltipStyle 节点同构；渲染=web 交互不外宣', 'serialization'),
    cap('chart.seriesBorder', 'verified', 'verified', 'pending', 'verified', 'probe_r4m14 AttrBorder(Color,int)/AttrBorderWithAlpha(Color,int,double) CTOR+probe_r4m15 XML 断言；§5步4 真引擎 PNG 目检：reports/test_vanchart.js 堆叠臂柱缘无可分辨蓝框（0x3355AA alpha0.9 可能被抗锯齿吃掉或未渲染），维持 pending', 'serialization'),
    cap('chart.effect', 'verified', 'verified', 'serialization-only', 'verified', 'probe_r4m14 AttrEffect(period) 方法面+probe_r4m15 XML 断言；web 动画渲染不外宣', 'serialization'),
    cap('chart.areaFill', 'verified', 'verified', 'verified', 'verified', 'probe_r4m14 AttrAreaSeriesFillColorBackground 方法面+probe_r4m15 XML 断言；§5步4 真引擎 PNG 目检：reports/test_vanchart.js varea 臂浅蓝面积带(0x77BBFF alpha0.45)可见（logs/_visual_top.png 第3面板）', 'rendering'),
    cap('chart.seriesImage', 'verified', 'verified', 'pending', 'verified', 'probe_r4m14b ImageBackground(ImageWithSuffix.build(byte[])) 方法面+probe_r4m15 XML 断言；§5步4 真引擎 reports/test_visual_deco.js PNG 目检：柱体仍纯色，图片未可见渲染（AttrSeriesImageBackground 序列化在但视觉未现形，不升层）', 'serialization'),
    cap('chart.hyperlinkCell', 'pending', 'pending', 'pending', 'pending', 'README #79 ChartHyperRelateCellLink 挂接面未探完，随地图批')
  ];
  // 条件属性族（README #45/#49/#71；carrier=test_hla2/test_cellattrs，scan 可重复）
  var condition = [
    cap('condition.formula', 'verified', 'verified', 'verified', 'verified', 'README #71 carrier test_hla2 PNG 分片', 'rendering'),
    cap('condition.column', 'verified', 'verified', 'verified', 'verified', 'README #71 本格值求值语义一手；carrier test_cellattrs', 'cpt'),
    cap('condition.list', 'verified', 'verified', 'verified', 'verified', 'README #45/#71；carrier test_closure_gaps（when.list 形态，v2 对账器补实）', 'cpt'),
    cap('condition.then.value', 'verified', 'verified', 'verified', 'verified', 'README #71 字面换值+公式换值 PNG；carrier test_hla2', 'rendering'),
    cap('condition.then.border', 'verified', 'verified', 'verified', 'verified', 'README #71 粗底线 PNG 分片；carrier test_hla2', 'rendering'),
    cap('condition.then.link', 'verified', 'verified', 'serialization-only', 'verified', 'README #71 超链为浏览器行为静态 PNG 不现形（官方同）；carrier test_hla2', 'serialization'),
    cap('condition.then.widget', 'verified', 'verified', 'serialization-only', 'verified', 'README #71 PNG 不渲染控件序列化为准（官方同）；carrier test_hla2', 'serialization'),
    cap('condition.then.style', 'verified', 'verified', 'verified', 'verified', 'README #45/#49 bg/color/font/rowHeight/colWidth/page；carrier test_cellattrs', 'cpt')
  ];
  // 填报族（README #76/#80）
  var write = [
    cap('write.structure', 'verified', 'verified', 'serialization-only', 'verified', 'README #76 ReportWriteAttr/BuiltInSQLSubmiter/IntelliDMLConfig 序列化在（提交属 web 行为）；carrier test_write', 'serialization'),
    cap('write.submit', 'pending', 'pending', 'pending', 'pending', 'README #76 WriteActor DML 真提交=独立工单'),
    cap('write.verifiers', 'rejected', 'rejected', 'rejected', 'rejected', 'README #76 VerifyItem≠Verifier 结构化拒'),
    cap('write.toolbarButtons', 'verified', 'verified', 'serialization-only', 'verified', 'README #76 按钮序列化在（web 行为）；carrier test_write', 'serialization'),
    cap('write.editorReg', 'verified', 'verified', 'serialization-only', 'verified', 'README #76 TextEditor 家族 reg（NumberEditor 等无 setRegex 跳过）；carrier test_write', 'serialization')
  ];
  // 页面/单元格表达力族（README #31/#73/#77/#78/#80）
  var page = [
    cap('page.headerFooter', 'verified', 'verified', 'verified', 'verified', 'README #73 PDF 文本层逐字命中；carrier test_pagehf scan', 'cpt'),
    cap('page.templateMarks', 'verified', 'verified', 'verified', 'verified', 'README #73 TemplateId/Theme 序列化+roundtrip；carrier test_pagehf', 'cpt'),
    cap('page.repeatHeaderRow', 'verified', 'verified', 'verified', 'verified', 'README #31 每页重复标题条带；carrier test_closure_gaps（repeatHeaderRow 键，v2 对账器补实）', 'cpt'),
    cap('page.freezeWeb', 'pending', 'pending', 'pending', 'pending', 'README #77 240 demo 零语料'),
    cap('page.multiSheet', 'verified', 'verified', 'verified', 'verified', 'A1（2026-11-06）：object 每 sheet 状态隔离（旧 si>0 throw 已拆），IR 接受多 sheet；carrier test_multisheet 部署 cpt 两个 <Report>（汇总/明细，均 WorkSheet），引擎渲染 failures=0。**ReportSpec/Planner 入口仍无 → Agent 不可用**', 'rendering', false),
    cap('cell.sort', 'rejected', 'rejected', 'rejected', 'rejected', 'README #78 墙破缺语料结构化拒'),
    cap('cell.subreport', 'verified', 'verified', 'verified', 'verified', 'README #77 整嵌渲染 PNG；carrier test_g scan', 'rendering'),
    cap('cell.barcode', 'verified', 'verified', 'verified', 'verified', 'README #77 条码 PNG；carrier test_g scan', 'rendering'),
    cap('cell.groupCustom', 'verified', 'verified', 'verified', 'verified', 'README #77 CustomGrouper 简单形态；carrier test_g', 'cpt'),
    cap('cell.poly', 'pending', 'pending', 'pending', 'pending', 'README #80 PolyWorkSheet 通路已证，块面 API 未探全')
  ];
  // ReportSpec / 数据集 / 语义 / 模板产品面（README #55/#59/#60/#74/#76/#82）
  var product = [
    cap('spec.rows.sum', 'verified', 'verified', 'verified', 'verified', 'README #55 等价铁证 CBEB42E3；fast_report_spec', 'cpt'),
    cap('spec.sql.model', 'verified', 'verified', 'verified', 'verified', 'README #59 端到端 33531/26531/79.12 逐格真值；fast_sqlbuilder', 'agent'),
    cap('spec.sql.filters', 'verified', 'verified', 'verified', 'verified', 'README #62 受控字面量引擎 live；fast_sqlbuilder', 'cpt'),
    cap('spec.sql.sort', 'verified', 'verified', 'verified', 'verified', 'README #62 ORDER BY 别名 live；fast_sqlbuilder', 'cpt'),
    cap('spec.sql.topN', 'verified', 'verified', 'verified', 'verified', 'README #62 SELECT TOP live；fast_sqlbuilder', 'cpt'),
    cap('spec.sql.chart', 'verified', 'verified', 'verified', 'verified', 'README #62 presentation.chart bar|pie|line live；fast_planner', 'cpt'),
    cap('spec.dataset.databaseDict', 'pending', 'pending', 'pending', 'pending', 'README #74 Database|DynamicSQLDict 需连接面=凭据注入批工单'),
    cap('template.patch.cellValue', 'verified', 'verified', 'verified', 'verified', 'README #60 replace_cell_value 读回 PASS；integration_runtime S6', 'cpt'),
    cap('template.patch.dataset', 'verified', 'verified', 'verified', 'verified', 'README #60 replace_dataset colCount 读回 PASS；integration_runtime', 'cpt'),
    cap('template.patch.style', 'rejected', 'rejected', 'rejected', 'rejected', 'README #60 R0 探针不过/命名样式有损 明确不做'),
    cap('agent.plan', 'verified', 'verified', 'verified', 'verified', 'README #82 plan verb 三态实测；integration_runtime', 'agent'),
    cap('agent.artifact.isolation', 'verified', 'verified', 'verified', 'verified', 'README #82 runId 目录隔离；integration_runtime S1/3/5/6', 'agent'),
    cap('agent.runtime.serial', 'verified', 'verified', 'verified', 'verified', 'r12 单实例 Supervisor；integration_runtime maxLiveRuntime=1', 'agent')
  ];

  function build() {
    return {
      manifestVersion: '3',
      source: 'application/capability_manifest.js（一处真相；lib/ir.js CAPABILITIES 注记引用此处）',
      legend: 'construction=API 构造 | serialization=CPT 序列化 | rendering=FineReport 实际渲染 | regression=可重复回归证据 | regressionScope=regression 覆盖的最高层(ir/object/cpt/serialization/rendering/agent，四层独立不强制一致) | agentAvailable=四层全 verified 才 true',
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
