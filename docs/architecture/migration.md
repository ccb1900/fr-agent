# ABR-1 迁移记录（Architecture Boundary Refactoring, 2026-11-03）

> 成功标准：架构变化 + 报表一张不变。基线 commit = `7b74549`（ABR-0）。

## 基线（阶段0，commit 7b74549）

- git HEAD 起点：`3a66a0a`（含当日 v4.2 VanChart 地板 + dbpass 凭据出库）→ 新增基线提交 `7b74549`。
- MD5 清单：`logs/abr1_baseline_manifest.txt`（v2/v3 默认、br 三张演示部署位、prod staging 24 张）。
- br 六连 RESULT 栅格副本：`logs/abr1_baseline/_br_*_grid.txt`。
- v2 默认 demo_template_final.cpt = `6161F402B340321B4ABF68B68E301828`。
- v3 默认 demo_api.cpt = `CBEB42E3CE48E46E362B9AE80168026F`；销售明细_api.png = `A8EF39AB648D5F00DDAE0481D0313110`。
- prod 批量工具（本阶段新增）：`tools_prod_run.ps1`（BR_MODULESET=prod + BR_TPFX + BR_DEPLOYDIR=build_prod\mkwh\<staging>；本机镜像库无 t_collector_ 表 → 恒 -SkipExec，执行验证按既有口径在生产服务器做）。

## 各阶段提交与验收

| 阶段 | commit | 内容 | 验收 |
|---|---|---|---|
| 0 | 7b74549 | 基线 + tools_br_run.ps1 分隔符修复 + tools_prod_run.ps1 | 基线全套可复现 |
| 1 | e048368 | runtime/paths.js；make_api 的 load/checkIn/outDir 走单点 | 默认 spec CBEB42E3 逐字节 |
| 2 | 63cb43d | lib/browser.js → features/data_browser/browser.js（垫片+门面）；49 spec 引用改 `Paths.feature()` | 评分流水演示 cpt `B1F47A0B…` = 基线；prod staging 25/25 cpt MD5 全同 |
| 3 | 3dd1f1f | runtime/bootstrap.js + runtime/datasource.js；make_api 抽离激活链/连接注册（文案与退出码逐字保持） | 默认 CBEB42E3 ✓；br_aaa B1F47A0B ✓ |
| 4 | bf58321 | lib/index.js（CORE 门面）+ scripts/check-boundaries.ps1 | R1–R5 全净 |

## 迁移后全量回归（最终门）

- br 六连（aaa 默认/p2/stageL/d13 筛日期/gosa/pwr）：failures=0 ×6，RESULT 栅格 **6/6 字节全同**（SQL 分页/筛选/机台/工序语义零漂移）。
- prod staging 24 张：EXIT=0 failures=0 ×24，cpt 字节 25/25（含遗留文件）同基线。
- v2 默认：`6161F402…` 与基线一致（v2 通路零触碰自救证明）。
- 能力自检四族（widgets/cellattrs/族二/VanChart）：EXIT=0 failures=0 ×4；控件族/单元格属性/族二产物 byte-size 与迁移前一致；VanChart 为 post-floor 版本（floor 属迁移前改动）像素复认（"画区地板"修复保持）。
- v3 默认收尾：demo_api.cpt = `CBEB42E3…`、png = `A8EF39AB…`（与 #45/#46 记录一致）。
- 退出码语义：EXIT=0 全通过；DB CONNECTION FAIL→exit(4)、relaxRowControl→exit(5)、IR/装配失败→exit(3) 逻辑未动。

## 目录树（迁移后）

```
fr-agent/
├── make_api.js / make_report.js / make_verify.js / make_pixel_diff.js   ← runner（保留根目录，运行协议不动）
├── lib/            ir.js · object.js · cpt.js · index.js（CORE 门面）· browser.js（兼容垫片）· dbpass.js
├── features/data_browser/    browser.js（业务生成器真实模块）· index.js（feature 门面）
├── runtime/        paths.js · bootstrap.js · datasource.js
├── scripts/        check-boundaries.ps1
├── reports/ (40) · reports_prod/ (24)
├── probes/ · verify/ · data/ · logs/ · build_prod/
├── docs/architecture/ boundaries.md · dependency-rules.md · migration.md
└── AGENTS.md · README.md · GENERATOR_DESIGN.md · TABLE_DESIGN_STANDARD.md
```

## 明确不做（ABR-2 起议）

- 拆 object.js（948 行）、重写 ReportIR、CPT→IR 反向导入、多 Backend、完整 Compiler Pipeline、SQL 参数绑定改造、Java API 调用改写、npm/TS 引入。

## 妥协项 / 越界修复记录

1. **git 工具**：本机原无 git 可执行文件，经用户补装后恢复；每阶段独立 commit 已满足。
2. **tools_br_run.ps1 分隔符伤**（08:49 事故存量，本阶段门禁必需）：仅修复语句分隔符，语义照旧。
3. **tools_prod_run.ps1**：新工具（维护类，类比 tools_br_run.ps1 家族）。PS5.1 对 UTF-8 无 BOM 中文注释按 GBK 读——两处事故后统一 BOM 重存（check-boundaries.ps1 / tools_prod_run.ps1）。
4. **spec 内仍为绝对路径字面量**：`Paths.feature()` 依赖 make_api 先载 paths.js；spec 不能脱离 runner 独立执行（现状等价 pre-ABR；FR_AGENT_HOME 重定向对 spec 内 load 无效——记为 ABR-2 待接线项）。
5. **能力自检 VanChart 族迁移前 hash 未留影**（14:49 floor 重刷后未抓字节，本轮以尺寸+像素复认补强）；控件族/单元格属性/族二 byte-size 与迁移前一致。
6. **v2 runner 未接 runtime/paths**：本轮不强制拆分（任务书 §"一个重要取舍"）。
7. run.ps1 加 `$Heap`（-Xmx）建议仍未拍板（当日 j2v8 提交额度事故的长期解，与 ABR-1 无关，挂账 README #46 更新结论后一并处理——本轮所有 java 调用实际用 -Xmx1200m 成功）。
