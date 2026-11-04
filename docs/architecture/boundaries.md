# ABR-1 架构边界（2026-11-03）

> 本阶段改造承诺：**架构改变，报表一张不变**（迁移基线 = commit 7b74549）。

## 一级边界

```
┌────────────────────────────────────────────────────────┐
│ 业务层   reports/  reports_prod/                        │  报表 spec（数据/列/标题/凭据名）
│ Feature  features/data_browser/                        │  业务生成器：spec/IR 词汇产出
├────────────────────────────────────────────────────────┤
│ Core    lib/ir.js → lib/object.js → lib/cpt.js          │  编译核心：IR → 对象图 → 校验器
│         lib/index.js（CORE 门面，事实契约：Ir/Obj/Cpt）  │
├────────────────────────────────────────────────────────┤
│ Runtime runtime/paths.js（路径单点）                     │
│         runtime/bootstrap.js（FR 激活链）                │
│         runtime/datasource.js（连接注册）                │
├────────────────────────────────────────────────────────┤
│ Runner  make_api.js（v3）/ make_report.js（v2 对照）     │  流程编排，不实现业务细节
│ 工具    tools_*.ps1 / scripts/check-boundaries.ps1      │
├────────────────────────────────────────────────────────┤
│ 语义层  semantic/schema/（I2，独立旁路，不在主链上）      │  只依赖 java.sql+dbpass+纯 JS；换引擎可整体复用
│   inspector.js(唯一触库薄壳) → metadata/relation/serializer(core 零运行时依赖) → data/schema_*.json │
│ 语义层  semantic/model/ + models/production/model.json（I3）│  实体/指标/维度/关系/映射：validator 回溯 I2 schema，resolver 歧义不自动选
│ 语义层  semantic/planner/（I4，零 load/零 Java，ctx 注入 I1+I3）│  结构化意图→ReportSpec+假设/追问/警告；越权明拒带 owner，不降级不编造
└────────────────────────────────────────────────────────┘
```

## 调用链（v3，与 make_api.js 实际顺序一致）

```
make_api.js
  → load(runtime/paths.js)                 # 装载锚：FR_AGENT_HOME 单点
  → load(Paths.lib('object.js'|'ir.js'|'cpt.js')) + load(Paths.spec(REPORT_SPEC))
  → load(Paths.runtime('bootstrap.js')) + load(Paths.runtime('datasource.js'))
      → Runtime.initialize()               # FR 激活链（保持原顺序）
      → Runtime.DataSource.register()      # testConnection → 注册，失败 exit 4
  → Ir.compile(SPEC) / Ir.validate(IR)     # lib/ir.js（纯 JS，零 FR 依赖）
  → Obj.build(IR)                          # lib/object.js（IR→FR 对象图）
  → wb.export() → cpt；Cpt.validate / Cpt.assertRoundTrip 回归门
  → execute / ImageExporter / PDFExporter 导出
```

说明：spec 先于 env 加载是**有意为之的 fail-fast**（SPEC 缺失 exit 2，省一次 env 启动）；
`Ir/Obj/Cpt` 全局名是事实契约（见 lib/index.js 头注），CORE 门面（lib/index.js）为 Node 兼容预留，
runner 改走门面 = ABR-2 触发器（届时 R6a 断言与本图同步下移，单 commit 收口）。

## 归属规则摘要

- `lib/browser.js` = ABR-1 兼容垫片（唯一豁免），真实模块 = `features/data_browser/browser.js`。
- Feature 只产出报表规格；不初始化 FR、不执行、不导出。
- Runtime 只初始化环境/注册连接；不含报表业务知识。
- 默认路径检查工具：`scripts/check-boundaries.ps1`（R1–R7，R6 = Runner 接线断言，R7 = 语义层独立边界）。

## 环境变量口子（职责分离）

| 变量 | 语义 | 默认 | 定义点 |
|---|---|---|---|
| FR_AGENT_HOME | 项目根 | D:/fineagent | runtime/paths.js |
| FR_HOME | FR 安装根 | D:/software/FineReport_11.0 | runtime/paths.js |
| REPORT_SPEC | 报表规格路径（root 相对） | reports/sales_demo.js | make_api.js |
| BR_DEPLOYDIR | 部署输出目录 | FR_HOME 下演示部署位 | make_api.js |
