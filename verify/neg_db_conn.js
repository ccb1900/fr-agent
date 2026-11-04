// verify/neg_db_conn.js — I0-02/I0-06 引擎负测夹具：datasource_connect 失败必须经 RunResult 收口
// 期望（U6 自动化门接管断言）：
//   REPORT_SPEC=verify/neg_db_conn.js → run.ps1 make_api.js → exit 4
//   logs/last_run.json（FR_AGENT_RESULT 重定向）：
//     stages.input_load=passed, stages.runtime_initialize=passed, stages.datasource_connect=failed,
//     ir_validate..roundtrip 全 skipped，diagnostics 含 'DB CONNECTION FAIL NEGBAD'，success=false，exit=4
//   且该文件必须是本轮写入（初始快照 success:null 被本轮 failed 覆盖）——不许残留上一轮的 success:true。
// 连接目标 = 本机封闭端口（确定性拒连）；user/password 为占位假值，零真实凭据。
var SPEC = {
  outName: 'neg_db_conn',
  connections: [
    { name: 'NEGBAD', driver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
      url: 'jdbc:sqlserver://127.0.0.1:59999;databaseName=master', user: 'x', password: 'y' }
  ],
  title: '负测-坏连接',
  columns: [{ label: 'A', name: 'a', type: 'text', widthPt: 80 }],
  heightsPt: { title: 30, header: 20, row: 20, total: 20 },
  data: [['1']]
};
