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
    cap('chart.vmap', 'verified', 'verified', 'verified', 'verified', 'D2（2026-11-06）：官方 doc/Chart/mapfather.cpt 结构（VanChartMapPlotAttr mapType=area/geourl/zoomlevel + VanMapDefinition/areaDefinition 类=VanMapMoreNameCDDefinition 10 参 useAreaName）→ object 构造与 cpt 序列化同构；carrier test_vmap(area)/test_vmap_point(point) 真引擎 failures=0，部署 cpt mapType=area|point/geourl/pointDefinition 命中，PNG 目检区域着色 与 散点标记+图例 0..280000；ReportSpec rows 路已通（examples/report-spec/vmap_rows.json 真引擎 failures=0，PNG 中国区域着色+图例 0..760000）；agentAvailable=true', 'rendering', true),
    cap('chart.vheatmap', 'verified', 'verified', 'verified', 'verified', 'D2 热力图（2026-11-07）：官方 doc/Chart/HeatMap/网页热力图.cpt 一手结构（VanChartHeatMapPlot extends VanChartMapPlot，javap；heat 四参 setRadius/setBlur/setMinOpacity/setMaxOpacity 直接在 plot，XML VanChartHeatMapPlotAttr=序列化别名；definition=VanMapDefinition/pointDefinition 与 vmap point 同构；官方缺省 35/45/0/70）。**R0=probe_heatmap.js**：方法面 + 官方模板无头渲染 RENDER-OK（logs/_heatmap_official.png 529712B，D1 检查点通过）。carrier reports/test_vheatmap.js 真引擎 failures=0（PNG 69599B），部署 cpt class=heatmap.VanChartHeatMapPlot/radius=35.0 blur=45.0 maxopacity=70.0 minopacity=0.0/mapType=point/中国.json/pointDefinition×2 与官方逐字段同构；**PNG 目检=5 省热力光晕（广东95 亮黄绿/四川62 橙红/黑龙江40 淡蓝紫，渐变色例 96..40 与数值对应）渲染达成（区别于 D1 组合图渲染不可见）**。ReportSpec rows 路已通（examples/report-spec/vheatmap_rows.json 真引擎 failures=0，PNG 热力光晕渲染）；agentAvailable=true', 'rendering', true),
    cap('chart.vradar', 'verified', 'verified', 'verified', 'verified', '2026-11-08 雷达图（非付费 16 图族闭环第 1 个）：官方 doc/Chart/NewRadarChart/CustomRadar.cpt 一手结构=VanChartRadarPlot + MoreNameCDDefinition(category+ChartSummaryColumn)；object VK 增 vradar，series 走矩形派 MoreName 绑定。carrier reports/test_radar.js 真引擎 failures=0，PNG 目检 5 轴 A-E + 蓝色多边面 + 图例「时速」+ 标题；SQL 真库 plan→plan2spec→create→validate 全链 PASS（runId=radar_e2e_001，部署 cpt + PNG 309 色，报表表体 33531/26531 真值不变，雷达图渲染）。IR/ReportSpec/Planner 三面词表已加 vradar；agentAvailable=true', 'rendering', true),
    cap('chart.vfunnel', 'verified', 'verified', 'verified', 'verified', '2026-11-08 漏斗图（非付费 16 图族闭环第 2 个）：官方 doc/Chart/FunnelPlot/漏斗图.cpt 一手结构=VanChartFunnelPlot + OneValueCDDefinition(seriesName=分类列, valueName=值列, SumFunction)；object VK 增 vfunnel，走 OneValue 派（CategoryName 空）。carrier reports/test_funnel.js 真引擎 failures=0，PNG 目检 5 段漏斗 + 5 条图例（420pt 高度全出）+ 标题；SQL 真库 plan→plan2spec→create→validate 全链 PASS（runId=funnel_e2e_001，表体 33531/26531 真值不变，漏斗图在表体下方渲染）；IR/ReportSpec/Planner 三面词表已加 vfunnel；agentAvailable=true', 'rendering', true),
    cap('chart.vbox', 'verified', 'verified', 'verified', 'verified', '2026-11-08 箱线图：官方 doc/Chart/BoxPlot/分组箱型图.cpt 一手结构=VanChartBoxPlot + VanBoxTableDefinition(detailed=true) + detailedDefinition=VanBoxMoreNameCDDefinition(category+columns) + resultDefinition=VanBoxTableResultDefinition（占位 categoryName/seriesName/median="无"+五标签）；object VK 增 vbox，plot/definition 双 setDetailed(true)。carrier reports/test_box.js（rawIR 1 组×3 系列×7 样本）真引擎 failures=0，PNG 3 箱并排（A/B/C），箱体 Q1/Q3 目检=12/20、22/30、9/25（与 7 样本分位一致）；须线为 1.5×IQR fence 端点（A 0-32、B 10-42、C 0-49），fence 语义未逐点对官方统计文档核。**Agent path 范围=单 value 列（每个 category 一个箱）**：ReportSpec presentation.chart 不支持 values 数组（validator CHART_KEYS 无 values），SQL 真库 plan→plan2spec→create→validate PASS（runId=box_e2e_001，表体 33531/26531 真值不变，单箱渲染）；rawIR 多系列 3 箱形态有 carrier，但无 spec/plan 入口。IR/ReportSpec/Planner 词表已加 vbox；agentAvailable=true（仅单系列 scope）', 'rendering', true),
    cap('chart.bar3d', 'verified', 'verified', 'verified', 'verified', '2026-11-08 legacy 3D 柱形图（核心 jar 非付费）：Bar3DPlot + Chart(plot) + MoreNameCDDefinition(category/values)；carrier reports/test_bar3d.js 真引擎 failures=0，PNG 3D 柱体+图例「产量」+标题；SQL 真库 plan→plan2spec→create→validate PASS（runId=bar3d_e2e_002，表体 33531/26531 真值不变）；IR/ReportSpec/Planner 词表已加 bar3d；agentAvailable=true', 'rendering', true),
    cap('chart.pie3d', 'verified', 'verified', 'verified', 'verified', '2026-11-08 legacy 3D 饼图：Pie3DPlot + Chart(plot) + MoreNameCDDefinition；carrier reports/test_pie3d.js 真引擎 failures=0，PNG 3D 饼体+四段图例 A-D+标题；SQL 真库 plan→plan2spec→create→validate PASS（runId=pie3d_e2e_002，表体 33531/26531 真值不变）；词表已加 pie3d；agentAvailable=true', 'rendering', true),
    cap('chart.area3d', 'verified', 'verified', 'verified', 'verified', '2026-11-08 legacy 3D 面积图：Area3DPlot + Chart(plot) + MoreNameCDDefinition；carrier reports/test_area3d.js 真引擎 failures=0，PNG 3D 面积带+图例+标题；SQL 真库 plan→plan2spec→create→validate PASS（runId=area3d_e2e_002，表体 33531/26531 真值不变）；词表已加 area3d；agentAvailable=true', 'rendering', true),
    cap('chart.donut', 'verified', 'verified', 'verified', 'verified', '2026-11-08 legacy 环形图（2D，多环形态）：Donut2DPlot + Chart(plot) + OneValueCDDefinition(category=系列名, value)；carrier reports/test_donut.js 真引擎 failures=0，PNG 多环环形（每系列一环、A/B/C/D 各色+图例）+标题；SQL 真库 plan→plan2spec→create→validate PASS（runId=donut_e2e_003，表体 33531/26531 真值不变）；词表已加 donut；**agentAvailable scope=多环环形（每系列一环）**；经典单环分段不是 Donut2DPlot 现有模式，未承诺', 'rendering', true),
    cap('chart.donut3d', 'verified', 'verified', 'verified', 'verified', '2026-11-08 legacy 3D 环形图（多环形态）：Donut3DPlot + Chart(plot) + OneValueCDDefinition；carrier reports/test_donut3d.js 真引擎 failures=0，PNG 3D 多环（每系列一环）+图例+标题；SQL 真库 plan→plan2spec→create→validate PASS（runId=donut3d_e2e_003，表体 33531/26531 真值不变）；词表已加 donut3d；agentAvailable scope=多环 3D 环形；经典单环分段未承诺', 'rendering', true),
    cap('chart.vmultipie', 'verified', 'verified', 'verified', 'verified', '2026-11-08 多层饼（非付费图族）：官方 doc/Chart/销售情况.cpt 一手=VanChartMultiPiePlot + MultiPieValueDefinition(OneValueCDDefinition valueName + MultiPie levelCount/LevelColumnNameList)；object VK 增 vmultipie，setLevelCount/addLevelName/setValueColumnName/NoneFunction。carrier reports/test_multipie.js 真引擎 failures=0，PNG 内外双层饼（华东/华北 + 销售员内层）+图例+标题；SQL 真库 plan→plan2spec→create→validate PASS（runId=multipie_e2e_004，levels=[bizDate,machine]/value=planned，表体 33531/26531 真值不变，多层饼渲染）；IR/ReportSpec/Planner 增 levels[] 词表；agentAvailable=true', 'rendering', true),
    cap('chart.tooltip', 'verified', 'verified', 'serialization-only', 'verified', 'README #72 AttrTooltip 全家序列化；probe_r4m15 XML 断言；tooltip 为 web 交互行为静态 PNG 不现形（同官方）', 'serialization'),
    cap('chart.label', 'verified', 'verified', 'verified', 'verified', 'probe_r4m9 定案：label 必挂命名 ConditionAttr+恒真 ListCondition 才渲染；官方 Demo.cpt 条件属性4 同构；carrier test_vanchart 实跑柱顶数值（§5步4 真引擎 PNG：logs/_visual_mid.png 堆叠段白字数值可见）。**范围限定=已验证形态（命名条件+恒真/单图三件组合 m10）；vpie label.summary 经 test_vanchart 真引擎 PNG 目检仅序列化、总结文字未可见渲染，不升层；不推导所有条件组合/复合嵌套**。**2026-11-08 四次实验复核（PNG 目检，均无任何标签文字）**：①命名 ConditionAttr+ListCondition ②图表类目条件 CATEGORY_INDEX ③ConditionCollection DefaultAttr（官方 基础饼图.cpt 的 AttrLabel 挂法）④position 0——全部阴性；官方语料一手显示 PieCategoryLabelContent 实用于 `gaugeValueLabel`（仪表值标签），饼图标签内容=AttrToolTipContent+value/percent/category/series format 开关 → 现行 label.summary→PieCategoryLabelContent 的 vpie 选型疑错，维持"仅序列化"、不承诺渲染（重开条件=以 AttrTooltipContent 开关重实现并 PNG 实证）。**2026-11-08 后续两次实现尝试（probe_labelcontent_api 活对象反射一手：AttrLabelDetail.setBorder(AttrBorderWithShape)=标签边框；饼图 labelDetail content=AttrTooltipContent，setValueFormat/setPercentFormat/setCategoryFormat/setSeriesFormat）**：⑤新建 AttrTooltipContent 挂 value/percent/category → cpt 导出期 CHART SERIALIZED 门失败（`<O t=\"CC\">` 不存在，ChartCollection 整体被丢）⑥复用 detail 自带 content 仅翻转 percent 开关（补 CoreDecimalFormat）→ 同样 CHART SERIALIZED 失败。结论：本版 headless 构建对 AttrTooltipContent 的 writeXML 不可用（图随内容一起丢），vpie 标签内容=引擎/序列化墙，维持 pending、不承诺；实现尝试已回滚不留未验证代码。**2026-11-08 第三次复核（隔离实验）**：同代码 vbar+label.percent 开关 → CHART SERIALIZED 通过（证明 AttrTooltipContent 类路径本身可用）；vpie 三条路线（复用 content+percent / 显式 new content / 官方 richText（${SERIES}:${PERCENT}））均 CHART SERIALIZED 失败 → 墙在 vpie 的 label content 写路径（非类本身）；实现再次回滚，backlog P3 保留（vbar 隔离实验已入证据）。**同时新能力 chart.labelBorder 已达成（labelDetail.setBorder(AttrBorderWithShape)，红框 244 像素）**。**2026-11-08 vpie 标签反转达成**：旧 summary/PieCategoryLabelContent 通道不渲染（四次实验+实现均失败）；改为从官方 `doc/Chart/PieChart/基础饼图.cpt` 反序列化取字段齐全的 AttrLabel（content=AttrTooltipContent）并保留其 content、覆盖 richText 文本 → CHART SERIALIZED 通过、饼图扇区渲染「标签内容」（carrier test_vanchart vpie 臂，PNG 目检）；IR 现明确拒 label.summary（写了不生效），vpie 标签内容入口=label.richText；scanner 载体 examples/report-spec/vpielabel_rows.json 入册（scan ok=92）', 'rendering'),
    cap('chart.stack', 'verified', 'verified', 'verified', 'verified', 'probe_r4m3 结案：isStackChart 只认 vanChartPlotType==STACK/STACK_BY_PERCENT,补 setter 后实拍堆叠；carrier test_vanchart 实跑。**范围限定=vbar/varea 的 STACK/STACK_BY_PERCENT 单图，不推导自定义组合图**', 'rendering'),
    cap('chart.conditionalSeries', 'verified', 'verified', 'verified', 'verified', 'probe_r4m7 D_a 实拍：系列条件染色正类=AttrBackground+ColorBackground；carrier test_vanchart 实跑。**范围限定=系列级染色（恒真/CommonCondition 两臂），不等于任意复杂条件语义已验证**', 'rendering'),
    cap('chart.trendLine', 'verified', 'verified', 'verified', 'verified', 'README #72 LineStyleInfo 门槛补齐后红趋势线画出 PNG；carrier test_vanchart vline trend 臂', 'rendering'),
    cap('chart.axisYUnit', 'verified', 'verified', 'verified', 'verified', 'probe_r4m17 实拍：unit=50 主刻度全渲染（无轴标题分支）；setTitle 后引擎自动降密度（交互事实记档）；carrier test_vanchart vline 臂。★审计 §2：0..300 无标题全刻度形态待补独立载体。§5步4 legacy axisX：reports/test_visual_deco.js 真引擎 PNG 目检 X 轴类目标签字号明显放大(fontPt:14 生效)，公共键 legacy 路径视觉验证通过', 'rendering'),
    cap('chart.hotTooltip', 'verified', 'verified', 'serialization-only', 'verified', 'probe_r4m14b Plot.setHotTooltipStyle(AttrContents) 方法面+probe_r4m15 XML 断言；官方 newHotTooltipStyle 节点同构；渲染=web 交互不外宣', 'serialization'),
    cap('chart.seriesBorder', 'verified', 'verified', 'verified', 'verified', '**2026-11-08 渲染达成（推翻此前"引擎墙"误判）**：根因=此前载体 style=3 越界 + alpha(AttrBorderWithAlpha) 通道引擎不画，不是没宿主。官方语料一手=doc/Chart 全量 **551 处 `<AttrBorder>` 位于 `<ConditionCollection><DefaultAttr><ConditionAttr name=""><AttrList>`**（BarChartOfPicture.cpt 等），lineStyle 分布 563×0/134×1 → 可用形态=纯 AttrBorder(color, style 0|1) 走 DefaultAttr 系列条件通道。carrier reports/test_seriesborder.js（vbar 红 0xFF0000/style=1）：真引擎 failures=0，部署 cpt AttrBorder 序列化，**PNG 红边 596 像素**（首次达成）。IR 闸同步：style 仅 0|1、alpha 键明确拒（写了不生效）；fast_ir_contract +4 断言。宿主穷举 probe_border_hosts.js=2416 类/105 个 Border 宿主方法（含 VanChartBarDataPoint.setBorder/ColorInfo.setSeriesAttrBorder），"无宿主"旧结论作废', 'rendering'),
    cap('chart.labelBorder', 'verified', 'verified', 'verified', 'verified', '**2026-11-08 新能力（标签边框）**：官方语料 268/268 一手=`labelDetail > AttrBorderWithShape`，lineStyle 全 0、shapeType 全 RectangularMarker；活对象 API=AttrLabelDetail.setBorder(AttrBorderWithShape)（setBorderColor/setBorderStyle/setShape(MarkerType)/setAutoColor）。carrier reports/test_labelborder.js（vbar label enable+红边框 style=1）：真引擎 failures=0，部署 cpt AttrBorderWithShape 序列化，**PNG 红框 244 像素**（首跑白框=autoColor 默认 true 忽略自定义色，setAutoColor(false) 后达成）。IR 闸：label.border keys=color|style|shape；style 仅 0|1；shape 仅 rect；未知键/类型拒；fast_ir_contract +4 断言', 'rendering'),
    cap('chart.effect', 'verified', 'verified', 'serialization-only', 'verified', 'probe_r4m14 AttrEffect(period) 方法面+probe_r4m15 XML 断言；web 动画渲染不外宣', 'serialization'),
    cap('chart.areaFill', 'verified', 'verified', 'verified', 'verified', 'probe_r4m14 AttrAreaSeriesFillColorBackground 方法面+probe_r4m15 XML 断言；§5步4 真引擎 PNG 目检：reports/test_vanchart.js varea 臂浅蓝面积带(0x77BBFF alpha0.45)可见（logs/_visual_top.png 第3面板）', 'rendering'),
    cap('chart.seriesImage', 'verified', 'verified', 'verified', 'verified', '2026-11-07 挂槽修复（官方 国旗柱形图.cpt 一手）：AttrSeriesImageBackground 必须挂 ConditionAttrList 的命名 ConditionAttr + ChartCommonCondition(CATEGORY_INDEX)，DefaultAttr 通道引擎不画——此前 PNG 纯色=挂错槽非引擎墙；修复后 carrier test_visual_deco 棋盘格 fixture 真引擎 failures=0，PNG 目检品红/白棋盘铺满柱体（渲染达成）；载体在 reports/ 被 scan 覆盖 → 四层全 verified，agentAvailable=true', 'rendering'),
    cap('chart.hyperlinkCell', 'verified', 'verified', 'serialization-only', 'verified', '批I（2026-11-07 阶段4）：com.fr.chart.web.ChartHyperRelateCellLink 经 com.fr.js.NameJavaScriptGroup 挂 plot.setHotHyperLink/setAreaHotHyperLink|setPointHotHyperLink|setLineHotHyperLink（VanChartMapPlot 方法面=probes/_probe_template.js 一手）；官方 资产负债联动图表.cpt <NameJavaScriptGroup><NameJavaScript><JavaScript class=...ChartHyperRelateCellLink> 同构；probe_mapdeco 真引擎 XML 断言（relateCCName/NameJavaScriptGroup 落 cpt）；热链属 web 交互 → rendering=serialization-only（同 chart.tooltip 口径）；parameters 槽（Formula 传参）未接=IR 结构化拒；回归载体=reports/test_mapdeco_ir.js（scan_all_specs 覆盖 hotHyperLink）；无 plan→create e2e → agentAvailable=false', 'serialization', false),
    cap('chart.mapTooltipFormat', 'verified', 'verified', 'serialization-only', 'verified', '批I 首靶（2026-11-07 阶段4）：地图种 tooltip 格式槽=地图专用子类——com.fr.plugin.chart.base.format.AttrTooltipAreaNameFormat（类目名槽，官方 按钮式图表切换.cpt/mapfather <category class=...> 一手）+ com.fr.plugin.chart.base.format.AttrTooltipMapValueFormat（值槽 <richTextValue class=...> 一手）；API 面=probes/_probe_template.js 实测（setFormat(java.text.Format)/setEnable(boolean)，CTOR()）；object tooltip.formats 按 kind=vmap|vheatmap 选子类对齐官方语料（基类槽位偏差修复）；probe_mapdeco 真引擎 XML 断言两子类落 cpt；tooltip 属 web 交互 → rendering=serialization-only（同 chart.tooltip 口径）；AttrTooltipStartAndEndNameFormat 同槽机制但消费方=流向图（vmap line 结构化拒）→ 随流向批。回归载体=reports/test_mapdeco_ir.js（scan 覆盖 tooltip.formats 地图槽）；无 plan→create e2e → agentAvailable=false', 'serialization', false),
    cap('chart.mapLabel', 'verified', 'verified', 'verified', 'verified', '批I（2026-11-07 阶段4）：com.fr.plugin.chart.map.attr.AttrMapLabel extends DataSeriesCondition（setAreaLabel/setPointLabel(AttrLabel)=probes/_probe_template.js 一手）；官方 按钮式图表切换.cpt <Attr class="...AttrMapLabel"><areaLabel class="...AttrLabel"> 条件集合同构；IR mapLabel 键（payload 同 label 形状）→ object plot 条件集合 dTag.addDataSeriesCondition；probe_mapdeco XML 断言 AttrMapLabel/areaLabel 落 cpt + 真引擎渲染 logs/_mapdeco_probe.png 目检=四川省区域 "90000" 面积标签可见（渲染达成）；IR 层 fast_ir_contract 批I 12 断言（vbar 结构化拒/payload 词表闸）；回归载体=reports/test_mapdeco_ir.js（scan_all_specs 覆盖 mapLabel）→ regression=verified；四层全 verified → agentAvailable=true', 'rendering', true),
    cap('chart.mapTooltip', 'verified', 'verified', 'serialization-only', 'verified', '批I（2026-11-07 阶段4）：com.fr.plugin.chart.map.attr.AttrMapTooltip（setAreaTooltip/setPointTooltip/setLineTooltip(AttrTooltip)=probes/_probe_template.js 一手）；IR mapTooltip 键（area/point/line payload 复用 AttrTooltip 装配面）→ object plot 条件集合；probe_mapdeco XML 断言落 cpt；tooltip 属 web 交互 → rendering=serialization-only；fast_ir_contract 批I 断言；回归载体=reports/test_mapdeco_ir.js（scan 覆盖 mapTooltip）→ regression=verified；rendering=serialization-only → agentAvailable=false', 'serialization', false),
    cap('chart.bubbleAttr', 'verified', 'verified', 'pending', 'pending', '批I（2026-11-07 阶段4）：com.fr.plugin.chart.bubble.attr.VanChartAttrBubble（setMinDiameter/setMaxDiameter/setShadow/setDisplayNegative=probes/_probe_template.js 一手）；IR bubble 键（仅 vbubble）→ object plot 条件集合；probe_mapdeco XML 断言 VanChartAttrBubble 落 cpt（logs/_mapdeco_bubble_test.cpt）。**2026-11-08 渲染专项**（reports/test_bubbleattr.js 4 臂 5/15|30/90|15/70 shadow|15/70 无 shadow；reports/test_bubbleattr_neg.js 负值两臂）：PNG 蓝泡 bbox 直径 5/8/11/15、30/44/67/90、15/28/49/70（图例 27 恒常量）→ min/maxDiameter 精确生效；负值 -30/-20 在 displayNegative=true 下渲染为灰泡、false 隐藏 → displayNegative 生效；shadow true/false 图表像素零差异（仅表头文字不同）→ shadow 静态 PNG 仅序列化（web canvas 未验）；故 rendering 仍 pending（shadow 未达渲染证据）；fast_ir_contract 批I 断言；agentAvailable=false')
  ];
  // 条件属性族（README #45/#49/#71；carrier=test_hla2/test_cellattrs，scan 可重复）
  var condition = [
    cap('condition.formula', 'verified', 'verified', 'verified', 'verified', 'README #71 carrier test_hla2 PNG 分片；**2026-11-08 G3 业务验收**（runId=ge20261108082641-e5ede7）：SQL 真库 plan→create 全链 + 条件高亮 when.formula 锚点按明细首行（=E3<75）→ PNG 红字 1411 像素（逐格判定），compileSql 现发射 item.conditions', 'rendering'),
    cap('condition.column', 'verified', 'verified', 'verified', 'verified', 'README #71 本格值求值语义一手；carrier test_cellattrs', 'cpt'),
    cap('condition.list', 'verified', 'verified', 'verified', 'verified', 'README #45/#71；carrier test_closure_gaps（when.list 形态，v2 对账器补实）', 'cpt'),
    cap('condition.then.value', 'verified', 'verified', 'verified', 'verified', 'README #71 字面换值+公式换值 PNG；carrier test_hla2', 'rendering'),
    cap('condition.then.border', 'verified', 'verified', 'verified', 'verified', 'README #71 粗底线 PNG 分片；carrier test_hla2', 'rendering'),
    cap('condition.then.link', 'verified', 'verified', 'serialization-only', 'verified', 'README #71 超链为浏览器行为静态 PNG 不现形（官方同）；carrier test_hla2', 'serialization'),
    cap('condition.then.widget', 'verified', 'verified', 'serialization-only', 'verified', 'README #71 PNG 不渲染控件序列化为准（官方同）；carrier test_hla2', 'serialization'),
    cap('condition.then.style', 'verified', 'verified', 'verified', 'verified', 'README #45/#49 bg/color/font/rowHeight/colWidth/page；carrier test_cellattrs；**2026-11-08 G3**（runId=ge20261108082641-e5ede7）：SQL 路 then.color+bold 经 ForegroundHighlightAction 渲染（PNG 红字 1411 像素）；then 形态=IR 扁平词表（color/bold/bg…，嵌套 style 会被 IR 明确拒）', 'cpt')
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
    cap('page.headerFooter', 'verified', 'verified', 'verified', 'verified', 'README #73 PDF 文本层逐字命中；carrier test_pagehf scan；**2026-11-08 业务验收 G2 全链**（runId=ge20261108081409-3c1bc7，Intent=verify/fixtures/golden/g2_intent.json）：SQL 真库 plan→plan2spec→create→validate(逐格真值 10 day@machine 行 + 合计 33531:26531)→preview→modify(diffClean)→promote→restore→baseline-restore 全 PASS，页眉"生产日报 G2"/页脚"机密·内部使用"随 sheet.headerFooter 进入真实报表', 'cpt', true),
    cap('page.templateMarks', 'verified', 'verified', 'verified', 'verified', 'README #73 TemplateId/Theme 序列化+roundtrip；carrier test_pagehf', 'cpt'),
    cap('page.repeatHeaderRow', 'verified', 'verified', 'verified', 'verified', 'README #31 每页重复标题条带；carrier test_closure_gaps（repeatHeaderRow 键，v2 对账器补实）', 'cpt'),
    cap('page.freezeWeb', 'pending', 'pending', 'pending', 'pending', 'README #77 240 demo 零语料'),
    cap('page.multiSheet', 'verified', 'verified', 'verified', 'verified', 'C4 口径拆分（2026-11-06）。**载体=Object/CPT/渲染证据**：rawIR 载体 test_multisheet 与 spec 载体 examples/report-spec/multisheet.json 均真引擎 failures=0，部署 cpt 2 <Report>，PNG 汇总/明细两页目检。**e2e=仅结构链路**：scripts/run-multisheet-e2e.ps1（plan→plan2spec→create）证明 reportSpec 保留 extraSheets/params + 部署 cpt 2 <Report>/ReportParameterAttr/ds2；**不证明逐格真值、第二 Sheet 视觉渲染、hideRows/hideCols 在 e2e 产物中的效果**（后者由载体 PNG 承担）。planner 透传（README #127/#135）', 'rendering', true),
    cap('cell.sort', 'rejected', 'rejected', 'rejected', 'rejected', 'README #78 墙破缺语料结构化拒'),
    cap('cell.subreport', 'verified', 'verified', 'verified', 'verified', 'README #77 整嵌渲染 PNG；carrier test_g scan', 'rendering'),
    cap('cell.barcode', 'verified', 'verified', 'verified', 'verified', 'README #77 条码 PNG；carrier test_g scan', 'rendering'),
    cap('cell.groupCustom', 'verified', 'verified', 'verified', 'verified', 'README #77 CustomGrouper 简单形态；carrier test_g', 'cpt'),
    cap('cell.poly', 'pending', 'pending', 'pending', 'pending', 'README #80 PolyWorkSheet 通路已证，块面 API 未探全'),
    // 2026-11-06 C2：隐藏行列（行高/列宽归零）；ReportSpec sheet.hideRows/hideCols 有入口
    cap('sheet.hideRowsCols', 'verified', 'verified', 'verified', 'verified', 'C2（2026-11-06）：IR hideRows/hideCols→object sheet 构建末 setRowHeight/setColumnWidth(FU 0)；carrier test_hidden 真引擎 failures=0（RowHeight[1]=0/ColumnWidth[1]=0），PNG 目检表头行与「完成」列消失；spec 载体 examples/report-spec/hidden.json 同证；fast_report_spec C2 断言', 'rendering'),
    // 2026-11-06 R3-0：cells 多行/多列合并（rowSpan）；ReportSpec 无入口（presentation.cells 拒绝对 r）
    cap('cells.rowSpan', 'verified', 'verified', 'verified', 'verified', 'README #113/#114 R3-0：IR rowSpan 整数闸+块内重叠静态拒+ds+rowSpan 结构化拒（C2，putDSCell 不合并）；carrier test_merge_header 部署 cpt rs="2"×2/cs="2"×1，PNG 目检合并表头；fast_ir_contract R3-0/C2 断言。**2026-11-08 E5 实证**：spec_validator 放开 presentation.cells.rowSpan（正整数闸），examples/report-spec/cells_rowspan.json 真引擎 failures=0、部署 cpt rs="2"；agentAvailable=true', 'rendering', true)
  ];
  // ReportSpec / 数据集 / 语义 / 模板产品面（README #55/#59/#60/#74/#76/#82）
  var product = [
    cap('spec.rows.sum', 'verified', 'verified', 'verified', 'verified', 'README #55 等价铁证 CBEB42E3；fast_report_spec', 'cpt'),
    // 2026-11-06 B1-B6：ReportSpec 新入口（四条独立；渲染未证者不升层）
    cap('spec.rows.conditions', 'verified', 'verified', 'verified', 'verified', 'B1（2026-11-06）：presentation.conditions→IR detail.conditions→HighlightGroup×3；spec 载体 hl_conditions 真引擎 failures=0 且 PNG 高亮行可见；fast_report_spec B1 断言（README #118）', 'rendering'),
    cap('spec.rows.cells', 'verified', 'verified', 'pending', 'verified', 'B3（2026-11-06）：presentation.cells→IR cells 块；spec 载体 cells_extras 真引擎 failures=0（部署 cpt RichText×3/RichChar×4/TextHFElement/WatermarkAttr）；**2026-11-08 PNG 专项目检**：cells_extras 渲染出「【结论】」粗体段+正文行（rich 文本格可见），但 formula/link/barcode 等 item 形态各有独立能力账本、未逐形态目检 → rendering 仍 pending（不把部分形态包装成全族）；fast_report_spec B3 断言（README #118）', 'serialization'),
    cap('spec.rows.sumCols', 'verified', 'verified', 'verified', 'verified', 'B6（2026-11-06）：presentation.total.sumCols→IR total.sumCols；spec 载体 sumcols_reg 真引擎 failures=0，部署 cpt 合计 c0 无 cs、c1=SUM(B3)、c2=SUM(C3)（审查轮1 P1-B 后）；PNG 目检合计 120/105 两列求和可见；fast_report_spec B6/span 断言（README #118/#119）', 'rendering'),
    // 2026-11-06 P1：合计行非 sum 聚合（avg/count/min/max/ratio）
    cap('spec.rows.totalAgg', 'verified', 'verified', 'verified', 'verified', 'P1+复审（2026-11-06）：IR aggregate.fn=sum|avg|count|min|max|ratio（ratio={num,den}，整数列 1..25）+ sumCols[].fn；ReportSpec total.aggregate/sumCols[].fn 两通道；rawIR 载体 test_total_agg（PNG 60.0/2/35）+ test_total_ratio（PNG 1.14，aggregate.format）；spec 载体 examples total_agg.json（=AVERAGE(B3)，PNG 平均 60.0）与 total_ratio.json（=SUM(B3)/SUM(C3)，PNG 1.14）真引擎 failures=0；fast_report_spec +8 / fast_ir_contract +12（README #122）', 'rendering'),
    cap('spec.params.panel', 'verified', 'verified', 'serialization-only', 'verified', 'B2（2026-11-06）：ReportSpec params→IR.param widgets（DateEditor/ComboBox/NumberEditor/FormSubmitButton/WParameterLayout）；spec 载体 params.json 真引擎 failures=0；参数面板属 web 交互，静态 PNG 不现形（官方同口径）→ rendering 不升层；fast_report_spec B2 断言（README #118）', 'serialization'),
    cap('spec.params.filter', 'verified', 'verified', 'verified', 'verified', 'C3 口径（2026-11-06）：params[].filter{column,op} → IR.param.filters（object 对每个明细格挂 CommonCondition）。**已验证=默认参数值过滤**：载体 examples/report-spec/param_filter.json 真引擎 failures=0，默认值 A线 → PNG 只渲染 A线 行（执行期筛选真值）；fast_report_spec 断言（README #140）。**未验证=Web 交互改参数后重查询**（静态 PNG 无法证明交互重查）；**2026-11-08 E5 实证**：plan→plan2spec→create 全链 PASS（runId=e5filter001，artifact execution exit=0），Agent 可承诺带默认值筛选的报表创建，不承诺交互式改参重查询；agentAvailable=true', 'rendering', true),
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

  // 2026-11-08：未承诺能力的成因分类（避免一句"引擎墙/真实原因"糊过去）。
  //   规则：四层全 verified 但 agentAvailable=false → e5Evidence；rejected → rejected；
  //   rendering=serialization-only → webInteraction；rendering=pending 但 regression/construction
  //   已证 → unverifiedRendering；全 pending → notImplemented。
  function unavailabilityReason(c) {
    if (c.agentAvailable) return null;
    if (c.construction === 'rejected' || c.serialization === 'rejected') return 'rejected';
    if (c.rendering === 'serialization-only') return 'webInteraction';
    if (c.construction === 'pending' && c.serialization === 'pending' && c.regression === 'pending') return 'notImplemented';
    if (c.construction === 'verified' && c.serialization === 'verified' && c.rendering === 'verified' && c.regression === 'verified') return 'e5Evidence';
    return 'unverifiedRendering';
  }
  function unavailableCatalog() {
    var out = [];
    [chart, condition, write, page, product].forEach(function (seg) {
      seg.forEach(function (c) {
        if (!c.agentAvailable) out.push({ name: c.name, reason: unavailabilityReason(c),
          construction: c.construction, serialization: c.serialization, rendering: c.rendering, regression: c.regression });
      });
    });
    return out;
  }
  function build() {
    return {
      manifestVersion: '3',
      source: 'application/capability_manifest.js（一处真相；lib/ir.js CAPABILITIES 注记引用此处）',
      legend: 'construction=API 构造 | serialization=CPT 序列化 | rendering=FineReport 实际渲染 | regression=可重复回归证据 | regressionScope=regression 覆盖的最高层(ir/object/cpt/serialization/rendering/agent，四层独立不强制一致) | agentAvailable=四层全 verified 才 true；unavailable=未承诺能力成因分类（webInteraction=浏览器行为静态PNG不可验 / unverifiedRendering=渲染未达成 / notImplemented=未接线 / rejected=明确不做 / e5Evidence=四层全证但缺Agent全链）',
      totals: { registered: [chart, condition, write, page, product].reduce(function (n, seg) { return n + seg.length; }, 0), agentAvailable: agentAvailableNames().length, unavailable: unavailableCatalog().length },
      // 证据强度口径（2026-11-08）：agentAvailable=true 表示"可按账本承诺（四层状态+显式 override）"，
      //   不等于每项都跑过 plan→create→preview→modify→promote→restore 全链。fullE2e 名单是真正有
      //   端到端证据的项；其余为 layerEvidence（四层+回归证据）。discover 输出须带此口径，防"广告"被误读。
      evidenceGrade: { fullE2e: ['agent.plan', 'agent.artifact.isolation', 'agent.runtime.serial', 'page.multiSheet', 'page.headerFooter', 'spec.rows.sum', 'spec.sql.model', 'spec.sql.chart', 'condition.formula', 'condition.then.style', 'template.patch.cellValue', 'template.patch.dataset', 'chart.vmap', 'chart.vheatmap', 'cells.rowSpan', 'spec.params.filter', 'chart.bar'], note: 'agentAvailable=可按账本承诺；fullE2e=有端到端工具链实证；未列名者=layerEvidence（四层/回归证据），不等于已跑全生命周期' },
      unavailable: unavailableCatalog(),
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

  return { build: build, agentAvailableNames: agentAvailableNames, unavailableCatalog: unavailableCatalog, unavailabilityReason: unavailabilityReason };
})();
