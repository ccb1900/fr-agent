# fr-agent · 报表创作 Agent Instructions（迭代 4 地基，2026-11-04）

> 给**现成 Agent**（Codex / Claude 等）使用的工作指南。目标：用户提需求 → Agent 自主产出一张 FineReport 报表 → 真实验证 → 交付。
> 铁律：**未经真实验证，不得声称报表可用**。本文件只描述已存在的稳定接口，不要求 Agent 理解 FineReport 内部实现，也不要求写 Java API / 任意 Nashorn 代码。

## 0. 心智：三样东西，一个闭环

| 资产 | 你（Agent）看到的形态 | 你能改吗 |
|---|---|---|
| **ReportIR** | 纯数据 JSON（受约束的报表结构模型） | 是——这是你唯一的产出物 |
| **Backend** | `make_api.js`（跑一次生成 CPT/PNG/PDF 并自检） | 否——只调用，不改 |
| **Result 契约** | `RESULT_JSON` 单行 + `logs/last_run.json` | 否——只读，据此修复 |

闭环：
```
探索数据源与能力  →  写 ReportSpec/ReportIR  →  Ir.validate  →  跑 runner
     ↑                                                            ↓
     └──────── 读 RESULT_JSON（failed stage + diagnostics）修 ←────┘
                     全部 stage passed / success=true → 交付用户验收
```

## 1. 能力边界（先查，别赌）

写任何 IR 前，先读 `Ir.capabilities()`（`lib/ir.js`）——它列出**已支持 / partial / 不支持**：
- 已支持：单 Sheet、title/header/detail/total/cells/chart 块、内嵌/SQL 数据集、参数面板控件族、条件属性（`then` 仅白名单 `bg|color|bold|sizePt|font|rowHeight|colWidth|page`）、图种 legacy+VanChart 族、水印/浮层/工具栏。
- 不支持（IR 里写了也会被 validate 拒）：多 Sheet（`UNSUPPORTED_CAPABILITY:multi_sheet`）、反向解析已有 CPT（`reverseFromCpt: unsupported`）。
- 版本：IR 带 `irVersion:"1"`；validate 认当前版、拒未知版。缺省视为当前版。

**列名/类型不许猜**：一律取自数据源直查画像（`data/db_tables_profile.txt`、`data/db_br_truth.txt` 一类真值），同列唯一 `format`。

## 2. 你要产出的东西（ReportIR）

三条路径，选一：
- **JSON ReportSpec（I1，推荐——不写 JS）**：受约束的 dimensions/metrics/dataset.rows/presentation，见 §3.5。runner 自动编译成 IR。
- **传统 spec**（简单报表，JS）：`{ title, columns:[{name,label,type,widthPt,format?}], heightsPt, data:[[...]], dsName?, paramPanel?, highlight?/conditions?/link?/chart?, connections? }`
- **IR 直通**（复杂/贴近官方形态，JS）：`{ IR: { sheets:[{blocks:[...], widthsPt:[...], floats?}], datasets:[...], param?, watermark?, toolbar?, webPage? } }`

数据集两种形态：
- 内嵌自包含：`{ name, columns:[{name,type,format?}], rows:[[...]] }`——列 `type` 全词表（I0-05 定案，`Ir.capabilities().columnType.embedded`）：`text|string|number|integer|long|float|decimal|boolean|date|datetime`；`number`=legacy（硬转 Integer）。行值形态被逐格校验：`date` 必须字面 `yyyy-MM-dd`（补零）、`datetime` 必须 `yyyy-MM-dd HH:mm:ss`、`integer/long` 必须整值（long 可用纯数字串保精度）、`decimal` 用数字串保高精度、`boolean` 只认 `true|false`、`null` 合法（可空语义保留）。
- SQL：`{ kind:'sql', connection:'<连接名>', query:'SELECT ...', params? }` —— **连接名**写这里，凭据不写（见 §5）。query 受只读闸：必须单语句 `SELECT`/`WITH` 起头且**不得含 `;`**。

字段词汇细节以 `lib/ir.js` 头注 + `Ir.capabilities()` 为准，别自造键。

## 3. 怎么调用管线（稳定机器入口）

```powershell
# 从项目根；run.ps1 会杀所有 java 进程（释放 FineDB 锁）——非本管线的 java 先跟用户打招呼
$env:REPORT_SPEC = 'reports/你的spec.js'          # 默认 reports/sales_demo.js
$env:FR_AGENT_RESULT = 'logs/last_run.json'       # RESULT 落盘点（可选，有默认）
.\run.ps1 -Script make_api.js                      # 默认堆 1200m；内存紧张先 wsl --shutdown
```

