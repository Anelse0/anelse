import { SHOT_TYPES, CAMERA_MOVES } from "@anselse/vocab";
import type { CapabilityMatrix } from "@anselse/adapters";
import { useEditor } from "../store.ts";
import { AxisSelect } from "./AxisSelect.tsx";

function Text({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Editor({ caps }: { caps: CapabilityMatrix }) {
  const draft = useEditor((s) => s.draft);
  const selectedShot = useEditor((s) => s.selectedShot);
  const patch = useEditor((s) => s.patch);
  const shot = draft.shots[selectedShot];

  return (
    <div>
      {/* 场景 */}
      <div className="section">
        <div className="col-title" style={{ padding: 0, marginBottom: "var(--sp-3)" }}>场景</div>
        <Text label="风格" value={draft.scene.styleContract} onChange={(v) => patch((d) => void (d.scene.styleContract = v))} />
        <Text label="规定情境" value={draft.scene.circumstances} onChange={(v) => patch((d) => void (d.scene.circumstances = v))} />
        <Text label="环境" value={draft.scene.setting} onChange={(v) => patch((d) => void (d.scene.setting = v))} />
        <Text label="光线" value={draft.scene.lighting} onChange={(v) => patch((d) => void (d.scene.lighting = v))} />
      </div>

      {/* 摄影 */}
      <div className="section">
        <div className="col-title" style={{ padding: 0, marginBottom: "var(--sp-3)" }}>摄影</div>
        <Text label="观看关系" value={draft.camera.viewerRelation} onChange={(v) => patch((d) => void (d.camera.viewerRelation = v))} />
        <AxisSelect
          label="主运镜"
          options={CAMERA_MOVES}
          axisPrefix="move"
          caps={caps}
          value={draft.camera.mainMove}
          onChange={(id) => patch((d) => void (d.camera.mainMove = id as typeof d.camera.mainMove))}
        />
        {draft.camera.mainMove !== "static" && (
          <Text label="运镜动机（非固定机位必填）" value={draft.camera.movementDriver ?? ""} onChange={(v) => patch((d) => void (d.camera.movementDriver = v))} />
        )}
        <div className="row">
          <Text label="起幅" value={draft.camera.startFrame} onChange={(v) => patch((d) => void (d.camera.startFrame = v))} />
          <Text label="落幅" value={draft.camera.endFrame} onChange={(v) => patch((d) => void (d.camera.endFrame = v))} />
        </div>
        <div className="row">
          <div className="field">
            <label>时长（秒）</label>
            <input
              type="text"
              inputMode="numeric"
              value={String(draft.constraints.durationSec)}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n > 0) patch((d) => void (d.constraints.durationSec = n));
              }}
            />
          </div>
          <div className="field">
            <label>画幅</label>
            <select value={draft.constraints.aspect} onChange={(e) => patch((d) => void (d.constraints.aspect = e.target.value as typeof d.constraints.aspect))}>
              <option value="9:16">9:16</option>
              <option value="16:9">16:9</option>
              <option value="1:1">1:1</option>
            </select>
          </div>
        </div>
      </div>

      {/* 选中镜头的剧本卡 */}
      {shot && (
        <div className="section">
          <div className="col-title" style={{ padding: 0, marginBottom: "var(--sp-3)" }}>
            镜头 {String(selectedShot + 1).padStart(2, "0")} · 剧本
          </div>
          <AxisSelect
            label="景别"
            options={SHOT_TYPES}
            axisPrefix="framing"
            caps={caps}
            value={shot.framing}
            onChange={(id) => patch((d) => void (d.shots[selectedShot]!.framing = id as typeof shot.framing))}
          />
          {shot.beats.map((beat, bi) => (
            <div className="beat-card" key={bi}>
              <div className="beat-head">
                <span className="beat-n">beat {bi + 1}</span>
                <input
                  type="text"
                  value={beat.state}
                  onChange={(e) => patch((d) => void (d.shots[selectedShot]!.beats[bi]!.state = e.target.value))}
                  style={{ fontWeight: 600 }}
                />
              </div>
              <div className="field">
                <label>动作</label>
                <textarea rows={3} value={beat.action} onChange={(e) => patch((d) => void (d.shots[selectedShot]!.beats[bi]!.action = e.target.value))} />
              </div>
              <div className="field">
                <label>台词（可空）</label>
                <input
                  type="text"
                  value={beat.dialogue?.text ?? ""}
                  onChange={(e) => {
                    const text = e.target.value;
                    patch((d) => {
                      const b = d.shots[selectedShot]!.beats[bi]!;
                      b.dialogue = text ? { text, ...(b.dialogue?.delivery ? { delivery: b.dialogue.delivery } : {}) } : undefined;
                    });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
