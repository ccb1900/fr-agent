// probe_vpie_label_template.js — 2026-11-08：官方饼图 cpt 反序列化取 label 对象（vpie 序列化墙重开路线）
//   先初始化 Runtime（同 make_api），再 readTemplateWorkBook，遍历 cell 找 ChartCollection 并取 AttrLabel。
var J = function (n) { return Java.type(n); };
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/runtime/paths.js');
load(ROOT + '/runtime/bootstrap.js');
load(ROOT + '/runtime/datasource.js');
Runtime.initialize();
print('ENV READY');
var wb = null;
try { wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('doc/Chart/PieChart/基础饼图.cpt'); }
catch (e) { print('LOAD ERR ' + e); }
if (wb) {
  var n = +wb.getReportCount();
  print('reports=' + n);
  for (var si = 0; si < n; si++) {
    var sh = wb.getReport(si);
    var rows = +sh.getRowCount(), cols = +sh.getColumnCount();
    print('sheet ' + si + ' ' + rows + 'x' + cols);
    for (var r = 0; r < Math.min(rows, 60); r++) {
      for (var c = 0; c < Math.min(cols, 20); c++) {
        try {
          var ce = sh.getCellElement(c, r);
          if (!ce) continue;
          var v = ce.getValue();
          if (!v) continue;
          var cn = String(v.getClass().getName());
          if (cn.indexOf('ChartCollection') < 0) continue;
          print('CHART at c=' + c + ' r=' + r + ' class=' + cn);
          var ch = v.getChart(0);
          print('  chart=' + ch.getClass().getName());
          var plot = ch.getPlot ? ch.getPlot() : null;
          print('  plot=' + (plot ? plot.getClass().getName() : 'null'));
          var cc = plot && plot.getConditionCollection ? plot.getConditionCollection() : null;
          print('  condCollection=' + (cc ? cc.getClass().getName() : 'null'));
          if (cc) {
            var da = cc.getDefaultAttr ? cc.getDefaultAttr() : null;
            print('  defaultAttr=' + (da ? da.getClass().getName() : 'null'));
            if (da) {
              var it0 = da.getConditionIterator ? da.getConditionIterator() : null;
              var idx = 0;
              while (it0 && it0.hasNext()) {
                var it = it0.next();
                print('    [' + idx + '] ' + it.getClass().getName());
                if (String(it.getClass().getName()).indexOf('AttrLabel') >= 0) {
                  var ld = it.getAttrLabelDetail ? it.getAttrLabelDetail() : null;
                  print('       detail=' + (ld ? ld.getClass().getName() : 'null'));
                  if (ld) {
                    var ct = ld.getContent ? ld.getContent() : null;
                    print('       content=' + (ct ? ct.getClass().getName() : 'null'));
                    if (ct && ct.getRichTextAttr) {
                      var rt = ct.getRichTextAttr();
                      print('       richText=' + (rt ? String(rt.getContent()).substring(0, 100) : 'null'));
                    }
                  }
                }
                idx++;
              }
            }
          }
        } catch (e2) { }
      }
    }
  }
}
print("PROBE END"); J("java.lang.System").exit(0);
