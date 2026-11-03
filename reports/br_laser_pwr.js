// br_laser_pwr.js — 数据浏览器·功率计（画像源 db_laser_tables.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load('D:/fineagent/lib/browser.js');

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_功率计'),
  title: '激光数据浏览器 · 功率计 laser_pwr',
  table: 'laser_pwr',
  selfCpt: 'fineagent/激光数据浏览器_功率计_api.cpt',
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
    { name: "biz_date", label: "日期", len: 14 },
    { name: "biz_time", label: "时间", len: 10 },
    { name: "stage", label: "Stage", len: 6, type: 'cent' },
    { name: "cond_no", label: "条件编号", len: 9, type: 'code' },
    { name: "output_power", label: "输出功率", len: 9, type: 'num', fmt: '#,##0' },
    { name: "frequency", label: "频率", len: 8, type: 'num', fmt: '#,##0' },
    { name: "on_time", label: "ON时间", len: 7, type: 'num', fmt: '#,##0.0' },
    { name: "base_energy", label: "基准能量", len: 9, type: 'num', fmt: '#,##0.000' },
    { name: "judgement", label: "判断", len: 5 },
    { name: "measured_energy", label: "测量能量", len: 9, type: 'num', fmt: '#,##0.000' },
    { name: "tolerance", label: "容许范围", len: 9, type: 'num', fmt: '#,##0.00' },
    { name: "collimator_no", label: "准直NO.", len: 8, type: 'code' },
    { name: "base_rate", label: "基准倍率", len: 9, type: 'num', fmt: '#,##0.0' },
    { name: "cur_rate", label: "当前倍率", len: 9, type: 'num', fmt: '#,##0.0' },
    { name: "mask_no2", label: "光罩编号", len: 9, type: 'num', fmt: '#,##0' },
    { name: "gain", label: "增益", len: 6, type: 'num', fmt: '#,##0.0' },
    { name: "bias", label: "偏置", len: 6, type: 'num', fmt: '#,##0.0' },
    { name: "beam_on_time", label: "光束ON时间", len: 12, type: 'num', fmt: '#,##0' },
    { name: "blower_on_time", label: "鼓风机ON时间", len: 14, type: 'num', fmt: '#,##0' },
    { name: "ready_on_time", label: "准备ON时间", len: 12, type: 'num', fmt: '#,##0' },
    { name: "measured_freq", label: "测量频率", len: 9, type: 'num', fmt: '#,##0.000' },
    { name: "freq_limit", label: "上限频率", len: 12, type: 'num', fmt: '#,##0.000' },
    { name: "shot_group", label: "shot群数", len: 9, type: 'num', fmt: '#,##0' },
    { name: "display_freq", label: "显示测量频率", len: 14, type: 'num', fmt: '#,##0' },
    { name: "cond_file", label: "条件文件", len: 12, type: 'cent' },
    { name: "pulse_class", label: "脉级", len: 5, type: 'cent' }
  ]
});
