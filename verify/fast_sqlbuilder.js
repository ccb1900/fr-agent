// verify/fast_sqlbuilder.js — I5 模型→SQL 生成器离线契约测（零引擎、零连库；喂真 model.json）
//   标尺=镜像 #52 agent_daily_report 的已验证 SQL 形态（TRY_CAST 归一、score IS NOT NULL 基筛、日期定字面 BETWEEN、GROUP BY、无 ${}），
//   且 ratio 派生指标绝不泄进 SQL（引擎无 SUMPRODUCT，比率在展示层公式）。受控：生成 SQL 必过单语句/无 ; 自检。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function src(f) { return String(new (J('java.lang.String'))(Files.readAllBytes(P.get(ROOT + '/' + f)), 'UTF-8')); }
function jt(f) { return JSON.parse(src(f)); }
function threw(fn) { try { fn(); return false; } catch (e) { return true; } }
check('PARSE semantic/query/sqlbuilder.js', (function () { try { new Function(src('semantic/query/sqlbuilder.js')); return true; } catch (e) { print('' + e); return false; } })());

load(ROOT + '/lib/isodate.js');
load(ROOT + '/semantic/model/vocab.js');   // sqlbuilder 引用 ModelVocab.JOIN_SAFE_CARDINALITY
load(ROOT + '/semantic/query/sqlbuilder.js');
var model = jt('models/production/model.json');
function codeAt(res, code, frag) { return (res.errors || []).some(function (e) { return e.code === code && String(e.path).indexOf(frag) >= 0; }); }

// 真值日报形状：按 bizDate 分组，planned/done base，completionRate derived，日期定字面
var sel = { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned', 'done', 'completionRate'], dateRange: { from: '2026-09-13', to: '2026-09-22' } };
var res = SqlBuilder.build(model, sel);
var sql = res.sql || '';
check('生成无错', (res.errors || []).length === 0 && !!res.sql);
check('SQL 含 COUNT(*) AS planned', /COUNT\(\*\) AS planned/.test(sql));
check('SQL 含 SUM(CASE WHEN TRY_CAST(score AS float) >= 0.9 …) AS done', /SUM\(CASE WHEN TRY_CAST\(score AS float\) >= 0\.9 THEN 1 ELSE 0 END\) AS done/.test(sql));
check('SQL 基筛 TRY_CAST(score AS float) IS NOT NULL', /TRY_CAST\(score AS float\) IS NOT NULL/.test(sql));
check('SQL 日期定字面 BETWEEN（禁 ${} 文本替换）', /TRY_CAST\(biz_date AS date\) BETWEEN '2026-09-13' AND '2026-09-22'/.test(sql) && sql.indexOf('${') < 0);
check('SQL GROUP BY 归一日期 + ORDER BY', /GROUP BY TRY_CAST\(biz_date AS date\)/.test(sql) && /ORDER BY 1$/.test(sql));
check('SQL 单语句无分号（受控）', sql.indexOf(';') < 0 && /^SELECT\b/.test(sql));
check('ratio 派生指标不泄进 SQL', sql.indexOf('completionRate') < 0 && sql.indexOf(' / ') < 0);
check('derived 规格含 completionRate→done/planned ×100', (function () {
  var d = (res.derived || []).filter(function (x) { return x.alias === 'completionRate'; })[0];
  return d && d.numerator === 'done' && d.denominator === 'planned' && d.scale === 100;
})());
check('baseAliases 列序 bizDate,planned,done', (function () {
  var a = (res.baseAliases || []).map(function (x) { return x.alias; }).join(',');
  return a === 'bizDate,planned,done';
})());

// 负项：追溯/口径闭合
check('未知指标→UNKNOWN_REF', codeAt(SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['ghostMetric'], dateRange: { from: '2026-09-13', to: '2026-09-22' } }), 'UNKNOWN_REF', 'metrics'));
check('未知实体→UNKNOWN_REF', codeAt(SqlBuilder.build(model, { entity: 'Nope', dimensions: ['bizDate'], metrics: ['planned'] }), 'UNKNOWN_REF', 'entity'));
check('坏日期格式→INVALID_TYPE（防注入）', codeAt(SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], dateRange: { from: "2026-9-13' --", to: '2026-09-22' } }), 'INVALID_TYPE', 'dateRange'));
check('ratio 分子未选→UNKNOWN_REF（口径闭合）', codeAt(SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned', 'completionRate'] }), 'UNKNOWN_REF', 'ratio'));
check('dateRange 无 date 维→INVALID_SHAPE', codeAt(SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: [], metrics: ['planned'], dateRange: { from: '2026-09-13', to: '2026-09-22' } }), 'INVALID_SHAPE', 'dateRange'));

