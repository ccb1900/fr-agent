// probe_custom_surface.js — 组合图（CustomPlot / VanChartCustomPlot）类面 + 官方 Combination 语料对象图探针（2026-11-08）
//   背景：D1 曾按 `柱形图变形.cpt` 判定"线系列渲染不达成"；本轮发现官方 doc/Chart/Combination/ 有 10 个组合图语料，
//   先反射类面、再读官方对象图，回答：组合图由哪些 plot/definition/style/condition 组成，渲染需要的字段是什么。
// 用法：run.ps1 -Script probes/probe_custom_surface.js
var J = function (n) { return Java.type(n); };
function dumpClass(cn) {
  try {
    var c = J(cn);
    print('=== CLASS ' + cn);
    var sc = c.class.getSuperclass();
    print('  EXTENDS ' + (sc ? sc.getName() : '<none>'));
    var ct = c.class.getConstructors();
    for (var i = 0; i < ct.length; i++) {
      var ps = ct[i].getParameterTypes(), a = [];
      for (var j = 0; j < ps.length; j++) a.push(ps[j].getName());
      print('  CTOR (' + a.join(',') + ')');
    }
    var msj = c.class.getDeclaredMethods(), ms = [];
    for (var z0 = 0; z0 < msj.length; z0++) ms.push(msj[z0]);
    ms.sort(function (x, y) { return ('' + x.getName()).localeCompare('' + y.getName()); });
    for (var k = 0; k < ms.length; k++) {
      var m = ms[k], nm = '' + m.getName(), p = m.getParameterTypes(), aa = [];
      if (/^(set|get|add|create|default|is)/.test(nm)) {
        for (var q = 0; q < p.length; q++) aa.push(p[q].getName());
        print('  M ' + nm + '(' + aa.join(',') + ') -> ' + m.getReturnType().getName());
      }
    }
  } catch (e) { print('  ERR ' + e); }
}
['com.fr.plugin.chart.custom.VanChartCustomPlot',
 'com.fr.plugin.chart.custom.CustomDefinition',
 'com.fr.plugin.chart.custom.type.CustomStyle',
 'com.fr.plugin.chart.custom.type.CustomPlotType',
 'com.fr.plugin.chart.custom.CustomPlotFactory',
 'com.fr.plugin.chart.custom.CustomIndependentVanChart',
 'com.fr.chart.chartattr.CustomPlot',
 'com.fr.chart.charttypes.CustomIndependentChart',
 'com.fr.chart.chartdata.CustomDefinition',
 'com.fr.chartx.data.CustomChartDataDefinition'
].forEach(dumpClass);
function dumpStatics(cn){try{var c=J(cn);print('=== STATICS '+cn);var fs=c.class.getDeclaredFields();for(var i=0;i<fs.length;i++){var f=fs[i];if(java.lang.reflect.Modifier.isStatic(f.getModifiers())){try{print('  '+f.getName()+' = '+f.get(null));}catch(e){print('  '+f.getName());}}}}catch(e){print('  ERR '+e);}}
dumpStatics('com.fr.plugin.chart.custom.type.CustomStyle');
dumpStatics('com.fr.plugin.chart.custom.type.CustomPlotType');

// 官方语料对象图
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(), new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(), new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(), new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(J('java.lang.Class').forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
var FILES = ['doc/Chart/Combination/柱形-折线组合图.cpt'];
for (var fi = 0; fi < FILES.length; fi++) {
  print('##### FILE ' + FILES[fi]);
  var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook(FILES[fi]);
  var sh = wb.getReport(0);
  for (var r = 0; r < Math.min(sh.getRowCount(), 40); r++) for (var c = 0; c < Math.min(sh.getColumnCount(), 12); c++) {
    var ce = sh.getCellElement(c, r); if (!ce) continue;
    var v = ce.getValue(); if (!v || String(v.getClass().getName()).indexOf('ChartCollection') < 0) continue;
    var chart = v.getChart(0);
    print('cell ' + c + ',' + r + ' chart=' + chart.getClass().getName() + ' plot=' + chart.getPlot().getClass().getName());
    var d = chart.getFilterDefinition(); print('DEF ' + d.getClass().getName());
    var gp = chart.getPlot();
    ['getCustomStyle', 'getCustomPlotList', 'getPlotList', 'getCustomDefinition', 'getCustomPlotType', 'getStyle', 'getPlotType'].forEach(function (mn) {
      try { if (gp[mn]) { var val = gp[mn](); print('  plot.' + mn + '()=' + (val == null ? 'null' : val.getClass().getName())); } } catch (e) {}
    });
    try {
      var cpl = gp.getCustomPlotList ? gp.getCustomPlotList() : null;
      if (cpl) { print('  CustomPlotList size=' + cpl.size()); for (var pi = 0; pi < cpl.size(); pi++) { var pobj = cpl.get(pi); print('    plot[' + pi + ']=' + pobj.getClass().getName()); } }
      var dpm = (d.getDefinitionProviderMap ? d.getDefinitionProviderMap() : null);
      if (dpm) { print('  DefinitionProviderMap class=' + dpm.getClass().getName() + ' size=' + dpm.size()); var it = dpm.entrySet().iterator(); while (it.hasNext()) { var en = it.next(); var vv = en.getValue(); print('    map key=' + en.getKey() + ' val=' + (vv == null ? 'null' : vv.getClass().getName())); } }
      var sdl = (d.getSeriesDefinitionList ? d.getSeriesDefinitionList() : null);
      if (sdl) { print('  SeriesDefinitionList size=' + sdl.size()); }
    } catch (ePL) { print('  PL ERR ' + ePL); }
    try {
      var cs = gp.getCustomStyle ? gp.getCustomStyle() : null;
      if (cs) {
        print('  CustomStyle ' + cs.getClass().getName());
        var cm = cs.getClass().getMethods();
        for (var mi = 0; mi < cm.length; mi++) {
          var nm = '' + cm[mi].getName();
          if (/^(get|is)/.test(nm) && cm[mi].getParameterTypes().length === 0 && nm !== 'getClass') {
            try { var rv = cm[mi].invoke(cs); print('    cs.' + nm + '()=' + (rv == null ? 'null' : (typeof rv === 'object' ? String(rv.getClass().getName()) + ' -> ' + String(rv) : String(rv)))); } catch (e2) {}
          }
        }
      }
    } catch (eCS) { print('  CS ERR ' + eCS); }
    // 定义体一级字段
    try {
      var dm = d.getClass().getMethods();
      for (var di = 0; di < dm.length; di++) {
        var dn = '' + dm[di].getName();
        if (/^(get|is)/.test(dn) && dm[di].getParameterTypes().length === 0 && dn !== 'getClass') {
          try { var dv = dm[di].invoke(d); print('    def.' + dn + '()=' + (dv == null ? 'null' : (typeof dv === 'object' ? String(dv.getClass().getName()) : String(dv)))); } catch (e3) {}
        }
      }
    } catch (eD) { print('  DEF ERR ' + eD); }
    // 官方 XML 结构（只打含 Custom 的行，粗略）
    break;
  }
}
J('java.lang.System').exit(0);
