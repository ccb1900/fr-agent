// lib/browser.js — ABR-1 COMPAT SHIM
// 真实模块已迁至 features/data_browser/browser.js（业务生成器，不再属于编译器核心 lib）。
// 旧路径引用（未来脚本/第三方 load）经此垫片继续可用；ABR-2 评估撤垫。
// 边界检查唯一豁免（scripts/check-boundaries.ps1 白名单）。
if (typeof load === 'function') {
  load('D:/fineagent/features/data_browser/browser.js');      // Nashorn：置全局 BROWSER（原 IIFE 行为）
} else if (typeof require === 'function') {
  module.exports = require('../data_browser/browser.js');     // Node 兼容
}