// I5.1-P1 / I5.2：跨表度量仍拒；跨表维度经 confirmed 安全关系→INNER JOIN（fan-out 由基数守卫拦）
var xmet = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['fileCount'], dateRange: { from: '2026-09-13', to: '2026-09-22' } });
check('跨表度量(fileCount→laser_files)→仍拒（JOIN 不改度量 grain）', codeAt(xmet, 'UNSUPPORTED_CROSS_TABLE', 'metrics') && !xmet.sql);
var jdim = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['machine'], metrics: ['planned', 'done', 'completionRate'] });
var jsql = jdim.sql || '';
check('I5.2 跨表维度(machine)经 confirmed N:1 关系→INNER JOIN laser_files ON file_key',
  /INNER JOIN laser_files ON laser_aaa\.file_key = laser_files\.file_key/.test(jsql) && /laser_files\.source_id AS machine/.test(jsql) && !jdim.sql0 && (jdim.errors || []).length === 0);
check('I5.2 JOIN 查询度量列限定实体表(避歧义)', /TRY_CAST\(laser_aaa\.score AS float\)/.test(jsql) && /GROUP BY laser_files\.source_id/.test(jsql));
check('I5.2 单表查询不受影响（无 JOIN、列裸名）', (function () { var s = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned', 'done'], dateRange: { from: '2026-09-13', to: '2026-09-22' } }).sql || ''; return s.indexOf('JOIN') < 0 && /TRY_CAST\(score AS float\)/.test(s); })());
// fan-out 守卫：把 recordToFile 基数改成 1:N（非安全）→ machine 维应回退拒绝，不产放大 SQL
var fanModel = JSON.parse(JSON.stringify(model));
fanModel.relationships.forEach(function (r) { if (r.name === 'recordToFile') r.cardinality = '1:N'; });
var fanOut = SqlBuilder.build(fanModel, { entity: 'InspectionRecord', dimensions: ['machine'], metrics: ['planned'] });
check('I5.2 fan-out 守卫：非安全基数(1:N)→machine 仍拒、不产放大 SQL', codeAt(fanOut, 'UNSUPPORTED_CROSS_TABLE', 'dimensions') && !fanOut.sql);

// 纯函数/确定序/输入不可变/抗炸
// I5.1-P4 日期严格双边 + 日历有效性
var oneSided = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], dateRange: { from: '2026-09-13' } });
check('P4 单边 dateRange→拒', codeAt(oneSided, 'REQUIRED', 'dateRange') && !oneSided.sql);
var badCal = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], dateRange: { from: '2026-99-99', to: '2026-09-22' } });
check('P4 假日期(2026-99-99)→拒', codeAt(badCal, 'INVALID_TYPE', 'dateRange') && !badCal.sql);
var revDate = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], dateRange: { from: '2026-09-22', to: '2026-09-13' } });
check('P4 from>to→拒', !revDate.sql && (revDate.errors || []).some(function (e) { return e.code === 'INVALID_SHAPE'; }));
check('P4 同表正常查询仍过（跨表闸不误伤）', (SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate', 'stage'], metrics: ['planned', 'done', 'completionRate'], dateRange: { from: '2026-09-13', to: '2026-09-22' } }).sql || '').indexOf('FROM laser_aaa') >= 0);

// I5.3-A sort + topN
var srt = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['machine'], metrics: ['planned', 'done'], sort: [{ field: 'done', dir: 'desc' }] });
check('I5.3-A sort→ORDER BY 别名 DESC + JOIN 保留', /ORDER BY done DESC$/.test(srt.sql || '') && /INNER JOIN laser_files/.test(srt.sql || ''));
var sDeriv = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned', 'done', 'completionRate'], sort: [{ field: 'completionRate' }] });
check('I5.3-A 按派生比率排序→拒（不在 SQL）', codeAt(sDeriv, 'UNKNOWN_REF', 'sort'));
var sBadDir = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], sort: [{ field: 'planned', dir: 'sideways' }] });
check('I5.3-A 坏 sort.dir→INVALID_ENUM', codeAt(sBadDir, 'INVALID_ENUM', 'sort'));
var tp = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['machine'], metrics: ['planned'], sort: [{ field: 'planned', dir: 'desc' }], topN: { n: 10 } });
check('I5.3-A topN→SELECT TOP 10', /^SELECT TOP 10 /.test(tp.sql || '') && /ORDER BY planned DESC$/.test(tp.sql || ''));
check('I5.3-A topN 无 sort→INVALID_SHAPE', codeAt(SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['machine'], metrics: ['planned'], topN: { n: 10 } }), 'INVALID_SHAPE', 'topN'));
check('I5.3-A topN 非正整数→INVALID_NUMBER', codeAt(SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['machine'], metrics: ['planned'], sort: [{ field: 'planned' }], topN: { n: 0 } }), 'INVALID_NUMBER', 'topN'));

