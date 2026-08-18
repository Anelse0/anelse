/**
 * 事件信封（借 dsh SessionEvent 的信封设计）：
 * - 判别式联合按 `type` 展开，`switch (event.type)` 无需 cast 即可窄化 data。
 * - `ignorable` 缺省即"必需"：读端遇到不认识的必需事件必须拒绝重建，
 *   而不是静默丢弃——未知必需事件可能改变后续日志的解释方式；
 *   忘写标记的代价是过度拒绝（不便），而非静默恢复出残缺项目。
 * - EVENT_FORMAT_VERSION = 0：预发布期，无兼容承诺。
 */
import { z } from "zod";
import { EVENT_SCHEMAS, type EventPayloadMap, type EventType } from "./map.ts";
import { actorIdSchema, type ActorId } from "./ids.ts";

export const EVENT_FORMAT_VERSION = 0;

/** 项目事件：append-only 日志中的一条不可变记录。 */
export type ProjectEvent<T extends EventType = EventType> = {
  [K in EventType]: {
    type: K;
    /** 项目内单调递增（从 0 起）；持久层以 (project_id, seq) 唯一约束背书。 */
    seq: number;
    /** Unix epoch 毫秒。 */
    time: number;
    actorId: ActorId;
    data: EventPayloadMap[K];
    /** 仅纯信息性记录可标 true；缺省即必需（读端未知必拒）。 */
    ignorable?: true;
  };
}[T];

/** 解析结果：ok / 可忽略的未知（跳过）/ 拒绝。 */
export type ParsedEvent =
  | { kind: "ok"; event: ProjectEvent }
  | { kind: "skipped-unknown-ignorable"; rawType: string; seq: number };

export class UnknownRequiredEventError extends Error {
  readonly rawType: string;
  readonly seq: number;
  constructor(rawType: string, seq: number) {
    super(
      `unknown required event type "${rawType}" at seq ${seq}: refusing to reconstruct ` +
        `(an unrecognized required event may change how the rest of the log is interpreted)`,
    );
    this.name = "UnknownRequiredEventError";
    this.rawType = rawType;
    this.seq = seq;
  }
}

const envelopeBaseSchema = z.object({
  type: z.string().min(1),
  seq: z.number().int().nonnegative(),
  time: z.number().int().positive(),
  actorId: actorIdSchema,
  data: z.unknown(),
  ignorable: z.literal(true).optional(),
});

function isKnownType(type: string): type is EventType {
  return Object.prototype.hasOwnProperty.call(EVENT_SCHEMAS, type);
}

/**
 * 持久化边界的事件解析（dsh：durable 边界必校验，同进程 typed 边界信任 TS）。
 * 未知类型：带 `ignorable: true` → 跳过；否则抛 {@link UnknownRequiredEventError}。
 * @param raw - 从存储读出的未信任值。
 */
export function parseEvent(raw: unknown): ParsedEvent {
  const base = envelopeBaseSchema.parse(raw);
  if (!isKnownType(base.type)) {
    if (base.ignorable === true) {
      return { kind: "skipped-unknown-ignorable", rawType: base.type, seq: base.seq };
    }
    throw new UnknownRequiredEventError(base.type, base.seq);
  }
  const data = EVENT_SCHEMAS[base.type].parse(base.data);
  return {
    kind: "ok",
    event: {
      type: base.type,
      seq: base.seq,
      time: base.time,
      actorId: base.actorId,
      data,
      ...(base.ignorable === true ? { ignorable: true as const } : {}),
    } as ProjectEvent,
  };
}

/**
 * 解析整段日志（按 seq 升序输入），跳过可忽略未知，未知必需事件抛错。
 */
export function parseEventLog(raw: readonly unknown[]): ProjectEvent[] {
  const out: ProjectEvent[] = [];
  for (const item of raw) {
    const parsed = parseEvent(item);
    if (parsed.kind === "ok") out.push(parsed.event);
  }
  return out;
}
