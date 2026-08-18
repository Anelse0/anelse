/**
 * 类型化 append：进程内的写入口。
 * 借 dsh `Session.append` 的两条规则：
 * - 载荷在 append 时按类型 schema 校验（misconfiguration fails loud）；
 * - 载荷必须 JSON 可序列化（roundtrip 恒等检查：Date/函数/bigint/undefined 槽位直接拒绝）。
 */
import { EVENT_SCHEMAS, type EventPayloadMap, type EventType } from "./map.ts";
import type { ProjectEvent } from "./envelope.ts";
import type { ActorId } from "./ids.ts";

export class NonSerializablePayloadError extends Error {
  constructor(readonly eventType: string, detail: string) {
    super(`event "${eventType}" payload is not JSON-serializable: ${detail}`);
    this.name = "NonSerializablePayloadError";
  }
}

/**
 * 结构遍历确认值是纯 JSON 值（null/boolean/有限 number/string/纯对象/数组）。
 * Date、class 实例、bigint、函数、undefined 槽位、NaN/Infinity 都会被
 * JSON.stringify 有损处理——遍历比 roundtrip 字符串对比更诚实。
 * @returns 第一个违规位置的描述；合法返回 null。
 */
function findNonJsonValue(value: unknown, path: string): string | null {
  if (value === null) return null;
  switch (typeof value) {
    case "string":
    case "boolean":
      return null;
    case "number":
      return Number.isFinite(value) ? null : `${path}: non-finite number`;
    case "bigint":
    case "function":
    case "symbol":
    case "undefined":
      return `${path}: ${typeof value}`;
    case "object":
      break;
    default:
      return `${path}: unsupported type`;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const bad = findNonJsonValue(value[i], `${path}[${i}]`);
      if (bad) return bad;
    }
    return null;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return `${path}: non-plain object (would serialize lossily)`;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const bad = findNonJsonValue(entry, `${path}.${key}`);
    if (bad) return bad;
  }
  return null;
}

function assertJsonSerializable(type: string, data: unknown): void {
  const bad = findNonJsonValue(data, "data");
  if (bad) throw new NonSerializablePayloadError(type, bad);
}

export interface AppendInput<T extends EventType> {
  type: T;
  data: EventPayloadMap[T];
  actorId: ActorId;
  time: number;
  /** 仅纯信息性记录可标 true（读端未知可跳过）。 */
  ignorable?: true;
}

/**
 * 构造下一条事件（纯函数：不做存储，seq 由现有日志推导）。
 * @param events - 项目现有日志（按 seq 升序）。
 * @param input - 待追加内容。
 * @returns seq = last+1（空日志为 0）的新事件。
 */
export function nextEvent<T extends EventType>(
  events: readonly ProjectEvent[],
  input: AppendInput<T>,
): ProjectEvent<T> {
  const data = EVENT_SCHEMAS[input.type].parse(input.data) as EventPayloadMap[T];
  assertJsonSerializable(input.type, data);
  const last = events[events.length - 1];
  const seq = last === undefined ? 0 : last.seq + 1;
  return {
    type: input.type,
    seq,
    time: input.time,
    actorId: input.actorId,
    data,
    ...(input.ignorable === true ? { ignorable: true as const } : {}),
  } as ProjectEvent<T>;
}
