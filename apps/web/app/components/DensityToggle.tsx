"use client";

import { useEffect, useState } from "react";

type Density = "lavish" | "compact";
const STORAGE_KEY = "cv:density";

export function DensityToggle() {
  const [density, setDensity] = useState<Density>("lavish");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = (window.localStorage.getItem(STORAGE_KEY) as Density | null) ?? "lavish";
    setDensity(stored);
    document.body.dataset.density = stored;
  }, []);

  function toggle(next: Density) {
    setDensity(next);
    document.body.dataset.density = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  return (
    <span className="density-toggle" aria-label="Density">
      <button
        type="button"
        className={`ghost ${density === "lavish" ? "is-active" : ""}`}
        onClick={() => toggle("lavish")}
      >
        Lavish
      </button>
      <span aria-hidden="true">⁂</span>
      <button
        type="button"
        className={`ghost ${density === "compact" ? "is-active" : ""}`}
        onClick={() => toggle("compact")}
      >
        Compact
      </button>
    </span>
  );
}
