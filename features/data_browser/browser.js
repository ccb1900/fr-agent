// lib/browser.js — 数据浏览器构造器 v3.7：多模块互跳 + 日期范围/工序筛选 + 每表自适应分页
//
// v3.7 重要翻新（真实预览事故复盘，README #36）：
//   上一版用"自造工具条 + ReportletHyperlink 自跳 + extendParameters"做翻页，设计器 数据分析预览 实测：
//   ①每点一次按钮发一次带全参的导航请求，请求头随导航膨胀，三四次后 Tomcat 报 400「请求头太大」（用户崩溃现场）；
//   ②页码参数在反复自跳中途失控（一下跳到末页）。自造工具条超链按钮整族拆除。
//   ③排序：FR 存 cpt 时会把 ORDER BY 里的 [] 标识符补别名导致排序失效（一手实证 probe_order），故
//     全序包进 ROW_NUMBER() OVER(...)（解析器不动它）出 _ord 列，外层 ORDER BY _ord 无标识符不被改写。
//
// 每表策略（行阈值 = 引擎 RelaxationRestrictionConfig.maxDSRowCount，本机默认 8 万）：
//   - 行数 < 阈值：不设 sqlPaging → FR 原生 Web 分页（wb.setReportWebAttr(WebPage(pageFixedRow,rowcount))，
//     预览用引擎自带「首页/上一页/下一页/末页」在视图内翻，不发起导航请求）。
//   - 超阈值大表：spec 给 sqlPaging:true → SQL 端 ROW_NUMBER 区间取当页，翻页收进参数面板
//     （page/size 可改 + 查询提交 = FR 原生同视图重算，无导航）；工具条只留 dsm 口径信息，零按钮。
//
// 已知边界（诚实记录）：FR 的 ${} 是文本替换不是绑定变量，参数里输入单引号会破坏 SQL——本模板面向内网运维自查，
// 若要对外必须改走 DBTableData 的 ? 绑定参数（引擎 v3.6 ppArray 通道已具备，待接）。
// 日期列画像：laser_* 的 biz_date 是 nvarchar 且同库存在 '2026/9/13' 与 '2026-09-13' 两种写法，TRY_CAST 归一。

