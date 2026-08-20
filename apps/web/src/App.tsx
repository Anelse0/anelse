import { useMemo } from "react";
import { useEditor } from "./store.ts";
import { compileDraft, capabilitiesOf, ADAPTER_LABELS, type AdapterId } from "./compile.ts";
import { Editor } from "./components/Editor.tsx";
import { Preview } from "./components/Preview.tsx";
import { RenderBar } from "./components/RenderBar.tsx";

const MODELS: AdapterId[] = ["seedance-2.5", "kling-v3", "mock"];

export function App() {
  const draft = useEditor((s) => s.draft);
  const adapterId = useEditor((s) => s.adapterId);
  const selectedShot = useEditor((s) => s.selectedShot);
  const setAdapter = useEditor((s) => s.setAdapter);
  const selectShot = useEditor((s) => s.selectShot);

  const caps = useMemo(() => capabilitiesOf(adapterId), [adapterId]);
  const output = useMemo(() => compileDraft(draft, adapterId), [draft, adapterId]);

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">Anselse</span>
        <span className="hint">导演工作台 · 所见即编译所得</span>
        <span className="spacer" />
        <div className="modelseg" role="group" aria-label="目标模型">
          {MODELS.map((m) => (
            <button key={m} aria-pressed={m === adapterId} onClick={() => setAdapter(m)}>
              {ADAPTER_LABELS[m]}
            </button>
          ))}
        </div>
      </header>

      <div className="main">
        <aside className="col col-strip">
          <div className="col-title">分镜</div>
          {draft.shots.map((shot, i) => (
            <div
              key={i}
              className="shot-card"
              aria-current={i === selectedShot}
              onClick={() => selectShot(i)}
            >
              <div className="idx">镜头 {String(i + 1).padStart(2, "0")}</div>
              <div className="framing">{shot.framing}</div>
              <div className="beats">{shot.beats.length} 个 beat</div>
            </div>
          ))}
        </aside>

        <main className="col col-editor">
          <Editor caps={caps} />
        </main>

        <section className="col col-preview">
          <div className="col-title">编译预览 · {ADAPTER_LABELS[adapterId]}</div>
          <Preview output={output} />
        </section>
      </div>

      <RenderBar canRender={Boolean(output.prompt)} />
    </div>
  );
}
