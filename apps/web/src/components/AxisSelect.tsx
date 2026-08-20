import type { VocabEntry, SupportStatus } from "@anselse/vocab";
import type { CapabilityMatrix } from "@anselse/adapters";

interface Props {
  label: string;
  /** 词汇表条目全集（如 SHOT_TYPES / CAMERA_MOVES）。 */
  options: readonly VocabEntry[];
  /** capability 轴前缀（"framing" / "move"）。 */
  axisPrefix: string;
  caps: CapabilityMatrix;
  value: string;
  onChange: (id: string) => void;
}

/** 目标模型对某轴的支持度（capability 感知的核心）。 */
function levelOf(caps: CapabilityMatrix, axis: string): SupportStatus | "unsupported" {
  const s = caps.axes[axis];
  return s ? s.level : "unsupported";
}

/** capability 感知选择器：不支持置灰禁用，设计级标注，全靠排版不靠颜色。 */
export function AxisSelect({ label, options, axisPrefix, caps, value, onChange }: Props) {
  const currentLevel = levelOf(caps, `${axisPrefix}:${value}`);
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => {
          const level = levelOf(caps, `${axisPrefix}:${opt.id}`);
          const suffix = level === "unsupported" ? "（本模型不支持）" : level === "experimental" ? " · 设计级" : "";
          return (
            <option key={opt.id} value={opt.id} disabled={level === "unsupported"}>
              {opt.label}
              {suffix}
            </option>
          );
        })}
      </select>
      {currentLevel === "experimental" && (
        <div className="axis-note exp">设计级：可用但未经成片验证</div>
      )}
      {currentLevel === "unsupported" && (
        <div className="axis-note unsupported">当前模型不支持此选项，渲染会被拒绝</div>
      )}
    </div>
  );
}
