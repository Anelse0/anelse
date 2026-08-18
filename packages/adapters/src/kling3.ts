/**
 * Kling 3 (Standard) Provider：Recipe → API 配置 + 时间分段 prompt。
 *
 * 事实与决策来源：knowledge/kling-3-adapter-notes.md
 * - 官方：时长 3–15s；multi-shot ≤6 镜/总长 ≤15s；prompt ≤2500 字符；
 *   v3 无独立 camera_control API 字段（运镜编译进 prompt 正文）。
 * - 已验证证据：单人 actor cut 的 `【start–end s｜状态】` 分段框架
 *   （时间不加"约"；正文声明时间仅作节奏参考、动作跨界连续）。
 * - v0 只编译单镜 actor cut（唯一有成片证据的形态）；multi_prompt 待红线测试解锁。
 * - 对白在 Kling 侧无已验证成片 → experimental 告警。
 */
import type { Recipe, AdapterId, Shot, Beat } from "@anselse/recipe";
import { SHOT_TYPES, findVocab } from "@anselse/vocab";
import type { CapabilityMatrix, ModelAdapter, Resolved, RenderResult } from "./types.ts";
import { checkRecipeAgainstCapabilities } from "./check.ts";

/** API 配置与 prompt 正文分离（UI 控件/API 字段永不与正文冲突）。 */
export interface KlingConfigSpec {
  modelName: "kling-v3";
  mode: "std";
  durationSec: number;
  aspect: "9:16" | "16:9" | "1:1";
  /** 官方默认 0.5；显式写出（无隐藏默认）。 */
  cfgScale: number;
  multiShot: false;
}

export interface KlingPromptSpec {
  kind: "kling-prompt";
  config: KlingConfigSpec;
  prompt: string;
}

/** 已验证 fixture 的证据标识（红线测试跑通后替换为 ProbeRunId）。 */
const EVIDENCE_STATIONARY_REUNION = "fixture:kling3-standard-stationary-reunion";

/** 官方 API prompt 上限（字符）。 */
export const KLING_PROMPT_MAX_CHARS = 2500;