// I5.3-B 非日期 filters（受控字面量，注入面清零）
var fnum = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], filters: [{ field: 'score', op: '>=', value: 0.9 }] });
check('I5.3-B 数值列 filter→TRY_CAST 比较', /TRY_CAST\(score AS float\) >= 0\.9/.test(fnum.sql || '') && (fnum.errors || []).length === 0);
var ftxt = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], filters: [{ field: 'stage', op: 'like', value: 'L' }] });
check('I5.3-B 文本列 like→LIKE %L%', /LIKE '%L%'/.test(ftxt.sql || ''));
var finj = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], filters: [{ field: 'stage', op: '=', value: "x'; DROP TABLE y;--" }] });
check('I5.3-B 注入串→INVALID_TYPE 拒、不产 SQL', codeAt(finj, 'INVALID_TYPE', 'filters') && !finj.sql);
var fbadnum = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], filters: [{ field: 'score', op: '>=', value: 'abc' }] });
check('I5.3-B 数值列非数值值→INVALID_NUMBER', codeAt(fbadnum, 'INVALID_NUMBER', 'filters'));
var fghost = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], filters: [{ field: 'ghost_col', op: '=', value: 1 }] });
check('I5.3-B 未知 filter 列→UNKNOWN_REF', codeAt(fghost, 'UNKNOWN_REF', 'filters'));
check('I5.3-B filter 生成 SQL 仍单语句无分号', (fnum.sql || '').indexOf(';') < 0);

// ===== I5.4 边界（r4 P2）：JOIN 顺序无关 / 跨表日期归属 / op×类型 / == 映射 =====
check('I5.4 JOIN 列限定与维度顺序无关', (function () {
  var a = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate', 'machine'], metrics: ['planned'] });
  var b = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['machine', 'bizDate'], metrics: ['planned'] });
  function allQualified(r) {
    var s = r.sql || '';
    return r.errors.length === 0 && /laser_aaa\.biz_date/.test(s) && /laser_files\.source_id/.test(s) &&
      !/(^|[, ])biz_date AS/.test(s) && !/(^|[, ])source_id AS/.test(s);
  }
  return allQualified(a) && allQualified(b);
})());
check('I5.4 == 语义相等映射为 SQL =', (function () {
  var r = SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], filters: [{ field: 'stage', op: '==', value: 'L' }] });
  return (r.sql || '').indexOf(" = 'L'") >= 0 && (r.sql || '').indexOf('==') < 0;
})());
check('I5.4 数值列 like→INVALID_ENUM 拒', codeAt(SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], filters: [{ field: 'score', op: 'like', value: '9' }] }), 'INVALID_ENUM', 'filters'));
check('I5.4 文本列非法 op(contains)→INVALID_ENUM 拒', codeAt(SqlBuilder.build(model, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], filters: [{ field: 'stage', op: 'contains', value: 'L' }] }), 'INVALID_ENUM', 'filters'));
check('I5.4 跨表日期维 WHERE 挂 refTable 而非主表', (function () {
  var m = JSON.parse(JSON.stringify(model));
  m.dimensions.forEach(function (d) { if (d.name === 'bizDate') { d.table = 'laser_files'; d.column = 'collection_date'; } });
  var r = SqlBuilder.build(m, { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'], dateRange: { from: '2026-09-13', to: '2026-09-22' } });
  return (r.sql || '').indexOf('TRY_CAST(laser_files.collection_date AS date) BETWEEN') >= 0 && (r.sql || '').indexOf('TRY_CAST(laser_aaa.collection_date') < 0;
})());

// 纯函数/确定序/输入不可变/抗炸
var snap = JSON.stringify(sel);
check('确定序（两次 SQL 全等）', SqlBuilder.build(model, sel).sql === SqlBuilder.build(model, sel).sql);
check('不改输入 sel', JSON.stringify(sel) === snap);
check('抗炸：垃圾输入不抛', threw(function () { SqlBuilder.build(null, null); SqlBuilder.build(42, {}); }) === false);

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
