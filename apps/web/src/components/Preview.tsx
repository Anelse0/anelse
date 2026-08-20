import type { CompileOutput } from "../compile.ts";

/** 编译预览：所见即编译所得。拒绝/告警靠排版区分（实线/虚线），不靠颜色。 */
export function Preview({ output }: { output: CompileOutput }) {
  if (output.schemaError) {
    return (
      <div className="preview-body">
        <div className="reject">
          <strong>✕ 配方不完整</strong>
          <div className="mono-muted" style={{ marginTop: 6 }}>{output.schemaError}</div>
        </div>
      </div>
    );
  }

  const resolved = output.resolved;
  if (resolved && !resolved.ok) {
    return (
      <div className="preview-body">
        <div className="mono-muted" style={{ marginBottom: "var(--sp-3)" }}>
          此配方无法在当前模型渲染 —— 编译期即被拒绝，不会浪费渲染。
        </div>
        {resolved.rejections.map((r, i) => (
          <div className="reject" key={i}>
            <strong>✕ {r.axis}</strong>
            <div className="mono-muted" style={{ marginTop: 6 }}>{r.message}</div>
          </div>
        ))}
      </div>
    );
  }

  const warnings = resolved && resolved.ok ? resolved.warnings : [];
  return (
    <div className="preview-body">
      {warnings.length > 0 && (
        <>
          {warnings.map((w, i) => (
            <div className="warn" key={i}>
              <strong>设计级 · {w.axis}</strong>
              <div style={{ marginTop: 6 }}>{w.message}</div>
            </div>
          ))}
        </>
      )}
      <pre className="prompt-box">{output.prompt}</pre>
    </div>
  );
}
