# AGENTS.md — fineagent 管线的 agent 行为约束（任何 agent 开工前必读，约束高于个人判断）

## N. 夜间自主工作规范（Night Shift v1.0，2026-11-05 用户授权，每次会话必读）

> 用户离线期间的自主工程模式。最高目标：持续提高真实产品能力（Agent 可靠理解报表需求、创建/验证/修改 FineReport 报表），不是代码量/提交数/架构复杂度。Golden v1（README #98）为已验证基线，不推翻、不重复实现。

**优先级**：P0 确定性缺陷与安全（数据丢失/CPT 损坏/误覆盖/并发重复执行/结果与数据不一致/失败误报成功/超范围修改/环境破坏——发现即停其他工作先处理）> P1 RunId 测试收尾（已于 r24 完成，见 docs/night-shift-log.md）> P2 Agent 产品链路审查（真实代码调用链，不从架构图开始）> P3 报表创作质量（一次只开一个有验收标准的方向）> P4 工程质量（只处理有实际维护/正确性影响的）。

**不可突破约束**：Runtime 冻结（单机单实例/Named Mutex/active.json/java.pid/PID+StartTime/fail-closed；禁自制队列/DB 调度器/OwnerToken/额外 Supervisor/第二套并发机制；除确定性 P0/P1 外不改 Runtime 生产代码）。技术栈约束：不迁 TypeScript、不为 DDD 拆层、不引 ANTLR、不造新 IR/DSL/协议/抽象层、不动 FineReport 交互机制、不破坏已验证的 CPT/Object/IR 路径、不把 FR 不支持的能力包装成支持。技术选型先调查成熟方案。

**强制流程（每任务七步）**：①确认真实状态（分支/SHA/工作区/读全模块与调用方与测试与历史，不只看 diff）→②建立证据（何处/何码/何路径/何触发/何影响/有无成熟方案；无证据不定缺陷）→③最小有效方案（成熟库>既有机制>局部修复>必要新抽象>最后才重构）→④实施（一次一个问题、改动可解释、不顺手改无关、保回滚）→⑤验证（适配的语法/单测/集成/真实路径/产物检查/实预览；失败不许改断言迁就；未跑的测试明确标注未跑）→⑥复盘（原问题解否/新问题/其他模块/文档同步/更简方案）→⑦独立 commit（message 说真话）。

**自主决策边界**：可自主读仓库/安全本地检查/改码/加测试/修明确缺陷/更新与代码一致的文档/本地分支与 commit/继续下一项。禁止：强推 main、删分支历史、不可逆 Git 操作、删真实报表/数据库/用户文件、无隔离跑可能覆盖生产报表的集成测试、改 FineReport 安装目录生产文件当测试、换技术栈、引大框架、伪造测试输出/截图/记录、降测试标准凑完成。需用户决定的事项：先做不依赖该决定的部分并记录待决，不擅自做不可逆选择。

**三轮规则**：同一问题最多三轮修复（正常实现→依失败证据修正→仅处理明确剩余）；三轮未解即暂停记录阻塞原因，转其他独立任务。无可信下一项宁可停止，不造任务。

**工作记录（强制）**：`docs/night-shift-log.md`（每项：目标/代码证据/实施/验证结果/未验证事项/commit SHA/下一项）＋`docs/night-shift-backlog.md`（每项：优先级/真实证据/用户影响/修改范围/验收标准/外部依赖；完成即移除；不得把风格偏好包装成高优）。

**停止条件**：环境时限/预算/上下文尽、发现可能损坏数据或生产的操作、缺凭据依赖授权、连续验证失败无法定位、无可信高价值工作、环境将结束。停止前：保存工作、不留未说明半成品、查 Git 工作区、记最后成功提交与未完任务及阻塞、给出下一轮可直续步骤。

**诚实区分**：已实现/已静态审查/已自动化测试/已真实集成验证/尚未验证——五态不得混写。

