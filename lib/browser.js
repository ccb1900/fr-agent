// lib/browser.js — ABR-1 COMPAT SHIM
// 真实模块已迁至 features/data_browser/browser.js（业务生成器，不再属于编译器核心 lib）。
// 旧路径引用（未来脚本/第三方 load）经此垫片继续可用；ABR-2 评估撤垫。
// 边界检查唯一豁免（scripts/check-boundaries.ps1 白名单）。
if (typeof load === 'function') {
  // Nashorn：FR_AGENT_HOME 单点（2026-11-04 审计批 A：原硬编码 D:/fineagent 违反路径单点）
  load((java.lang.System.getenv('FR_AGENT_HOME') || 'D:/fineagent') + '/features/data_browser/browser.js');
} else if (typeof require === 'function') {
  // Node 兼容：相对路径修正（原 '../data_browser/' 缺 features/ 段，必 404——审计批 A）
  module.exports = require('../features/data_browser/browser.js');
}