function fmtSec(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * beat 时间窗解析：缺省时显式均分（0.1s 精度，末段吸收余量保证收口于总时长）。
 * 全部缺省或全部给定均可；给定值直接使用（schema 已保证有序且不越界）。
 */
export function resolveBeatWindows(beats: readonly Beat[], durationSec: number): [number, number][] {
  const even = beats.map((_, i): [number, number] => {
    const start = Math.round(((i * durationSec) / beats.length) * 10) / 10;
    const end =
      i === beats.length - 1
        ? durationSec
        : Math.round((((i + 1) * durationSec) / beats.length) * 10) / 10;
    return [start, end];
  });
  return beats.map((beat, i) => beat.window ?? even[i]!);
}

function actionLines(action: string): string[] {
  return action
    .split("；")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function compileSegments(shot: Shot, durationSec: number): string[] {
  const windows = resolveBeatWindows(shot.beats, durationSec);
  const blocks: string[] = [];
  shot.beats.forEach((beat, i) => {
    const [start, end] = windows[i]!;
    const lines: string[] = [`【${fmtSec(start)}–${fmtSec(end)}s｜${beat.state}】`];
    for (const line of actionLines(beat.action)) lines.push(`${line}。`);
    if (beat.dialogue) {
      lines.push("对白：");
      lines.push(`“${beat.dialogue.text}”`);
      if (beat.dialogue.delivery) lines.push(`（${beat.dialogue.delivery}）`);
    }
    blocks.push(lines.join("\n"));
  });
  return blocks;
}

/** 纯函数编译（快照测试对象）。前置条件：recipe.shots.length === 1（resolve 已拒绝其余）。 */
export function compileKlingPrompt(recipe: Recipe): string {
  const shot = recipe.shots[0]!;
  const { scene, camera, constraints } = recipe;
  const hasDialogue = shot.beats.some((b) => b.dialogue);
  const isStatic = camera.mainMove === "static";

  const header: string[] = [
    `${constraints.durationSec} 秒稳定单镜${findVocab(SHOT_TYPES, shot.framing)?.label ?? shot.framing}${hasDialogue ? "" : "，无台词"}。`,
    ...scene.subjects.map((s) => `${s.description}。整段视频中保持角色身份高度稳定一致。`),
    `${scene.setting}。${scene.lighting}。`,
    `${camera.viewerRelation}。`,
  ];
  if (isStatic) {
    header.push("人物自始至终站定，双脚持续承重，人物与镜头的距离保持不变。");
  } else if (camera.movementDriver) {
    header.push(`整段只有一个主运镜：${camera.movementDriver}。`);
  }
  // 已验证分段框架的固定声明：时间仅作节奏参考，动作跨界连续。
  header.push(
    "时间范围仅作节奏参考，动作可自然提前或延后；所有变化连续衔接，不在分段边界停顿、重置或重新起势。",
  );

  const tail: string[] = [`落幅：${camera.endFrame}。`];
  if (scene.subjects.length === 1) {
    const constraintsLine = isStatic
      ? "单人；画面只有该角色；不迈步、不靠近或远离镜头。"
      : "单人；画面只有该角色。";
    tail.push(constraintsLine);
  }

  return [header.join("\n"), ...compileSegments(shot, constraints.durationSec), tail.join("\n")].join(
    "\n\n",
  );
}

export class Kling3Adapter implements ModelAdapter<KlingPromptSpec> {
  readonly id = "kling-v3" as AdapterId;
  readonly version = "0.1.0";

  capabilities(): CapabilityMatrix {
    return {
      axes: {
        // verified 域 = 已验证 fixture 的窄域（单人固定机位 actor cut）
        "framing:medium_close_up": { level: "verified", evidenceRef: EVIDENCE_STATIONARY_REUNION },
        "move:static": { level: "verified", evidenceRef: EVIDENCE_STATIONARY_REUNION },
        "framing:close_up": { level: "experimental" },
        "framing:extreme_close_up": { level: "experimental" },
        "framing:over_the_shoulder": { level: "experimental" },
        "framing:medium": { level: "experimental" },
        "framing:wide": { level: "experimental" },
        "move:slow_push_in": { level: "experimental" },
        "move:slow_pull_back": { level: "experimental" },
        "move:pan": { level: "experimental" },
      },
      // 官方：3–15s（弹性）
      durationRangeSec: [3, 15],
      aspects: ["16:9", "9:16", "1:1"],
    };
  }

  resolve(recipe: Recipe): Resolved<KlingPromptSpec> {
    const check = checkRecipeAgainstCapabilities(recipe, this.id, this.capabilities());
    // v0 只有单镜 actor cut 的成片证据；multi_prompt 编译待红线测试解锁。
    if (recipe.binding.targetAdapter === this.id && recipe.shots.length > 1) {
      check.rejections.push({
        axis: "shots",
        message: `kling-v3 v0 compiles single-shot actor cuts only (got ${recipe.shots.length} shots); multi-shot compile unlocks after probe verification`,
      });
    }
    if (check.rejections.length > 0) return { ok: false, rejections: check.rejections };

    if (recipe.shots[0]!.beats.some((b) => b.dialogue)) {
      check.warnings.push({
        axis: "dialogue",
        message: "dialogue on kling-v3 is experimental (no verified footage yet)",
      });
    }

    const prompt = compileKlingPrompt(recipe);
    if (prompt.length > KLING_PROMPT_MAX_CHARS) {
      return {
        ok: false,
        rejections: [
          {
            axis: "prompt-length",
            message: `compiled prompt is ${prompt.length} chars, over the official ${KLING_PROMPT_MAX_CHARS} limit`,
          },
        ],
      };
    }

    return {
      ok: true,
      warnings: check.warnings,
      spec: {
        kind: "kling-prompt",
        config: {
          modelName: "kling-v3",
          mode: "std",
          durationSec: recipe.constraints.durationSec,
          aspect: recipe.constraints.aspect,
          cfgScale: 0.5,
          multiShot: false,
        },
        prompt,
      },
    };
  }

  render(_spec: KlingPromptSpec, _signal: AbortSignal): Promise<RenderResult> {
    return Promise.reject(
      new Error("kling-v3 render not wired yet: provider API integration lands in M5"),
    );
  }
}
