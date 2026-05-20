"use client";

import { toRomanLower } from "../../lib/roman";

export type QuillProgressRow = {
  index: number;
  label: string;
  status: "queued" | "in_progress" | "ok" | "error";
  detail?: string;
};

type Props = {
  total: number;
  done: number;
  failed: number;
  state: "idle" | "running" | "paused" | "complete" | "cancelled";
  rows: QuillProgressRow[];
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onClear?: () => void;
};

export function QuillProgress({ total, done, failed, state, rows, onPause, onResume, onCancel, onClear }: Props) {
  const queued = Math.max(0, total - done - failed);
  const pct = total > 0 ? ((done + failed) / total) * 100 : 0;
  const visible = rows.slice(-12).reverse();
  return (
    <div className="quill-progress">
      <div className="score-track" aria-hidden="true">
        <span className="score-fill" style={{ transform: `scaleX(${pct / 100})`, animation: "none" }} />
      </div>
      <p className="quill-meta">
        <em>{toRomanLower(done)}</em> inscribed · <em>{toRomanLower(failed)}</em> failed · <em>{toRomanLower(queued)}</em> queued
      </p>
      <div className="quill-controls">
        {state === "running" && onPause ? (
          <button type="button" className="ghost" onClick={onPause}>Pause</button>
        ) : null}
        {state === "paused" && onResume ? (
          <button type="button" className="gold" onClick={onResume}>Resume</button>
        ) : null}
        {(state === "running" || state === "paused") && onCancel ? (
          <button type="button" className="danger" onClick={onCancel}>Cancel</button>
        ) : null}
        {(state === "complete" || state === "cancelled") && onClear ? (
          <button type="button" className="ghost" onClick={onClear}>Clear Ledger</button>
        ) : null}
      </div>
      {visible.length > 0 ? (
        <ul className="timeline quill-ledger">
          {visible.map((row) => (
            <li key={row.index}>
              <span className="when">Row {toRomanLower(row.index + 1)} ·</span>{" "}
              {row.status === "ok" ? <em>inscribed</em> : null}
              {row.status === "error" ? <span className="badge invalid">failed</span> : null}
              {row.status === "in_progress" ? <span className="muted">writing…</span> : null}
              {row.status === "queued" ? <span className="muted">queued</span> : null}
              <span className="row-label"> {row.label}</span>
              {row.detail ? <span className="muted"> — {row.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
