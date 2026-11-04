# AGENTS.md — fineagent 管线的 agent 行为约束（任何 agent 开工前必读，约束高于个人判断）

> 本文件是"流程防线"：README.md 编号条目是"事实库"，这里是"行为规则"。两者冲突时以更新日期新者为准。

## 0. 阅读顺序（拒绝凭记忆干活）

1. **AGENTS.md**（本文件）
2. **README.md**——经验库，编号条目 #1 起逐条是一手实证，改 lib/spec 前先 grep 相关编号
3. **TABLE_DESIGN_STANDARD.md**——出报表前过"落地检查清单"，逐项打勾才算产物合格
4. **GENERATOR_DESIGN.md**——架构意图（为什么 XML 是产物不是输入）

## 1. 交付产物前的硬性回归（不跑不得报"完成"）

```powershell
# 默认路径重跑 + MD5 铁证对比（改 lib/object.js、ir.js、cpt.js 任何一处都必须执行）
run.ps1 -Script make_api.js
# demo_api.cpt MD5 必须 = CBEB42E3CE48E46E362B9AE80168026F（2026-10-27 生产对齐版：正文字号 attr=112），failures 必须 = 0
```

- 改浏览器族（lib/browser.js / reports/br_*.js）后：三张 spec 全部跑一遍，各 failures=0
- 记住 make_api.js 每轮**只回写当前 spec**，最后一步必须用默认 spec 收尾，否则基线铁证被踩
- 交付核对面=渲染 PNG 人工过目 + TABLE_DESIGN_STANDARD 检查清单，**不许"validator 绿了就报完成"**
- **分层门（README #53/#54，改 lib/ir/object/runresult/browser 必跑）**：
  - 快速层（无引擎，秒级，不碰 FineDB/不产字节）：`scripts/run-fast-tests.ps1`（fast_parse + fast_ir_contract + fast_runresult + fast_browser_sql，任一 rc≠0 整体 exit 1）
  - 零误伤扫描（无引擎）：`nashorn.jar ... Shell probes/scan_all_specs.js`（reports/ 全量 compile+validate，合法报表=回归门）
  - 引擎负门（需 java/FineDB，会杀 java）：`scripts/run-engine-negative-tests.ps1`——断言"失败必非零退出码、无假绿"，末步自动回补默认 spec 护基线

## 2. 排版红线（自动销项，别等用户提）

- 全表 **SimHei，Font attr 全员 112**（2026-10-27 用户拍板"甲：生产同款"，对标 3D翘曲检查数据分析V2；设计器框显示 14、纸面 56pt，生产既定大字版式）；标题/表头 style=1 加粗，正文 style=0；明细行高 84pt（生产同值）。字号写入公式：attr = sizePt × 8（sizePt = 设计器框显示值）
- 版式学习源（只学版式）：`reportlets\3D翘曲检查数据分析V2.cpt`（生产参考）——合并组带表头、TextEditor+原生提交按钮、行高冗余大、数据集缓存策略段；不抄它的全局配置类内容
- 表头与本列内容对齐方式一致；数字列同列唯一 Format；编号列按文字列（千分位禁止）
- **表格必须有内边框（2026-10-27 口径）**：横、竖黑细线全保留；防字号/编号粘边用 Style.derivePaddingLeft/Right 留白（见 probe_margins.js），不靠去线
- 列宽由文案反算（textPt：半角 1.0×FP、全角 2.0×FP、粗体 +10%），不许手拍
- 官方 demo 重建族例外：边框/底色照抄官方样式，以像素 diff 为验收线

## 3. 引擎级已知事实（踩过一次就别踩第二次）

- **FR 存 cpt 时会改写 SQL**：`[]` 标识符补表别名 → 运行时 ORDER BY 失效；全序走 `ROW_NUMBER() OVER(...)` 出 `_ord`，外层 `ORDER BY _ord`（无标识符不被改写）
- **字号单位 = pt×2（2026-10-27 font_ruler 标尺证伪 pt×4 旧说）**：attr{10,20,40,42} 渲染墨高 px {3,6,10,11} @0.667px/pt，与 attr/2=pt 全对合（attr/4 预测差 2.25 倍）。写字号：getInstanceFromFRSize 时 attr=sizePt×2（lib/object.js font()）；设计器字号框显示 getSize2D≈attr/8 的浮点值（attr42→5.3、attr50→6.3，用户在框里看到的 6.5/4.5 即此类值+人工口记偏差）。历史"SimHei 8pt 吞负号"实验当时 attr=32=真 16pt，结论的原口径需重验后才可再引用
- **自造工具条超链翻页禁用**：数据分析预览中每点一次导航，请求头随导航膨胀，三四次 → Tomcat 400「请求头太大」；且页码参数在多次跳转中会漂移。翻页 = 参数面板 page/size + 查询提交（同视图重算，无导航）；模块互跳 = 导航条 ReportletHyperlink（低频、可接受）
- **SQL 分页是唯一抗大表方案**：原生 WebPage 全量切片已被废弃——千万行时内存不可行；行数保护阈值（RelaxationRestrictionConfig，默认 8 万行）**默认不碰**，确需调整必须先告知用户并在 README 留痕
- FR 的 `${}` 是文本替换不是绑定变量：参数输入单引号会破坏 SQL（内网自查工具，对外必须接 ? 绑定）
- 错误被混淆类吞堆栈：`Throwable.printStackTrace(PrintWriter)` 抓
- 数据勘误必须看**像素**（Result dump 的值层有字就有墨）——黑体 8pt 负号事件就是纯像素实证

