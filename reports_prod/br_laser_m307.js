// br_laser_m307.js — 数据浏览器·307机型（画像源 DB_LASER_TABLES_PROD.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load(Paths.feature('data_browser', 'browser.js'));

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_307机型'),
  title: '激光数据浏览器 · 307机型 laser_m307',
  table: 'laser_m307',
  selfCpt: 'fineagent/激光数据浏览器_307机型_api.cpt',
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
    { name: "biz_date", label: "日期", len: 14 },
    { name: "biz_time", label: "时间", len: 10 },
    { name: "output_power", label: "输出功率", len: 9, type: 'num', fmt: '#,##0' },
    { name: "frequency", label: "频率", len: 6, type: 'num', fmt: '#,##0' },
    { name: "on_time", label: "ON时间", len: 7, type: 'num', fmt: '#,##0.0' },
    { name: "measured_out", label: "测量输出", len: 9, type: 'num', fmt: '#,##0.0' },
    { name: "check_out", label: "检验输出", len: 9, type: 'num', fmt: '#,##0.0' },
    { name: "gain", label: "增益", len: 9, type: 'num', fmt: '#,##0' },
    { name: "bias", label: "偏置", len: 5, type: 'num', fmt: '#,##0' },
    { name: "beam_on_time", label: "光束ON时间", len: 12, type: 'num', fmt: '#,##0' },
    { name: "blower_on_time", label: "鼓风机ON时间", len: 14, type: 'num', fmt: '#,##0' },
    { name: "ready_on_time", label: "准备ON时间", len: 12, type: 'num', fmt: '#,##0' },
    { name: "judgement", label: "判断", len: 5, type: 'cent' }
  ]
});
