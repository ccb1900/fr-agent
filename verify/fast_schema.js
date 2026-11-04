// verify/fast_schema.js — I2 纯函数三件的离线契约测（无引擎、不连库，喂合成 DatabaseMetaData 行对象）
//   行形态取自 W0 一手 truth（data/schema_probe_truth.txt）：bigint DATA_TYPE=-5/COLUMN_SIZE=19、nvarchar=-9/4000、
//   IS_NULLABLE YES/NO、NULLABLE 0/1；FK=0 的演示库现实由 fkRows=[] 复现。
//   跑法同 fast 层：纯 nashorn.jar（不加载 semantic/schema/inspector.js——那是唯一触库薄壳，离线门不碰）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function src(f) { return String(new (J('java.lang.String'))(Files.readAllBytes(P.get(ROOT + '/' + f)), 'UTF-8')); }
function threw(fn) { try { fn(); return false; } catch (e) { return true; } }

['semantic/schema/metadata.js', 'semantic/schema/relation.js', 'semantic/schema/serializer.js'].forEach(function (f) {
  var ok = true; try { new Function(src(f)); } catch (e) { ok = false; print('PARSE ' + f + ' -> ' + e); }
  check('PARSE ' + f, ok);
});
load(ROOT + '/semantic/schema/metadata.js');
load(ROOT + '/semantic/schema/relation.js');
load(ROOT + '/semantic/schema/serializer.js');

function shapeOk(errs) { return errs.every(function (e) { return e && typeof e.code === 'string' && typeof e.path === 'string' && typeof e.message === 'string'; }); }

// ===== metadata：列归一（对拍 W0 真实行） =====
var bigRow = { COLUMN_NAME: 'file_key', DATA_TYPE: -5, TYPE_NAME: 'bigint', COLUMN_SIZE: 19, DECIMAL_DIGITS: 0, NULLABLE: 0, IS_NULLABLE: 'NO', ORDINAL_POSITION: 1, COLUMN_DEF: null };
var nvRow = { COLUMN_NAME: 'biz_date', DATA_TYPE: -9, TYPE_NAME: 'nvarchar', COLUMN_SIZE: 4000, DECIMAL_DIGITS: null, NULLABLE: 1, IS_NULLABLE: 'YES', ORDINAL_POSITION: 3, COLUMN_DEF: null };
var errs = [];
var c1 = SchemaMeta.normalizeColumn(bigRow, 'columns[0]', errs);
var c2 = SchemaMeta.normalizeColumn(nvRow, 'columns[1]', errs);
check('bigint 列归一 jdbcType=-5/length=19/nullable=false', c1 && c1.jdbcType === -5 && c1.length === 19 && c1.nullable === false && c1.typeName === 'bigint');
check('nvarchar 列归一 jdbcType=-9/length=4000/nullable=true', c2 && c2.jdbcType === -9 && c2.length === 4000 && c2.nullable === true);
check('COLUMN_DEF=null 归 null 不折字符串', c1 && c1.defaultValue === null);
check('合法列零误报', errs.length === 0);
// 脏行：缺 COLUMN_NAME / DATA_TYPE 非数 → 产诊断不抛，且错误是 {code,path,message}
var badErrs = [];
var none = SchemaMeta.normalizeColumn({ DATA_TYPE: 12 }, 'columns[0]', badErrs);
SchemaMeta.normalizeColumn({ COLUMN_NAME: 'x', DATA_TYPE: 'notnum' }, 'columns[1]', badErrs);
check('脏列不抛且返回 null', none === null);
check('脏列产 REQUIRED + INVALID_NUMBER', badErrs.some(function (e) { return e.code === 'REQUIRED'; }) && badErrs.some(function (e) { return e.code === 'INVALID_NUMBER'; }));
check('metadata 错误结构契约 {code,path,message}', shapeOk(badErrs));
// 排序按 ordinal（逆序输入）
var sErrs = [];
var sorted = SchemaMeta.normalizeColumns([nvRow, bigRow], 'columns', sErrs);
check('normalizeColumns 按 ordinal 升序', sorted.length === 2 && sorted[0].name === 'file_key' && sorted[1].name === 'biz_date');
// PK 列按 KEY_SEQ
var pk = SchemaMeta.primaryKeyColumns([
  { TABLE_NAME: 'laser_aaa', COLUMN_NAME: 'row_number', KEY_SEQ: 2, PK_NAME: null },
  { TABLE_NAME: 'laser_aaa', COLUMN_NAME: 'file_key', KEY_SEQ: 1, PK_NAME: null }
], 'laser_aaa', 'pk', []);
check('primaryKeyColumns 按 KEY_SEQ 有序 (file_key,row_number)', pk.length === 2 && pk[0].column === 'file_key' && pk[1].column === 'row_number');

