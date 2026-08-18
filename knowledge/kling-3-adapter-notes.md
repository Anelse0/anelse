# Kling 3 Adapter · 调研笔记与编译决策

> M3.5 实现前的官方文档调研留存（2026-08-18）。规则收录立场：官方事实 + 已验证成片证据；无证据处显式 experimental。

## 官方/一手事实（来源见文末）

| 事实 | 值 | 来源 |
|---|---|---|
| 模型 | Kling 3 Standard / Pro（另有 Omni 变体） | [2][3] |
| 时长 | **3–15 秒**（弹性，非 5/10 枚举） | [1][2] |
| Multi-shot | ≤6 镜；每镜 ≥3s；总长 ≤15s；`multi_shot` + `multi_prompt`；`shot_type: customize/intelligence` | [1][2] |
| Prompt 上限 | 2500 字符（负向同） | [2] |
| 画幅 | 16:9（默认）/ 9:16 / 1:1 | [2] |
| i2v | `image_list`: first_frame / end_frame（≥300px、≤10MB、JPG/PNG） | [2] |
| cfg_scale | 0–1，默认 0.5 | [2] |
| Camera control | **v3 无独立 camera_control API 字段**——运镜经 prompt / 工作流表达 | [2]（文档未列该字段） |
| API 官方文档 | kling.ai/document-api 对无凭证抓取返回 446，接入时需注册开发者后核对 | [3] |

## 已验证成片证据（内部，来自表演方法论账本）

- Kling 3.0 Standard 单人 actor cut：`【0–t｜状态】`时间分段框架（时间不加"约"；正文声明"时间范围仅作节奏参考，动作连续衔接、边界不停顿不重置"）；固定机位 + 原地锁定措辞（站定/双脚承重/距离不变）已验证（fixture: 8s 久别重逢）。
- 纯文本不保证零根位移：护栏用正向替代措辞，不堆否定词。
- 30s 情绪长文仅 Seedance 2.5 可单次直出；Kling 走多镜/多条。

## 编译决策（v0）

1. **adapter id = `kling-v3`**（对齐 API `model_name`）；mode `std`；`cfgScale` 显式 0.5。
2. **时长范围 [3, 15]**——30s 的 Recipe 编译到 Kling **必须拒绝**（诚实能力；测试锁定）。
3. **v0 只编译单镜 actor cut**（唯一有成片证据的形态）：`shots.length > 1` → 结构化拒绝（multi_prompt 编译无证据，留待红线测试后解锁）。
4. **Beat 时间窗**：schema 给 `beat.window?: [start, end]`（本次新增，Kling 分段框架的真实需要）；缺省时编译器**显式均分**（确定性，resolve 一步补默认）。
5. **对白轴 experimental**：Kling 侧无带台词的已验证成片 → 出现 dialogue 给告警不拒绝。
6. capability 证据引用：verified 轴指向 `fixture:kling3-standard-stationary-reunion`；其余 experimental。
7. v3 无 camera_control 字段 → 运镜全部编译进 prompt 正文（与 UI 控件冲突问题在 UI 层处理，不在 API 层）。

## 来源

1. [Kling AI 官方 Video 3.0 说明（搜索摘要；官网详情页拦截抓取）](https://kling.ai/quickstart/klingai-video-3-model-user-guide)
2. [Magnific API · Kling v3 参数镜像文档](https://docs.magnific.com/api-reference/video/kling-v3/overview)
3. [Kling AI 官方 API 文档入口（需开发者凭证核对）](https://kling.ai/document-api/apiReference/model/textToVideo)
