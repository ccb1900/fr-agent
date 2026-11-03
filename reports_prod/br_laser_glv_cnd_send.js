// br_laser_glv_cnd_send.js — 数据浏览器·条件下发（画像源 DB_LASER_TABLES_PROD.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；行数 1176750 超引擎阈值，SQL 分页。
// 凭据只在本机 spec 的 connections 段。

load(Paths.feature('data_browser', 'browser.js'));

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_条件下发'),
  title: '激光数据浏览器 · 条件下发 laser_glv_cnd_send',
  table: 'laser_glv_cnd_send',
  selfCpt: 'fineagent/激光数据浏览器_条件下发_api.cpt',
  modules: BROWSER.MODULES,
  dateCol: 'biz_date',
  timeCol: 'biz_time',
  filterCol: null,
  sqlPaging: true,
  defaults: {
    d1: BROWSER.env('BR_D1', '=TODAY()-6'), d2: BROWSER.env('BR_D2', '=TODAY()'),
    machine: BROWSER.env('BR_MACHINE', ''),
    size: +BROWSER.env('BR_SIZE', '50'), page: +BROWSER.env('BR_PAGE', '1')
  },
  connections: [{
    name: 'ATOM_LIVE',
    driver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
    url: 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false',
    user: 'sa',
    password: load('D:/fineagent/lib/dbpass.js')
  }],
  cols: [
    { name: "file_key", len: 20, type: 'code' },
    { name: "row_number", len: 11, type: 'num', fmt: '#,##0' },
    { name: "biz_date", label: "DATE", len: 14 },
    { name: "biz_time", label: "TIME", len: 10 },
    { name: "no", label: "No.", len: 6, type: 'code' },
    { name: "r8162", label: "R8162", len: 6, type: 'num', fmt: '#,##0' },
    { name: "r8145", label: "R8145", len: 6, type: 'num', fmt: '#,##0' },
    { name: "r8144", label: "R8144", len: 9, type: 'num', fmt: '#,##0' },
    { name: "r8146", label: "R8146", len: 6, type: 'num', fmt: '#,##0' },
    { name: "r8147", label: "R8147", len: 8, type: 'num', fmt: '#,##0' },
    { name: "r8159", label: "R8159", len: 8, type: 'num', fmt: '#,##0' },
    { name: "r8156", label: "R8156", len: 9, type: 'num', fmt: '#,##0' },
    { name: "r8148", label: "R8148", len: 9, type: 'num', fmt: '#,##0' },
    { name: "warning", label: "Warning", len: 8, type: 'num', fmt: '#,##0' },
    { name: "err", label: "Err", len: 8, type: 'num', fmt: '#,##0' },
    { name: "ref_r", label: "RefR", len: 12, type: 'num', fmt: '#,##0' },
    { name: "ref_l", label: "RefL", len: 12, type: 'num', fmt: '#,##0' },
    { name: "gain_no", label: "GainNo", len: 7, type: 'code' },
    { name: "r8163", label: "R8163", len: 6, type: 'num', fmt: '#,##0' }
  ]
});
