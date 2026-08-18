/**
 * 受控词汇表（数据包，零依赖）。
 *
 * 收录规则：`verified` 条目必须有真实成片证据（红线测试运行记录或已验证模板族）；
 * `experimental` 为设计级、未经成片验证，UI 必须显式标注。红线测试（E3）后
 * 更新本包数据，而非修改 recipe schema。
 */

/** 证据分级：verified = 有成片证据；experimental = 设计级待验证。 */
export type SupportStatus = "verified" | "experimental";

/** 一个受控词条：稳定 id + 双语 label + 证据状态。 */
export interface VocabEntry<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly labelEn: string;
  readonly status: SupportStatus;
}

/* ------------------------------------------------------------------
 * 景别（shot framing）
 * verified 来源：SD2.5 30s 越肩情绪戏模板族 + Kling3 standard 单人固定机位成片。
 * ------------------------------------------------------------------ */
export const SHOT_TYPES = [
  { id: "over_the_shoulder", label: "越肩", labelEn: "Over-the-shoulder", status: "verified" },
  { id: "medium_close_up", label: "中近景", labelEn: "Medium close-up", status: "verified" },
  { id: "close_up", label: "近景", labelEn: "Close-up", status: "verified" },
  { id: "extreme_close_up", label: "极近景", labelEn: "Extreme close-up", status: "verified" },
  { id: "medium", label: "中景", labelEn: "Medium shot", status: "experimental" },
  { id: "wide", label: "全景", labelEn: "Wide shot", status: "experimental" },
] as const satisfies readonly VocabEntry[];

export type ShotTypeId = (typeof SHOT_TYPES)[number]["id"];

/* ------------------------------------------------------------------
 * 主运镜（每镜只有一个主要运动任务；static 是正式设计结果）
 * ------------------------------------------------------------------ */
export const CAMERA_MOVES = [
  { id: "static", label: "固定机位", labelEn: "Static", status: "verified" },
  { id: "slow_push_in", label: "缓推", labelEn: "Slow push-in", status: "verified" },
  { id: "slow_pull_back", label: "缓拉", labelEn: "Slow pull-back", status: "experimental" },
  { id: "pan", label: "横摇", labelEn: "Pan", status: "experimental" },
] as const satisfies readonly VocabEntry[];

export type CameraMoveId = (typeof CAMERA_MOVES)[number]["id"];

/** 按 id 查询词条；未知 id 返回 undefined（调用方决定失败策略）。 */
export function findVocab(
  list: readonly VocabEntry[],
  id: string,
): VocabEntry | undefined {
  return list.find((e) => e.id === id);
}

/** 提取 id 列表（供 zod enum 等消费）。 */
export function vocabIds<const T extends readonly VocabEntry[]>(
  list: T,
): [T[number]["id"], ...T[number]["id"][]] {
  return list.map((e) => e.id) as [T[number]["id"], ...T[number]["id"][]];
}
