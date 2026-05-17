"use client";

import { useEffect, useMemo, useState } from "react";
import DiplomaCard from "../components/DiplomaCard";
import CopyButton from "../components/CopyButton";

type CredentialRow = {
  id: string;
  jwt: string;
  cid: string;
  hash: string;
  revoked?: boolean;
  credential: { issuer: string; credentialSubject: { name: string; degree: string; major: string; graduationDate: string; gpa?: number } };
  chain?: { mode: string; blockNumber?: number };
  storageMode?: string;
};

async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export default function HolderPage() {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const data: CredentialRow[] = await api("/api/credentials");
    setRows(data);
    setSelectedId((v) => v || data[0]?.id || "");
  }

  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);

  const row = useMemo(() => rows.find((r) => r.id === selectedId), [rows, selectedId]);

  async function makeShare() {
    if (!row) return;
    const share = await api("/api/share-links", { credentialId: row.id });
    const url = `${location.origin}${share.url}`;
    setShareUrl(url);
    await navigator.clipboard.writeText(url);
    setMessage("Verifier link copied to clipboard.");
  }

  return (
    <>
      <section className="intro">
        <h1>Credential Wallet</h1>
        <p>Your credentials live here as portable, self-sovereign diplomas. Share a verifier link — no university lookup required.</p>
      </section>

      {message && <div className="notice">{message}</div>}

      <div className="btn-row">
        <button className="gold" onClick={() => api("/api/demo/reset", {}).then(refresh).then(() => setMessage("Presentation records loaded."))}>
          Load Presentation Records
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ marginTop: "1.1rem" }}>
          <p className="muted">No credentials yet. Issue one from the Issuer dashboard or load presentation records.</p>
        </div>
      ) : (
        <section className="grid cols-2" style={{ marginTop: "1.1rem", alignItems: "start" }}>
          <div className="stack">
            <div className="card">
              <label>Select credential</label>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.credential.credentialSubject.name} — {r.credential.credentialSubject.degree} {r.revoked ? "(revoked)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {row && (
              <DiplomaCard
                credential={row.credential}
                hash={row.hash}
                status={row.revoked ? "revoked" : "valid"}
                blockNumber={row.chain?.blockNumber}
              />
            )}
          </div>

          {row && (
            <div className="card stack">
              <h2>Portable Proof</h2>
              <div>
                <label>IPFS CID ({row.storageMode ?? "local"})</label>
                <p className="mono">{row.cid}</p>
              </div>
              <div>
                <label>Credential hash</label>
                <p className="mono">{row.hash}</p>
              </div>
              <div>
                <label>Signed credential (JWT)</label>
                <p className="mono">{row.jwt.slice(0, 96)}…</p>
              </div>
              <div className="btn-row">
                <CopyButton value={row.jwt} label="Copy JWT" />
                <CopyButton value={row.cid} label="Copy CID" />
                <button onClick={makeShare}>Create Verifier Link</button>
              </div>
              {shareUrl && (
                <div>
                  <label>Shareable verification link</label>
                  <p className="mono">{shareUrl}</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
