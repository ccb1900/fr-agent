// features/data_browser/index.js — ABR-1 业务 Feature 门面
// 数据浏览器生成器对外入口。Feature 只产出 spec/IR 词汇（build(config) → ReportIR），
// 不初始化 FineReport、不执行报表、不导出产物。
// 兼容适配：真实函数名是 spec()，按 ABR-1 计划补 build = spec 别名。
var B = require('./browser.js');

module.exports = {
  spec: B.spec,
  build: B.spec,          // ABR-1 计划 §4.2 的 build(config) 形态适配
  MODULES: B.MODULES,
  env: B.env,
  fullSql: B.fullSql,
  pagedSql: B.pagedSql,
  metaSql: B.metaSql,
  dateExpr: B.dateExpr
};
