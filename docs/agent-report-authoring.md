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

两条路径，二选一：
- **传统 spec**（简单报表）：`{ title, columns:[{name,label,type,widthPt,format?}], heightsPt, data:[[...]], dsName?, paramPanel?, highlight?/conditions?/link?/chart?, connections? }`
- **IR 直通**（复杂/贴近官方形态）：`{ IR: { sheets:[{blocks:[...], widthsPt:[...], floats?}], datasets:[...], param?, watermark?, toolbar?, webPage? } }`

数据集两种形态：
- 内嵌自包含：`{ name, columns:[{name,type('text'|'number'|'float')], rows:[[...]] }`
- SQL：`{ kind:'sql', connection:'<连接名>', query:'SELECT ...', params? }` —— **连接名**写这里，凭据不写（见 §5）。

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

## 4. 读结果（你的修复信号）

每次跑完，看 stdout 末尾 `RESULT_JSON {...}` 与进程退出码：
```json
{ "success": true,
  "stages": { "input_load":"passed","ir_validate":"passed","object_build":"passed",
              "cpt_export":"passed","cpt_validate":"passed","execute":"passed","render":"passed","deploy":"passed" },
  "order": [...], "diagnostics": [...], "exit": 0 }
```
- `exit` 码是**权威裁决**（`success = (exit===0)`）：`0` 通过 / `1` 某段失败（门禁拦下）/ `2` spec 缺失 / `3` 构建异常 / `4` 数据连接失败 / `5` 行数保护配置 / `8` 提交额度预检（内存）/ `9` IR 校验失败。
- `failed` 的 stage 告诉你**卡在哪一段**；其下游自动 `skipped`。
- `diagnostics` 里是逐条原因（如 `IR ISSUE: sheet0 block3 cond0: when must pick exactly one ...`）——照着改 IR，重跑，直到全 `passed`。

## 5. 硬约束（安全 + 交付纪律，违反即停）

- **凭据不进你写的 spec/IR，更不进交付的 cpt**：连接名写 `datasets[].connection`；`driver/url/user/password` 只放本机 `spec.connections` 段（用户环境受信任配置）。交付前对产物 `grep 'whmeiko\|password'` 必须 0 命中。
- **不许产出的输入**（后端会拒，别试）：`toolbar` 用 `className` 指任意 Java 类；`nav`/`iframe`/`linkTo` 用绝对/外部 URL（`scheme://`、`javascript:`）——只允许相对路径；`floats.imageFile` 越出 `FR_AGENT_HOME`；SQL 里手拼凭据或未授权数据源。
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

> 尚无 Agent 实跑过本闭环。第一版真接入后，用真实体验决定是否再加 MCP（暂不做）。
