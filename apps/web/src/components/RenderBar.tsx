import { useSession } from "../session.ts";

/** 渲染工作台：保存并渲染 + 渲染行（status/provenance）。 */
export function RenderBar({ canRender }: { canRender: boolean }) {
  const { busy, message, renders, saveAndRender } = useSession();

  return (
    <div className="renderbar">
      <div className="renderbar-head">
        <button className="btn-primary" disabled={!canRender || busy} onClick={() => void saveAndRender()}>
          {busy ? "渲染中…" : "保存并渲染"}
        </button>
        <span className="renderbar-title">渲染工作台</span>
        {!canRender && <span className="mono-muted">配方在当前模型不可渲染，先修好左侧</span>}
        {message && <span className="mono-muted">{message}</span>}
      </div>
      <div className="render-rows">
        {renders.length === 0 && <span className="mono-muted">还没有渲染。改好配方后点「保存并渲染」。</span>}
        {renders.map((r) => (
          <div className="render-row" key={r.requestSeq} data-status={r.status}>
            <span className="rr-status">
              {r.status === "completed" ? "✓" : r.status === "failed" ? "✕" : "…"}
            </span>
            <span className="rr-model">{r.adapterId}</span>
            <span className="mono-muted">v{r.recipeVersion}</span>
            {r.status === "completed" && <span className="rr-url mono-muted">{r.videoUrl}</span>}
            {r.status === "failed" && <span className="rr-detail mono-muted">{r.detail}</span>}
            {r.status === "pending" && <span className="mono-muted">排队/渲染中…</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
