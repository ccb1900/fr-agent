// lib/object_chart.js — 图表族构建（2026-11-08 从 object.js 拆出）
//   putChartCell(api, c, r, b, spanC)：按 kind 分派地图/钻取/Van/legacy；
//   applyChartDeco：系列提示/标签/标记/线型/趋势/条件/贴图/地图/气泡/热链。
//   api = { wb, putCell, chartDecoJobs } 由 object.js 的 build 提供。
//   依赖：ObjCore（J/cls/颜色/字体/边框/条件表达式）。

var ObjChart = (function () {
  var C = ObjCore;
  var Class = C.Class, J = C.J, vpieTemplateLabel = C.vpieTemplateLabel, cls = C.cls, awtColor = C.awtColor, font = C.font, bgColor = C.bgColor, applyAxisCommon = C.applyAxisCommon, imageBackground = C.imageBackground, edgesOf = C.edgesOf, conditionOf = C.conditionOf;

  // 图表格（v3.2 终极大件）：cell.setValue(ChartCollection)。
  // 一手 API 面（probe_chart/2/3/4/5/6/7 + 官方 WorkBook3 语料）：
  //   Chart(Plot) + setTitle(Title(Object)) + setFilterDefinition(TopDefinitionProvider)；
  //   官方绑定形态 = MoreNameCDDefinition(TableData, categoryName, ChartSummaryColumn[])（抽象祖宗 TableDataDefinition 全家实证不可 new）；
  //   ChartSummaryColumn(值列名, 自定义名, SumFunction)，官方 ChartSummaryColumn/function=SumFunction 同构
  //   ChartCollection 继承链 < Object（非 Widget），序列化形态自桩自验（wb.export 后 grep）
  // BarPlot 抽性实证（probe_chart4）：抽象基类，bar 一律用具象 Bar2DPlot；3D 变体后续用 3DPlot 家族
  var TK = { bar: 'com.fr.chart.chartattr.Bar2DPlot', pie: 'com.fr.chart.chartattr.PiePlot', line: 'com.fr.chart.chartattr.LinePlot',
    bar3d: 'com.fr.chart.chartattr.Bar3DPlot', pie3d: 'com.fr.chart.chartattr.Pie3DPlot', area3d: 'com.fr.chart.chartattr.Area3DPlot', donut: 'com.fr.chart.chartattr.Donut2DPlot', donut3d: 'com.fr.chart.chartattr.Donut3DPlot', meter: 'com.fr.chart.chartattr.MeterPlot', stock: 'com.fr.chart.chartattr.StockPlot', range: 'com.fr.chart.chartattr.RangePlot', gismap: 'com.fr.chart.chartattr.GisMapPlot' };
  // v4.2 VanChart 插件图表族（probe_vanchart/2）：VanChart < Chart 一手超类链；默认构造 = 标准形态
  //   vbar 柱形 / vline 折线 / varea 面积 / vscatter 散点 / vpie 饼图 / vgauge 仪表盘（None Pointer 默认）
  var VK = { vbar: 'com.fr.plugin.chart.column.VanChartColumnPlot', vline: 'com.fr.plugin.chart.line.VanChartLinePlot',
    varea: 'com.fr.plugin.chart.area.VanChartAreaPlot', vscatter: 'com.fr.plugin.chart.scatter.VanChartScatterPlot',
    vbubble: 'com.fr.plugin.chart.bubble.VanChartBubblePlot',
    vpie: 'com.fr.plugin.chart.PiePlot4VanChart', vgauge: 'com.fr.plugin.chart.gauge.VanChartGaugePlot',
    vmultipie: 'com.fr.plugin.chart.multilayer.VanChartMultiPiePlot',
    vwordcloud: 'com.fr.plugin.chart.wordcloud.VanChartWordCloudPlot',
    vstructure: 'com.fr.plugin.chart.structure.VanChartStructurePlot',
    vradar: 'com.fr.plugin.chart.radar.VanChartRadarPlot',
    vfunnel: 'com.fr.plugin.chart.funnel.VanChartFunnelPlot',
    vbox: 'com.fr.plugin.chart.box.VanChartBoxPlot', vtreemap: 'com.fr.plugin.chart.treemap.VanChartTreeMapPlot', vgantt: 'com.fr.plugin.chart.gantt.VanChartGanttPlot', vcombo: 'com.fr.plugin.chart.custom.VanChartCustomPlot' };
  // 2026-11-06（D1 阻塞记录，实验代码已回收）：组合图 VanChartCustomPlot 构造/序列化已打通
  //   （CustomStyle.parse + CustomPlotList 子 plot + CustomDefinition/DefinitionMap 枚举键 → 部署 cpt 结构与
  //   官方 柱形图变形.cpt 同构：CustomDefinition/DefinitionMap/OneValueCDDefinition/MoreNameCDDefinition 齐备），
  //   但渲染未达成：分类轴恒单类（4 行被画成 1 类 6 系列），缺「子图系列分配 ConditionCollection
  //   (AttrSeriesStackAndAxis) + 分类 Present 装配」；外层改 plain Chart 直接 NPE。三轮已尽，按规则暂停，
  //   证据=probes/probe_customplot{2}.js/probe_customtype.js/probe_customdef{2}.js + logs/d1_combo*.log。
  //   重开条件：先拿到可运行的 ConditionCollection 系列分配语料（官方 cpt 子图条件块）再接线。
  // D1 组合图第 4 轮（SQL+DataSheet2PlotList）结论：分类塌缩已解决（SQL 数据集），但线系列仍不渲染；
  //   官方 柱形图变形.cpt 无头渲染同样只见柱（无可见线）→ 不接线，证据在 probes/probe_combo_sql_carrier.js + logs/vcustom_sql*.log。
  // 2026-11-06（D2）：地图 vmap（官方 doc/Chart/mapfather.cpt 一手结构：
  //   Plot class=VanChartMapPlot + VanChartMapPlotAttr mapType=area geourl=assets/map/geographic/world/中国.json
  //   + ChartDefinition/VanMapDefinition/areaDefinition class=VanMapMoreNameCDDefinition(10 参)）。

  // 图表单元格总入口：按图表族分派（各族互斥、各自 putCell + 装饰入队）
  function putChartCell(api, c, r, b, spanC) {
    if (b.kind === 'vdrillmap') { putDrillMapCell(api, c, r, b, spanC); return; }
    if (b.kind === 'vmap' || b.kind === 'vheatmap') { putMapChartCell(api, c, r, b, spanC); return; }
    if (VK[b.kind]) { putVanChartCell(api, c, r, b, spanC); return; }
    putLegacyChartCell(api, c, r, b, spanC);
  }

  // 钻取地图：逐层 layerMapType/layerLevel + DrillMapDefinition
  function putDrillMapCell(api, c, r, b, spanC) {
    var dplot = new (J('com.fr.plugin.chart.drillmap.VanChartDrillMapPlot'))();
    // 官方：layerMapType = AREA 逐层；layerLevel = 0..3 or AUTO
    var MTs = new (J('java.util.ArrayList'))();
    var ZLs = new (J('java.util.ArrayList'))();
    var MT=J('com.fr.plugin.chart.type.MapType'), ZL=J('com.fr.plugin.chart.type.ZoomLevel');
    var nLayer = 1 + (b.layerDefs ? b.layerDefs.length : 0);
    for (var dl=0; dl < nLayer; dl++) { MTs.add(MT.AREA); }
    var zl0 = ZL.ZEROPOINTFIVE, zl1 = ZL.TWO, zl2 = ZL.FOUR, zl3 = ZL.SIX;
    if (nLayer > 0) ZLs.add(zl0); if (nLayer > 1) ZLs.add(zl1); if (nLayer > 2) ZLs.add(zl2); if (nLayer > 3) ZLs.add(zl3);
    dplot.setLayerMapTypeList(MTs);
    dplot.setLayerLevelList(ZLs);
    var vchart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(dplot);
    vchart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title == null ? '' : b.title));
    var dl = new (J('com.fr.plugin.chart.drillmap.data.DrillMapDefinition'))();
    var cols = (b.bottomValues && b.bottomValues.length) ? b.bottomValues : [];
    var bArrItems = [];
    for (var bi = 0; bi < cols.length; bi++) bArrItems.push(new (J('com.fr.chart.chartdata.ChartSummaryColumn'))(cols[bi], cols[bi], new (J('com.fr.data.util.function.NoneFunction'))()));
    var bArr = J('java.lang.reflect.Array').newInstance(cls('com.fr.chart.chartdata.ChartSummaryColumn'), bArrItems.length);
    for (var bj = 0; bj < bArrItems.length; bj++) bArr[bj] = bArrItems[bj];
    var bDef = new (J('com.fr.plugin.chart.map.data.VanMapMoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))(b.dataset), b.bottomArea, bArr, true, '', '', '', '', '', null);
    dl.setFromBottomData(false); dl.setBottomDataDefinition(bDef);
    var lyrList = new (J('java.util.ArrayList'))();
    (b.layerDefs || []).forEach(function (ld) {
      var lv = (ld.values && ld.values.length) ? ld.values : [];
      var arr2 = [];
      for (var lj = 0; lj < lv.length; lj++) arr2.push(new (J('com.fr.chart.chartdata.ChartSummaryColumn'))(lv[lj], lv[lj], new (J('com.fr.data.util.function.NoneFunction'))()));
      var lArr = J('java.lang.reflect.Array').newInstance(cls('com.fr.chart.chartdata.ChartSummaryColumn'), arr2.length);
      for (var lk = 0; lk < arr2.length; lk++) lArr[lk] = arr2[lk];
      var lDef = new (J('com.fr.plugin.chart.map.data.VanMapMoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))(ld.dataset || b.dataset), ld.area, lArr, true, '', '', '', '', '', null);
      lyrList.add(lDef);
    });
    dl.setEachLayerDataDefinitionList(lyrList);
    vchart.setFilterDefinition(dl);
    dplot.setGeoUrl(b.geoUrl || 'assets/map/geographic/world/中国.json');
    try { dplot.setZoomLevel(J('com.fr.plugin.chart.type.ZoomLevel').ZERO); } catch (eDZ) { }
    var _rce = api.putCell(c, r, (function(){var x=new (J('com.fr.chart.chartattr.ChartCollection'))();x.addChart(vchart);return x;})(), { align:null,bold:false,bg:null,format:null,edges: b.noBorder?null:edgesOf(null)}, spanC);
    api.chartDecoJobs.push({ce:_rce, b:b, van:true});
    return;
  }

  // 地图 / 热力图：mapType + geoUrl + ViewCenter + VanMapDefinition
  function putMapChartCell(api, c, r, b, spanC) {
    // 2026-11-07（D2 热力图）：VanChartHeatMapPlot extends VanChartMapPlot（javap 一手）——heat 四参直接在 plot 上
    //   （setRadius/setBlur/setMinOpacity/setMaxOpacity(double)；官方 XML VanChartHeatMapPlotAttr 是序列化别名）。
    //   官方 doc/Chart/HeatMap/网页热力图.cpt：mapType=point + geourl=image/heatmap.json + heat 35/45/0/70；
    //   热力地图.cpt：point + 中国.json。definition 与 vmap point 完全同构（VanMapDefinition/pointDefinition）。
    var mp = (b.kind === 'vheatmap') ? new (J('com.fr.plugin.chart.heatmap.VanChartHeatMapPlot'))() : new (J('com.fr.plugin.chart.map.VanChartMapPlot'))();
    if (b.kind === 'vheatmap') {
      mp.setRadius(b.heat && b.heat.radius != null ? b.heat.radius : 35);
      mp.setBlur(b.heat && b.heat.blur != null ? b.heat.blur : 45);
      mp.setMinOpacity(b.heat && b.heat.minOpacity != null ? b.heat.minOpacity : 0);
      mp.setMaxOpacity(b.heat && b.heat.maxOpacity != null ? b.heat.maxOpacity : 70);
    }
    var MT = J('com.fr.plugin.chart.type.MapType');
    var mtype = String(b.mapType != null ? b.mapType : (b.kind === 'vheatmap' ? 'point' : 'area')).toLowerCase();
    if (mtype !== 'area' && mtype !== 'point') throw new Error('[IR] vmap/vheatmap mapType 只支持 area|point: ' + b.mapType);
    mp.setMapType(mtype === 'point' ? MT.POINT : MT.AREA);
    if (mtype === 'point' && b.kind !== 'vheatmap') {
      // 官方 doc/Chart/Map/散点地图.cpt：mapType=point + mapmarkertype=1(COMMON，无 SCATTER 常量) + pointDefinition。
      //   热力图不设 marker（官方 网页热力图.cpt mapmarkertype=0=引擎默认）
      try { mp.setMapMarkerType(J('com.fr.plugin.chart.type.MapMarkerType').COMMON); } catch (eMK) { }
    }
    mp.setGeoUrl(b.geoUrl != null ? b.geoUrl : 'assets/map/geographic/world/中国.json');
    try { mp.setZoomLevel(J('com.fr.plugin.chart.type.ZoomLevel').parseInt(b.zoom != null ? b.zoom : (mtype === 'point' ? 0 : 4))); } catch (eZ) { }
    try {
      var vc = new (J('com.fr.plugin.chart.base.ViewCenter'))();
      // 显式经纬度才锁中心；未给则 auto=true 让引擎按地图自适配（任意 geoUrl 不至于跑到视野外）
      if (b.longitude != null || b.latitude != null) {
        vc.setAuto(false);
        vc.setLongitude(b.longitude != null ? b.longitude : 106.258754);
        vc.setLatitude(b.latitude != null ? b.latitude : 38.471318);
      } else vc.setAuto(true);
      mp.setViewCenter(vc);
    } catch (eVC) { }
    var mchart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(mp);
    mchart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title == null ? '' : b.title));
    var mapVals = (b.values && b.values.length) ? b.values : [b.value];
    var MCS = cls('com.fr.chart.chartdata.ChartSummaryColumn');
    var MCSC = J('com.fr.chart.chartdata.ChartSummaryColumn');
    var mfn = new (J('com.fr.data.util.function.NoneFunction'))();
    var mcols = J('java.lang.reflect.Array').newInstance(MCS, mapVals.length);
    for (var mvi = 0; mvi < mapVals.length; mvi++) mcols[mvi] = new (MCSC)(mapVals[mvi], mapVals[mvi], mfn);
    var mapDef = new (J('com.fr.plugin.chart.map.data.VanMapDefinition'))();
    // 10 参：TableData, categoryName, columns, useAreaName(boolean), longitude, latitude, endLongitude, endLatitude, endAreaName, matchResult
    var mapAreaDef = new (J('com.fr.plugin.chart.map.data.VanMapMoreNameCDDefinition'))(
      new (J('com.fr.data.impl.NameTableData'))(b.dataset), b.category, mcols, true, '', '', '', '', '', null);
    if (mtype === 'point') mapDef.setPointDefinition(mapAreaDef); else mapDef.setAreaDefinition(mapAreaDef);
    mchart.setFilterDefinition(mapDef);
    var _mcc = new (J('com.fr.chart.chartattr.ChartCollection'))();
    _mcc.addChart(mchart);
    var _mce = api.putCell(c, r, _mcc, { align: null, bold: false, bg: null, format: null, edges: b.noBorder ? null : edgesOf(null) }, spanC);
    api.chartDecoJobs.push({ ce: _mce, b: b, van: true });
    return;
  }

  // VanChart 插件族：plot 无轴/矩形/地图各派 + 各族 FilterDefinition（vpie 走 OneValue）
  // VanChart 绑定定义各族：vbox/vcombo/vtreemap/vgantt/vstructure/vwordcloud/vmultipie/
  //   vpie·vgauge·vfunnel（OneValue）/ vscatter·vbubble（Bubble）/ 其余矩形派（MoreName）
  // 甘特绑定：VanGanttDefinition(VanGanttTableDefinition + 可选 linkDefinition)
  //   linkDefinition 必须非 null（GanttChartDataDefinition.execute 无条件执行）——无数据时注册 0 行命名表
  function applyGanttDefinition(api, vchart, b) {
    var gdef = new (J('com.fr.plugin.chart.gantt.data.VanGanttDefinition'))();
    var gtab = new (J('com.fr.plugin.chart.gantt.data.VanGanttTableDefinition'))();
    gtab.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
    // firstProcess = actual process VALUE from the data (not column name)
    gtab.setFirstProcess(b.firstProcess || b.processname || '');
    gtab.setSeriesName(b.seriesname || '');
    gtab.setStartTime(b.starttime || '');
    gtab.setEndTime(b.endtime || '');
    gtab.setMarkTime(b.marktime || '');
    gtab.setProgress(b.progress || '');
    gtab.setLinkID(b.taskid || '');
    var plist = new (J('java.util.ArrayList'))();
    // 官方 关联线甘特图.cpt 一手：processList 可为空，引擎按数据结构自动推断流程分组；
    //   不得用列名（processname）冒充流程值——会把同一列名重复画成多行（2026-11-08 PNG 实证）。
    if (b.processes) { b.processes.forEach(function(x){ plist.add(x); }); }
    gtab.setProcessList(plist);
    gdef.setDataDefinition(gtab);
    // 审查 F2 修复：GanttChartDataDefinition.execute 无条件执行 linkDefinition（NPE 根因=null）。
    //   无关联线数据时给一个 0 行 EmbeddedTableData 的链接定义（列名占位、attr 指向同名列）；
    //   有 b.link{dataset,start,end,type} 时用真实数据集。
    var linkTd, lStart = 'fromtaskid', lEnd = 'totaskid', lType = 'type';
    if (b.link && b.link.dataset) {
      linkTd = new (J('com.fr.data.impl.NameTableData'))(b.link.dataset);
      if (b.link.start) lStart = b.link.start;
      if (b.link.end) lEnd = b.link.end;
      if (b.link.type) lType = b.link.type;
    } else {
      // VanGanttLinkTableDefinition 执行期强转 NameTableData → 0 行表也必须注册为命名表
      var lname = b.dataset + '__gantt_links';
      var letd = new (J('com.fr.data.impl.EmbeddedTableData'))();
      letd.addColumn(lStart, cls('java.lang.String'));
      letd.addColumn(lEnd, cls('java.lang.String'));
      letd.addColumn(lType, cls('java.lang.String'));
      api.wb.putTableData(lname, letd);
      linkTd = new (J('com.fr.data.impl.NameTableData'))(lname);
    }
    gdef.setLinkDefinition(new (J('com.fr.plugin.chart.gantt.data.VanGanttLinkTableDefinition'))(linkTd, lStart, lEnd, lType));
    try { vplot.setTimeAxis(new (J('com.fr.plugin.chart.gantt.attr.GanttTimeAxis'))());
          vplot.setProcessAxis(new (J('com.fr.plugin.chart.gantt.attr.GanttProcessAxis'))()); } catch (eG) {}
    vchart.setFilterDefinition(gdef);
  }

  function applyVanChartDefinition(api, vchart, vplot, b) {
    if (b.kind === 'vbox') {
      // 2026-11-08 箱线图：官方 doc/Chart/BoxPlot/分组箱型图.cpt 一手
      //   VanBoxTableDefinition(detailed=true) + detailedDefinition=VanBoxMoreNameCDDefinition(category, columns)
      //   + resultDefinition=VanBoxTableResultDefinition（detailed 模式只需占位，统计量由 detailed 数据算）。
      var bvals = (b.values && b.values.length) ? b.values : [b.value];
      var BCSC = J('com.fr.chart.chartdata.ChartSummaryColumn');
      var bcols = J('java.lang.reflect.Array').newInstance(cls('com.fr.chart.chartdata.ChartSummaryColumn'), bvals.length);
      for (var bvi = 0; bvi < bvals.length; bvi++) bcols[bvi] = new (BCSC)(bvals[bvi], bvals[bvi], new (J('com.fr.data.util.function.NoneFunction'))());
      var boxDef = new (J('com.fr.plugin.chart.box.data.VanBoxTableDefinition'))();
      boxDef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      boxDef.setDetailed(true);
      boxDef.setDetailedDefinition(new (J('com.fr.plugin.chart.box.data.VanBoxMoreNameCDDefinition'))(null, b.category, bcols));
      var boxResult = new (J('com.fr.plugin.chart.box.data.VanBoxTableResultDefinition'))();
      // 官方 分组箱型图.cpt 一手：detailed 模式 resultDefinition 仍是占位（categoryName/seriesName/median="无"+五个标签），
      //   空对象会让引擎按默认 0..50 画须（A/C 下须掉到 0）。
      boxResult.setCategoryName('无');
      boxResult.setSeriesName('无');
      boxResult.setMinLabel('最小值');
      boxResult.setQ1Label('下四分位数');
      boxResult.setMedianLabel('中位数');
      boxResult.setQ3Label('上四分位数');
      boxResult.setMaxLabel('最大值');
      boxResult.setMedian('无');
      boxDef.setResultDefinition(boxResult);
      vplot.setDetailed(true);   // plot 与 definition 双开关：只设 definition 时引擎按 resultDefinition 空统计画 0..50 异常须
      vchart.setFilterDefinition(boxDef);
    } else if (b.kind === 'vcombo') {
      // 2026-11-08 组合图（官方 doc/Chart/Combination/ 10 份语料一手）：
      //   plot=VanChartCustomPlot(CustomStyle) + CustomPlotList[column/line/area/bubble/pie 子 plot]
      //   def=CustomDefinition.setDefinitionProviderMap（键=CustomPlotType enum；值按 plot 族：
      //     column/line/area → VanChartMoreNameCDDefinition；pie → VanChartOneValueCDDefinition；
      //     bubble → BubbleTableDefinition(bubbleX/Y/Size)）。
      //   样式按子图集合推导：column+line→COMMON_COLUMN_LINE（b.stack→STACK_COLUMN_LINE）、column+area→COMMON_COLUMN_AREA、
      //   其余组合→CUSTOM（官方 柱形-饼/柱形-气泡/折线-气泡 customStyle="custom"）。
      var CSty = J('com.fr.plugin.chart.custom.type.CustomStyle');
      var CTy = J('com.fr.plugin.chart.custom.type.CustomPlotType');   // 键类型一手：String 键 cpt 导出期 ClassCastException（必须 enum）
      var gs = b.groups || [];
      var pset = {}; gs.forEach(function (g) { pset[g.plot] = 1; });
      var cstyle = b.stacked && pset.column && pset.line ? 'stack_column_line'
        : (pset.column && pset.line && !pset.area && !pset.bubble && !pset.pie ? 'column_line'
        : (pset.column && pset.area && !pset.line && !pset.bubble && !pset.pie ? 'column_area' : 'custom'));
      var CSMAP = { column_line: CSty.COMMON_COLUMN_LINE, column_area: CSty.COMMON_COLUMN_AREA, stack_column_line: CSty.STACK_COLUMN_LINE, custom: CSty.CUSTOM };
      vplot.setCustomStyle(CSMAP[cstyle]);
      var CPK = new (J('java.util.LinkedHashMap'))();
      var cplist = new (J('java.util.ArrayList'))();
      var CRC = J('com.fr.chart.chartdata.ChartSummaryColumn');
      var GPLOT = { column: 'com.fr.plugin.chart.column.VanChartColumnPlot', line: 'com.fr.plugin.chart.line.VanChartLinePlot',
        area: 'com.fr.plugin.chart.area.VanChartAreaPlot', bubble: 'com.fr.plugin.chart.bubble.VanChartBubblePlot',
        pie: 'com.fr.plugin.chart.PiePlot4VanChart' };
      gs.forEach(function (g) {
        var sp = new (J(GPLOT[g.plot]))();
        cplist.add(sp);
        // 堆积柱+线（官方 堆积柱形-折线组合图.cpt 一手）：stack 条件挂 column 子 plot
        //   （命名 ConditionAttr + 空 ListCondition + AttrSeriesStackAndAxis(stacked=true,stackID)），
        //   并把子 plot 的 vanChartPlotType 置 STACK（isStackChart 只认该枚举，README #72 根因）。
        if (b.stacked && g.plot === 'column' && sp.setStackAndAxisCondition) {
          var scc = new (J('com.fr.chart.chartglyph.ConditionCollection'))();
          var sd = new (J('com.fr.chart.chartglyph.ConditionAttr'))();
          var sid = String(b.stackId || '堆积和坐标轴1');
          sd.setName(sid);
          sd.setCondition(new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()));
          var sa = new (J('com.fr.plugin.chart.base.AttrSeriesStackAndAxis'))();
          sa.setStacked(true); sa.setPercentStacked(false); sa.setStackID(sid);
          sd.addDataSeriesCondition(sa);
          scc.addConditionAttr(sd);
          sp.setStackAndAxisCondition(scc);
          try { sp.setVanChartPlotType(J('com.fr.plugin.chart.type.VanChartPlotType').STACK); } catch (eST) { }
        }
        var td = new (J('com.fr.data.impl.NameTableData'))(g.dataset);
        if (g.plot === 'pie') {
          CPK.put(CTy.PIE, new (J('com.fr.plugin.chart.data.VanChartOneValueCDDefinition'))(
            td, '', g.category, g.value, new (J('com.fr.data.util.function.SumFunction'))()));
        } else if (g.plot === 'bubble') {
          var bd = new (J('com.fr.chart.chartdata.BubbleTableDefinition'))();
          bd.setTableData(td);
          bd.setSeriesName('');
          bd.setBubbleX(g.x); bd.setBubbleY(g.y);
          if (g.bubbleSize) bd.setBubbleSize(g.bubbleSize);
          CPK.put(CTy.BUBBLE, bd);
        } else {
          var gvals = (g.values && g.values.length) ? g.values : [g.value];
          var gcols = J('java.lang.reflect.Array').newInstance(cls('com.fr.chart.chartdata.ChartSummaryColumn'), gvals.length);
          for (var gi = 0; gi < gvals.length; gi++) gcols[gi] = new (CRC)(gvals[gi], gvals[gi], new (J('com.fr.data.util.function.NoneFunction'))());
          CPK.put(CTy[String(g.plot).toUpperCase()], new (J('com.fr.plugin.chart.data.VanChartMoreNameCDDefinition'))(td, g.category, gcols));
        }
      });
      vplot.setCustomPlotList(cplist);
      var cdef = new (J('com.fr.plugin.chart.custom.CustomDefinition'))();
      cdef.setDefinitionProviderMap(CPK);
      try { vplot.setAllPlotInCustom(); } catch (eAll) { }
      vchart.setFilterDefinition(cdef);
    } else if (b.kind === 'vtreemap') {
      // 2026-11-08 审查修复（F1-F3）：历史提交把 gantt/structure 代码一并塞进本分支，last-write 覆盖了 treemap 定义。
      //   三分支现各自独立，禁止再合并写。
      var tmdef = new (J('com.fr.plugin.chart.multilayer.data.MultiPieValueDefinition'))();
      tmdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      tmdef.setSeriesName(b.seriesName || '');
      tmdef.setValueColumnName(b.value || (b.values && b.values[0]));
      tmdef.setDataFunction(new (J('com.fr.data.util.function.NoneFunction'))());
      tmdef.setLevelCount(b.levels.length);
      b.levels.forEach(function (lv) { tmdef.addLevelName(lv); });
      vchart.setFilterDefinition(tmdef);
    } else if (b.kind === 'vgantt') {
      applyGanttDefinition(api, vchart, b);
    } else if (b.kind === 'vstructure') {
      var stdef = new (J('com.fr.plugin.chart.structure.data.StructureTableDefinition'))();
      stdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      stdef.setSeriesName(b.seriesName || '');
      stdef.setNodeID(b.nodeId); stdef.setParentID(b.parentId); stdef.setNodeName(b.nodeName); stdef.setNodeValue(b.nodeValue);
      stdef.setDataFunction(new (J('com.fr.data.util.function.NoneFunction'))());
      vchart.setFilterDefinition(stdef);
    } else if (b.kind === 'vwordcloud') {
      var wcdef = new (J('com.fr.plugin.chart.wordcloud.data.WordCloudTableDefinition'))();
      wcdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      wcdef.setWordName(b.wordName); wcdef.setWordValue(b.wordValue);
      wcdef.setDataFunction(new (J('com.fr.data.util.function.NoneFunction'))());
      vchart.setFilterDefinition(wcdef);
    } else if (b.kind === 'vmultipie') {
      var mpdef = new (J('com.fr.plugin.chart.multilayer.data.MultiPieValueDefinition'))();
      mpdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      mpdef.setSeriesName(b.seriesName || '');
      mpdef.setValueColumnName(b.value || (b.values && b.values[0]));
      mpdef.setDataFunction(new (J('com.fr.data.util.function.NoneFunction'))());
      mpdef.setLevelCount(b.levels.length);
      b.levels.forEach(function (lv) { mpdef.addLevelName(lv); });
      vchart.setFilterDefinition(mpdef);
    } else if (b.kind === 'vpie' || b.kind === 'vgauge' || b.kind === 'vfunnel') {
      vchart.setFilterDefinition(new (J('com.fr.plugin.chart.data.VanChartOneValueCDDefinition'))(
        new (J('com.fr.data.impl.NameTableData'))(b.dataset), '',
        b.category, b.value || (b.values && b.values[0]),
        new (J('com.fr.data.util.function.SumFunction'))()));
    } else if (b.kind === 'vscatter' || b.kind === 'vbubble') {
      var btd = new (J('com.fr.chart.chartdata.BubbleTableDefinition'))();
      btd.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      btd.setSeriesName(b.seriesName || 'series');
      btd.setBubbleX(b.x || (b.values && b.values[0]));
      btd.setBubbleY(b.y || (b.values && b.values[1]));
      // #46 遗留（右下大蓝点）定案：官方 气泡图 bubbleSize="库存订购量差" 属性同位——未设 → 引擎默认按自动定位画出异常巨点。显式传入即修
      if (b.bubbleSize) btd.setBubbleSize(b.bubbleSize);
      vchart.setFilterDefinition(btd);
    } else {
      applyChartAttrs(vchart, vplot, b, true, true);
    }
  }

  function putVanChartCell(api, c, r, b, spanC) {
    var vplot = new (J(VK[b.kind]))(); // 无轴派（pie/gauge）getyAxis=null，轴参数自动跳过
    var vchart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(vplot);
    // Van 图占位标题（Fine-Engine_Chart_Title_New_Title）默认绘出且吃掉全部绘图区：空串显式压制（二分实证唯一有效项）。
    // 2026-11-08 缺陷修复（bubbleAttr 专项暴露 vbar/vbubble + title 整图空白）：非空标题必须用 VanChartTitle
    //   并给布局（官方 demo 柱形图变形.cpt 一手：TitleVisible=true position=0 maxHeight=15，Attr4VanChart
    //   floating=false limitSize=false），plain Title(text) 无这些字段会把绘图区吃成 0。
    var _vt = b.title == null ? '' : String(b.title);
    if (_vt === '') {
      vchart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
    } else {
      var vtitle = new (J('com.fr.plugin.chart.attr.VanChartTitle'))(_vt);
      vtitle.setTitleVisible(true);
      vtitle.setPosition(0);
      vtitle.setMaxHeight(15.0);
      vtitle.setUseHtml(false);
      vtitle.setFloating(false);
      vtitle.setLimitSize(false);
      vchart.setTitle(vtitle);
    }
    // v4.2 绑定分歧（probe_vanchart6/7 一手实证）：
    //   矩形派（bar/line/area/scatter 外）MoreNameCDDefinition 实测可用（分组柱/双系列图例正确）；
    //   vpie/vgauge 官方形态 = VanChartOneValueCDDefinition(TableData, 系列名, 分类名, 值列名, DataFunction)，More 会把分类读成系列（4 全圆事故）
    //   vscatter 官方形态 = BubbleTableDefinition(TableData, seriesName, bubbleX, bubbleY, bubbleSize)（doc/Chart/Scatter/常规散点图.cpt）
    applyVanChartDefinition(api, vchart, vplot, b);
    // 批B：装饰后挂 + 挂「cell 里那个 chart/plot 实例」（浅拷贝语义：legend/axis 引用共享而
    //   conditionCollection 是引用替换，必须挂到序列化走的实例上——bisect5 一手实证）
    var _vcc = new (J('com.fr.chart.chartattr.ChartCollection'))();
    _vcc.addChart(vchart);
    var _vce = api.putCell(c, r, _vcc, { align: null, bold: false, bg: null, format: null, edges: b.noBorder ? null : edgesOf(null) }, spanC);
    api.chartDecoJobs.push({ ce: _vce, b: b, van: true });
    return;
  }

  // legacy 图表族：stock/range/meter/donut/gismap + MoreNameCDDefinition 通用绑定
  function putLegacyChartCell(api, c, r, b, spanC) {
    if (b.kind === 'stock') {
        var stD = new (J('com.fr.chart.chartdata.StockTableDefinition'))();
        var stLb = new (J('com.fr.chart.chartdata.StockLabel'))();
        stD.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
        if (b.cateTime) stD.setCateTime(b.cateTime);
        if (b.openString) stD.setOpenString(b.openString);
        if (b.highString) stD.setHighString(b.highString);
        if (b.lowString) stD.setLowString(b.lowString);
        if (b.closeString) stD.setCloseString(b.closeString);
        if (b.volumnString) stD.setVolumnString(b.volumnString);
        if (b.stockLabels) { stLb.setOpenLabel(b.stockLabels.open||''); stLb.setHighLabel(b.stockLabels.high||''); stLb.setLowLabel(b.stockLabels.low||''); stLb.setCloseLabel(b.stockLabels.close||''); stLb.setVolumeLabel(b.stockLabels.volume||''); stD.setStockLabels(stLb); } else { stD.setStockLabels(stLb); }
      } else if (b.kind === 'range') {
        var rdef = new (J('com.fr.chart.chartdata.ScatterTableDefinition'))();
        rdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
        rdef.setSeriesName(b.seriesName || 'range');
        rdef.setScatterX(b.category); rdef.setScatterY(b.value || (b.values && b.values[0]));
      } else if (b.kind === 'meter') {
        var mtdef = new (J('com.fr.chart.chartdata.MeterTableDefinition'))();
        mtdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
        mtdef.setName(b.seriesName || '值');
        mtdef.setValue(b.category || b.value || (b.values && b.values[0]));
        mtdef.setMeterType(0);
        mtdef.setCustom(false);
      } else if (b.kind === 'donut' || b.kind === 'donut3d') {
      // 2026-11-08 经典分段环形尝试：MoreName 会把每个分类画成一环（同心环）；改用 OneValueCDDefinition
      //   让分类成为扇区（同 legacy pie 的语义），值列=value/values[0]。
      var dplot = new (J(TK[b.kind]))();
      var dchart = new (J('com.fr.chart.chartattr.Chart'))(dplot);
      var dvals = (b.values && b.values.length) ? b.values : [b.value];
      dchart.setFilterDefinition(new (J('com.fr.chart.chartdata.OneValueCDDefinition'))(
        new (J('com.fr.data.impl.NameTableData'))(b.dataset), b.category, b.category, dvals[0],
        new (J('com.fr.data.util.function.SumFunction'))()));
      dchart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title == null ? '' : b.title));
      var _dce = api.putCell(c, r, (function () { var x = new (J('com.fr.chart.chartattr.ChartCollection'))(); x.addChart(dchart); return x; })(), { align: null, bold: false, bg: null, format: null, edges: b.noBorder ? null : edgesOf(null) }, spanC);
      api.chartDecoJobs.push({ ce: _dce, b: b, van: false });
      return;
    }
    // legacy 图 plot 类：meter 主题变体（MeterBluePlot/SimpleMeterPlot 均 extends MeterPlot、零新增 API）走 theme 键
    var _plotCls = TK[b.kind];
    if (b.kind === 'meter' && b.theme === 'blue') _plotCls = 'com.fr.chart.chartattr.MeterBluePlot';
    else if (b.kind === 'meter' && b.theme === 'simple') _plotCls = 'com.fr.chart.chartattr.SimpleMeterPlot';
    var chart = new (J('com.fr.chart.chartattr.Chart'))(new (J(_plotCls))());
    if (b.kind === 'stock') {
        var stD = new (J('com.fr.chart.chartdata.StockTableDefinition'))();
        var stLb = new (J('com.fr.chart.chartdata.StockLabel'))();
        stD.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
        if (b.cateTime) stD.setCateTime(b.cateTime);
        if (b.openString) stD.setOpenString(b.openString);
        if (b.highString) stD.setHighString(b.highString);
        if (b.lowString) stD.setLowString(b.lowString);
        if (b.closeString) stD.setCloseString(b.closeString);
        if (b.volumnString) stD.setVolumnString(b.volumnString);
        if (b.stockLabels) { stLb.setOpenLabel(b.stockLabels.open||''); stLb.setHighLabel(b.stockLabels.high||''); stLb.setLowLabel(b.stockLabels.low||''); stLb.setCloseLabel(b.stockLabels.close||''); stLb.setVolumeLabel(b.stockLabels.volume||''); stD.setStockLabels(stLb); } else { stD.setStockLabels(stLb); }
      } else if (b.kind === 'meter') {
      chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title == null ? '' : b.title));
      chart.setFilterDefinition(mtdef);
    } else if (b.kind === 'gismap') {
      // 2026-11-08 probe_gismap 一手：GisMapPlot extends Plot，setGisType/setAddressType/setBaiduKey/setGoogleKey；
      //   数据=GisMapTableDefinition(setAddress/setAddressName/setAddressType/setLnglatOrder+addTittleValue(SeriesDefinition))
      var gplot = chart.getPlot();
      try { gplot.setGisType(b.gisType !== false); gplot.setAddressType(!!b.addressType); } catch (eGp) {}
      var gdef = new (J('com.fr.chart.chartdata.GisMapTableDefinition'))();
      gdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      gdef.setAddress(b.address);
      if (b.addressName) gdef.setAddressName(b.addressName);
      gdef.setAddressType(!!b.addressType);
      gdef.setLnglatOrder(b.lnglatOrder !== false);
      var gvals = (b.values && b.values.length) ? b.values : [b.value];
      for (var gvi = 0; gvi < gvals.length; gvi++) {
        gdef.addTittleValue(new (J('com.fr.chart.chartdata.SeriesDefinition'))(gvals[gvi], gvals[gvi]));
      }
      chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title == null ? '' : b.title));
      chart.setFilterDefinition(gdef);
    } else {
      applyChartAttrs(chart, chart.getPlot(), b);
    }
    var _cce = api.putCell(c, r, (function () { var x = new (J('com.fr.chart.chartattr.ChartCollection'))(); x.addChart(chart); return x; })(), { align: null, bold: false, bg: null, format: null, edges: b.noBorder ? null : edgesOf(null) }, spanC);
    api.chartDecoJobs.push({ ce: _cce, b: b, van: false }); // legacy 装饰同路后挂
  }


  // v4.2 图表通用装配（新旧 plot 同路）：绑定（MoreNameCDDefinition）+ 图例 + Y 轴 + 柱间隙
  //   VanChart 族实证（probe_vanchart/2）：VanChart.setFilterDefinition/setTitle 同 Chart；
  //   VanChartValueAxis.setMaxValue/minValue 同口径（getMaxValue 回读 "=0" → Formula 包装）；
  //   无轴派（vpie/vgauge）getyAxis=null → axisY/barInterval 自动跳过
  function applyChartAttrs(chart, plot, b, skipTitle, van) {
    if (!skipTitle && b.title != null) chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title)); // 空串也显式压掉引擎默认占位标题（如 Fine-Engine_Chart_Title_New_Title）
    var CSC = cls('com.fr.chart.chartdata.ChartSummaryColumn'); // StaticClass 不能传 Array.newInstance（README #18 同款），用 cls() 取 Class 对象
    var CSCS = J('com.fr.chart.chartdata.ChartSummaryColumn');  // new 用 StaticClass
    // v3.3 多系列：b.values 数组 → 每系列一个 ChartSummaryColumn（列名=系列名）；单值 b.value 老路径不变
    var vals = (b.values && b.values.length) ? b.values : [b.value];
    // v4.2 A/B 实证（柱形图变形.cpt 形态）：官方 Van 柱形 def 配 NoneFunction；SumFunction 曾致 Y 轴自适货运异常（待验证）
    var fnc = (typeof van !== 'undefined' && van) ? new (J('com.fr.data.util.function.NoneFunction'))() : new (J('com.fr.data.util.function.SumFunction'))();
    var cols = J('java.lang.reflect.Array').newInstance(CSC, vals.length);
    for (var vi = 0; vi < vals.length; vi++) {
      cols[vi] = new (CSCS)(vals[vi], vals[vi], fnc);
    }
    var def = new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))(b.dataset), b.category, cols);
    chart.setFilterDefinition(def);
    // 批B：装饰改为 build 尾后挂（chartDecoJobs），此处只做绑定
  }

  // 批B（2026-11-04）图表装饰单源（由 applyChartAttrs 尾段上提 + 扩容）：legend/axisY(含 unit 主刻度)/barInterval
  //   + tooltip/label/marker/line/trend/条件系列 格式。挂接=Plot.setConditionCollection(ConditionCollection)，
  //     装饰件入 DefaultAttr(ConditionAttr).addDataSeriesCondition(...)（官方 DataVisualization.cpt 条件集形态同构）；
  //     tooltip 内容一手=getContent() 活引用（AttrTooltip 无 setContent setter，官方 initAttrTooltipContent 同理回填）；
  //     plot 级 alpha/bg/border 走 GeneralInfo setters；堆叠轴走 VanChartRectanglePlot.setStackAndAxisCondition（仅 vbar/varea）。
  // 批I 地图族共用件（2026-11-07）：AttrLabel/AttrTooltip 装配子函数——b.label/b.tooltip 主路不动的
  //   前提下，mapLabel/mapTooltip 的 payload 走同一装配面（与主路同类构造，不另造词表）。
  function buildMapLabelDetail(ls) {
    var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))();
    if (ls.enable != null) lab.setEnable(!!ls.enable);
    var ld = lab.getAttrLabelDetail ? lab.getAttrLabelDetail() : null;
    if (ld) {
      if (ls.position != null && ld.setPosition) ld.setPosition(ls.position);
      if ((ls.fontPt != null || ls.color != null || ls.bold) && ld.setTextAttr) {
        var ta = ld.getTextAttr ? ld.getTextAttr() : null;
        if (!ta || !ta.setFRFont) ta = new (J('com.fr.chart.base.TextAttr'))();
        ta.setFRFont(font(!!ls.bold, ls.fontPt != null ? ls.fontPt : 12, ls.color != null ? ls.color : 0x000000));
        ld.setTextAttr(ta);
      }
      if (ls.backgroundColor != null && ld.setBackgroundColor) ld.setBackgroundColor(awtColor(ls.backgroundColor));
      if (ls.align != null && ld.setAlign) ld.setAlign(ls.align);
      if (ls.autoAdjust != null && ld.setAutoAdjust) ld.setAutoAdjust(!!ls.autoAdjust);
    }
    return lab;
  }
  function buildMapTooltipDetail(ts) {
    var tip = new (J('com.fr.plugin.chart.base.AttrTooltip'))();
    tip.setEnable(true);
    if (ts.muti != null) tip.setShowMutiSeries(!!ts.muti);
    var ctt = tip.getContent();
    if (ctt) {
      if (ts.format && ctt.setValueFormat) {
        var vf = new (J('com.fr.plugin.chart.base.format.AttrTooltipValueFormat'))();
        vf.setEnable(true);
        vf.setFormat(new (J('com.fr.base.CoreDecimalFormat'))(String(ts.format)));
        ctt.setValueFormat(vf);
      }
      if (ts.richText && ctt.setRichTextAttr) {
        var rtc = String(ts.richText.content || '');
        var rt = new (J('com.fr.plugin.chart.base.AttrTooltipRichText'))();
        rt.setContent(rtc);
        rt.setAuto(!!ts.richText.auto);
        rt.setInitParamsContent(rtc);
        ctt.setRichText(true);
        ctt.setRichTextAttr(rt);
      }
    }
    return tip;
  }
  // 系列提示：AttrTooltip（散点/气泡走 Scatter 子类）+ 格式槽/富文本
  function addChartTooltip(dTag, b) {
    // 散点/气泡官方类=ScatterAttrTooltip（content 真类=ScatterAttrTooltipContent 才有 x/y/size 三槽，
    //   官方 doc/Chart/Scatter/常规散点图.cpt 一手；probe_r4m14c 实证）
    var isScatter = (b.kind === 'vscatter' || b.kind === 'vbubble');
    var tip = isScatter ? new (J('com.fr.plugin.chart.scatter.attr.ScatterAttrTooltip'))() : new (J('com.fr.plugin.chart.base.AttrTooltip'))();
    tip.setEnable(true);
    if (b.tooltip.muti != null) tip.setShowMutiSeries(!!b.tooltip.muti);
    var ctt = tip.getContent();
    if (ctt) {
      var TF = { series: 'setSeriesFormat', value: 'setValueFormat', percent: 'setPercentFormat', changedValue: 'setChangedValueFormat', changedPercent: 'setChangedPercentFormat', category: 'setCategoryFormat' };
      var FC = { series: 'AttrTooltipSeriesFormat', value: 'AttrTooltipValueFormat', percent: 'AttrTooltipPercentFormat', changedValue: 'AttrTooltipChangedValueFormat', changedPercent: 'AttrTooltipChangedPercentFormat', category: 'AttrTooltipCategoryFormat' };
      // 批I 地图族（2026-11-07 阶段4 首靶）：地图种 tooltip 格式槽=地图专用子类——官方 按钮式图表切换.cpt/mapfather
      //   一手 <category class="...AttrTooltipAreaNameFormat"> 与 <richTextValue class="...AttrTooltipMapValueFormat">；
      //   基类槽位在 vmap/vheatmap 上与官方语料类名偏差，按 kind 选子类对齐（API 面=probes/_probe_template.js 实测）。
      if (b.kind === 'vmap' || b.kind === 'vheatmap') { FC.category = 'AttrTooltipAreaNameFormat'; FC.value = 'AttrTooltipMapValueFormat'; }
      if (isScatter) { TF.x = 'setXFormat'; TF.y = 'setYFormat'; TF.size = 'setSizeFormat'; FC.x = 'AttrTooltipXFormat'; FC.y = 'AttrTooltipYFormat'; FC.size = 'AttrTooltipSizeFormat'; }
      Object.keys(TF).forEach(function (fk) {
        var fv = b.tooltip.formats ? b.tooltip.formats[fk] : undefined;
        if (fv === undefined) return;
        var fo = new (J('com.fr.plugin.chart.base.format.' + FC[fk]))();
        fo.setEnable(true);
        if (typeof fv === 'string') fo.setFormat(new (J('com.fr.base.CoreDecimalFormat'))(String(fv)));  // 格式串=直塞 CoreDecimalFormat
        ctt[TF[fk]](fo);
      });
      // 富文本 tooltip（probe_r4m14b 一手：setRichTextAttr+setRichText(true)；官方 各部门反馈情况 richText 节点同构）
      if (b.tooltip.richText && ctt.setRichTextAttr) {
        var rtc = String(b.tooltip.richText.content || '');
        var rt = new (J('com.fr.plugin.chart.base.AttrTooltipRichText'))();
        rt.setContent(rtc);
        rt.setAuto(!!b.tooltip.richText.auto);
        rt.setInitParamsContent(rtc);
        ctt.setRichText(true);
        ctt.setRichTextAttr(rt);
      }
    }
    dTag.addDataSeriesCondition(tip);
  }

  // 数值标签：AttrLabel(+Detail) 位置/字体/边框/富文本；vpie 用官方模板 + DefaultAttr 挂法
  function addChartLabel(cc, dTag, b) {
    // 2026-11-08 vpie 序列化墙实验：饼图 label 用官方 cpt 反序列化得到的 AttrLabel（字段齐全），
    //   而不是 new 空对象（空对象在 vpie 分支 writeXML 会丢 ChartCollection，CHART SERIALIZED 实锤）。
    //   模板=doc/Chart/PieChart/基础饼图.cpt（官方安装自带）；缺失时回退 new。
    var lab = null;
    var labFromTpl = false;
    if (b.kind === 'vpie' && b.label.richText) {
      try { lab = vpieTemplateLabel(); } catch (eTpl) { lab = null; }
      if (!lab) throw new Error('[IR] vpie label.richText 需要官方模板 doc/Chart/PieChart/基础饼图.cpt（字段齐全的 AttrLabel）；模板缺失时拒绝构建，不静默丢标签');
      labFromTpl = true;
    }
    if (!lab) lab = new (J('com.fr.plugin.chart.base.AttrLabel'))();
    if (b.label.enable != null) lab.setEnable(!!b.label.enable);
    // 位置/字/底/对齐在 AttrLabelDetail 上（AttrLabel 无 setPosition 一手探针实证）；主 detail=getAttrLabelDetail() 活引用回填
    //   批B axis 群扩（README #103，probe_r4m16 方法面）：fontPt/color/bold/backgroundColor/align/autoAdjust/showGuidLine
    var ld = lab.getAttrLabelDetail ? lab.getAttrLabelDetail() : null;
    if (ld) {
      if (b.label.position != null && ld.setPosition) ld.setPosition(b.label.position);
      if ((b.label.fontPt != null || b.label.color != null || b.label.bold) && ld.setTextAttr) {
        var lta = ld.getTextAttr ? ld.getTextAttr() : null;
        if (!lta || !lta.setFRFont) lta = new (J('com.fr.chart.base.TextAttr'))();
        lta.setFRFont(font(!!b.label.bold, b.label.fontPt != null ? b.label.fontPt : 12, b.label.color != null ? b.label.color : 0x000000));
        ld.setTextAttr(lta);
      }
      if (b.label.backgroundColor != null && ld.setBackgroundColor) ld.setBackgroundColor(awtColor(b.label.backgroundColor));
      if (b.label.align != null && ld.setAlign) ld.setAlign(b.label.align);
      if (b.label.autoAdjust != null && ld.setAutoAdjust) ld.setAutoAdjust(!!b.label.autoAdjust);
      if (b.label.showGuidLine != null && ld.setShowGuidLine) ld.setShowGuidLine(!!b.label.showGuidLine);
      // 2026-11-08 新能力：标签边框——官方 268/268 一手（labelDetail > AttrBorderWithShape，
      //   lineStyle=0、shapeType=RectangularMarker）；活对象 API=setBorderColor/setBorderStyle/setShape(MarkerType)。
      if (b.label.border && ld.setBorder) {
        var lbd = new (J('com.fr.plugin.chart.base.AttrBorderWithShape'))();
        // 官方 XML isAutoColor="true" 会让引擎忽略自定义色（首跑实测：边框画了但呈白/灰）；
        //   要自定义颜色必须 setAutoColor(false) + setBorderColor。
        if (lbd.setAutoColor) lbd.setAutoColor(false);
        lbd.setBorderColor(awtColor(b.label.border.color != null ? b.label.border.color : 0x000000));
        lbd.setBorderStyle(b.label.border.style != null ? b.label.border.style : 0);
        try { lbd.setShape(J('com.fr.plugin.chart.marker.type.MarkerType').valueOf('MARKER_RECTANGULAR')); } catch (eLBS) { }
        ld.setBorder(lbd);
      }
    }
    // 批B 头部（2026-11-06, README #104）：旧 summary 路已废（IR 现明确拒 label.summary：
    //   PieCategoryLabelContent 不渲染）。vpie 标签内容=richText，label 对象取自官方 cpt 模板，
    //   保留其自带 content（AttrTooltipContent）并覆盖 richText 文本。
    var lct = null;
    if (ld.getContent) lct = ld.getContent();
    if (b.label.richText && lct && lct.setRichTextAttr) {
      var lrtc = String(b.label.richText.content || '');
      var lrt = new (J('com.fr.plugin.chart.base.AttrTooltipRichText'))();
      lrt.setContent(lrtc);
      lrt.setAuto(!!b.label.richText.auto);
      lrt.setInitParamsContent(lrtc);
      lct.setRichText(true);
      lct.setRichTextAttr(lrt);
    }
    // 渲染定案（probe_r4m9）：label 必须挂命名 ConditionAttr(恒真 ListCondition) 才渲染（官方条件属性4 同构）
    //   2026-11-08 模板实验：vpie 的 label 挂 DefaultAttr（官方 基础饼图.cpt 的挂法），其余走命名条件。
    if (b.kind === 'vpie') {
      dTag.addDataSeriesCondition(lab);
    } else {
      var lTag = new (J('com.fr.chart.chartglyph.ConditionAttr'))();
      lTag.setName('数值标签');
      lTag.setCondition(new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()));
      lTag.addDataSeriesCondition(lab);
      cc.addConditionAttr(lTag);
    }
  }

  // 标记点：VanChartAttrMarker + 透明度 AttrMarkerAlpha
  function addChartMarker(dTag, b) {
    var mk = new (J('com.fr.plugin.chart.base.VanChartAttrMarker'))();
    var MT = J('com.fr.plugin.chart.marker.type.MarkerType');
    var MMAP = { none: 'MARKER_NULL', circle: 'MARKER_CIRCLE', square: 'MARKER_SQUARE', diamond: 'MARKER_DIAMOND', triangle: 'MARKER_TRIANGLE', circleHollow: 'MARKER_CIRCLE_HOLLOW', squareHollow: 'MARKER_SQUARE_HOLLOW', diamondHollow: 'MARKER_DIAMOND_HOLLOW', triangleHollow: 'MARKER_TRIANGLE_HOLLOW', star: 'MARKER_STAR', rect: 'MARKER_RECTANGULAR', dialog: 'MARKER_DIALOG', parallelogram: 'MARKER_PARALLELOGRAM', ellipse: 'MARKER_ELLIPSE', lineTriangle: 'MARKER_LINE_TRIANGLE' };
    mk.setMarkerType(MT.valueOf(MMAP[b.marker.type] || 'MARKER_AUTO'));
    if (b.marker.radius != null) mk.setRadius(b.marker.radius);
    if (b.marker.common != null) mk.setCommon(!!b.marker.common);
    dTag.addDataSeriesCondition(mk);
    if (b.marker.alpha != null) {  // 批B后继：标记透明度=AttrMarkerAlpha（AttrAlpha 子类，probe_r4m14 一手）
      var mkA = new (J('com.fr.plugin.chart.base.AttrMarkerAlpha'))();
      mkA.setAlpha(b.marker.alpha);
      dTag.addDataSeriesCondition(mkA);
    }
  }

  // 线型/线式：VanChartAttrLine（LineType × LineStyle）
  function addChartLineStyle(dTag, b) {
    var ln = new (J('com.fr.plugin.chart.base.VanChartAttrLine'))();
    var LT = J('com.fr.plugin.chart.type.LineType');  // LINE=NONE|SOLID|DASHED（probe 一手枚举）
    var LMAP = { solid: 'SOLID', dashed: 'DASHED', none: 'NONE' };
    if (b.lineStyle.type) ln.setLineType(LT.valueOf(LMAP[b.lineStyle.type] || 'SOLID'));
    var LS = J('com.fr.plugin.chart.type.LineStyle'); // LINE=NORMAL|STEP|CURVE
    var LSMAP = { normal: 'NORMAL', step: 'STEP', curve: 'CURVE' };
    if (b.lineStyle.style) ln.setLineStyle(LS.valueOf(LSMAP[b.lineStyle.style] || 'NORMAL'));
    if (b.lineStyle.width != null) ln.setLineWidth(b.lineStyle.width);
    dTag.addDataSeriesCondition(ln);
  }

  // 趋势线：VanChartAttrTrendLine + LineStyleInfo（缺线型/线色即不序列化）
  function addChartTrend(dTag, b) {
    var tl = new (J('com.fr.plugin.chart.base.VanChartAttrTrendLine'))();
    var KW = { linear: 'Linear', exp: 'Exponent', log: 'Log', poly: 'Polynomial' };
    // 枚举常量经 Class.forName 取（StaticClass 不透 getEnumConstants）；匹配 toString 后常量对象直传
    var TCS = java.lang.Class.forName('com.fr.plugin.chart.base.TrendLineType').getEnumConstants();
    var hit = null;
    for (var ti = 0; ti < TCS.length; ti++) if (String(TCS[ti]).indexOf(KW[b.trend.type]) >= 0) hit = TCS[ti];
    if (!hit) throw new Error('[IR] unknown trend type: ' + b.trend.type);
    tl.setTrendLineType(hit);
    tl.setTrendLineName(String(b.trend.name || '趋势线'));
    // isValidTrendLine 门槛：需 LineStyleInfo（线型+线色），缺省=无效不序列化（probe 一手：裸 type/name → TrendLine 节点 0）
    var lsi = new (J('com.fr.chart.base.LineStyleInfo'))();
    lsi.setAttrLineColor(new (J('com.fr.chart.base.AttrColor'))(awtColor(b.trend.color != null ? b.trend.color : 0xD0392E)));
    var als = new (J('com.fr.chart.base.AttrLineStyle'))();
    try { als.setLineStyle(2); } catch (eALS) { }   // 线型枚举 int（默认实线可渲染即达标）
    lsi.setAttrLineStyle(als);
    tl.setLineStyleInfo(lsi);
    if (b.trend.pre != null) tl.setPrePeriod(b.trend.pre);
    if (b.trend.after != null) tl.setAfterPeriod(b.trend.after);
    dTag.addDataSeriesCondition(tl);
  }

  // 系列条件染色：命名 ConditionAttr + AttrBackground/AttrAlpha
  function addChartSeriesConditions(cc, dTag, b) {
    (b.conditions || []).forEach(function (cd, cdi) {
      var th = cd && cd.then;
      if (!th || (th.seriesColor == null && th.alpha == null)) return;  // 坏 then 已由 ir 层结构化拒，这里双键空即无装饰
      var ca = new (J('com.fr.chart.chartglyph.ConditionAttr'))();
      ca.setName(cd.name || ('图表条件' + (cdi + 1)));
      ca.setCondition(conditionOf(cd.when));
      // 渲染定案（probe_r4m7 D_a 实拍全染）：系列条件染色正类=AttrBackground+ColorBackground；
      //   AttrColor 挂上引擎不染（批B 挂账根因，manifest conditionalSeries same）
      if (th.seriesColor != null) ca.addDataSeriesCondition(new (J('com.fr.chart.base.AttrBackground'))(bgColor(th.seriesColor)));
      if (th.alpha != null) ca.addDataSeriesCondition(new (J('com.fr.chart.base.AttrAlpha'))(th.alpha));
      cc.addConditionAttr(ca);
    });
  }

  // 柱缘：AttrBorder（AttrBorderWithAlpha 通道引擎不画，IR 已移除）
  function addChartSeriesBorder(dTag, b) {
    var sbc = awtColor(b.seriesBorder.color != null ? b.seriesBorder.color : 0x000000);
    var sbs = b.seriesBorder.style != null ? b.seriesBorder.style : 1;
    dTag.addDataSeriesCondition(new (J('com.fr.chart.base.AttrBorder'))(sbc, sbs));
  }

  // 动画：AttrEffect
  function addChartEffect(dTag, b) {
    var ef = new (J('com.fr.plugin.chart.base.AttrEffect'))();
    ef.setEnabled(b.effect.enabled == null ? true : !!b.effect.enabled);
    if (b.effect.period != null) ef.setPeriod(b.effect.period);
    dTag.addDataSeriesCondition(ef);
  }

  // 面积填充：AttrAreaSeriesFillColorBackground
  function addChartAreaFill(dTag, b) {
    var af = new (J('com.fr.plugin.chart.base.AttrAreaSeriesFillColorBackground'))();
    af.setColorBackground(bgColor(b.areaFill.color != null ? b.areaFill.color : 0x99BBFF));
    if (b.areaFill.alpha != null) af.setAlpha(b.areaFill.alpha);
    dTag.addDataSeriesCondition(af);
  }

  // 系列贴图：命名 ConditionAttr(CATEGORY_INDEX) + AttrSeriesImageBackground
  function addChartSeriesImage(cc, b) {
    // 2026-11-07 渲染修复（官方 国旗柱形图.cpt 一手）：AttrSeriesImageBackground 必须挂在
    //   ConditionAttrList 的命名 ConditionAttr 上（配 ChartCommonCondition CATEGORY_INDEX），
    //   DefaultAttr 通道引擎不画（此前 PNG 柱纯色 = 挂错槽，非引擎墙）。
    var sib = new (J('com.fr.plugin.chart.base.AttrSeriesImageBackground'))();
    sib.setSeriesBackground(imageBackground(b.seriesImage.image, b.seriesImage.layout));
    var imgTag = new (J('com.fr.chart.chartglyph.ConditionAttr'))();
    imgTag.setName('seriesImage');
    try { imgTag.setCondition(conditionOf({ column: 'CATEGORY_INDEX', op: '>=', value: 0 })); } catch (eImg) { }
    imgTag.addDataSeriesCondition(sib);
    cc.addConditionAttr(imgTag);
  }

  // 地图标签：AttrMapLabel(area/point) 复用 buildMapLabelDetail
  function addChartMapLabel(dTag, b) {
    if (b.kind !== 'vmap' && b.kind !== 'vheatmap') throw new Error('[IR] mapLabel 仅 vmap/vheatmap（AttrMapLabel 物理宿主=地图 plot 条件集合）');
    var aml = new (J('com.fr.plugin.chart.map.attr.AttrMapLabel'))();
    if (b.mapLabel.areaLabel) aml.setAreaLabel(buildMapLabelDetail(b.mapLabel.areaLabel));
    if (b.mapLabel.pointLabel) aml.setPointLabel(buildMapLabelDetail(b.mapLabel.pointLabel));
    dTag.addDataSeriesCondition(aml);
  }

  // 地图提示：AttrMapTooltip(area/point/line) 复用 buildMapTooltipDetail
  function addChartMapTooltip(dTag, b) {
    if (b.kind !== 'vmap' && b.kind !== 'vheatmap') throw new Error('[IR] mapTooltip 仅 vmap/vheatmap（AttrMapTooltip 物理宿主=地图 plot 条件集合）');
    var amt = new (J('com.fr.plugin.chart.map.attr.AttrMapTooltip'))();
    if (b.mapTooltip.areaTooltip) amt.setAreaTooltip(buildMapTooltipDetail(b.mapTooltip.areaTooltip));
    if (b.mapTooltip.pointTooltip) amt.setPointTooltip(buildMapTooltipDetail(b.mapTooltip.pointTooltip));
    if (b.mapTooltip.lineTooltip) amt.setLineTooltip(buildMapTooltipDetail(b.mapTooltip.lineTooltip));
    dTag.addDataSeriesCondition(amt);
  }

  // 气泡：VanChartAttrBubble（直径/阴影/负值）
  function addChartBubble(dTag, b) {
    if (b.kind !== 'vbubble') throw new Error('[IR] bubble 仅 vbubble（VanChartAttrBubble 物理宿主=气泡 plot 条件集合）');
    var bab = new (J('com.fr.plugin.chart.bubble.attr.VanChartAttrBubble'))();
    if (b.bubble.minDiameter != null) bab.setMinDiameter(b.bubble.minDiameter);
    if (b.bubble.maxDiameter != null) bab.setMaxDiameter(b.bubble.maxDiameter);
    if (b.bubble.shadow != null) bab.setShadow(!!b.bubble.shadow);
    if (b.bubble.displayNegative != null) bab.setDisplayNegative(!!b.bubble.displayNegative);
    dTag.addDataSeriesCondition(bab);
  }

  // 图表热链：ChartHyperRelateCellLink 挂 plot/area/point/line
  function addChartHotHyperLink(plot, b) {
    var hhl = b.hotHyperLink;
    var hgrp = new (J('com.fr.js.NameJavaScriptGroup'))();
    (Array.isArray(hhl.items) ? hhl.items : []).forEach(function (hit) {
      var lnk = new (J('com.fr.chart.web.ChartHyperRelateCellLink'))();
      if (hit.relateCCName != null) lnk.setRelateCCName(String(hit.relateCCName));
      if (hit.itemName != null) lnk.setItemName(String(hit.itemName));
      if (hit.title != null) lnk.setLinkTitle(String(hit.title));
      if (hit.width != null) lnk.setWidth(hit.width);
      if (hit.height != null) lnk.setHeight(hit.height);
      hgrp.addNameHyperlink(new (J('com.fr.js.NameJavaScript'))(String(hit.name || 'chart link'), lnk));
    });
    var hTgt = String(hhl.target || 'plot');
    if (hTgt === 'area' && plot.setAreaHotHyperLink) plot.setAreaHotHyperLink(hgrp);
    else if (hTgt === 'point' && plot.setPointHotHyperLink) plot.setPointHotHyperLink(hgrp);
    else if (hTgt === 'line' && plot.setLineHotHyperLink) plot.setLineHotHyperLink(hgrp);
    else if (plot.setHotHyperLink) plot.setHotHyperLink(hgrp);
    else throw new Error('[IR] hotHyperLink: plot has no HotHyperLink setter');
  }

  function applyChartDeco(chart, plot, b, van) {
    // v3.3 图例：legend 住在 Plot 上（Chart.getLegend 不存在一手实证，getPlot().getLegend 才对）；legend 类名=com.fr.chart.chartattr.Legend（probe _leg 定名）
    if (b.legend && plot) {
      var lg = plot.getLegend();
      if (lg) {
        if (b.legend.fontPt != null || b.legend.color != null) lg.setFRFont(font(b.legend.bold || false, b.legend.fontPt || 12, b.legend.color));
        if (b.legend.position != null) lg.setPosition(b.legend.position);
        if (b.legend.visible != null) lg.setLegendVisible(b.legend.visible);
      }
    }
    // v3.3 轴口径（Formula 包装 BaseFormula；Van 必须 setCustomMaxValue/MinValue(true)，否则 Y 轴按默认 "=0" 走）
    // 审查 P1-B 轮2：公共轴配置无条件应用（probe_legacy_axis 实证 legacy Bar2D/LinePlot.getyAxis()=ValueAxis，
    //   setTextAttr/setTitle/setFormat/setAxisColor/setShowAxisLabel 等公共 setter 全在；PiePlot 无 yAxis 自动跳过）。
    //   去掉 (van || b.legend) 继承闸——与 axisX 同口径；Van 专属 max|min|unit|alerts 留在 van 门槛内（ir 同步拒 legacy 用这些键）。
    if (b.axisY && plot && plot.getyAxis) {
      var yA = plot.getyAxis();
      if (yA) {
        applyAxisCommon(yA, b.axisY, van);   // 公共键：legacy/Van 同适用；title 仅 Van
        // max|min 归公共：legacy ValueAxis 也有 setMaxValue/setMinValue（rebuild_first.js #46 既有用法）；
        //   custom 开关只在 Van 路径验证（legacy 不调，语义保守）
        if (b.axisY.max != null) {
          yA.setMaxValue(new (J('com.fr.base.Formula'))('=' + b.axisY.max));
          if (van && yA.setCustomMaxValue) yA.setCustomMaxValue(true);
        }
        if (b.axisY.min != null) {
          yA.setMinValue(new (J('com.fr.base.Formula'))('=' + b.axisY.min));
          if (van && yA.setCustomMinValue) yA.setCustomMinValue(true);
        }
        if (van) {
          // 批B axis 群（README #103）：预警值=VanChartAlertValue 列表（LineColor/LineStyle 双件门槛同 trend，probe_r4m16b 一手）
          if (b.axisY.alerts && b.axisY.alerts.length && yA.setAlertValues) {
            var AV = J('com.fr.plugin.chart.attr.axis.VanChartAlertValue');
            var alist = new (J('java.util.ArrayList'))();
            b.axisY.alerts.forEach(function (al) {
              if (!al || al.value == null) return;
              var av = new AV();
              av.setAlertValueFormula(new (J('com.fr.base.Formula'))('=' + al.value));
              if (al.content != null) av.setAlertContent(String(al.content));
              if (al.color != null) {
                av.setLineColor(new (J('com.fr.chart.base.AttrColor'))(awtColor(al.color)));
                try { var _als = new (J('com.fr.chart.base.AttrLineStyle'))(); _als.setLineStyle(2); av.setLineStyle(_als); } catch (eAL) { }
              }
              if (al.alpha != null) av.setAlertLineAlpha(al.alpha);
              alist.add(av);
            });
            yA.setAlertValues(alist);
          }
          // #46 遗留（240pt auto 刻度只 0/150 两级）：显式主刻度步长=Axis.setMainUnit(Formula)+setCustomMainUnit(true)
          if (b.axisY.unit != null) {
            yA.setMainUnit(new (J('com.fr.base.Formula'))('=' + b.axisY.unit));
            yA.setCustomMainUnit(true);
          }
        }
      }
    }
    // 批B axis 群（2026-11-06, README #103）：X 轴=VanChartAxis 实例配置（Van 族）/ CategoryAxis（legacy），
    //   不构造新轴；axisX 全键 legacy 同适用（审查 P2-6:去掉 (van||b.legend) 继承闸——公共 setter 非公式包装）
    if (b.axisX && plot && plot.getxAxis) {
      var xA = plot.getxAxis();
      if (xA) applyAxisCommon(xA, b.axisX, van);
    }
    // 2026-11-06（P3 精确化）：barInterval 仅 vbar 落 XML（legacy Bar2DPlot 有 setter 但 writer 不序列化，
    //   部署 cpt 零命中一手）；调用点保留 setter 存在性守卫，IR 已把非 vbar 结构化拒。
    if (b.barInterval != null && plot && plot.setCategoryIntervalPercent) plot.setCategoryIntervalPercent(b.barInterval);
    // 批B 装饰族（ConditionCollection 通道；ir.js 已限 Van kind + 形态白名单）
    var hasDeco = b.tooltip || b.label || b.marker || b.lineStyle || b.trend || (b.conditions && b.conditions.length)
      || b.seriesBorder || b.effect || b.areaFill || b.seriesImage || b.mapLabel || b.mapTooltip || b.hotHyperLink || b.bubble;
    if (hasDeco && plot.setConditionCollection) {
      var cc = new (J('com.fr.chart.chartglyph.ConditionCollection'))();
      var dTag = new (J('com.fr.chart.chartglyph.ConditionAttr'))();
      dTag.setName('');
if (b.tooltip) addChartTooltip(dTag, b);
if (b.label) addChartLabel(cc, dTag, b);
if (b.marker) addChartMarker(dTag, b);
if (b.lineStyle) addChartLineStyle(dTag, b);
if (b.trend) addChartTrend(dTag, b);
      addChartSeriesConditions(cc, dTag, b);
      // 批B后继（2026-11-06, README #102）扩容词汇——方法面 probe_r4m14/b 一手；DefaultAttr 系列条件通道
      //   2026-11-08 渲染实证（官方 551 处 ConditionAttr AttrBorder 一手 + 载体 PNG red=596）：
      //   纯 AttrBorder 通道真的画柱缘；AttrBorderWithAlpha 通道引擎不画（alpha=1 仍零像素）→
      //   IR 侧已移除 alpha 键，这里只用 AttrBorder。
if (b.seriesBorder) addChartSeriesBorder(dTag, b);
if (b.effect) addChartEffect(dTag, b);
if (b.areaFill && b.kind === 'varea') addChartAreaFill(dTag, b);
if (b.seriesImage && b.seriesImage.image) addChartSeriesImage(cc, b);
      // 批I 地图族（2026-11-07 阶段4）：地图专属标签/提示条件（AttrMapLabel/AttrMapTooltip extends
      //   DataSeriesCondition，物理宿主=地图 plot 条件集合；官方 按钮式图表切换.cpt <Attr class="...AttrMapLabel">
      //   条件集合同构；API 面=probes/_probe_template.js 一手 setAreaLabel/setPointLabel(AttrLabel)、
      //   setAreaTooltip/setPointTooltip/setLineTooltip(AttrTooltip)）——payload 复用 buildMapLabelDetail/buildMapTooltipDetail
if (b.mapLabel) addChartMapLabel(dTag, b);
if (b.mapTooltip) addChartMapTooltip(dTag, b);
if (b.bubble) addChartBubble(dTag, b);
      // 批I 图表热链（ChartHyperRelateCellLink；官方 资产负债联动图表.cpt 一手：<NameJavaScriptGroup><NameJavaScript
      //   name="..."><JavaScript class="com.fr.chart.web.ChartHyperRelateCellLink">）。挂点=plot.setHotHyperLink
      //   （通用）/setAreaHotHyperLink|setPointHotHyperLink|setLineHotHyperLink（地图；probe 一手方法面）。
      //   parameters 槽（官方 <Parameters> Formula 传参）本批不接——IR 层结构化拒，不静默丢。
if (b.hotHyperLink) addChartHotHyperLink(plot, b);
      cc.setDefaultAttr(dTag);   // ★ 批B 定案补（根因）：装饰件全在 dTag 上，缺这行=从未挂进 ConditionCollection（bisect5/6 对拍揪出）
      plot.setConditionCollection(cc);
    }
    if (b.stack && plot.setStackAndAxisCondition) {
      // 官方形（demo/analytics/Demo.cpt 一手）：ConditionAttrList 里的命名 ConditionAttr + 空 ListCondition(恒真) + stackID=attr 名
      var scc = new (J('com.fr.chart.chartglyph.ConditionCollection'))();
      var sd = new (J('com.fr.chart.chartglyph.ConditionAttr'))();
      var sid = String(b.stack.stackId || 'stack1');
      sd.setName(sid);
      sd.setCondition(new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()));
      var sa = new (J('com.fr.plugin.chart.base.AttrSeriesStackAndAxis'))();
      if (b.stack.stacked) sa.setStacked(true);
      if (b.stack.percent) sa.setPercentStacked(true);
      sa.setStackID(sid);
      sd.addDataSeriesCondition(sa);
      scc.addConditionAttr(sd);
      plot.setStackAndAxisCondition(scc);
      // m3 结案：isStackChart() 只认 plot.vanChartPlotType==STACK/STACK_BY_PERCENT——只有
      //   setStackAndAxisCondition 时序列化在、渲染仍分组（README #72 挂账根因）
      if (plot.setVanChartPlotType) {
        var PT = J('com.fr.plugin.chart.type.VanChartPlotType');
        plot.setVanChartPlotType(b.stack.percent ? PT.STACK_BY_PERCENT : PT.STACK);
      }
    }
    // 批B后继：plot 级热提示样式（legacy+Van 同路，官方 XML newHotTooltipStyle=AttrContents 一手；
    //   probe_r4m14b：Plot.setHotTooltipStyle(AttrContents)）
    if (b.hotTooltip && plot.setHotTooltipStyle) {
      var hc = new (J('com.fr.chart.base.AttrContents'))();
      if (b.hotTooltip.position != null) hc.setPosition(b.hotTooltip.position);
      if (b.hotTooltip.showMutiSeries != null) hc.setShowMutiSeries(!!b.hotTooltip.showMutiSeries);
      if (b.hotTooltip.whiteBackground != null) hc.setWhiteBackground(!!b.hotTooltip.whiteBackground);
      if (b.hotTooltip.seriesLabel != null) hc.setSeriesLabel(String(b.hotTooltip.seriesLabel));
      if (b.hotTooltip.format) hc.setFormat(new (J('com.fr.base.CoreDecimalFormat'))(String(b.hotTooltip.format)));
      if (b.hotTooltip.percentFormat) hc.setPercentFormat(new (J('com.fr.base.CoreDecimalFormat'))(String(b.hotTooltip.percentFormat)));
      plot.setHotTooltipStyle(hc);
    }
    // plot 级外观（GeneralInfo setters 直通）
    if (b.alpha != null && plot.setAlpha) plot.setAlpha(b.alpha);
    if (b.bg != null && plot.setBackground) plot.setBackground(bgColor(b.bg));
    if (b.border != null) {
      if (b.border.color != null && plot.setBorderColor) plot.setBorderColor(awtColor(b.border.color));
      if (b.border.style != null && plot.setBorderStyle) plot.setBorderStyle(b.border.style);
    }
  }

  return { putChartCell: putChartCell, applyChartDeco: applyChartDeco };
})();
