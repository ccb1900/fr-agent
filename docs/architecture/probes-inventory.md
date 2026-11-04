# 探针与真值资产清单（r8 P2 治理第一步：只登记，不搬迁）

> 现状：`probes/` 172 个文件，是 FineReport API 考古与能力取证的主要资产；其中一部分是**正式能力的唯一证据**，
> 一部分是一次性探索。本文件先给出三类清单与运行条件，不做目录迁移（r8 §七：先建清单，再谈搬迁）。
> 约定：新探针放 `probes/`、真值放 `data/`、日志放 `logs/`；正式回归测试继续放 `verify/`。

## 一、正式证据探针（被产品/回归引用，删除或改语义必须先更新引用）

| 探针 | 产物 | 被谁消费 | 运行条件 |
|---|---|---|---|
| `probe_relation_unique.js` | `data/i55_relation_unique_truth.json/.txt`（v2：指纹+时效+关系级） | `make_api` → `SemanticPreflight`（JOIN 安全） | 需真实库 + `SQL_*` env + `dbpass`；写失败即整体 failed |
| `probe_patch_readback.js` | `data/template_patch_readback_truth.txt`（R0 冻结白名单） | `template/ops.js` 白名单依据 | runraw + FR 引擎；只读自产 CPT |
| `probe_patch_dataset_integration.js` | `data/i61_dataset_integration_truth.txt` | `template/{inspector,locator,patch,regression}` 集成证据 | runraw + FR；临时件自清 |
| `probe_tabledata_api.js` | （stdout 即证据） | `inspector.datasetSnapshot` 的 API 依据 | runraw；内存构造，不落盘 |
| `probe_image_export2.js` | （stdout 即证据） | 渲染回归导出器可用性 | runraw + bootstrap |
| `probe_typemap.js` | 类型映射证据 | `object.js` DS_JTYPE / 列型保真 | runraw + FR |

## 二、业务真值（对拍基线，不是探针）

| 文件 | 用途 | 生产者 |
|---|---|---|
| `data/db_laser_sub_truth.txt` | 日报逐日/合计真值（33531/26531/79.12） | JDBC 直查 SQL |
| `data/db_laser_aaa_truth.txt` | 明细表画像/真值 | JDBC 直查 |
| `data/db_br_truth.txt` / `db_tables_profile.txt` | 浏览器族列名/类型/格式画像 | JDBC 直查 |
| `data/schema_atom_live_demo.json` | I2 结构快照（模型回溯/证据指纹输入） | `semantic/schema/inspect_main.js` |

## 三、一次性探索（保留作考古，不作为验收依据）

- `probe_vanchart*.js`、`probe_webpage*.js`、`probe_widgets*.js`、`probe_open*.js`、`probe_papercap.js` 等：
  用于确认 FineReport 对象/控件/图表 API 的可用签名；结论已固化进 `lib/object.js`/`lib/cpt.js` 或 README 编号条目。
- `probes/_probe*.js` 与临时扫描脚本：一次调用即弃。

> 判定规则：**被代码/文档引用 + 有落盘真值/可重复运行 = 正式证据**；否则视为一次性探索。
> 未来若迁移到 `research/probes`，先按本清单移动正式证据并在引用处同步路径（当前不迁）。

## 四、运行提醒

- `run.ps1` 会杀 java 释放 FineDB 锁；`runraw.ps1` 不杀 java。
- 探针写中文一律经 `Files.write(...,'UTF-8')`，Nashorn 源码字面量不保证 UTF-8（README 教训）。
- 任何"数据侧唯一性"结论都只是快照：TTL 30 天 + 指纹绑定（schema/模型/物理源），过期即失效。
