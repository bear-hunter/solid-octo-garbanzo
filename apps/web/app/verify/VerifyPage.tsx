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
type CredentialRow = {
  id: string;
  revoked?: boolean;
  credential: { credentialSubject: { name: string; degree: string; studentId: string } };
};

async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

function describeRow(row: CredentialRow) {
  const s = row.credential.credentialSubject;
  const status = row.revoked ? "revoked" : "active";
  return `${s.name} — ${s.degree} (${s.studentId}) · ${status}`;
}

export default function VerifyPage({ shareId }: { shareId?: string }) {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [payload, setPayload] = useState(shareId ? JSON.stringify({ shareId }, null, 2) : "");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const data: CredentialRow[] = await api("/api/credentials");
    setRows(data);
    if (!selectedId && !shareId && data[0]) {
      setSelectedId(data[0].id);
      if (!payload) setPayload(JSON.stringify({ id: data[0].id }, null, 2));
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    if (shareId) verify({ shareId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  function chooseCredential(id: string) {
    setSelectedId(id);
    setPayload(id ? JSON.stringify({ id }, null, 2) : "");
  }

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
    const targetId = selectedId || rows[0]?.id;
    if (!targetId) return;
    const full = await api("/api/credentials");
    const target = full.find((r: { id: string }) => r.id === targetId);
    if (!target) return;
    const tampered = {
      ...target.credential,
      credentialSubject: { ...target.credential.credentialSubject, degree: "Doctor of Philosophy" },
    };
    await verify({ id: targetId, credential: tampered });
    setMessage("Submitted an altered copy — the verifier should flag it as tampered.");
  }

  return (
    <>
      <section className="intro rise d1">
        <div className="kicker">— Estate the Third · The Tribunal —</div>
        <h1>The <em>Verifier&apos;s</em> Tribunal.</h1>
        <p>
          Submit a credential — by JWT, CID, ID, or share-link — and the tribunal renders an
          explainable six-part trust score, with the failing predicate named in plain language and
          pinpointed to the contract call that disagreed.
        </p>
      </section>

      {message && <div className="notice">{message}</div>}

      <section className="grid cols-2 rise d2" style={{ alignItems: "start" }}>
        <div className="card stack">
          <h2>Submission to the <em>Tribunal</em></h2>
          <label>Choose a credential on record</label>
          <select
            value={selectedId}
            onChange={(e) => chooseCredential(e.target.value)}
            disabled={rows.length === 0}
          >
            {rows.length === 0 && <option value="">No credentials on file — load records below</option>}
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {describeRow(row)}
              </option>
            ))}
          </select>
          <p className="muted">Or paste a JSON object with one key — <code>id</code>, <code>cid</code>, <code>jwt</code>, or <code>shareId</code>.</p>
          <textarea value={payload} onChange={(e) => setPayload(e.target.value)} placeholder='{"id":"urn:uuid:…"}' />
          <div className="btn-row">
            <button disabled={busy} onClick={() => { try { verify(JSON.parse(payload || "{}")); } catch { setMessage("Input is not valid JSON."); } }}>
              Verify Credential
            </button>
            <button className="ghost" disabled={busy || rows.length === 0} onClick={verifyTampered}>
              Demo: Verify Tampered Copy
            </button>
            <button
              className="ghost"
              disabled={busy}
              onClick={async () => {
                await api("/api/demo/reset", {});
                await refresh();
                setMessage("Presentation records loaded — pick one from the dropdown above.");
              }}
            >
              Load Sample Records
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2>Verdict of the <em>Tribunal</em></h2>
          {!result ? (
            <p className="muted">No verification run yet.</p>
          ) : (
            <>
              <div>
                <StatusBadge status={result.status} />
              </div>
              <ScoreBar score={result.score} breakdown={result.breakdown} />
              <div>
                <h3>Of the predicates that disagreed</h3>
                {result.reasons.length === 0 ? (
                  <p className="muted">— Six predicates, six lights of inspection · all confirmed —</p>
                ) : (
                  <ul className="timeline">
                    {result.reasons.map((reason) => (
                      <li key={reason}><div className="when">PREDICATE · FAILED</div>{reason}</li>
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
        <section className="card rise d3" style={{ marginTop: "1.4rem" }}>
          <h2>Audit <em>Timeline</em></h2>
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
