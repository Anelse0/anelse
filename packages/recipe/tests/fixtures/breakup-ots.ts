/**
 * Golden fixture：来自已验证成片的"分手告白"配方（SD2.5 30s 越肩情绪戏模板族）。
 * 与真实已验证 prompt 同构；M3.5 的编译快照测试以它为基准输入。
 */
import type { RecipeDraft } from "@anselse/recipe";

export const breakupDraft: RecipeDraft = {
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
        {
          state: "憋话",
          action: "安静站定，目光沉重地看着对方，眼睛微微泛红；深吸一口气，张口又停住，移开视线数秒后强迫自己看回去，下颌绷紧，手指轻轻蜷起",
        },
        {
          state: "开口",
          action: "呼吸重新稳定后终于开口；说完立刻沉默，表情动摇了一下，像是后悔说出口，泪水积在眼眶暂时不落",
          dialogue: { text: "我觉得……我真的没办法再继续下去了。", delivery: "缓慢、压着" },
        },
      ],
    },
    {
      framing: "medium_close_up",
      beats: [
        {
          state: "挣扎",
          action: "低下眼睛短暂避开视线，呼吸变重；轻轻吸气后再次抬眼看向对方",
          dialogue: { text: "我努力过。我真的……努力过了。", delivery: "比刚才更轻，长停顿" },
        },
        {
          state: "撑到极限",
          action: "嘴唇出现极细微颤抖，泪水更明显；表情里没有愤怒，只有依恋、疲惫、悲伤；无数句话堵在喉咙里被咽回去",
        },
      ],
    },
    {
      framing: "close_up",
      beats: [
        {
          state: "接近失控",
          action: "一滴眼泪缓慢滑落，没有伸手擦掉；极轻地摇一下头，像提醒自己必须坚持决定",
          dialogue: { text: "不是因为我不在乎你。", delivery: "停住，喉咙发紧" },
        },
        {
          state: "说完",
          action: "短暂闭眼再睁开，眼睛完全湿润，在泪光中微微发亮；专注看着对方，像最后一次记住这张脸",
          dialogue: { text: "我只是……真的没办法再这样继续下去了。" },
        },
      ],
    },
    {
      framing: "extreme_close_up",
      beats: [
        {
          state: "崩溃边缘",
          action: "肩膀几乎难以察觉地轻微颤抖，呼吸不均匀；嘴角极轻地动了一下想笑没笑成",
          dialogue: { text: "对不起。", delivery: "非常轻，沉默数秒" },
        },
        {
          state: "敞开等待",
          action: "更多眼泪慢慢落下；说完不再说话，不转身不离开，一动不动看着对方",
          dialogue: { text: "我觉得……我们该放彼此走了。", delivery: "全场最轻的一句" },
        },
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
  },
  constraints: {
    durationSec: 30,
    aspect: "9:16",
  },
  binding: {
    targetAdapter: "seedance-2.5" as RecipeDraft["binding"]["targetAdapter"],
  },
};