var BROWSER = (function () {
  var LINE = -16777216;
  var DEEP = 'deep';
  var HEADBG = -263173;
  var BARBG = -855310;

  // 排版标准落地（TABLE_DESIGN_STANDARD.md，2026-10-26 用户下发）：
  //   ①表头与本列内容对齐一致——禁止"表头居中、内容左/右"混用；
  //   ②数字列同列唯一 Format（spec 给 fmt），编号列按文字列（type:'code'）绝不千分位；
  //   ③短且等长字段才允许居中（type:'cent'，R/L、S/R 型）；
  //   ④表格必须有内边框（用户 2026-10-27 口径）：横竖黑细线全保留，防粘边靠 padding 不靠拆线。
  function colAlign(c) { return c.type === 'num' ? 4 : (c.type === 'cent' ? 0 : 2); }
  function cellStyle(c) {
    var st = { align: colAlign(c), sizePt: 14, edges: { top: LINE, bottom: LINE, left: LINE, right: LINE } };
    if (c.type === 'num' && c.fmt) st.format = c.fmt;
    // 内边距：数列右留白、文字/居中列左留白（共享边两侧各让一点，杜绝"99000"式粘连）
    if (c.type === 'num') st.padR = 8; else st.padL = 10;
    return st;
  }
  function headStyle(c) {
    // 表头 padding 要小（4）：标准要求"表头超长自动换行"，padding 太大会把列名挤成一列竖排
    return { bold: true, align: colAlign(c), sizePt: 14, bg: HEADBG, edges: { top: DEEP, bottom: DEEP, left: LINE, right: LINE }, padL: 4, padR: 4 };
  }
  function barCell(current) {
    return { bold: !!current, align: 0, sizePt: 14, bg: current ? BARBG : null, border: LINE,
      edges: { top: DEEP, bottom: DEEP, left: DEEP, right: DEEP } };
  }

  // 日期列 → yyyymmdd 整数规范形（2026-10-28 4936 三连后的终局方案）：
  //   TRY_CAST 非确定性拒；TRY_CONVERT(style) 演示库可过、生产仍拒；CONVERT(style) 生产也拒（段0 实机 4936）。
  //   → 彻底不用任何 date 函数，只用 LEN/LIKE/SUBSTRING/CAST(int)/字符串+：全版本确定性的最小集。
  //   四形态守卫（探针 probe_dateshape2 实证：长度 8~10、分隔符 - 或 /、月日单双位、零怪字符），
  //   产出旁到了的 yyyymmdd 整数（同理于按日序）。NULL/怪形态 → NULL（等价 TRY 语义）。
  //   全库 22 表对拍 TRY_CAST(date)→yyyymmdd 零差异（probe_exp4.js）。
  //   ★ 查询表达式必须与生产计算列 *_d 定义逐字一致（优化器表达式匹配 → INDEX SEEK）。
  function dateExpr(col, pfx) {
    var c = (pfx || '') + '[' + col + ']';
    var pat = function (p) { return c + " LIKE '" + p + "'"; };
    var mon = function (pos, len) { return "CAST(SUBSTRING(" + c + "," + pos + "," + len + ") AS int) BETWEEN 1 AND 12"; };
    var day = function (pos, len) { return "CAST(SUBSTRING(" + c + "," + pos + "," + len + ") AS int) BETWEEN 1 AND 31"; };
    return "CASE " +
      "WHEN LEN(" + c + ")=10 AND " + pat('[0-9][0-9][0-9][0-9][-/][0-9][0-9][-/][0-9][0-9]') + " AND " + mon(6, 2) + " AND " + day(9, 2) +
        " THEN CAST(SUBSTRING(" + c + ",1,4)+SUBSTRING(" + c + ",6,2)+SUBSTRING(" + c + ",9,2) AS int) " +
      "WHEN LEN(" + c + ")=9 AND " + pat('[0-9][0-9][0-9][0-9][-/][0-9][-/][0-9][0-9]') + " AND " + mon(6, 1) + " AND " + day(8, 2) +
        " THEN CAST(SUBSTRING(" + c + ",1,4)+'0'+SUBSTRING(" + c + ",6,1)+SUBSTRING(" + c + ",8,2) AS int) " +
      "WHEN LEN(" + c + ")=9 AND " + pat('[0-9][0-9][0-9][0-9][-/][0-9][0-9][-/][0-9]') + " AND " + mon(6, 2) + " AND " + day(9, 1) +
        " THEN CAST(SUBSTRING(" + c + ",1,4)+SUBSTRING(" + c + ",6,2)+'0'+SUBSTRING(" + c + ",9,1) AS int) " +
      "WHEN LEN(" + c + ")=8 AND " + pat('[0-9][0-9][0-9][0-9][-/][0-9][-/][0-9]') + " AND " + mon(6, 1) + " AND " + day(8, 1) +
        " THEN CAST(SUBSTRING(" + c + ",1,4)+'0'+SUBSTRING(" + c + ",6,1)+'0'+SUBSTRING(" + c + ",8,1) AS int) " +
      "END";
  }

  // 日期列取值表达式：原生 date/datetime 列直接用列本身；字符串列走确定性 dateExpr。
  // cfg.dateNative 由生成器按画像 dtype 打标（laser_files.collection_date = date 原始型）。
  function dExprOf(cfg) {
    // 只有与 files 撞名的日期列（如备份表 collection_date）才加 T. 前缀；
    // 其它（biz_date/Date）保持无限定文本，确保与生产计算列定义逐字一致（SEEK 表达式匹配）
    var pfx = (showMachine(cfg) && FILES_COLS[cfg.dateCol]) ? 'T.' : '';
    if (cfg.dateNative) return pfx + '[' + cfg.dateCol + ']';
    return dateExpr(cfg.dateCol, pfx);
  }

  // 2026-10-29 用户口径定案：字符串日期列**直接建索引**，日期窗在查询侧展开成字符串清单。
  //   病根回顾：'2026-9-13' 不补零 → 字符串序跨月不可比（'2026-10-13' < '2026-9-13'），故不能 BETWEEN/>=；
  //   也不能靠计算列（TRY_CAST/TRY_CONVERT 被版本判非确定性，生产 4936 实证）。
  //   正解：每天展开 4 种写法（- 或 / × 补零/不补零）做等值 join，全部是索引 seek；
  //   排序用展开序号 P.n（true 日期序），查询里零日期转换。
  //   实证 probe_stridx：展开命中 64062 = 旧 TRY_CAST 范围 64062；NVARCHAR(4000) 可建索引。
  function usePats(cfg) { return !!cfg.dateCol && !cfg.dateNative; }
  function patsCte(cfg) {
    if (!usePats(cfg)) return '';
    return "WITH days AS (" +
      " SELECT 0 AS n, COALESCE(TRY_CAST('${d1}' AS date), DATEADD(day, -6, CONVERT(date, GETDATE()))) AS d," +
      " COALESCE(TRY_CAST('${d2}' AS date), CONVERT(date, GETDATE())) AS d2" +
      " UNION ALL SELECT n + 1, DATEADD(day, 1, d), d2 FROM days WHERE d < d2" +
      "), pats AS (" +
      " SELECT DISTINCT n, p FROM (" +
      "  SELECT n, CONVERT(varchar(10), d, 23) AS p FROM days" +
      "  UNION ALL SELECT n, REPLACE(CONVERT(varchar(10), d, 23), '-', '/') FROM days" +
      "  UNION ALL SELECT n, CAST(YEAR(d) AS varchar(4)) + '-' + CAST(MONTH(d) AS varchar(2)) + '-' + CAST(DAY(d) AS varchar(2)) FROM days" +
      "  UNION ALL SELECT n, CAST(YEAR(d) AS varchar(4)) + '/' + CAST(MONTH(d) AS varchar(2)) + '/' + CAST(DAY(d) AS varchar(2)) FROM days" +
      " ) x" +
      ") ";
  }
  var sqlTail = function (cfg) { return usePats(cfg) ? ' OPTION (MAXRECURSION 0)' : ''; };

  function whereClause(cfg) {
    // 无 dateCol 表（pwrmulti 类参数表）：日期筛缺席，`1=1` 顶住 WHERE 起头（machineClause/stage 皆以 AND 续）；
    // 2026-10-28 复现实证：空表分支直接回 machineClause → FROM [...] AND ... 语法错（Incorrect syntax near 'AND'）
    if (!cfg.dateCol) return { dc: null, where: ' WHERE 1 = 1' + machineClause(cfg) };
    // 字符串日期列（biz_date/Date）：过滤由 INNER JOIN pats 完成（等值 seek），这里只剩机台/stage
    if (usePats(cfg)) {
      var wp = ' WHERE 1 = 1' + machineClause(cfg);
      if (cfg.filterCol) wp += " AND ('${stage}' = '' OR " + colRef(cfg, cfg.filterCol) + " = '${stage}')";
      return { dc: null, where: wp };
    }
    var d = cfg.dateCol, dc = dExprOf(cfg);
    // 日期界（参数侧，不受确定性限制）：公式字面 '=TODAY()-6' 直接塞进 SQL 时转换失败 → COALESCE 兜底回落
    // GETDATE() 最近 7 天（2026-10-28 首屏直出实证：空参/公式串/真日期三景全免疫）。
    //   字符串日期列（yyyymmdd 整数规范形）→ 参数同变换成整数界；原生 date 列（files）→ 直接日期界。
    var lo, hi;
    if (cfg.dateNative) {
      lo = "COALESCE(TRY_CAST('${d1}' AS date), DATEADD(day, -6, CONVERT(date, GETDATE())))";
      hi = "COALESCE(TRY_CAST('${d2}' AS date), CONVERT(date, GETDATE()))";
    } else {
      lo = "COALESCE(TRY_CAST(REPLACE('${d1}','-','') AS int), CAST(CONVERT(char(8), DATEADD(day, -6, GETDATE()), 112) AS int))";
      hi = "COALESCE(TRY_CAST(REPLACE('${d2}','-','') AS int), CAST(CONVERT(char(8), GETDATE(), 112) AS int))";
    }
    var w = ' WHERE ' + dc + ' >= ' + lo +
      ' AND ' + dc + ' <= ' + hi + machineClause(cfg);
    if (cfg.filterCol) {
      w += " AND ('${stage}' = '' OR " + colRef(cfg, cfg.filterCol) + " = '${stage}')";
    }
    return { dc: dc, where: w };
  }

  // #1 机台筛选（2026-10-28 用户口径）：机台 = laser_files.source_id 前缀模糊（'1#' 输入 → like '1#%'），
  // 空串 = 全部机台。#3 关联落地：普通数据表经 file_key 关联 laser_files 取 source_id；
  // files 表自身直接按 source_id 过滤。${machine} 文本替换不转义（内网自查口径，AGENTS §3）。
  // 默认全开（laser 全表皆有 file_key，files 键序表已移出导航）；个别无关联的表 spec 里 machine:false 关闭。
  function machineClause(cfg) {
    if (cfg.machine === false) return '';
    if (cfg.table === 'laser_files') {
      return " AND ('${machine}' = '' OR [source_id] LIKE '${machine}%')";
    }
    if (showMachine(cfg)) {
      // 已 LEFT JOIN files 取机台列 → 直接过滤 LF，免去重复子查询
      return " AND ('${machine}' = '' OR LF.[source_id] LIKE '${machine}%')";
    }
    return " AND ('${machine}' = '' OR [file_key] IN (SELECT [file_key] FROM [" +
      TPFX + "laser_files] WHERE [source_id] LIKE '${machine}%'))";
  }

  // 排序尾部键（日期之后）：时间 + 通用键名列。返回「名字」列表，供内层（带 T. 前缀）与外层（M.）复用。
  function tieNames(cfg) {
    var names = [];
    if (cfg.timeCol) names.push(cfg.timeCol);
    var pool = (cfg.sortKeys && cfg.sortKeys.length)
      ? cfg.sortKeys
      : (cfg.cols || []).filter(function (c) { return /(^file_key$|_no$|_seq$|row_number$|_key$|_code$|_id$)/i.test(c.name); })
          .map(function (c) { return c.name; });
    pool.forEach(function (n) {
      var nm = String(n).replace(/^\[|\]$/g, '');
      if (names.indexOf(nm) < 0) names.push(nm);
    });
    return names;
  }

  function orderKeys(cfg) {
    if (!cfg.dateCol) return '(SELECT NULL)';           // 无日期列表：ROW_NUMBER 任意稳定序
    var k = [usePats(cfg) ? 'P.n' : dExprOf(cfg)];   // 字符串日期: 展开清单的日序；原生 date: 裸列
    // 排序键通用化（2026-10-27 全库扩容）：spec 可给 sortKeys；缺省自动挑键名列（file_key/row_number/_no/_seq 等），
    // 只在键名列存在时加入；一颗键都没有就落 (SELECT NULL) 任意稳定序
    var names = tieNames(cfg);
    names.forEach(function (n) { k.push(colRef(cfg, n)); });
    if (k.length === 1) k.push('(SELECT NULL)');
    return k.join(', ');
  }

  // 2026-10-27 表名前缀单点：生产库表带前缀（演示库裸 laser_*），部署换前缀只动这一个 env（BR_TPFX），
  // 26 张 spec/注册表字节零改动；默认 '' = 演示库现状。
  // 2026-10-28 连接名单点（BR_CONN，默认 ATOM_LIVE）：数据连接一切的物理定义在 FR 服务器端的「数据连接管理」，
  //   cpt 只存连接名——换库/换机/换账号 = 服务器端改连接定义即可，cpt 零改动；若连名字都想换，构建时给 BR_CONN。
  var TPFX = function () { return env('BR_TPFX', ''); }();
  var CONN = function () { return env('BR_CONN', 'ATOM_LIVE'); }();
  function tq(cfg) { return '[' + TPFX + cfg.table + ']'; }

  // 2026-10-28 用户口径：每张数据表增加「机台」列（来源 laser_files.source_id，经 file_key 关联）。
  //   files 表自身的 source_id 就是机台列，不重复加；cfg.machineCol=false 可单表关闭显示（筛选不受影响）。
  //   join 时基表别名 T、files 别名 LF——file_key 两表同名，所有 file_key 引用必须走 T./LF. 消歧。
  function showMachine(cfg) {
    return cfg.machine !== false && cfg.machineCol !== false && cfg.table !== 'laser_files';
  }
  // files 侧列名集合（join 消歧用）：右表存在这些同名列时，基表侧引用必须加 T. 前缀，
  // 否则 SQL 报 ambiguous column（files_bak_20261020 与 files 整表同列名，实证需求）。
  var FILES_COLS = { source_id: 1, collection_date: 1, file_id: 1, path: 1, name: 1, records: 1, header: 1, collected_at: 1, file_key: 1 };
  function colRef(cfg, name) {
    return (showMachine(cfg) && FILES_COLS[name]) ? 'T.[' + name + ']' : '[' + name + ']';
  }
  function fromClause(cfg) {
    // 基表别名 T：日期展开 join 或机台 join 任一存在就需要
    var base = tq(cfg) + ((usePats(cfg) || showMachine(cfg)) ? ' T' : '');
    if (usePats(cfg)) base += ' INNER JOIN pats P ON P.p = T.[' + cfg.dateCol + ']';   // 日期窗=展开清单等值 seek
    if (showMachine(cfg)) base += ' LEFT JOIN [' + TPFX + 'laser_files] LF ON LF.[file_key] = T.[file_key]';
    return base;
  }
  // 内层（基表作用域）与外层（派生表作用域）的列清单分开：机台列内层来自 LF，外层直接引用别名
  function innerCols(cfg) {
    var mach = showMachine(cfg) ? 'LF.[source_id] AS machine_name, ' : '';
    return mach + cfg.cols.map(function (c) { return colRef(cfg, c.name); }).join(', ');
  }
  function outerCols(cfg) {
    var mach = showMachine(cfg) ? 'machine_name, ' : '';
    return mach + cfg.cols.map(function (c) { return '[' + c.name + ']'; }).join(', ');
  }

  function ordSubquery(cfg) {
    var w = whereClause(cfg);
    return 'SELECT ' + innerCols(cfg) + ', ROW_NUMBER() OVER (ORDER BY ' + orderKeys(cfg) + ') AS _ord' +
      ' FROM ' + fromClause(cfg) + w.where;
  }

  // 原生分页用：全量行集 + _ord + 外层 ORDER BY _ord（无 [] 标识符，别名改写器不碰）
  function fullSql(cfg) {
    return patsCte(cfg) + 'SELECT ' + outerCols(cfg) + ', _ord FROM (' + ordSubquery(cfg) + ') PGT ORDER BY _ord' + sqlTail(cfg);
  }

  function pageExpr() { return '(TRY_CAST(${page} AS int) - 1) * TRY_CAST(${size} AS int)'; }

  // 大表专用：SQL 端区间取当页。
  // 2026-10-29 性能定案（生产实测：10s；A 分页 10s / B 计数秒出 / C TOP 也 10s）——
  //   病根=跨天合并排序迫使全窗口读+排；对策=按天各取前 page*size 行（CROSS APPLY + TOP），
  //   凑够当页即停，读行数从「整窗口」降到「天×页×每 format」。逐行对拍一致（第1/2/3页 + 机台过滤）。
  function pagedSql(cfg) {
    if (!usePats(cfg)) {
      return 'SELECT ' + outerCols(cfg) + ', _ord FROM (' + ordSubquery(cfg) + ') PGT' +
        ' WHERE _ord > ' + pageExpr() +
        ' AND _ord <= TRY_CAST(${page} AS int) * TRY_CAST(${size} AS int)' +
        ' ORDER BY _ord' + sqlTail(cfg);
    }
    var take = 'TRY_CAST(${page} AS int) * TRY_CAST(${size} AS int)';
    // 内层「每天取前 N」的排序键必须与复合索引键序一致（时间,file_key,row_number），否则 SQL Server
    // 会对当天全部行做 Sort 再取 TOP——生产每天行数大时就是那 10 秒（2026-10-29 现场：索引正确但仍 10s）。
    // 完整平局键（程序号等）只用在合并后的少量行上（外层 ROW_NUMBER），不再拖累早停。
    var dayOrder = [];
    if (cfg.timeCol) dayOrder.push(cfg.timeCol);
    dayOrder.push('file_key');
    var hasRowNoCol = false;
    (cfg.cols || []).forEach(function (c) { if (c.name === 'row_number') hasRowNoCol = true; });
    if (hasRowNoCol) dayOrder.push('row_number');
    var tn = tieNames(cfg);
    var innerTie = dayOrder.map(function (n) { return colRef(cfg, n); }).join(', ');
    var outerTie = tn.map(function (n) { return 'M.[' + n + ']'; }).join(', ');
    var machSel = showMachine(cfg) ? 'LF.[source_id] AS machine_name, ' : '';
    var innerColsSel = machSel + cfg.cols.map(function (c) { return colRef(cfg, c.name); }).join(', ') + ', P.n AS n';
    var inner = 'SELECT TOP (' + take + ') ' + innerColsSel +
      ' FROM ' + tq(cfg) + ' T' +
      (showMachine(cfg) ? ' LEFT JOIN [' + TPFX + 'laser_files] LF ON LF.[file_key] = T.[file_key]' : '') +
      ' WHERE T.[' + cfg.dateCol + '] = P.p' + machineClause(cfg) +
      (cfg.filterCol ? " AND ('${stage}' = '' OR " + colRef(cfg, cfg.filterCol) + " = '${stage}')" : '') +
      ' ORDER BY ' + (innerTie || '(SELECT NULL)');
    var mid = 'SELECT M.*, ROW_NUMBER() OVER (ORDER BY M.n' + (outerTie ? ', ' + outerTie : '') + ') AS _ord' +
      ' FROM ( SELECT M0.* FROM pats P CROSS APPLY ( ' + inner + ' ) M0 ) M';
    return patsCte(cfg) + 'SELECT ' + outerCols(cfg) + ', _ord FROM (' + mid + ') PGT' +
      ' WHERE _ord > ' + pageExpr() +
      ' AND _ord <= ' + take +
      ' ORDER BY _ord' + sqlTail(cfg);
  }

  // 大表专用：页码口径（同过滤条件下的 COUNT 与换算，单行）
  function metaSql(cfg) {
    var w = whereClause(cfg);
    return patsCte(cfg) + 'SELECT COUNT(*) AS total_cnt, TRY_CAST(${page} AS int) AS cur_page,' +
      ' TRY_CAST(${size} AS int) AS page_size,' +
      ' (COUNT(*) + TRY_CAST(${size} AS int) - 1) / TRY_CAST(${size} AS int) AS total_pages' +
      ' FROM ' + fromClause(cfg) + w.where + sqlTail(cfg);
  }

  // 模块导航注册表（26 表全库统一）：由 gen_laser_specs.js 从 data/db_laser_tables.json 画像自动生成，
  // 注册表单点维护在 data/（db_laser_modules.js=演示 26 表；db_laser_modules_prod.js=生产 25 表，无备份表）；
  // BR_MODULESET=prod 时构建走生产注册表（演示部署零影响）
  load('D:/fineagent/data/db_laser_modules' + (env('BR_MODULESET', 'demo') === 'prod' ? '_prod' : '') + '.js');
  var MODULES = LASER_MODULES;

  // 参数覆盖钩子：核验筛选时不必为每个参数组合另开一份 spec 文件
  function env(k, d) {
    try {
      var v = J('java.lang.System').getenv(k);
      return (v == null || String(v) === '') ? d : String(v);
    } catch (e) { return d; }
  }

  function browserSpec(cfg) {
    // effLen 全角感知（与 gen_laser_specs.js 同款）：中文/全角 2 半角位（'行号' 等 4 半角，直数 .length 腰斩）
    var effLen = function (s) {
      var w = 0;
      for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 0x2e7f ? 2 : 1;
      return w;
    };
    var sqlPaging = !!cfg.sqlPaging;   // 大表走 SQL 分页；小表默认原生 Web 分页
    // 字体 2026-10-27 用户拍板：attr 全员 112，与生产模板 3D翘曲检查数据分析V2 同值（设计器框显示 14）。
    // 不再按 pt 换算——attr 单位实测已闭环，版式参数（advance/行高）从标尺外推：
    //   半角 advance ≈ attr×0.246 pt（attr42 → 10.34pt/字 实测）；行高按生产比例（detail 84pt，attr112 字 em56pt + 留白）。
    var FS = Math.max(72, cfg.fontAttr || 112);
    var ADV = FS * 0.28;   // 半角 advance：0.246 标尺值在大字号下偏紧（biz_time/size 折行实证），放宽容差到 0.28
    var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
    // 行号列：分页排序键 _ord 直出（FR 按明细第一列排展示序 → 展示序=全序=真值序）
    var showNo = cfg.showRowNo !== false;
    // 机台列（2026-10-28 用户口径）：紧跟行号，展示 laser_files.source_id（经 file_key）；
    // files 表 own source_id 即机台，不重复加（showMachine 已挡）
    var machCol = showMachine(cfg) ? [{ name: 'machine_name', label: '机台', len: 12 }] : [];
    var cols = (showNo ? [{ name: '_ord', label: '行号', len: 6, type: 'num', fmt: '#,##0' }] : []).concat(machCol).concat(cfg.cols);
    var ncol = Math.max(cols.length, 12);
    var widths = cols.map(function (c) {
      // 文字列 +30pt 边距：数值/编号防粘边（"99000 式粘连"）；
      // 顶部钳制 2000（2026-10-28 用户口径：宽是公式的事不许点名补丁——原 900 顶把 prog_path 类长文列
      // 永远钳死 → 字母竖排；纸宽动态覆盖全部列宽，无溢出条件，顶部钳制只为防表中表离谱值）
      return c.w || clamp(Math.max(c.len || 6, Math.min(effLen(c.name), 8)) * ADV + (c.type === 'num' ? 14 : 30), 120, 2000);
    });
    while (widths.length < ncol) widths.push(Math.round(6 * ADV + 14));
    var D = cfg.defaults || {};
    var rowsPerPage = Math.max(1, +env('BR_SIZE', String(D.size || 50)));
    var rowH = 141;                    // 明细行高（生产 V2 同值 141pt）：attr112 数据行引擎自适应地板≈138pt（92px×50 行像素标尺实测），
                                       // 预写 112 会被顶到 138 → 纸面装不下 50 行永远切 2 页；预写 141≥地板按预写直出，纸面预算闭合
    var HDR_H = 224;                   // 表头/口径注 2 行文本带（112×2）：静态格实测不膨胀（223px 对账）
    var BAND_H = 70;                   // 标题/信息行带高：attr112=纸面56pt（2026-10-27 设计器截图实证），放足 56+留白
    // 纸高 = 全内容实高精确算：标题带 + 表头2行 + 空 + N行明细 [+ 空 + 表底信息带] + 余量（口径注删除，导航入面板）
    var paperH = BAND_H                                 // 标题带
               + HDR_H                                  // 表头 2 行
               + 10 + rowsPerPage * rowH                // 空 + 明细
               + (sqlPaging ? 10 + BAND_H : 0)          // 空 + 表底信息带
               + 54 + rowH;                             // 余量+rowH：数据行地板膨胀兜底
    if (!cfg.paper) {
      // 自定义长页只服务于打印/PDF（数据分析预览按 pageFixedRowCount 切页，与纸高无关）
      // 纸宽必须覆盖全部列（含 padding/最后一列的掩宽留量）：纸 0848 < 列Σ 会横向溢出 → 引擎切第二页（1/2 条）
      var wpt = 0; widths.forEach(function (x) { wpt += x; });
      wpt = wpt + widths.length * 12;   // 每列 padding 计入（padL/padR 4~10 + 默认 2×2）
      cfg.paper = {
        width: Math.round((wpt + 54) * 12700), height: Math.round(paperH * 12700),
        top: 190500, left: 228600, bottom: 190500, right: 228600
      };
    }
    var page0 = Math.max(1, +env('BR_PAGE', String(D.page || 1)));
    // 公式默认值（=TODAY()-6 / =TODAY()）：web 端由面板控件公式求值；管线 PNG 静态路径用字面日期兜底
    function calStr(off) {
      var cal = J('java.util.Calendar').getInstance();
      cal.add(J('java.util.Calendar').DATE, off);
      return new (J('java.text.SimpleDateFormat'))('yyyy-MM-dd').format(cal.getTime());
    }
    function litDate(v) {
      var s = String(v);
      if (s.charAt(0) === '=') {
        var num = parseInt(s.replace(/^=?(TODAY|NOW)\(\)/, '').replace(/^\+=/, '').replace(/\s/g, ''), 10);
        return calStr(isNaN(num) ? 0 : num);
      }
      return s;
    }
    var d1Lit = litDate(D.d1), d2Lit = litDate(D.d2);
    var machineLit = String(D.machine == null ? '' : D.machine);
    var params = sqlPaging
      ? [
          { name: 'd1', value: d1Lit }, { name: 'd2', value: d2Lit },
          { name: 'stage', value: D.stage == null ? '' : String(D.stage) },
          { name: 'machine', value: machineLit },
          { name: 'size', value: String(rowsPerPage) }, { name: 'page', value: String(page0) }
        ]
      : [
          { name: 'd1', value: d1Lit }, { name: 'd2', value: d2Lit },
          { name: 'stage', value: D.stage == null ? '' : String(D.stage) },
          { name: 'machine', value: machineLit }
        ];

    // ---- 通用排布：按"目标宽度"从左往右贪心吃列（列宽由数据决定） ----
    // 前向宽度实测（probe_fontmetrics2.js）：半角 ≈1.0×FP、全角 ≈2.0×FP、粗体再 +10%。
    // 前向宽度（font_ruler 标尺实测）：黑体半角 advance ≈ 0.49×真实 pt（attr42→10 数字 69px@0.667=103pt
    //   → 10.34pt/字）。写宽一律换成真实 pt 尺度：半角 0.5×FP、全角 1.0×FP、粗体再 +10%。
    function textPt(s, bold) {
      var w = 0, k = ADV * (bold ? 1.1 : 1.0);
      for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 0x2e7f ? k * 2 : k;
      return w;
    }
    function layout(targets, start) {
      var res = [], cur = start || 0;
      targets.forEach(function (t) {
        if (t == null) { cur += 1; res.push(null); return; }
        var acc = 0, span = 0;
        while (acc < t && cur + span < widths.length) { acc += widths[cur + span]; span++; }
        if (span === 0) span = 1;
        res.push({ c: cur, span: span });
        cur += span;
      });
      return res;
    }

    // ---- r0 标题行（2026-10-27 用户口径 v2：导航入参数面板，表内只留标题/信息行）----
    var blocks = [{
      type: 'cells', heightPt: BAND_H,
      items: [{ c: 0, span: ncol, text: cfg.title, st: { bold: true, sizePt: 14, align: 2, edges: {} } }]
    }];

    // ---- 标题行之后：表头 / 明细 / 空行 / 表底分页信息带（2026-10-27 用户口径：口径注删除、信息带挪 表底）----
    // 信息带构造留给 postDetail 段，先排表头与明细
    // ---- r2 表头（对齐跟本列内容；去竖线）----
    var hdr = cols.map(function (c, k) { return { c: k, text: c.label || c.name, st: headStyle(c) }; });
    blocks.push({ type: 'cells', heightPt: HDR_H, items: hdr });

    // ---- r3 明细（编号/数值/居中三型分流 + 同列唯一 Format + 无竖线）----
    var det = cols.map(function (c, k) {
      return { c: k, ds: { column: c.name }, st: cellStyle(c) };
    });
    blocks.push({ type: 'cells', heightPt: rowH, dataset: 'ds1', items: det });

    blocks.push({ type: 'space', heightPt: 10 });
    if (sqlPaging) {
      // 表底分页信息带（dsm 单行直出：共 N 条 · 第 x/y 页 · 每页 N 条），原顶部位置挪这里
      var bar1 = [];
      var BAR = [
        { text: '共', t: textPt('共', false) }, { ds: 'total_cnt', t: textPt('000000', true) },
        { text: '条 第', t: textPt('条 第', false) }, { ds: 'cur_page', t: textPt('0000', true) },
        { text: '页 / 共', t: textPt('页 / 共', false) }, { ds: 'total_pages', t: textPt('0000', true) },
        { text: '页 每页', t: textPt('页 每页', false) }, { ds: 'page_size', t: textPt('000', true) },
        { text: '条', t: textPt('条', false) }
      ];
      var barLay = layout(BAR.map(function (b) { return b.t; }), 0);
      BAR.forEach(function (b, k) {
        var lay = barLay[k];
        if (!lay) return;
        var o = { c: lay.c, span: lay.span };
        if (b.ds) {
          o.ds = { column: b.ds, ds: 'dsm', noExpand: true };
          o.st = { align: 4, bold: true, sizePt: 14, edges: {} };
        } else {
          o.text = b.text; o.st = { align: 2, sizePt: 14, edges: {} };
        }
        bar1.push(o);
      });
      blocks.push({ type: 'cells', heightPt: BAND_H, items: bar1 });
    }

    // ---- 参数面板（2026-10-27 用户口径 v2：日期组件/每页枚举 10-50/去工序/导航按钮入面板）----
    var widgets = [
      { kind: 'label', text: '起始日期', x: 10, y: 12, w: 62, h: 22 },
      { kind: 'date', name: 'd1', value: String(D.d1), x: 76, y: 12, w: 110, h: 22 },
      { kind: 'label', text: '结束日期', x: 198, y: 12, w: 62, h: 22 },
      { kind: 'date', name: 'd2', value: String(D.d2), x: 264, y: 12, w: 110, h: 22 }
    ];
    var nx2 = 386;
    if (sqlPaging) {
      widgets.push(
        { kind: 'label', text: '每页', x: nx2, y: 12, w: 36, h: 22 },
        { kind: 'combo', name: 'size', value: String(rowsPerPage), values: [10, 20, 30, 40, 50], x: nx2 + 40, y: 12, w: 72, h: 22 },
        { kind: 'label', text: '页码', x: nx2 + 124, y: 12, w: 36, h: 22 },
        { kind: 'editor', name: 'page', value: String(page0), x: nx2 + 164, y: 12, w: 64, h: 22 }
      );
    }
    // #1 机台（2026-10-28）：文本输入框，前缀模糊匹配 laser_files.source_id（'1#' → 1# 皆机），
    // 空 = 全部。sqlPaging 行排在页码后（x 750 起）；小表行接日期区后。
    if (cfg.machine !== false) {
      var mx = sqlPaging ? 750 : nx2;
      widgets.push(
        { kind: 'label', text: '机台', x: mx, y: 12, w: 46, h: 22 },
        { kind: 'editor', name: 'machine', value: String(D.machine == null ? '' : D.machine), x: mx + 46, y: 12, w: 200, h: 22 }
      );
    }
    // 导航按钮栅格：每行 5 颗（2026-10-28 用户口径：中文名带表短名后缀防Mixin两义，如「Z轴 zaxis」；
    // 每行 7 颗会因后缀加长溢出按钮，栅格放宽 PER=5、宽 208/间距 216）
    var PER = 5;
    cfg.modules.forEach(function (m, mk) {
      var suffix = String(m.key).replace(/^laser_/, '');
      widgets.push({ kind: 'nav', name: 'btn_' + m.key, text: (m.label || m.key) + ' ' + suffix,
        url: '/webroot/decision/view/report?viewlet=' + encodeURIComponent(m.cpt) + '&op=view',
        x: 10 + (mk % PER) * 216, y: 40 + Math.floor(mk / PER) * 28, w: 208, h: 24 });
    });
    widgets.push({ kind: 'submit', text: '查询', name: 'btn_query', x: 634, y: 12, w: 80, h: 24 });
    var navRows = Math.ceil(cfg.modules.length / PER);
    var param = {
      // 生产 V2 同款弹出窗：showWindow=true + windowPosition=1（2026-10-28 用户 GUI A/B 定罪：
      // delayPlaying="true" 会让首次打开不直出内容、要点查询才出；翻 false（ABTEST 直出实证）。
      // useParamsTemplate 保持 true（ABTEST2 false 无效应，被排除）。
      designWidth: 1130, designHeight: 40 + navRows * 28 + 4, showWindow: true, delayPlaying: false,
      align: 0, windowPosition: 1, useParamsTemplate: true, title: cfg.title + ' 查询条件',
      widgets: widgets
    };

    return {
      outName: cfg.outName,
      allowNoFormula: true,   // 浏览器族零公式：v2 校验器的公式存在断言不适用（分页入参或原生条，无公式按钮）
      connections: cfg.connections,
      IR: {
        param: param,
        webPage: sqlPaging ? null : { rows: rowsPerPage },
        sheets: [{
          name: 'sheet1',
          widthsPt: widths,
          paper: cfg.paper,
          pageRepeat: sqlPaging ? null : { from: 0, to: 0 },   // 2026-10-27 导出层验证：sqlPaging 长纸下去掉页头重复，排除导出二次分页诱因
          blocks: blocks
        }],
        datasets: sqlPaging ? [
          { name: 'ds1', kind: 'sql', connection: CONN, params: params, query: pagedSql(cfg) },
          { name: 'dsm', kind: 'sql', connection: CONN, params: params, query: metaSql(cfg) }
        ] : [
          { name: 'ds1', kind: 'sql', connection: CONN, params: params, query: fullSql(cfg) }
        ]
      }
    };
  }

  return { spec: browserSpec, MODULES: MODULES, env: env, fullSql: fullSql, pagedSql: pagedSql, metaSql: metaSql, dateExpr: dateExpr };
})();

// 兼容 Nashorn 与 node：两种模块系统都挂上
if (typeof module !== 'undefined' && module.exports) module.exports = BROWSER;


