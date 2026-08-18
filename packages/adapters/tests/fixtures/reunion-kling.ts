/**
 * Kling golden fixture：来自已验证成片的"久别重逢"单人 actor cut
 * （Kling 3.0 Standard · 8s · 固定机位 · 无台词 · 原地锁定）。
 * 时间窗与状态标题取自已验证 fixture（kling3-standard-stationary-reunion）。
 */
import type { RecipeDraft } from "@anselse/recipe";

export const reunionDraft: RecipeDraft = {
  scene: {
    styleContract: "写实、克制；情绪充分但不过度",
    circumstances: "久别重逢。她想让镜头前想象中的重逢对象确认：我还在、可以靠近",
    subjects: [{ description: "单人正面对镜（角色参考图为唯一身份参考）" }],
    setting: "简洁室内，背景干净不抢注意力",
    lighting: "柔和正面光，面部表情与肩臂动作清晰可见",
  },
  shots: [
    {
      framing: "medium_close_up",
      beats: [
        {
          state: "静立辨认",
          window: [0, 1.3],
          action: "人物正面对镜，目光已落在镜头上，肩背安静，呼吸平稳",
        },
        {
          state: "认出的冲击",
          window: [1.3, 2.8],
          action: "目光一次收紧，下颌微收，嘴角先抿后松；肩线一次轻抬又落下，情绪浮起但压住",
        },
        {
          state: "放开邀请",
          window: [2.8, 5.7],
          action: "笑意漫开，眼里泛起水光但不落；双臂沿身体横向向左右缓缓打开到略宽于肩，掌心朝向镜头，肩胸随之舒展",
        },
        {
          state: "敞开等待",
          window: [5.7, 8],
          action: "动作停在双臂打开、身体前敞；目光继续留在镜头上，一次轻微点头；姿态保持不收回",
        },
      ],
    },
  ],
  performanceAdvanced: {
    want: "让对方确认自己还在、可以靠近",
    tactic: "压住冲击，用放开的肩臂发出邀请",
    displayPolicy: "reveal",
  },
  camera: {
    viewerRelation: "中近景固定机位建立对视，人物正面对镜",
    mainMove: "static",
    startFrame: "中近景正面对镜，目光落在镜头上",
    endFrame: "停在肩臂打开、身体前敞，目光留在镜头上",
    executionSource: "prompt",
  },
  constraints: {
    durationSec: 8,
    aspect: "9:16",
  },
  binding: {
    targetAdapter: "kling-v3" as RecipeDraft["binding"]["targetAdapter"],
  },
};
