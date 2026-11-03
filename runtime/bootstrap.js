// runtime/bootstrap.js — ABR-1 runtime：FineReport 执行环境
// 职责：环境激活链（ActivatorToolBox.simpleLink）+ SimpleWork.supply/checkIn + module.start()
// 不负责：报表构建（backend）、数据源注册（datasource.js）、业务生成（features/）。
// 依赖：全局 Paths（load 顺序保证：make_api 先载 paths.js）。
// 语义保持（ABR-1 纪律）：激活链内容与顺序、checkIn 落点与 make_api 原实现逐行等价
//   （原实现见 ABR-0 基线 commit 7b74549 的 make_api.js 第 29-41 行）。

var Runtime = (function () {
  function initialize() {
    var J = function (n) { return Java.type(n); };
    var Class = Java.type('java.lang.Class');
    var m = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
      new (J('com.fr.config.activator.BaseDBActivator'))(),
      new (J('com.fr.config.activator.ConfigurationActivator'))(),
      new (J('com.fr.store.StateServiceActivator'))(),
      new (J('com.fr.report.module.ReportBaseActivator'))(),
      new (J('com.fr.report.RestrictionActivator'))(),
      new (J('com.fr.report.ReportActivator'))(),
      new (J('com.fr.chart.activator.ChartBaseActivator'))());
    var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
    SimpleWork.supply(Class.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
    SimpleWork.checkIn(Paths.frWebInf());   // ABR-1：FR 安装根走 FR_HOME 单点
    m.start();
    return m;
  }

  return { initialize: initialize };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Runtime;
