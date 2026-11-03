// br_laser_length.js — 数据浏览器·长度数据（画像源 db_laser_tables.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load('D:/fineagent/lib/browser.js');

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_长度数据'),
  title: '激光数据浏览器 · 长度数据 laser_length',
  table: 'laser_length',
  selfCpt: 'fineagent/激光数据浏览器_长度数据_api.cpt',
  modules: BROWSER.MODULES,
  dateCol: 'biz_date',
  timeCol: 'biz_time',
  filterCol: 'stage',
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
    { name: "file_key", len: 9, type: 'code' },
    { name: "row_number", len: 11, type: 'num', fmt: '#,##0' },
    { name: "stage", label: "Stage", len: 6, type: 'cent' },
    { name: "biz_date", label: "日期", len: 14 },
    { name: "biz_time", label: "时间", len: 10 },
    { name: "comp_points", label: "补偿点数", len: 9, type: 'num', fmt: '#,##0' },
    { name: "length_15", label: "长度(#15)", len: 11, type: 'num', fmt: '#,##0.0000' },
    { name: "length_16", label: "长度(#16)", len: 11, type: 'num', fmt: '#,##0.0000' },
    { name: "length_17", label: "长度(#17)", len: 11, type: 'num', fmt: '#,##0.0000' },
    { name: "length_18", label: "长度(#18)", len: 11, type: 'num', fmt: '#,##0.0000' },
    { name: "length_19", label: "长度(#19)", len: 11, type: 'num', fmt: '#,##0.0000' },
    { name: "length_20", label: "长度(#20)", len: 11, type: 'num', fmt: '#,##0.0000' },
    { name: "error_msg", label: "错误内容", len: 9, type: 'cent' },
    { name: "length_max_err", label: "长度最大误差", len: 14, type: 'num', fmt: '#,##0.0000' },
    { name: "stretch_rate_min", label: "伸缩率最小值", len: 14, type: 'num', fmt: '#,##0.0000000' },
    { name: "stretch_rate_max", label: "伸缩率最大值", len: 14, type: 'num', fmt: '#,##0.0000000' }
  ]
});
