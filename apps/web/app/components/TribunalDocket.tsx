"use client";

import { useEffect, useState } from "react";

export type DocketEntry = {
  id: string;
  holderName: string;
  status: string;
  score: number;
  at: string;
  payload: string;
};

const STORAGE_KEY = "cv:docket:v1";

export function loadDocket(): DocketEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DocketEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveDocket(entries: DocketEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 200)));
  } catch {
    // ignore
  }
}

type Props = {
  entries: DocketEntry[];
  onReVerify: (entry: DocketEntry) => void;
  onClear: () => void;
};

export function TribunalDocket({ entries, onReVerify, onClear }: Props) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated) return null;

  return (
    <section className="card rise d4 docket">
      <div className="docket-head">
        <h3>Docket of the <em>Tribunal</em></h3>
        {entries.length > 0 ? (
          <button type="button" className="ghost" onClick={onClear}>Clear Docket</button>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <p className="marginalia"><em>No verifications yet this session.</em></p>
      ) : (
        <ul className="timeline docket-list">
          {entries.map((entry) => (
            <li key={entry.id} className="docket-row">
              <span className={`badge ${entry.status}`}>{entry.status}</span>
              <span className="holder-name">{entry.holderName || "—"}</span>
              <span className="score">{entry.score}/100</span>
              <span className="when">{new Date(entry.at).toLocaleTimeString()}</span>
              <button type="button" className="ghost re-verify" onClick={() => onReVerify(entry)} aria-label="Re-verify">
                ↻
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
