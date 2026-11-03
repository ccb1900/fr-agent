// probe_machine_sql.js — 静态验证机台列 SQL 组装（不连库）：打印 pagedSql / metaSql 两条
load('D:/fineagent/lib/browser.js');
var col = function (n, t) { return { name: n, type: t || null }; };
var aaa = {
  table: 'laser_aaa', dateCol: 'biz_date', timeCol: 'biz_time', filterCol: 'stage', sqlPaging: true,
  cols: [col('file_key'), col('row_number'), col('biz_date'), col('biz_time'), col('stage'), col('prog_path')]
};
var files = {
  table: 'laser_files', dateCol: 'collection_date', dateNative: true, sqlPaging: true,
  cols: [col('source_id'), col('collection_date'), col('path'), col('file_key')]
};
var bak = {
  table: 'laser_files_bak_20261020', dateCol: 'collection_date', dateNative: true, sqlPaging: true,
  cols: [col('source_id'), col('collection_date'), col('path'), col('name'), col('records'), col('header'), col('collected_at'), col('file_key')]
};
print('=== bak pagedSql ===');
print(BROWSER.pagedSql(bak));
print('=== aaa pagedSql ===');
print(BROWSER.pagedSql(aaa));
print('=== aaa metaSql ===');
print(BROWSER.metaSql(aaa));
print('=== files pagedSql ===');
print(BROWSER.pagedSql(files));
print('DONE');