- 只想烘 SQL+导出、不做执行/出图（生产构建通道）：`$env:BR_SKIP_EXEC='1'`（此时 RESULT 的 `execute/render` = `skipped`，仍算 success）。
- 换部署目录：`$env:BR_DEPLOYDIR`（默认演示服务器 reportlets/fineagent）。
- 根/引擎位置：`$env:FR_AGENT_HOME`（项目根）、`$env:FR_HOME`（FineReport 安装）。

## 3.5 JSON 入口（ReportSpec，I1——你更该用的形态，不写 JS）

若你不想写 Nashorn JS，提交**纯 JSON ReportSpec**（`examples/report-spec/sales_demo.json` 是等价范例），同一 runner 走 `.json` 分支：
```powershell
$env:REPORT_SPEC = 'examples/report-spec/你的报表.json'
.\run.ps1 -Script make_api.js
```
- 链路：`JSON.parse → SpecValidator（结构+语义，拒则 exit 2）→ SpecCompiler（ReportSpec→ReportIR）→ 复用既有 Ir.validate/build/CPT/门禁`。JSON 里**无处放凭据**，连接/目录仍由本机 env 控制。
- **v1 词汇（sum-only）**：`{ specVersion:"1", report:{name}, outName, dimensions:[{field,label,widthPt?,format?}], metrics:[{field,label,aggregation:"sum",dataType?,widthPt?,format?}], dataset:{rows:[[...]]}, presentation:{type:"table",showTotal?,heightsPt?} }`。列顺序=维度在前、度量在后；`dataset.rows` 每行宽度须等于列数。
- **v1 明确不支持**（写了必被结构化拒，别试）：`filters`、`chart`、`dataset.query/type:semantic`（→ I2/I3）、非 `sum` 聚合（avg/count/ratio_of_sums…→I3）、多 Sheet。契约镜像见 `schemas/report-spec.schema.json`（权威执行者=`lib/spec_validator.js`，Nashorn 无 JSON-Schema 库）。
- 修复信号同上 §4：`SPEC ISSUE: <CODE> @ <JSON路径>: <message>` 照路径改 JSON 重跑。

## 4. 读结果（你的修复信号）

每次跑完，看 stdout 末尾 `RESULT_JSON {...}` 与进程退出码：
```json
{ "success": true,
  "stages": { "input_load":"passed","runtime_initialize":"passed","datasource_connect":"skipped","ir_validate":"passed",
              "object_build":"passed","cpt_export":"passed","cpt_validate":"passed","execute":"passed","render":"passed","deploy":"passed","roundtrip":"passed" },
  "order": [...], "diagnostics": [...], "exit": 0 }
```
- `exit` 码是**权威裁决**（`success = (exit===0)`）：`0` 通过 / `1` 某段失败（门禁拦下）/ `2` spec 缺失或装载炸 / `3` 构建/初始化异常 / `4` 数据连接失败 / `5` 行数保护配置 / `8` 提交额度预检（内存）/ `9` IR 校验失败。
- **stage 全序（I0-02 起 11 段，一处真相=`lib/runresult.js` STAGES）**：`input_load → runtime_initialize → datasource_connect → ir_validate → object_build → cpt_export → cpt_validate → execute → render → deploy → roundtrip`。无 `connections` 的 spec `datasource_connect=skipped`（skipped 不算失败）；`deploy` 排在 `render` 之后（渲染失败即不部署）；开跑即写初始快照（`success:null`），坏输入/崩溃路径也保证 RESULT 文件是**本轮**的（不会残留上次绿）。
- `failed` 的 stage 告诉你**卡在哪一段**；其下游自动 `skipped`。
- `diagnostics` 逐条带因；IR 类错误自 I0-01 起是结构化行：`IR ISSUE: <CODE> @ <JSON路径>: <message>`（如 `IR ISSUE: INVALID_TYPE @ sheets[0].blocks[3].conditions[0].when: when must pick exactly one ...`）。CODE 词汇：REQUIRED / INVALID_TYPE / INVALID_ARRAY / INVALID_NUMBER / INVALID_ENUM / INVALID_SHAPE / DUPLICATE / UNKNOWN_REF / INVALID_URL / INVALID_TARGET / SQL_READONLY / UNSUPPORTED_IR_VERSION / UNSUPPORTED_CAPABILITY——照 JSON 路径定位改 IR，重跑，直到全 `passed`。

## 5. 硬约束（安全 + 交付纪律，违反即停）

