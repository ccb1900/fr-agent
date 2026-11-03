// br_laser_cnd_selct.js — 数据浏览器·条件选择（画像源 db_laser_tables.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load(Paths.feature('data_browser', 'browser.js'));

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_条件选择'),
  title: '激光数据浏览器 · 条件选择 laser_cnd_selct',
  table: 'laser_cnd_selct',
  selfCpt: 'fineagent/激光数据浏览器_条件选择_api.cpt',
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
    { name: "file_key", len: 9, type: 'code' },
    { name: "row_number", len: 11, type: 'num', fmt: '#,##0' },
    { name: "biz_date", label: "日期", len: 14 },
    { name: "biz_time", label: "时间", len: 10 },
    { name: "prog_path", label: "加工程序", len: 34, type: 'cent' },
    { name: "cond_file", label: "条件文件", len: 29, type: 'cent' },
    { name: "cond_no", label: "条件编号", len: 9, type: 'code' },
    { name: "output_power", label: "输出功率", len: 9, type: 'num', fmt: '#,##0' },
    { name: "frequency", label: "频率", len: 6, type: 'num', fmt: '#,##0' },
    { name: "pulse_width", label: "脉宽", len: 7, type: 'num', fmt: '#,##0.0' },
    { name: "pulse_class", label: "脉级", len: 5, type: 'cent' },
    { name: "speed", label: "速度", len: 9, type: 'num', fmt: '#,##0' },
    { name: "pulse_count", label: "脉冲数", len: 7, type: 'num', fmt: '#,##0' },
    { name: "mask_no2", label: "光罩编号", len: 9, type: 'num', fmt: '#,##0' },
    { name: "b_c", label: "B/C", len: 4, type: 'cent' },
    { name: "g", label: "G", len: 5, type: 'num', fmt: '#,##0' },
    { name: "collimator_no", label: "准直NO.", len: 8, type: 'code' },
    { name: "base_rate", label: "基准倍率", len: 9, type: 'num', fmt: '#,##0.0' },
    { name: "cur_rate", label: "当前倍率", len: 9, type: 'num', fmt: '#,##0.0' },
    { name: "base_energy", label: "基准能量", len: 9, type: 'num', fmt: '#,##0.000' },
    { name: "measured_freq", label: "测量频率", len: 9, type: 'num', fmt: '#,##0' },
    { name: "tolerance", label: "容许范围", len: 9, type: 'num', fmt: '#,##0.00' }
  ]
});
