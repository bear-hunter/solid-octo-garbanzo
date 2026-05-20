"use client";

import { useEffect, useState } from "react";

type Status = {
  registry: { mode: string; ok: boolean; blockNumber?: number };
  storage: { mode: string; ok: boolean };
};

export default function ChainStatusPill() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/chain/status")
        .then((res) => res.json())
        .then((data) => active && setStatus(data))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (!status) return <span className="pill">chain · awaiting first block</span>;
  const chainUp = status.registry.ok;
  const block = status.registry.blockNumber;
  return (
    <span className="pill" title={`Registry: ${status.registry.mode} · Storage: ${status.storage.mode}`}>
      <span className={`dot ${chainUp ? "up" : "down"}`} />
      chain · {status.registry.mode}
      {block !== undefined ? ` · #${block}` : ""}
      <span className={`dot ${status.storage.ok ? "up" : "down"}`} />
      ipfs · {status.storage.mode}
    </span>
  );
}
