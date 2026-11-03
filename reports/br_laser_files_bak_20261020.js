// br_laser_files_bak_20261020.js — 数据浏览器·文件备份（画像源 db_laser_tables.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load(Paths.feature('data_browser', 'browser.js'));

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_文件备份'),
  title: '激光数据浏览器 · 文件备份 laser_files_bak_20261020',
  table: 'laser_files_bak_20261020',
  selfCpt: 'fineagent/激光数据浏览器_文件备份_api.cpt',
  modules: BROWSER.MODULES,
  dateCol: 'collection_date',
  dateNative: true,
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
    { name: "source_id", len: 23 },
    { name: "collection_date", len: 17 },
    { name: "file_id", len: 44 },
    { name: "path", len: 44 },
    { name: "name", len: 26 },
    { name: "records", len: 8, type: 'num', fmt: '#,##0' },
    { name: "header", len: 44 },
    { name: "collected_at", len: 34, type: 'num', fmt: '#,##0' },
    { name: "file_key", len: 9, type: 'code' }
  ]
});
