// runtime/datasource.js — ABR-1 runtime：数据源/连接注册
// 职责：spec.connections[] 凭据注册进 DatasourceManager（先真连一次，连不上终止）。
// 语义保持（ABR-1 纪律，与 ABR-0 基线 make_api.js 1.5 节逐行等价）：
//   - 先 testConnection()，失败 → stamp('DB CONNECTION FAIL ...') + System.exit(4)
//   - 成功 → putConnection(名, 连接) + check('DB CONNECTION <名> 注册+名称可解析') + stamp('DB CONNECTION READY ...')
// api = { stamp, check }：由 runner 提供，日志文案/时序/FAILS 计数与原实现一致。

var Runtime = Runtime || {};

Runtime.DataSource = (function () {
  function register(connections, api) {
    if (!connections || !connections.length) return;
    var J = function (n) { return Java.type(n); };
    var dmApi = J('com.fr.file.DatasourceManager').getInstance();
    for (var ci = 0; ci < connections.length; ci++) {
      var cc = connections[ci];
      try {
        var jd = new (J('com.fr.data.impl.JDBCDatabaseConnection'))();
        jd.setDriver(cc.driver); jd.setURL(cc.url); jd.setUser(cc.user); jd.setPassword(cc.password);
        jd.testConnection();
        dmApi.putConnection(cc.name, jd);
        var resolved = new (J('com.fr.data.impl.NameDatabaseConnection'))(cc.name);
        api.check('DB CONNECTION ' + cc.name + ' 注册+名称可解析', dmApi.getConnection(cc.name) != null);
        api.stamp('DB CONNECTION READY: ' + cc.name + ' driver=' + cc.driver);
      } catch (eDb) {
        api.stamp('DB CONNECTION FAIL ' + cc.name + ': ' + eDb);
        J('java.lang.System').exit(4);
      }
    }
  }

  return { register: register };
})();

if (typeof module !== 'undefined' && module.exports) {
  if (typeof module.exports === 'object' && module.exports.initialize) {
    module.exports.DataSource = Runtime.DataSource;   // 合并 Runtime 门面
  } else {
    module.exports = Runtime.DataSource;
  }
}
