// _readme_append.js — README.md 末尾按 UTF-8 字节追加 #36/#37 条目（Files APPEND，零触碰存量字节）
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
var Paths = J('java.nio.file.Paths');
var P = 'D:/fineagent/README.md';

var txt = '\n#36 打开直出三案（2026-10-28）：首屏不点查询直出第一页，三处根因连环修——\n' +
 '(1) 引擎层：参数映射缺键时模板默认值生效（probe_open_exec 空参数=54 行实证）；但 "=TODAY()-6" 这类公式串经 FR ${} 文本替换直进 SQL，TRY_CAST(公式串) 失败\u2192 0 行。日期界自愈 SQL：COALESCE(TRY_CAST(\'${d1}\' AS date), DATEADD(day,-6,CONVERT(date,GETDATE())))，d2 兜 CONVERT(date,GETDATE())——公式串/空串全免疫落 GETDATE() 最近 7 天，真日期原样用；三景实证：空参=54 行 / 公式串=兜底窗口执行 / 字面日期 5490 条回归。\n' +
 '(2) delayPlaying="true" 定罪（生产 V2 字节同款照抄来的毒）：GUI 单变量 A/B（ABTEST_评分流水 delayPlaying=false）用户直出实证——打开先不渲染内容区、点查询才出。lib/browser.js 翻 delayPlaying:false，演示 26 + 生产 25 重刷全绿（残留 0）。useParamsTemplate=false 变体（ABTEST2）与去 op=view 分页预览均无效应，被排除。\n' +
 '(3) 壳页取证教训：op=view 首屏 HTML 是未登录通用壳（login.min.css/js 痕迹），delayPlaying true/false 两版壳完全同长且无数据痕迹——壳级 byte 对比无效。显示层语义对法：官方文档「点击查询前不显示报表内容」勾选项 = DelayDisplayContent（V2/GettingStarted=delay"true" 点查询才出；随包自动查询实例=delay"false" 直出），我们一直 false 无罪；判罪靠 GUI 单变量 A/B，不靠壳页。\n' +
 '相关教案：GUI 验证按纪律交用户手动（本例四链路 A/B 一次打完）；HTTP 无会话抓不到真实预览页面。\n\n' +
 '#37 生产画像双源 + colSpec v2（2026-10-28）：生产网段本机不通，画像改 SQL 收集两腿——demo 直查（probe_profile_all.js）/ 生产 SSMS 贴回（data/prod_profile_request.sql A 行数段 + B sys.columns 段 \u2192 prod_profile_raw.txt \u2192 probes/probe_parse_prod.js \u2192 data/db_laser_tables_prod.json 25 表：键剥 t_collector_ 归 laser_*，kind/小数位/样本按同名列继承 demo 画像，生产独有列只打 minw 宽度下限不臆造样本，file_key 按生产实况 18 位）。colSpec v2 统一公式：len = max(数据宽, 表头宽, 类别下限)，只设类别上限（code 22/num 40/cent 34/文本 44）——表头一票当地板修 row_numb er / r_stage_ftheta_t emp 拦腰断行，样本/下限修 file_key 17 位翻 3 行 / prg 路径字母竖排。stage 家族以 prod 画像为准：Z轴（生产无 stage）filterCol 自动摘除，[stage] 恰在 10 张实有列的 cpt；生产 25 张 build_prod\\mkwh\\ staging 三要素全齐、凭据 0 命中。\n' +
 '流程教训：prod spec 轮注册表只在 demo 模式重写（BR_PROFILE 守卫，防 26\u219225 踩丢）；PowerShell 单行内联正则拼中文/特殊字符极易翻车：探针一律 write 工具落盘再跑，禁内联长 JS。\n';

var existed = Files.exists(Paths.get(P));
if (!existed) { print('ABORT: README.md 不存在'); } else {
  var size = Files.size(Paths.get(P));
  var bytes = new (J('java.lang.String'))(txt).getBytes('UTF-8');
  Files.write(Paths.get(P), bytes, J('java.nio.file.StandardOpenOption').CREATE, J('java.nio.file.StandardOpenOption').APPEND);
  print('APPENDED ' + bytes.length + ' bytes (原 ' + size + '), 新大小=' + Files.size(Paths.get(P)));
}