---

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
  - 快速层（无引擎，秒级，不碰 FineDB/不产字节）：`scripts/run-fast-tests.ps1`（18 套件：fast_parse/fast_ir_contract/fast_runresult/fast_browser_sql/fast_report_spec/fast_schema/fast_semantic/fast_planner/fast_sqlbuilder/fast_sqlpath/fast_closure/fast_template/fast_contracts/fast_manifest_evidence/fast_capability_gate_consistency/fast_golden_closure/fast_layer_coherence/fast_baseline，任一 rc≠0 整体 exit 1；fast_baseline=三铁证 MD5 快速层断言；fast_layer_coherence=账本×入口×jar 锚定不变量）
  - 零误伤扫描（无引擎）：`nashorn.jar ... Shell probes/scan_all_specs.js`（reports/ 全量 compile+validate，合法报表=回归门）
  - 引擎负门（需 java/FineDB，会杀 java）：`scripts/run-engine-negative-tests.ps1`——断言"失败必非零退出码、无假绿"，末步自动回补默认 spec 护基线
  - 工具链集成门（r13/r14，改 agent/tools/*、runtime supervisor、config.ps1、run.ps1、contracts.js 必跑）：`scripts/run-integration-tests.ps1`（`verify/check_ps1_static.ps1` 静态门：PSParser tokenize+ASCII-only+无硬编路径；`verify/integration_runtime.ps1` **全链故障注入**——现行 S 号见 `docs/architecture/runtime-supervisor.md` §5（r21 起至 S28：互斥 S2/S4/S15·真宿主崩溃 S20·pidfile 十变体 S21·同 RunId 并发 S24·登记故障 S25/S26·文件四分类 S27/S27e·status 黑盒链 S28·patch 证据 S17 等；"S1–S19"是 r13/r14 历史编号，只作档案不作现行断言）。**Runtime Supervisor 状态协议见 `docs/architecture/runtime-supervisor.md`；互斥=OS 命名 Mutex（单 Session）、恢复=进程身份+文件状态 fail-closed；不变量必须配能主动制造故障并证明系统正确拒绝的测试（r14 原则，不以 GREEN 自证）**

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
- **提交额度预检已删（2026-11-06 用户拍板，README #111）**：run.ps1 不再查 FreeVirtualMemory/heap+900；#46 原生崩（hs_err×7，不报 Java OOM）的触发条件是**未限堆 6G 默认堆**，限堆 `-Xmx1200m/400m` 是主防线，预检对其只是过度保守的兜底、在小堆场景误拦（实测提交剩余 1776MB 时 -Xmx400m 可正常跑）。**不要再引入固定常数预检**；JVM/原生真失败走非零退出 fail-closed。
- **cell 级 highlight 条件 `when.column` 实测=对本格值求值（2026-11-04 批A 像素实证，README #71）**：列名不跨格求值——空串格 `'<60'` 恒真（三行全画线）、`'>0'` 恒假（全列空白）；跨列判断一律 `when.formula` 相对公式（`=F3<60` 本格锚+行自动偏移，官方语料同款）。字面换值/公式换值/粗边框/超链/内嵌控件四动作已实证
- **v2 spec 总分列必须放最右（README #71）**：totalCol 聚合格在中间列时被 `total.label`（span=n−1）合并区吞并 → 引擎丢格 → 幽灵样式 → CPT GATE「style count mismatch」表象；根因是格重叠不是样式本身

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

## 6. 项目状态速查（2026-11-06 压缩版）

> 逐轮叙事不再堆叠在本文件——**事实库=README 编号索引**（全文 docs/history/README-full-2026-11-06.md）、**缺口账=docs/architecture/coverage.md**、**逐轮审查=docs/gpt/r1~r24.md**、**工作日志=docs/night-shift-log.md**、**提交叙事=git log**。本文件只保留行为规则（§N/§0-§5）与以下四条。

- **现状**：批 0/A-J + 批B 车道全结 + 阶段2 Agent 闭环（五 verbs/三形状 e2e）；**缺口归属清零（ALIGN unattributed=0，≠已实现）**；coverage（2026-11-08 生成器复核）：类级 missing=0 / partial=21 / noncore=44（旧快照 missing=32 partial=20 已废）；能力账本=application/capability_manifest.js **72 项 / agentAvailable=50**（四层+regressionScope，机器对账器 verify/fast_manifest_evidence.js + verify/fast_layer_coherence.js 已入 fast 18 套件）；**层间一致性（2026-11-08）=docs/architecture/layer-coherence.md**（11 层机器判定 + 4 条不变量全绿 + jar E1 锚定：102 核心 jar/140,118 类/182 管线点名类全解析/63 项 anchored）；闭环审计最终基线=docs/architecture/capability-closure-audit.md（§6 = §5 实施结果）。
- **架构原则（2026-11-06 五层模型）**：fr-agent 不做 FineReport 的重新实现，只做"让 Agent 安全完整调用 FR 已有能力"的语义接口层。新增能力默认顺序 = 查 Engine 原生 → 查 Object/CPT 构造 → 查 IR 键 → 补 ReportSpec/Planner；**不能因为 IR 没字段就认为 FR 不支持**。五层差集与 A/B/C/D 清单见 `docs/architecture/native-capability-inventory.md`。
- **路线图**：`docs/architecture/capability-matrix.md`（七源对账+六维+P0-P3）。P0 第一项「cells 多行合并表头（rowSpan）」已收 + R3-0 收尾（游标含 rowSpan、合并格不再被覆盖；IR 整数闸/块内重叠静态拒；7 场景断言+真引擎载体；Agent 可用=待验证；频率 103/240 demo 文件）；R3-1/条件高亮/参数面板/合计聚合/rows 出图/多 Sheet SQL extra/vmap/vheatmap/seriesImage 等已接；poly/heatmap 旧 pending 表述已废（vheatmap 已接）。当前主线=能力账本与闸门一致性 + 真实业务报表验收。
- **铁证**：demo_api.cpt=CBEB42E3… / 销售明细_api.png=A8EF39AB… / v2=6161F402…（改 lib/object|ir|cpt 必逐字节复核）。
- **未结（直续步骤见 docs/night-shift-log.md）**：阶段2（2026-11-07）已收——A段外部 34-commit 审查未修 P1×4/P2×7 反例先行清零（对账表见 night-shift-log）＋P3 未修项如实挂 backlog；B段五 verbs（list_reports/inspect_template/sample_data/promote/restore）+modify→promote→restore 闭环+错误面 nextActions+resolve/plan 退出码一致；C段外置 LLM 口径三形状端到端 GREEN（一手发现 FR 导出层 ']' 注入损坏=probe_c3_titleA 系列）。Golden e2e 全链 PASS（**ge20261108053139-20f321** 默认业务 + **ge20261108081409-3c1bc7** 组合业务 G2 + **ge20261108082641-e5ede7** 组合业务 G3：SQL 真库+柱形图+页眉页脚+参数面板+条件高亮（PNG 红字 1411 像素）+合计+modify，逐格真值 10 行/合计 33531:26531；2026-11-08 本轮改动后复跑）；seriesBorder（三次挂载像素阴性）与 vpie 标签/汇总（四次实验+官方语料显示 PieCategoryLabelContent 属 gauge）均已判否并挂 backlog P3——保持 pending、不承诺；poly 保持、批F 写回/批D 凭据（用户决定）。
- **不变**：Runtime 冻结；§N/§1-§5 全部约束；欠账以 coverage.md 为准；与本文件冲突时以更新日期新者为准。
