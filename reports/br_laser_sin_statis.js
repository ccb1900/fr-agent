// br_laser_sin_statis.js — 数据浏览器·正弦统计（画像源 db_laser_tables.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load('D:/fineagent/lib/browser.js');

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_正弦统计'),
  title: '激光数据浏览器 · 正弦统计 laser_sin_statis',
  table: 'laser_sin_statis',
  selfCpt: 'fineagent/激光数据浏览器_正弦统计_api.cpt',
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
    { name: "manage_no", label: "管理No.", len: 13 },
    { name: "stretch_max_x", label: "伸缩最大(X)", len: 13, type: 'num', fmt: '#,##0.0000000' },
    { name: "stretch_min_x", label: "伸缩最小(X)", len: 13, type: 'num', fmt: '#,##0.0000000' },
    { name: "stretch_avg_x", label: "伸缩平均(X)", len: 13, type: 'num', fmt: '#,##0.0000000' },
    { name: "stretch_std_x", label: "伸缩标准偏差(X)", len: 17, type: 'num', fmt: '#,##0.0000000' },
    { name: "stretch_max_y", label: "伸缩最大(Y)", len: 13, type: 'num', fmt: '#,##0.0000000' },
    { name: "stretch_min_y", label: "伸缩最小(Y)", len: 13, type: 'num', fmt: '#,##0.0000000' },
    { name: "stretch_avg_y", label: "伸缩平均(Y)", len: 13, type: 'num', fmt: '#,##0.0000000' },
    { name: "stretch_std_y", label: "伸缩标准偏差(Y)", len: 17, type: 'num', fmt: '#,##0.0000000' },
    { name: "main_prog_no", label: "主程序的程序编号", len: 42 },
    { name: "cond_file", label: "条件文件", len: 14 },
    { name: "offset_max_x", label: "偏置最大(X)", len: 13, type: 'num', fmt: '#,##0.0' },
    { name: "offset_min_x", label: "偏置最小(X)", len: 13, type: 'num', fmt: '#,##0.0' },
    { name: "offset_avg_x", label: "偏置平均(X)", len: 13, type: 'num', fmt: '#,##0.0000' },
    { name: "offset_std_x", label: "偏置标准偏差(X)", len: 17, type: 'num', fmt: '#,##0.0000' },
    { name: "offset_max_y", label: "偏置最大(Y)", len: 13, type: 'num', fmt: '#,##0.0' },
    { name: "offset_min_y", label: "偏置最小(Y)", len: 13, type: 'num', fmt: '#,##0.0' },
    { name: "offset_avg_y", label: "偏置平均(Y)", len: 13, type: 'num', fmt: '#,##0.0000' },
    { name: "offset_std_y", label: "偏置标准偏差(Y)", len: 17, type: 'num', fmt: '#,##0.0000' },
    { name: "theta_max", label: "θ最大", len: 9, type: 'num', fmt: '#,##0.000' },
    { name: "theta_min", label: "θ最小", len: 9, type: 'num', fmt: '#,##0.000' },
    { name: "theta_avg", label: "θ平均", len: 9, type: 'num', fmt: '#,##0.000' },
    { name: "theta_std", label: "θ标准偏差", len: 10, type: 'num', fmt: '#,##0.000' },
    { name: "sheet_count", label: "加工张数", len: 9, type: 'num', fmt: '#,##0' }
  ]
});
