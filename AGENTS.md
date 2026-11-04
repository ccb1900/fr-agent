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
  - 快速层（无引擎，秒级，不碰 FineDB/不产字节）：`scripts/run-fast-tests.ps1`（fast_parse + fast_ir_contract + fast_runresult + fast_browser_sql + fast_report_spec 五套件，任一 rc≠0 整体 exit 1）
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

- 列名/类型/格式一律照抄**机器直查画像**：`data/schema_<source>.json`（I2 Schema Inspector 产，结构事实级：类型/可空/PK/FK 三分桶，`runraw.ps1 -Script semantic/schema/inspect_main.js` 重生成）为一级权威；`data/db_tables_profile.txt` / `data/db_br_truth.txt` 为历史真值参照（I2 前的手工画像，verify_schema_profile 持续对拍）；fmt 逐列从样本推导（同列唯一）
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

## 6. 项目状态速查（2026-11-04，I0 可靠性收尾 + I1 ReportSpec 接口已落地）

- v4.x 管线：lib/object.js（API 对象图）+ ir.js（IR 编译）+ features/data_browser/browser.js（数据浏览器构造器，moved from lib）+ cpt.js（v2 校验器=回归门）
- **IR 契约（2026-11-04，README #49/#50/#54）**：ir.js 有 `IR_VERSION='1'`（validate 认当前版/拒未知版）+ `Ir.capabilities()` 机器读能力清单；`validate()` 输出结构化 `{code,path(JSON),message}`（I0-01，code 词汇见 lib/ir.js E码表），自炸路全堵+数值有限闸+枚举白名单+超链/SQL/凭据边界。`compile()` 输入不可变+幂等；multi-sheet 报 `UNSUPPORTED_CAPABILITY:multi_sheet`。object.js `build()` 只按具名键消费 IR。改 IR 断言前先读 object 消费语义（#48 铁律）。无引擎自检：`scripts/run-fast-tests.ps1` + `probes/scan_all_specs.js`
- **RunResult 契约（I0-02）**：11 段全序 `input_load→runtime_initialize→datasource_connect→ir_validate→object_build→cpt_export→cpt_validate→execute→render→deploy→roundtrip`（deploy 现居 render 后）；无 connections 时 datasource_connect=skipped；崩/坏输入都写初始快照 success:null（灭陈旧假绿）；run.ps1 透传退出码
- **数据类型（I0-05）**：embedded 列词表 text/string/number/integer/long/float/decimal/boolean/date/datetime（object.js DS_JTYPE，probe_typemap 实机证保真）；行值形态 ir.js checkRowValue 逐格闸；legacy number=硬转 Integer 不变
- 浏览器族 24 张（演示 25 含备份表/生产 24 无备份表），统一 SQL 分页 + 面板翻页；机台过滤 + 按天 TOP 参照 README #38–44
- **ReportSpec JSON 入口（2026-11-04 I1，README #55）**：`REPORT_SPEC=*.json` → make_api.js §0 后缀分支 → `lib/report_spec.js`(词汇/能力名册)+`lib/spec_validator.js`(校验，沿用 I0-01 {code,path,message})+`lib/spec_compiler.js`(→现有 ReportIR) → 包 `SPEC={outName,IR}` 复用 rawIR 直通路；v1 sum-only（dimensions/metrics(sum)/内嵌 rows/table+showTotal），filters/chart/semantic query/非 sum 聚合=v1 结构化拒（指向 I2-I5）；`schemas/report-spec.schema.json` 是声明式镜像、`spec_validator.js` 是权威（Nashorn 无 JSON-Schema 库）；旧 .js spec 路径一行不动。等价铁证：sales_demo.json 产出与 sales_demo.js 逐字节相等（CBEB42E3/A8EF39AB）；引擎负门含 json-bad-spec 第 5 路
- **ABR-1 边界（2026-11-03，I2 扩 R7、I6 扩 R8）**：一级结构 = reports → features/data_browser → lib(核心三件) → runtime(Paths/bootstrap/datasource) → runner 编排；**语义层 semantic/（I2/I3/I4/I5）+ template 层（I6）= 独立旁路**（semantic 只依赖 java.sql+dbpass+纯 JS，template 是 FR-facing 读回/写回旁路，均换引擎可复用）；依赖规则 `docs/architecture/dependency-rules.md`（**R1–R8**，`scripts/check-boundaries.ps1` exit 0 才干净；R7 词表刻意不含裸 Java.type 与 R2 不同是有意的；R8：make_api 不载 template/、template core 四件零 Java.type/com.fr）；lib/browser.js 为兼容垫片唯一豁免；lib/ir.js 零运行时依赖红线
- **Schema Inspector（2026-11-04 I2，README #56）**：`semantic/schema/{metadata,relation,serializer}.js`（core 零 java）+ `inspector.js`（唯一触 java.sql 薄壳）+ `inspect_main.js`（runraw 入口，不杀 java/不启 FR/只读元数据）→ `data/schema_<source>.json`（无凭据）。r2 三分桶**实机坐实**：演示库 26 表 25 有 PK、**FK=0** → 结构事实(PK)/FK推导(空)/未确认命名推导(file_key 等, requires_confirmation)三态硬隔离；COLUMN_SIZE 取字符长口径解旧画像字节-vs-字符陷阱；`verify/fast_schema.js`(22)+`verify/verify_schema_profile.js`(489 列 dtype/nullable 对拍 profile txt) 双门；采样不做（r2 §2.3 默认关）
- **Semantic Model（2026-11-04 I3，README #57）**：`semantic/model/{vocab,registry,validator,resolver}.js`（core 零 java）+ `models/production/model.json`（真实激光检测领域，业务口径锚定 agent_stage/daily_report 真值：计划 COUNT(*)/完成 score>=0.9/完成率 ratio×100/平均分全加权禁均值之均值；5 实体/15 映射/6 指标/3 维度/3 关系）。`ModelValidator.validate(model, I2schema)` 回溯性=每列必在真库找到（UNKNOWN_REF 护栏，实测 0 错）；`ModelResolver.resolve(term)` 三态 resolved/ambiguous/unknown，置信度只排序**绝不自动选**、未知不臆造（r2 §3.3）。指标禁裸 formula 串（显式聚合语义 r2 §3.2）。DB FK=0 故关系全 naming-derived+requiresConfirmation。**不接生成链**（I4/I5 域）。R7b 泛化：semantic/** 除 inspector/inspect_main 薄壳外禁 Java.type
- 基线铁证（2026-11-04 I0 批逐单元复验，逐字节）：demo_api.cpt = CBEB42E3CE48E46E362B9AE80168026F、销售明细_api.png = A8EF39AB648D5F00DDAE0481D0313110、v2 demo_template_final.cpt = 6161F402B340321B4ABF68B68E301828；br 六连栅格 + prod staging 24 张字节级基线副本在 logs\abr1_baseline*（PDF 含 CreationDate 非确定项，不作铁证）
- **Report Planner（2026-11-04 I4，README #58）**：`semantic/planner/{capability,planner}.js`（零 load/零 Java/零 com.fr，外部件经 ctx 注入=可喂 fake 证伪，天然落 R7）。`ReportPlanner.plan(intent,ctx)` 三态分流（r2 §4.3）：正确性歧义→unresolvedQuestions(requiresConfirmation 不自动选)、越权→validationWarnings(deferred 带 owner **不降级**)、非正确性默认→assumptions(版式/宽度/合计自决不追问)、未知→不编造字段；产 I1 ReportSpec 后注入 `SpecValidator.validate` 复验（一处真相，ready spec 必 0 err）。**不跑真 Agent**（NL→intent 留 I5 真闭环）、**不扩 I1 词汇**（ratio/filters 撞能力墙=诚实拒，真实日报走 #52 rawIR 路）。`verify/fast_planner.js` 20+ 需求矩阵覆盖 r2 §4 四分支全绿。接口契约见 `docs/agent-planner-interface.md`
- **NL→真实 CPT 完整闭环（2026-11-04 I5，README #59）**：兑现"缺的那档"——`semantic/query/sqlbuilder.js`（模型→受控 SQL 纯函数：model 维度/指标 expression → 单语句 GROUP BY 查询，ratio 不进 SQL 走展示层公式，日期定字面禁 `${}`，生成即过 SQL_READONLY 自检）+ ReportSpec 加 `dataset.kind:'sql'` 模型驱动形态（`spec_validator`/`spec_compiler` opt-in 分支，**内嵌 sum-only 路逐字不动**，`sales_demo.json`≡`sales_demo.js`=CBEB42E3 仍成立）+ `semantic/closure/loopguard.js`（r2 §5.2 五上限：maxFixCount/deadline/可改字段白名单/环境类 reject，纯函数）+ 文档 `docs/agent-closure-interface.md`。**端到端已用 ZCode 子代理真跑**：仅凭自然语言→语义 spec（无手写 SQL/IR）→管线→RESULT_DUMP 总计 **33531/26531/79.12** 逐格命中 #52 独立真值、0 retry；子代理并如实上报一个展示层 gap（模型 metric.format 未流到格子→已修）。凭据仍只在 runner 本地 dbpass 注入、JSON/cpt 零凭据
- **模型驱动 SQL 正确性加固（2026-11-04 I5.1，README #61，r3.md 复现后修）**：r3 静态审查提 5 问题，逐条对源码复现 P1–P4 属实（P5 是正确架构边界说明，不改；r3"I6 未开始"过期——I6 已 `c4fe924` 落地）。修=① `lib/isodate.js` 日期单点（严格双边+日历有效性，spec_validator/sqlbuilder 共用，消除松紧不一）② sqlbuilder **跨表拒绝** `UNSUPPORTED_CROSS_TABLE`（machine/fileCount 走 laser_files 不再被静默拼进 `FROM laser_aaa`，JOIN 留 I5.2）③ planner SQL 分支**幽灵成员不再 ready**（memberMissing→rejected、不入 spec）④ make_api SQL 生成路径前置 `ModelValidator.validate(model,schema)` **对不上即拒**（读 I2 schema 快照，不每次重扫库）⑤ ModelValidator scale 有限数校验 ⑥ `verify/verify_sql_data.js` grid↔`db_laser_sub_truth` 逐格哨兵（缺 grid SKIP 不假绿）。引擎端到端 live 复验：正常日报 failures=0 + 跨表干净拒不出错报表 + 负门 5 路 GREEN + 双铁证回补不变。**教训**：fast 层不覆盖 make_api 装载序，T4 前置漏载 `model/vocab.js` 被引擎首跑当场暴露——装载面改动必跑引擎回归
- **Template Patch（2026-11-04 I6，README #60）**：`template/{ops,validator,locator,diff}.js`（core 零 java，纯函数离线测）+ `template/{reader,inspector,patch}.js`（FR-facing 薄壳）+ `patch_main.js`（runraw 端到端）。**R0 读回/写回探针冻结 v1 白名单**（`data/template_patch_readback_truth.txt`）：仅 `replace_cell_value`(cell.setValue→export→re-read PASS) + `replace_dataset`(putTableData→export colCount 变 PASS) 入；r2 §6.2 其余 6 项（style/column-width/add·remove column/filters/params/title）**探针不过/读回无口/命名样式有损 → 明确不做**（附证据不半成品）。`reverseFromCpt` 保持 unsupported（局部 patch 非全量反编译）。命名样式源件默认 abort（README:103 读回即损）；写回**只进 staging**、原件 copy 保留、绝不碰 demo_api.cpt 基线；等价判据用语义 token diff + 渲染像素 diff（导出字节 MD5 不可用，README:126）。LIVE 真跑改 I5 自产日报标题：结构 diff clean + 执行回归数据栅格逐格不变 + 渲染像素 1.69%<5% + 原件保留 → r2 I6 六条验收全过。**I0~I6 全落地**
- **r2.md 全路线（I0~I6）+ r3.md I5.1 收官后仍开放（诚实）**：r3 的 P1–P4 已修（I5.1）、P5 是正确架构边界说明；`?` 值绑定接线（工单待排）；**多表 JOIN 模型驱动生成（I5.2）**、图表/非日期筛选/排序/TopN/钻取（I5.3）、I6 扩更多 patch op（各需 R0 式读回/写回探针先证）= 后续；`docs/gpt/r3.md` 已处理（其静态审查经复现证实），若再有新规范待用户投放
