/**
 * Seedance 2.5 Provider：Recipe → 结构化分镜 prompt。
 *
 * 编译规则源自已验证模板族（SD2.5 · 30s · 越肩单主体关系情绪戏）的微格式：
 * - 顶部先声明镜数/时长/画幅；
 * - 裸标题行 `镜头 N`（无说明后缀）；正文每句一行；
 * - 对白块：`对白：` 独占一行，引号内容下一行，delivery 独立短句行；
 * - 结尾 `表演指导` 逐句重述身份/场景/镜头/核心情感事实；
 * - 每条 prompt 独立自足：场景/光/构图/运镜是必写项。
 * 收录立场：规则以红线测试与已验证成片为准（experimental 轴编译时给告警）。
 */
import type { Recipe, AdapterId, Shot } from "@anselse/recipe";
import { SHOT_TYPES, findVocab } from "@anselse/vocab";
import type { CapabilityMatrix, ModelAdapter, Resolved, RenderResult } from "./types.ts";
import { checkRecipeAgainstCapabilities } from "./check.ts";

export interface SeedancePromptSpec {
  kind: "seedance-prompt";
  model: "seedance-2.5";
  durationSec: number;
  aspect: string;
  prompt: string;
}

/** 已验证模板族的证据标识（红线测试跑通后替换为 ProbeRunId）。 */
const EVIDENCE_OTS_EMOTION = "template:sd25-30s-ots-emotion";

function framingLabel(id: Shot["framing"]): string {
  return findVocab(SHOT_TYPES, id)?.label ?? id;
}

/** 每句一行：以中文分号切分动作描述（模板微格式）。 */
function actionLines(action: string): string[] {
  return action
    .split("；")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function compileShot(shot: Shot, index: number, prev: Shot | undefined, pushes: boolean): string[] {
  const lines: string[] = [`镜头 ${String(index + 1).padStart(2, "0")}`];
  if (pushes && prev && prev.framing !== shot.framing) {
    lines.push(`镜头缓慢推进至${framingLabel(shot.framing)}。`);
  }
  for (const beat of shot.beats) {
    for (const line of actionLines(beat.action)) lines.push(`${line}。`);
    if (beat.dialogue) {
      lines.push("对白：");
      lines.push(`“${beat.dialogue.text}”`);
      if (beat.dialogue.delivery) lines.push(`（${beat.dialogue.delivery}）`);
    }
  }
  return lines;
}

/** 纯函数编译（快照测试的对象）。 */
export function compileSeedancePrompt(recipe: Recipe): string {
  const { scene, shots, camera, constraints, performanceAdvanced: adv } = recipe;
  const pushes = camera.mainMove === "slow_push_in";
  const sections: string[] = [];

  // 总纲：镜数/时长/画幅声明 + 自足性必写项（主体/场景/光/构图/运镜）
  const header: string[] = [
    `生成一段 ${constraints.durationSec} 秒表演场景，共 ${shots.length} 个镜头，画幅 ${constraints.aspect}。`,
    ...scene.subjects.map((s) => `${s.description}。在整段视频中保持角色身份高度稳定且一致。`),
    `${scene.setting}。`,
    `${scene.lighting}。`,
    `风格：${scene.styleContract}。`,
    `镜头：${camera.viewerRelation}。`,
  ];
  if (camera.mainMove !== "static" && camera.movementDriver) {
    header.push(`整段只有一个主运镜：${camera.movementDriver}。`);
  } else if (camera.mainMove === "static") {
    header.push(`全程固定机位，人物与镜头的距离保持不变。`);
  }
  header.push(`起幅：${camera.startFrame}。`);
  const coreFact = adv?.want && adv?.tactic
    ? `核心情感事实：${scene.circumstances}。她想要：${adv.want}。她的策略：${adv.tactic}。`
    : `核心情感事实：${scene.circumstances}。`;
  header.push(coreFact);
  sections.push(header.join("\n"));

  // Shot 分段
  shots.forEach((shot, i) => {
    sections.push(compileShot(shot, i, shots[i - 1], pushes).join("\n"));
  });

  // 落幅 + 表演指导（逐句重述，模板 L5 变体）
  const coda: string[] = [`落幅：${camera.endFrame}。`];
  sections.push(coda.join("\n"));

  const direction: string[] = [
    "表演指导",
    ...scene.subjects.map((s) => `${s.description}。整段视频中必须保持角色身份高度稳定一致。`),
    `${scene.setting}。${scene.lighting}。`,
    `镜头：${camera.viewerRelation}。`,
  ];
  if (camera.mainMove !== "static" && camera.movementDriver) {
    direction.push(`${camera.movementDriver}。`);
  }
  direction.push(coreFact);
  if (adv?.displayPolicy === "restrain") {
    direction.push("情绪始终被压住：在真正崩溃之前结束，不演爆发。");
  }
  sections.push(direction.join("\n"));

  return sections.join("\n\n");
}

export class Seedance25Adapter implements ModelAdapter<SeedancePromptSpec> {
  readonly id = "seedance-2.5" as AdapterId;
  readonly version = "0.1.0";

  capabilities(): CapabilityMatrix {
    return {
      axes: {
        "framing:over_the_shoulder": { level: "verified", evidenceRef: EVIDENCE_OTS_EMOTION },
        "framing:medium_close_up": { level: "verified", evidenceRef: EVIDENCE_OTS_EMOTION },
        "framing:close_up": { level: "verified", evidenceRef: EVIDENCE_OTS_EMOTION },
        "framing:extreme_close_up": { level: "verified", evidenceRef: EVIDENCE_OTS_EMOTION },
        "framing:medium": { level: "experimental" },
        "framing:wide": { level: "experimental" },
        "move:static": { level: "verified", evidenceRef: EVIDENCE_OTS_EMOTION },
        "move:slow_push_in": { level: "verified", evidenceRef: EVIDENCE_OTS_EMOTION },
        "move:slow_pull_back": { level: "experimental" },
        "move:pan": { level: "experimental" },
      },
      // SD2.5 单次直出上限 30s（16-30s 仅此模型可直出）
      durationRangeSec: [4, 30],
      aspects: ["9:16", "16:9", "1:1"],
    };
  }

  resolve(recipe: Recipe): Resolved<SeedancePromptSpec> {
    const check = checkRecipeAgainstCapabilities(recipe, this.id, this.capabilities());
    if (check.rejections.length > 0) return { ok: false, rejections: check.rejections };
    return {
      ok: true,
      warnings: check.warnings,
      spec: {
        kind: "seedance-prompt",
        model: "seedance-2.5",
        durationSec: recipe.constraints.durationSec,
        aspect: recipe.constraints.aspect,
        prompt: compileSeedancePrompt(recipe),
      },
    };
  }

  render(_spec: SeedancePromptSpec, _signal: AbortSignal): Promise<RenderResult> {
    // 真实 provider 提交在 M5 接入（API 就绪后）；当前显式未实现。
    return Promise.reject(
      new Error("seedance-2.5 render not wired yet: provider API integration lands in M5"),
    );
  }
}