- **凭据不进你写的 spec/IR，更不进交付的 cpt**：连接名写 `datasets[].connection`；`driver/url/user/password` 只放本机 `spec.connections` 段（用户环境受信任配置）。交付前对产物 `grep 'whmeiko\|password'` 必须 0 命中——**且管线自 I0-04 起有自动凭据门**：deploy 后扫本轮部署件，命中密钥 token 即**撤回产物 + deploy=failed + 退出码非 0**，你无需手工 grep 也拦得住（但别依赖它，写时就别拼进去）。
- **不许产出的输入**（后端会拒，validate 或构建期当场报）：`toolbar` 用 `className` 指任意 Java 类；`nav`/`iframe`/`linkTo`/`detail.link` 用绝对/外部 URL（`scheme://`、`javascript:`）或含 `..` 穿越（只允许相对路径，reportlet 还禁 `..`）；`targetFrame` 只认 `^[A-Za-z0-9_-]{1,32}$`；`floats.imageFile` 越出 `FR_AGENT_HOME`、`imageFormat` 只认 `png|jpg|jpeg|gif|bmp`；SQL 数据集 `query` 必须单语句 `SELECT`/`WITH` 起头且不含 `;`（只读闸）；浏览器族配置里表名/列名必须是常规标识符（禁引号/分号/括号/空格/`[]`）；SQL 里手拼凭据或未授权数据源。
- **SQL 里的参数**：`${param}` 是 FR 的**文本替换不是绑定变量**（AGENTS §3），经 `wb.execute` 这条 API 路径**不会**被替换 → 会原样进 SQL 把日期/数值炸成空集（0 行）。日期/机台等筛选把值**烤成字面量**进 SQL（语料 browser 族 `dc >= lo AND dc <= hi` 就这么做）；运行期交互筛选是浏览器族 `br_*` 的专职，独立报表别重造。脏日期（混 `2026/9/14` 与 `2026-9-13`）先 `TRY_CAST(col AS date)` 规范化再比。
- **公式函数词汇**（实测，见 `Ir.capabilities().formula`）：FR 嵌入式解释器只有 `SUM/AVERAGE/MAX/MIN/COUNT/round()/row()/col()` 这个量级——**`SUMPRODUCT`、`VLOOKUP`、`IFERROR` 等 Excel 专有函数会 `InterpreterError: no function found` 让 execute 段炸**。加权平均用 `SUM(x)/SUM(n)` 或独立聚合行，别想当然写 Excel 函数。

## 5.5 已知坑（迭代 4 现成 Agent 实跑学费，别重踩）
- 列宽/字号经验值随渲染管线标尺变（当前约 0.667 px/pt、SimHei attr=112）——照旧 spec 注释拍宽常折行，按当前 PNG 实测重标；粗体表头、`完成率(%)` 这类长文案要更宽。
- execute 段失败根因现在会进 `RESULT.diagnostics`（如上面 `SUMPRODUCT`）；照 diagnostics 直接定位，不必翻 `run.out` 全量日志。
- **改 `lib/`（尤其 ir.js/object.js/cpt.js）后必须跑回归**：`run.ps1 -Script make_api.js`（默认 spec），`demo_api.cpt` MD5 必须 `CBEB42E3CE48E46E362B9AE80168026F`、`销售明细_api.png` `A8EF39AB648D5F00DDAE0481D0313110` 逐字节，`failures=0`。最后一步用默认 spec 收尾（别把基线踩脏）。
- **不许“validate 绿了就说完成”**：交付面 = RESULT 全 stage passed（或 BR_SKIP_EXEC 下 execute/render=skipped 且构建/校验/部署 passed）+ 渲染件（PNG/PDF）真实存在 + 真库报表的数值经 RESULT_DUMP 逐格对过真值。
- 排版红线（字体/边框/对齐/列宽反算）见 `AGENTS.md` §2 与 `TABLE_DESIGN_STANDARD.md` 落地清单。

## 6. 一句话流程

**查能力 → 拿真列名写受约束 IR → validate → 跑 runner → 读 RESULT 的 failed stage + diagnostics 定点修 → 全绿才交付，附 CPT + 预览图 + 验证摘要。**

> 闭环已有现成 Agent 实跑记录（README #52：ZCode 子代理独立产出两张真库报表并经 RESULT 自修）；I0 可靠性收尾（README #54）后，validate/边界/退出码契约均已硬化；I1（README #55）新增 JSON ReportSpec 入口（§3.5），Agent 可不写 JS 直接提交受约束 JSON。是否加 MCP 仍以真实体验定夺（暂不做）。
