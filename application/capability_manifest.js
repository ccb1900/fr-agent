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
    cap('chart.vmap', 'verified', 'verified', 'verified', 'verified', 'D2（2026-11-06）：官方 doc/Chart/mapfather.cpt 结构（VanChartMapPlotAttr mapType=area/geourl/zoomlevel + VanMapDefinition/areaDefinition 类=VanMapMoreNameCDDefinition 10 参 useAreaName）→ object 构造与 cpt 序列化同构；carrier test_vmap 真引擎 failures=0，部署 cpt mapType="area"/geourl=中国.json/VanMapDefinition 命中，PNG 目检中国区域地图着色+图例 0..280000；ReportSpec sql 路可表达（geoUrl/zoom/longitude/latitude），当前模型无省份数据源、无 plan→create e2e → Agent 不可用', 'rendering', false),
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
    cap('chart.seriesImage', 'verified', 'verified', 'pending', 'verified', 'probe_r4m14b ImageBackground(ImageWithSuffix.build(byte[])) 方法面+probe_r4m15 XML 断言；2026-11-06 棋盘格判别实验：fixture 改品红/白 16x16 棋盘（纯色会与默认柱色同色无法判定），test_visual_deco 真引擎 failures=0、部署 cpt ImageBackground/AttrSeriesImageBackground 在，PNG 柱仍纯蓝 → 视觉未现形，rendering 维持 pending', 'serialization'),
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
    cap('page.multiSheet', 'verified', 'verified', 'verified', 'verified', 'A1+多Sheet spec+e2e（2026-11-06）：carrier test_multisheet 与 spec 载体 multisheet.json 均 2 <Report>、PNG 两页；**plan→create e2e GREEN**：scripts/run-multisheet-e2e.ps1（plan→plan2spec→create）保留 extraSheets/params，部署 cpt 2 <Report>+ReportParameterAttr+ds2；planner 透传', 'rendering', true),
    cap('cell.sort', 'rejected', 'rejected', 'rejected', 'rejected', 'README #78 墙破缺语料结构化拒'),
    cap('cell.subreport', 'verified', 'verified', 'verified', 'verified', 'README #77 整嵌渲染 PNG；carrier test_g scan', 'rendering'),
    cap('cell.barcode', 'verified', 'verified', 'verified', 'verified', 'README #77 条码 PNG；carrier test_g scan', 'rendering'),
    cap('cell.groupCustom', 'verified', 'verified', 'verified', 'verified', 'README #77 CustomGrouper 简单形态；carrier test_g', 'cpt'),
    cap('cell.poly', 'pending', 'pending', 'pending', 'pending', 'README #80 PolyWorkSheet 通路已证，块面 API 未探全'),
    // 2026-11-06 C2：隐藏行列（行高/列宽归零）；ReportSpec sheet.hideRows/hideCols 有入口
    cap('sheet.hideRowsCols', 'verified', 'verified', 'verified', 'verified', 'C2（2026-11-06）：IR hideRows/hideCols→object sheet 构建末 setRowHeight/setColumnWidth(FU 0)；carrier test_hidden 真引擎 failures=0（RowHeight[1]=0/ColumnWidth[1]=0），PNG 目检表头行与「完成」列消失；spec 载体 examples/report-spec/hidden.json 同证；fast_report_spec C2 断言', 'rendering'),
    // 2026-11-06 R3-0：cells 多行/多列合并（rowSpan）；ReportSpec 无入口（presentation.cells 拒绝对 r）
    cap('cells.rowSpan', 'verified', 'verified', 'verified', 'verified', 'README #113/#114 R3-0：IR rowSpan 整数闸+块内重叠静态拒；carrier test_merge_header 部署 cpt rs="2"×2/cs="2"×1，PNG 目检合并表头；fast_ir_contract R3-0 断言。**ReportSpec/Planner 无入口 → Agent 不可用**', 'rendering', false)
  ];
  // ReportSpec / 数据集 / 语义 / 模板产品面（README #55/#59/#60/#74/#76/#82）
  var product = [
    cap('spec.rows.sum', 'verified', 'verified', 'verified', 'verified', 'README #55 等价铁证 CBEB42E3；fast_report_spec', 'cpt'),
    // 2026-11-06 B1-B6：ReportSpec 新入口（四条独立；渲染未证者不升层）
    cap('spec.rows.conditions', 'verified', 'verified', 'verified', 'verified', 'B1（2026-11-06）：presentation.conditions→IR detail.conditions→HighlightGroup×3；spec 载体 hl_conditions 真引擎 failures=0 且 PNG 高亮行可见；fast_report_spec B1 断言（README #118）', 'rendering'),
    cap('spec.rows.cells', 'verified', 'verified', 'pending', 'verified', 'B3（2026-11-06）：presentation.cells→IR cells 块；spec 载体 cells_extras 真引擎 failures=0（部署 cpt RichText×3/RichChar×4/TextHFElement/WatermarkAttr）；PNG 未专项目检 → rendering 不升层；fast_report_spec B3 断言（README #118）', 'serialization'),
    cap('spec.rows.sumCols', 'verified', 'verified', 'verified', 'verified', 'B6（2026-11-06）：presentation.total.sumCols→IR total.sumCols；spec 载体 sumcols_reg 真引擎 failures=0，部署 cpt 合计 c0 无 cs、c1=SUM(B3)、c2=SUM(C3)（审查轮1 P1-B 后）；PNG 目检合计 120/105 两列求和可见；fast_report_spec B6/span 断言（README #118/#119）', 'rendering'),
    // 2026-11-06 P1：合计行非 sum 聚合（avg/count/min/max/ratio）
    cap('spec.rows.totalAgg', 'verified', 'verified', 'verified', 'verified', 'P1+复审（2026-11-06）：IR aggregate.fn=sum|avg|count|min|max|ratio（ratio={num,den}，整数列 1..25）+ sumCols[].fn；ReportSpec total.aggregate/sumCols[].fn 两通道；rawIR 载体 test_total_agg（PNG 60.0/2/35）+ test_total_ratio（PNG 1.14，aggregate.format）；spec 载体 examples total_agg.json（=AVERAGE(B3)，PNG 平均 60.0）与 total_ratio.json（=SUM(B3)/SUM(C3)，PNG 1.14）真引擎 failures=0；fast_report_spec +8 / fast_ir_contract +12（README #122）', 'rendering'),
    cap('spec.params.panel', 'verified', 'verified', 'serialization-only', 'verified', 'B2（2026-11-06）：ReportSpec params→IR.param widgets（DateEditor/ComboBox/NumberEditor/FormSubmitButton/WParameterLayout）；spec 载体 params.json 真引擎 failures=0；参数面板属 web 交互，静态 PNG 不现形（官方同口径）→ rendering 不升层；fast_report_spec B2 断言（README #118）', 'serialization'),
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
