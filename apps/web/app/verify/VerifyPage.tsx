"use client";

import { useEffect, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import ScoreBar from "../components/ScoreBar";

type VerifyResult = {
  status: string;
  valid: boolean;
  score: number;
  reasons: string[];
  breakdown?: Record<string, number>;
  credential?: { credentialSubject: { name: string; degree: string; major: string } };
};
type AuditEvent = { id: string; type: string; note: string; createdAt: string };
type CredentialRow = { id: string; credential: { credentialSubject: { name: string } } };

async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export default function VerifyPage({ shareId }: { shareId?: string }) {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [payload, setPayload] = useState(shareId ? JSON.stringify({ shareId }, null, 2) : "");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const data: CredentialRow[] = await api("/api/credentials");
    setRows(data);
    if (!payload && !shareId && data[0]) setPayload(JSON.stringify({ id: data[0].id }, null, 2));
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    if (shareId) verify({ shareId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  async function verify(body: unknown) {
    setBusy(true);
    try {
      const res: VerifyResult = await api("/api/credentials/verify", body);
      setResult(res);
      const id = (body as { id?: string }).id;
      if (id) setEvents((await api(`/api/credentials/${id}/audit`)).events);
      else setEvents([]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function verifyTampered() {
    const first = rows[0];
    if (!first) return;
    const full = await api("/api/credentials");
    const target = full.find((r: { id: string }) => r.id === first.id);
    const tampered = { ...target.credential, credentialSubject: { ...target.credential.credentialSubject, degree: "Doctor of Philosophy" } };
    await verify({ id: first.id, credential: tampered });
    setMessage("Submitted an altered copy — the verifier should flag it as tampered.");
  }

  return (
    <>
      <section className="intro">
        <h1>Verifier Portal</h1>
        <p>Paste a credential reference or open a holder share link. CredVerify checks the signature, the issuer&apos;s authorization, the content hash, and the on-chain anchor.</p>
      </section>

      {message && <div className="notice">{message}</div>}

      <section className="grid cols-2" style={{ alignItems: "start" }}>
        <div className="card stack">
          <h2>Credential Input</h2>
          <p className="muted">Accepts {"{ \"id\": … }"}, {"{ \"cid\": … }"}, {"{ \"jwt\": … }"}, or {"{ \"shareId\": … }"}.</p>
          <textarea value={payload} onChange={(e) => setPayload(e.target.value)} placeholder='{"id":"urn:uuid:…"}' />
          <div className="btn-row">
            <button disabled={busy} onClick={() => { try { verify(JSON.parse(payload || "{}")); } catch { setMessage("Input is not valid JSON."); } }}>
              Verify Credential
            </button>
            <button className="ghost" disabled={busy || rows.length === 0} onClick={verifyTampered}>
              Demo: Verify Tampered Copy
            </button>
            <button className="ghost" onClick={() => api("/api/demo/reset", {}).then(refresh).then(() => setMessage("Presentation records loaded."))}>
              Load Records
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2>Trust Result</h2>
          {!result ? (
            <p className="muted">No verification run yet.</p>
          ) : (
            <>
              <div>
                <StatusBadge status={result.status} />
              </div>
              <ScoreBar score={result.score} breakdown={result.breakdown} />
              <div>
                <h3>Explainable checklist</h3>
                {result.reasons.length === 0 ? (
                  <p className="muted">All six checks passed.</p>
                ) : (
                  <ul>
                    {result.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
              {result.credential && (
                <p className="muted">
                  {result.credential.credentialSubject.name} — {result.credential.credentialSubject.degree},{" "}
                  {result.credential.credentialSubject.major}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {events.length > 0 && (
        <section className="card" style={{ marginTop: "1.1rem" }}>
          <h2>Audit Timeline</h2>
          <ul className="timeline">
            {events.map((event) => (
              <li key={event.id}>
                <div className="when">{new Date(event.createdAt).toLocaleString()} · {event.type}</div>
                {event.note}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