// ===== relation：三分桶 =====
var tA = { name: 'laser_aaa', columns: [{ name: 'file_key' }, { name: 'score' }], primaryKey: [{ column: 'file_key', seq: 1 }] };
var tFiles = { name: 'laser_files', columns: [{ name: 'file_key' }, { name: 'source_id' }] };
var st = SchemaRelation.bucketStructural([tA]);
check('structural 桶收 PK 事实', st.length === 1 && st[0].kind === 'PRIMARY_KEY' && st[0].columns[0] === 'file_key');
// FK 桶：完整两端进、缺列不进
var fk = SchemaRelation.bucketFk([
  { FKTABLE_NAME: 'a', FKCOLUMN_NAME: 'x', PKTABLE_NAME: 'b', PKCOLUMN_NAME: 'y', FK_NAME: 'fk1' },
  { FKTABLE_NAME: 'a', FKCOLUMN_NAME: 'x' }  // 缺引用端 → 必须被拒（非法态写不出来）
]);
check('FK 桶完整行入、残缺行拒', fk.length === 1 && fk[0].to === 'b' && fk[0].toColumn === 'y');
check('FK 空库→空桶（W0 演示库现状）', SchemaRelation.bucketFk([]).length === 0);
// 命名推导桶：file_key 跨表 → 候选、requires_confirmation、绝不进 structural/fk
var hints = SchemaRelation.bucketNaming([tA, tFiles]);
check('命名推导 file_key→laser_files 候选', hints.some(function (h) { return h.column === 'file_key' && h.candidates.indexOf('laser_files') >= 0 && h.requires_confirmation === true; }));
check('命名推导永不进 structural', st.every(function (x) { return x.kind !== 'NAMING'; }));

// ===== serializer：确定序 + 凭据自检 =====
var input = {
  source: 'atom_live_demo', dialect: { product: 'SQL Server', driver: '9.4.1' }, capturedAt: null,
  tables: [tA, tFiles], relations: { structural: st, fk: [], unconfirmedNaming: hints }
};
var d1 = SchemaSerializer.assemble(input), d2 = SchemaSerializer.assemble(input);
check('assemble 表按名排序 (laser_aaa<laser_files)', d1.tables[0].name === 'laser_aaa' && d1.tables[1].name === 'laser_files');
check('assemble 确定序（两次 stringify 全等）', JSON.stringify(d1) === JSON.stringify(d2));
check('三桶结构齐备', d1.relations && d1.relations.structural && Array.isArray(d1.relations.fk) && Array.isArray(d1.relations.unconfirmedNaming));
check('clean doc toJson 不抛', threw(function () { SchemaSerializer.toJson(SchemaSerializer.assemble(input)); }) === false);
// 凭据泄漏必须被自检拦下（toJson 抛、assertClean 命中）
check('assertClean 抓 source 里的连接串', SchemaSerializer.assertClean({ source: 'jdbc:sqlserver://x;user=sa' }).length > 0);
check('assertClean 抓嵌套 password 值', SchemaSerializer.assertClean({ tables: [{ name: 't', columns: [{ name: 'password' }] }] }).length > 0);
check('toJson 遇脏 doc 抛（拒绝落盘）', threw(function () { SchemaSerializer.toJson({ source: 'x', url: 'jdbc:sqlserver://y' }); }));

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
