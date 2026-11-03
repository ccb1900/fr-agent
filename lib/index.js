// lib/index.js — Core 门面（ABR-1 阶段4）
// 统一核心模块命名：ir（Spec→IR）/ backend.finereport（IR→FR 对象图）/ artifact.cpt（校验器回归门）。
// Nashorn：load(Paths.lib('index.js')) 后置全局 CORE；Ir/Obj/Cpt 原全局名保持不变（事实契约）。
// Node 兼容说明：core 三件仍是 IIFE 全局形态（未加 module.exports，ABR-2 再考虑），
// browser 垫片的 Node 通路已在 lib/browser.js 内单独支持。
var CORE = {
  ir: (typeof Ir !== 'undefined') ? Ir : null,
  backend: {
    finereport: (typeof Obj !== 'undefined') ? Obj : null
  },
  artifact: {
    cpt: (typeof Cpt !== 'undefined') ? Cpt : null
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = CORE;
