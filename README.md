# Anselse 工作区

> **Direction 的 GitHub** —— 导演优先的 AI 视频工具 + 可 remix 的调度配方（Recipe）社区。
> 模型是可替换的水管，Recipe 是流通与增值的资产。

## 文档索引

| 文档 | 内容 |
|---|---|
| [01-product.md](docs/01-product.md) | 产品背景：市场判断 · 定位 · 两边市场 · 三个复利回路 · 风险与边界 · 商业模式 |
| [02-features.md](docs/02-features.md) | Feature 方案：Recipe 原子 · 编辑器/Take/社区/FTUE/Adapter 五模块 · 优先级（P0-P2） |
| [03-tech.md](docs/03-tech.md) | 完整技术方案：架构 · 域模型（Recipe/事件日志/Take/谱系）· Adapter 编译器层 · 技术栈 · monorepo 布局 · 测试策略 · dsh 决策对照 |
| [04-pre-dev.md](docs/04-pre-dev.md) | 开发前期准备：关键路径（尽调→红线测试→schema 冻结→脚手架）· 验证/定义/技术/合规四类工作流 · Definition of Ready · 风险登记 |

## 三个不可动摇的产品决策

1. **流通单元是结构化 Recipe，不是 prompt 文本**——prompt 一截图就被抄走，Recipe 的价值在版本链 + 谱系 + 可重放，抄不走。
2. **UI 只承诺模型能兑现的控制轴**（capability 感知）——交付性是这类产品的头号死因，用结构化解，不用嘴解。
3. **先工具 + 自产 50-100 个精品 Recipe，后开社区**——社区不能空手起。

## 知识来源（均为上游输入，产品 schema 自有）

- **内部导演方法论**（团队 skill：行动逻辑链、Beat Graph、Camera Unit、逐模型规则、证据分级）——词汇表/编译规则的候选来源 + 种子 Recipe 内容工厂。**不是产品部件**：收录以红线测试为准，产品不与任何单一方法论绑定（解耦原则见 03-tech 文首）。
- **DeepSeek Harness 调研**（`../deepseek-harness-tech-report.md`、`../deepseek-harness-event-catalog.md`）——借意图接缝/事件日志/溯源/层叠 patch 四思想，不引入其插件运行时。

## 命名

Anselse — 取自 Ansel Adams（Zone System）：用系统化的控制方法，取代对光的赌博。
