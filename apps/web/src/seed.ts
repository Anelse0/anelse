import type { RecipeDraft } from "@anselse/recipe";

/** 编辑器初始种子：已验证分手戏（越肩缓推情绪戏），默认绑 seedance-2.5。 */
export const seedDraft: RecipeDraft = {
  scene: {
    styleContract: "写实、克制的情绪戏；背景简单不抢注意力",
    circumstances: "深夜室内。她依然爱着眼前的人，已经决定离开，正在逼自己亲口说出来",
    subjects: [{ description: "女主角（角色参考图为唯一身份参考），服装与参考一致" }],
    setting: "夜晚的室内，房间安静、昏暗，氛围压抑而沉重",
    lighting: "冷色环境光，脸上形成柔和而清晰的明暗层次；泪光、泛红眼睑、唇部颤抖清晰可见",
  },
  shots: [
    {
      framing: "medium_close_up",
      beats: [
        { state: "憋话", action: "安静站定，目光沉重地看着对方，眼睛微微泛红；深吸一口气，张口又停住，下颌绷紧，手指轻轻蜷起" },
        { state: "开口", action: "呼吸稳定后终于开口；说完立刻沉默，像是后悔说出口，泪水积在眼眶暂时不落", dialogue: { text: "我觉得……我真的没办法再继续下去了。", delivery: "缓慢、压着" } },
      ],
    },
    {
      framing: "close_up",
      beats: [
        { state: "接近失控", action: "一滴眼泪缓慢滑落，没有伸手擦掉；极轻地摇一下头，像提醒自己必须坚持决定", dialogue: { text: "不是因为我不在乎你。", delivery: "停住，喉咙发紧" } },
        { state: "说完", action: "短暂闭眼再睁开，眼睛完全湿润；专注看着对方，像最后一次记住这张脸", dialogue: { text: "我只是……真的没办法再这样继续下去了。" } },
      ],
    },
  ],
  performanceAdvanced: {
    want: "让对方接受这段关系已经结束，同时知道自己仍然爱他",
    tactic: "压住冲击，逼自己把决定亲口说完",
    displayPolicy: "restrain",
    intensity: "L2",
  },
  camera: {
    viewerRelation: "对方视角的越肩镜头：前景保留对方模糊的肩部轮廓，正面面对女主，焦点锁定她的脸",
    mainMove: "slow_push_in",
    movementDriver: "推进外化她逼自己开口的过程：一秒一秒缩短两人距离",
    startFrame: "越肩中近景，她安静站在对方面前，目光沉重",
    endFrame: "极近景停在她含泪的双眼与无法平稳的呼吸；情绪悬而未决、尚未彻底崩溃",
    executionSource: "prompt",
  },
  constraints: { durationSec: 30, aspect: "9:16" },
  binding: { targetAdapter: "seedance-2.5" as RecipeDraft["binding"]["targetAdapter"] },
};
