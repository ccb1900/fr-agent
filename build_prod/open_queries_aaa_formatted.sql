WITH days AS ( SELECT 0 AS n, COALESCE(TRY_CAST('2026-10-23' AS date), DATEADD(day, -6, CONVERT(date, GETDATE()))) AS d, COALESCE(TRY_CAST('2026-10-29' AS date), CONVERT(date, GETDATE())) AS d2 UNION ALL SELECT n + 1, DATEADD(day, 1, d), d2
FROM days
WHERE d < d2), pats AS ( SELECT DISTINCT n, p
FROM (  SELECT n, CONVERT(varchar(10), d, 23) AS p
FROM days  UNION ALL SELECT n, REPLACE(CONVERT(varchar(10), d, 23), '-', '/')
FROM days  UNION ALL SELECT n, CAST(YEAR(d) AS varchar(4)) + '-' + CAST(MONTH(d) AS varchar(2)) + '-' + CAST(DAY(d) AS varchar(2))
FROM days  UNION ALL SELECT n, CAST(YEAR(d) AS varchar(4)) + '/' + CAST(MONTH(d) AS varchar(2)) + '/' + CAST(DAY(d) AS varchar(2))
FROM days ) x) SELECT machine_name, [file_key], [row_number], [biz_date], [biz_time], [stage], [result_x], [result_y], [workpiece_x], [workpiece_y], [main_prog_no], [main_prog_seq], [main_prog_block], [sub_prog_no], [sub_prog_seq], [sub_prog_block], [machine_x], [machine_y], [size], [score], [corr_ratio], [lack_rate], [prog_path], _ord
FROM (SELECT M.*, ROW_NUMBER() OVER (ORDER BY M.n, M.[biz_time], M.[file_key], M.[row_number], M.[main_prog_no], M.[main_prog_seq], M.[sub_prog_no], M.[sub_prog_seq]) AS _ord
FROM ( SELECT M0.*
FROM pats P
CROSS APPLY ( SELECT TOP (TRY_CAST(1 AS int) * TRY_CAST(50 AS int)) LF.[source_id] AS machine_name, T.[file_key], [row_number], [biz_date], [biz_time], [stage], [result_x], [result_y], [workpiece_x], [workpiece_y], [main_prog_no], [main_prog_seq], [main_prog_block], [sub_prog_no], [sub_prog_seq], [sub_prog_block], [machine_x], [machine_y], [size], [score], [corr_ratio], [lack_rate], [prog_path], P.n AS n
FROM [laser_aaa] T
LEFT JOIN [laser_files] LF ON LF.[file_key] = T.[file_key]
WHERE T.[biz_date] = P.p AND ('' = '' OR LF.[source_id] LIKE '%') AND ('' = '' OR [stage] = '')
ORDER BY [biz_time], T.[file_key], [row_number] ) M0 ) M) PGT

WHERE _ord > (TRY_CAST(1 AS int) - 1) * TRY_CAST(50 AS int) AND _ord <= TRY_CAST(1 AS int) * TRY_CAST(50 AS int)
ORDER BY _ord
OPTION (MAXRECURSION 0)