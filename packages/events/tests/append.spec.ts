import { describe, it, expect } from "vitest";
import {
  nextEvent,
  parseEvent,
  parseEventLog,
  NonSerializablePayloadError,
  UnknownRequiredEventError,
  type ProjectEvent,
  type ActorId,
} from "@anselse/events";

const actorId = "u_1" as ActorId;
const T0 = 1_755_500_000_000;

function seed(): ProjectEvent[] {
  return [nextEvent([], { type: "project/created", data: { title: "测试项目" }, actorId, time: T0 })];
}

describe("nextEvent (typed append)", () => {
  it("starts seq at 0 and increments monotonically", () => {
    const log = seed();
    const e1 = nextEvent(log, {
      type: "take/selected",
      data: { takeId: "t_1" as never },
      actorId,
      time: T0 + 1,
    });
    expect(log[0]!.seq).toBe(0);
    expect(e1.seq).toBe(1);
  });

  it("rejects payload violating the event schema", () => {
    expect(() =>
      nextEvent([], { type: "project/created", data: { title: "" }, actorId, time: T0 }),
    ).toThrow();
  });

  it("rejects non-JSON-serializable payloads (Date is lossy)", () => {
    expect(() =>
      nextEvent([], {
        type: "render/requested",
        data: {
          recipeId: "r_1",
          recipeVersion: 1,
          adapterId: "mock",
          adapterVersion: "0.0.0",
          resolvedSpec: { at: new Date() },
        } as never,
        actorId,
        time: T0,
      }),
    ).toThrow(NonSerializablePayloadError);
  });
});

describe("parseEvent (durable boundary)", () => {
  it("roundtrips a typed event through raw JSON", () => {
    const [e0] = seed();
    const parsed = parseEvent(JSON.parse(JSON.stringify(e0)));
    expect(parsed.kind).toBe("ok");
    if (parsed.kind === "ok") expect(parsed.event).toEqual(e0);
  });

  it("refuses an unknown REQUIRED event type", () => {
    const raw = { type: "goal/change", seq: 3, time: T0, actorId: "u_1", data: {} };
    expect(() => parseEvent(raw)).toThrow(UnknownRequiredEventError);
  });

  it("skips an unknown event marked ignorable", () => {
    const raw = { type: "telemetry/tick", seq: 4, time: T0, actorId: "u_1", data: {}, ignorable: true };
    const parsed = parseEvent(raw);
    expect(parsed.kind).toBe("skipped-unknown-ignorable");
  });

  it("parseEventLog keeps known events and drops ignorable unknowns, refusing required unknowns", () => {
    const [e0] = seed();
    const rawLog = [
      JSON.parse(JSON.stringify(e0)),
      { type: "telemetry/tick", seq: 1, time: T0, actorId: "u_1", data: {}, ignorable: true },
    ];
    expect(parseEventLog(rawLog)).toHaveLength(1);

    rawLog.push({ type: "mystery/event", seq: 2, time: T0, actorId: "u_1", data: {} });
    expect(() => parseEventLog(rawLog)).toThrow(UnknownRequiredEventError);
  });
});