## 4. 数据纪律（不臆造）

- 列名/类型/格式一律照抄 `data/db_tables_profile.txt` 与 `data/db_br_truth.txt` 的直查画像；fmt 逐列从样本推导（同列唯一）
- 真值对拍用 probe 直查同一条 SQL（如 probe_dbtruth2.js），栅格 dump（RESULT_DUMP）逐格等值
- 凭据只在本机 spec 的 connections 段；交付前 grep 部署 cpt：`whmeiko|password` 必须 0 命中——**自 README #54 起管线有凭据自动门**（make_api §5.9：deploy 后扫部署件，命中密钥 token 即撤回+deploy failed+非零退出），人工纪律降为兜底；SQL 数据集受只读闸（单语句 SELECT/WITH、禁 `;`），浏览器族表/列名受标识符白名单闸（README #54 I0-04）

## 5. 流程纪律（防止"方向错了才被用户叫停"）

- **禁止未经用户允许截取屏幕**（包括 PrintWindow/桌面截图）；产品验证一律走文件层：读部署的 cpt/PNG 字节、跑管线渲染，用户亲眼看什么由用户决定
- **禁止用鼠标/键盘自动化操控其他软件**（设计器、浏览器等 GUI 属于用户的地盘）；需要用户动手的验证步骤，把操作步骤写清楚交给用户
- 方案分歧点**先列证据再动手**；证据 = 反射探针（probes/）+ 渲染/栅格，不是"文档说应该"
- 用户报的事故：先复现（能自己复现的在文件层/管线层复现，GUI 验证交给用户）、再定根因（日志/常量池/JVM 反射三线并进）、修复后**真实环境复测**，最后 README 回填编号条目
- 目录结构见 README「目录结构」节；新探针放 probes/、日志放 logs/、真值放 data/，别污染根目录
- 修改 spec/lib 一律用编辑器（逐字替换），**禁止 PowerShell `-replace`/`Set-Content` 批改 UTF-8 文件**——PS 5.1 按 GBK 读盘，会把中文字符串打成果酱（08:49 事故教训：outName 变 undefined、部署出 undefined_api.cpt）
- run.ps1 会杀所有 java 进程（管线自身的既定惯例，用于释放 FineDB 锁）：跑之前先向用户打招呼；没用户允许不启动/关闭非本管线的软件

## 6. 项目状态速查（2026-11-04，I0 可靠性收尾已落地）

- v4.x 管线：lib/object.js（API 对象图）+ ir.js（IR 编译）+ features/data_browser/browser.js（数据浏览器构造器，moved from lib）+ cpt.js（v2 校验器=回归门）
- **IR 契约（2026-11-04，README #49/#50/#54）**：ir.js 有 `IR_VERSION='1'`（validate 认当前版/拒未知版）+ `Ir.capabilities()` 机器读能力清单；`validate()` 输出结构化 `{code,path(JSON),message}`（I0-01，code 词汇见 lib/ir.js E码表），自炸路全堵+数值有限闸+枚举白名单+超链/SQL/凭据边界。`compile()` 输入不可变+幂等；multi-sheet 报 `UNSUPPORTED_CAPABILITY:multi_sheet`。object.js `build()` 只按具名键消费 IR。改 IR 断言前先读 object 消费语义（#48 铁律）。无引擎自检：`scripts/run-fast-tests.ps1` + `probes/scan_all_specs.js`
- **RunResult 契约（I0-02）**：11 段全序 `input_load→runtime_initialize→datasource_connect→ir_validate→object_build→cpt_export→cpt_validate→execute→render→deploy→roundtrip`（deploy 现居 render 后）；无 connections 时 datasource_connect=skipped；崩/坏输入都写初始快照 success:null（灭陈旧假绿）；run.ps1 透传退出码
- **数据类型（I0-05）**：embedded 列词表 text/string/number/integer/long/float/decimal/boolean/date/datetime（object.js DS_JTYPE，probe_typemap 实机证保真）；行值形态 ir.js checkRowValue 逐格闸；legacy number=硬转 Integer 不变
- 浏览器族 24 张（演示 25 含备份表/生产 24 无备份表），统一 SQL 分页 + 面板翻页；机台过滤 + 按天 TOP 参照 README #38–44
- **ABR-1 边界（2026-11-03）**：一级结构 = reports → features/data_browser → lib(核心三件) → runtime(Paths/bootstrap/datasource) → runner 编排；依赖规则 `docs/architecture/dependency-rules.md`（R1–R5，`scripts/check-boundaries.ps1` exit 0 才干净）；lib/browser.js 为兼容垫片唯一豁免；lib/ir.js 零运行时依赖红线
- 基线铁证（2026-11-04 I0 批逐单元复验，逐字节）：demo_api.cpt = CBEB42E3CE48E46E362B9AE80168026F、销售明细_api.png = A8EF39AB648D5F00DDAE0481D0313110、v2 demo_template_final.cpt = 6161F402B340321B4ABF68B68E301828；br 六连栅格 + prod staging 24 张字节级基线副本在 logs\abr1_baseline*（PDF 含 CreationDate 非确定项，不作铁证）
- **I0 后仍开放（不装完成）**：`?` 值绑定接线（浏览器族 SQL 全参数化，会改 24 张 SQL 文本+重录基线，列 I1 前工单）；r2.md I1~I6（ReportSpec/Schema Inspector/Semantic Model/Planner/NL 闭环/Template Patch）按"前一迭代验收过再开下一迭代"推进
