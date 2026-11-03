// probe_open_exec.js — 模拟"全新打开未点查询"：空参数表执行已部署模板，与显式公式参数执行对比——首屏直出实证
var J = function (n) { return Java.type(n); };
var Class = Java.type('java.lang.Class');
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(),
  new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(),
  new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(),
  new (J('com.fr.report.ReportActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(Class.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();

var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('fineagent/激光数据浏览器_评分流水_api.cpt');

function run(tag, pm) {
  try {
    var rb = wb.execute(pm, new (J('com.fr.stable.PageActor'))());
    var rr = rb.getResultReport(0);
    print(tag + ' -> pages=' + rb.getReportCount() + ' rows=' + rr.getRowCount() + ' cols=' + rr.getColumnCount());
    // 读表底分页信息带文字（约在倒数两行）：格值找出 total
    for (var r = rr.getRowCount() - 3; r < rr.getRowCount(); r++) {
      var vals = [];
      for (var c = 0; c < Math.min(8, rr.getColumnCount()); c++) {
        var v = null;
        try { var el = rr.getCellElement(c, r); if (el) v = el.getValue(); } catch (e) {}
        if (v != null) vals.push(String(v));
      }
      if (vals.length) print('  row' + r + ': ' + vals.join(' | '));
    }
  } catch (e) {
    print(tag + ' EXEC FAIL: ' + e);
    var sw = new (J('java.io.StringWriter'))(); var pw = new (J('java.io.PrintWriter'))(sw);
    e.printStackTrace(pw); print(String(sw.toString()).split('\n').slice(0, 4).join(' || '));
  }
}

var empty = new (J('java.util.HashMap'))();
run('A 空参数(全新打开)', empty);

var formula = new (J('java.util.HashMap'))();
formula.put('d1', '=TODAY()-6'); formula.put('d2', '=TODAY()');
formula.put('stage', ''); formula.put('size', '50'); formula.put('page', '1');
run('B 公式参数(点查询等价)', formula);

var literal = new (J('java.util.HashMap'))();
literal.put('d1', '2026-09-22'); literal.put('d2', '2026-09-22');
literal.put('stage', ''); literal.put('size', '50'); literal.put('page', '1');
run('C 字面日期(演示库有数日)', literal);
print('DONE');
