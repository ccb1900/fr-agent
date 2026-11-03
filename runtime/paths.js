// runtime/paths.js — ABR-1 统一路径管理（Nashorn 全局 Paths）
// 职责：四个环境口子的单点定义
//   FR_AGENT_HOME = 项目根目录（默认 D:/fineagent）——管线自己的代码与数据
//   FR_HOME       = FineReport 安装根目录（默认 D:/software/FineReport_11.0）——引擎与环境
//   （REPORT_SPEC / BR_DEPLOYDIR 参数级 env 由 runner 语义直接读取，不属于这里）
// 两者职责分离：不要混成一个配置。默认值不两手硬编码在 runner 里。
//
// 约束（ABR-1）：仅提供路径解析，不做 IO、不做目录创建、不做环境变量写入。
// Windows 分隔符统一收敛为 '/'（Nashorn load()/Files 接口全通吃）。

var Paths = (function () {
  var System = Java.type('java.lang.System');

  function envOr(name, def) {
    var v = System.getenv(name);
    return (v != null && String(v).replace(/^\s+|\s+$/g, '') !== '') ? String(v) : def;
  }

  // 项目根：末尾分隔符与拼接符统一归 '/'
  var root = envOr('FR_AGENT_HOME', 'D:/fineagent').replace(/[\\]+$/g, '');
  // FR 安装根：同上
  var frHome = envOr('FR_HOME', 'D:/software/FineReport_11.0').replace(/[\\]+$/g, '');

  function join(a, rel) {
    return String(a).replace(/[\\\/]+$/, '') + '/' + String(rel).replace(/^[\\\/]+/, '');
  }

  return {
    root: root,
    frHome: frHome,
    // 项目内目录访问
    lib: function (name) { return join(root, 'lib/' + name); },
    feature: function (dir, name) { return join(root, 'features/' + dir + '/' + name); },
    runtime: function (name) { return join(root, 'runtime/' + name); },
    spec: function (rel) { return join(root, rel); },        // REPORT_SPEC 同语义：root 相对
    data: function (name) { return join(root, 'data/' + name); },
    // FR 环境落点
    frWebInf: function () { return join(frHome, 'webapps/webroot/WEB-INF'); },
    demoDeployDir: function () { return join(frHome, 'webapps/webroot/WEB-INF/reportlets/fineagent'); }
  };

})();

if (typeof module !== 'undefined' && module.exports) module.exports = Paths;
