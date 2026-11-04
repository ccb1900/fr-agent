// verify/neg_secret_leak.js — I0-04 凭据自动门负测夹具
// 期望：deploy 后 SECRET GATE 命中 'password'（标题故意含该词）→ 撤回 3 件 + deploy=failed + exit 1；
//       部署目录不留本负测任何产物（撤回断言：文件不存在）。
// 跑法（U6 自动化门接管）：REPORT_SPEC=verify/neg_secret_leak.js run.ps1 make_api.js
var SPEC = {
  outName: 'neg_secret_leak',
  title: '负测面 password 字样泄漏',
  columns: [
    { label: '项', name: 'a', type: 'text', widthPt: 120 },
    { label: '值', name: 'v', type: 'number', widthPt: 80 }
  ],
  heightsPt: { title: 30, header: 20, row: 20, total: 20 },
  data: [['x', 1]]
};
