-- ============================================================
-- 生产库表画像请求脚本（给 DBA / 有权限的人在生产执行）
-- 在 MES 连接指向的那个库里执行（新查询 → USE <库名> → 跑三段）
-- 结果请"右键网格 → 将所有内容连同标题一起复制"贴回给我（文本即可）
-- 数据纪律（AGENTS §4）：列名单照抄，不臆造。
-- ============================================================

-- A) 表清单 + 行数（一段一个结果）
SELECT t.name AS tbl, SUM(p.rows) AS row_cnt
FROM sys.tables t
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
WHERE t.name LIKE 't_collector_laser%'
GROUP BY t.name
ORDER BY t.name;

-- B) 全部列定义（主结果：表/列/类型/长度/精度/小数位）
SELECT t.name AS tbl, c.column_id AS col_no, c.name AS col, ty.name AS dtype,
       c.max_length AS max_len, c.precision AS prec, c.scale AS dec
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name LIKE 't_collector_laser%'
ORDER BY t.name, c.column_id;

-- C)（可选，能跑更好）文本列真实内容最大长度 —— 一条动态 SQL，全兼容 SQL2008+
DECLARE @sql nvarchar(max);
SELECT @sql = COALESCE(@sql + ' UNION ALL ', '') +
  'SELECT ''' + t.name + ''' AS tbl, ''' + c.name + ''' AS col, MAX(LEN([' + c.name + '])) AS mx FROM [' + t.name + ']'
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE ty.name IN ('varchar', 'nvarchar') AND t.name LIKE 't_collector_laser%';
EXEC sp_executesql @sql;
-- 跑完 C 的结果同样贴回（tbl / col / mx 三列）
