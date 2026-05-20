"use client";

import { useEffect, useMemo, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import ScoreBar from "../components/ScoreBar";

type CredentialSubject = {
  id: string;
  studentId: string;
  name: string;
  degree: string;
  major: string;
  graduationDate: string;
  gpa?: number;
};

type AcademicCredential = {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: CredentialSubject;
};

type CredentialRow = {
  id: string;
  revoked?: boolean;
  credential: AcademicCredential;
};

type FieldDiff = { path: string; anchored: unknown; submitted: unknown };

type VerificationEvidence = {
  submittedHash: string;
  anchoredHash: string;
  hashesMatch: boolean;
  submittedCid: string;
  anchoredCid: string;
  cidsMatch: boolean;
  submittedIssuerDid: string;
  registeredIssuerDid: string;
  registeredIssuerName?: string;
  issuerMatches: boolean;
  revokedOnChain: boolean;
  registryBlockNumber?: number;
  diff: FieldDiff[];
};

type VerifyResult = {
  status: string;
  valid: boolean;
  score: number;
  reasons: string[];
  breakdown?: Record<string, number>;
  credential?: { credentialSubject: { name: string; degree: string; major: string } };
  evidence?: VerificationEvidence;
};

type AuditEvent = { id: string; type: string; note: string; createdAt: string };

type EditableSubject = {
  studentId: string;
  name: string;
  degree: string;
  major: string;
  graduationDate: string;
  gpa: string;
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

function subjectToEditable(s: CredentialSubject): EditableSubject {
  return {
    studentId: s.studentId,
    name: s.name,
    degree: s.degree,
    major: s.major,
    graduationDate: s.graduationDate,
    gpa: s.gpa !== undefined ? String(s.gpa) : "",
  };
}

function verdictNarrative(status: string): string {
  switch (status) {
    case "valid":
      return "Authentic. The credential was signed by an authorised institution, has not been altered since issuance, and is not revoked — verified directly against the blockchain, without contacting the issuer.";
    case "tampered":
      return "This document does not match the version the issuer anchored on the blockchain. Someone altered it after issuance.";
    case "revoked":
      return "The signature and contents are intact, but the issuer has recorded this credential as revoked on the blockchain.";
    case "unknownIssuer":
      return "The signing party is not a registered institution on the blockchain, so their authority to issue this credential cannot be confirmed.";
    case "unavailable":
      return "The credential document could not be retrieved from IPFS, so its contents cannot be checked against the on-chain anchor.";
    case "invalid":
      return "The submission failed basic validation — the signature, schema, or structure does not parse as a verifiable credential.";
    default:
      return "Verification produced an unrecognised status.";
  }
}

export default function VerifyPage({ shareId }: { shareId?: string }) {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [edits, setEdits] = useState<EditableSubject | null>(null);
  const [original, setOriginal] = useState<EditableSubject | null>(null);
  const [rawPayload, setRawPayload] = useState(shareId ? JSON.stringify({ shareId }, null, 2) : "");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedRow = useMemo(() => rows.find((r) => r.id === selectedId), [rows, selectedId]);

  const changedFields = useMemo(() => {
    if (!edits || !original) return new Set<keyof EditableSubject>();
    const out = new Set<keyof EditableSubject>();
    (Object.keys(edits) as Array<keyof EditableSubject>).forEach((key) => {
      if (edits[key] !== original[key]) out.add(key);
    });
    return out;
  }, [edits, original]);

  const hasEdits = changedFields.size > 0;

  async function refresh() {
    const data: CredentialRow[] = await api("/api/credentials");
    setRows(data);
    if (!selectedId && !shareId && data[0]) chooseCredential(data[0].id, data);
  }

  function chooseCredential(id: string, source?: CredentialRow[]) {
    const list = source ?? rows;
    const row = list.find((r) => r.id === id);
    if (!row) return;
    setSelectedId(id);
    const initial = subjectToEditable(row.credential.credentialSubject);
    setEdits(initial);
    setOriginal(initial);
  }

  function resetFields() {
    if (original) setEdits(original);
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

  async function verifySelected() {
    if (!selectedRow || !edits) return;
    if (!hasEdits) {
      await verify({ id: selectedRow.id });
      setMessage("Submitted the credential as recorded.");
      return;
    }
    const altered: AcademicCredential = {
      ...selectedRow.credential,
      credentialSubject: {
        ...selectedRow.credential.credentialSubject,
        studentId: edits.studentId,
        name: edits.name,
        degree: edits.degree,
        major: edits.major,
        graduationDate: edits.graduationDate,
        gpa: edits.gpa.trim() === "" ? undefined : Number(edits.gpa),
      },
    };
    await verify({ id: selectedRow.id, credential: altered });
    const list = [...changedFields].join(", ");
    setMessage(`Submitted an altered copy (changed: ${list}). The on-chain hash should refuse it.`);
  }

  async function forgeIssuer() {
    if (!selectedRow) return;
    const fakeIssuer = `did:example:forged-${Math.random().toString(16).slice(2, 14)}`;
    const forged: AcademicCredential = { ...selectedRow.credential, issuer: fakeIssuer };
    await verify({ id: selectedRow.id, credential: forged });
    setMessage(`Submitted with a forged issuer DID (${fakeIssuer}) — issuer-authorisation check should reject it.`);
  }

  async function forgeStorageAddress() {
    if (!selectedRow) return;
    const fakeCid = `bafy-forged-${Math.random().toString(16).slice(2, 14)}`;
    await verify({ id: selectedRow.id, cid: fakeCid });
    setMessage(`Submitted with a forged IPFS address (${fakeCid}) — storage-address check should fail.`);
  }

  async function submitMalformed() {
    if (!selectedRow) return;
    const subject = { ...selectedRow.credential.credentialSubject } as Record<string, unknown>;
    delete subject.degree;
    const malformed = { ...selectedRow.credential, credentialSubject: subject } as unknown as AcademicCredential;
    await verify({ id: selectedRow.id, credential: malformed });
    setMessage("Submitted a malformed credential (degree field stripped) — schema validation should reject it.");
  }

  function setField(key: keyof EditableSubject, value: string) {
    setEdits((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <>
      <section className="intro rise d1">
        <div className="kicker">— Estate the Third · The Tribunal —</div>
        <h1>The <em>Verifier&apos;s</em> Tribunal.</h1>
        <p>
          Pick a credential, inspect its contents, and submit it to the tribunal. Alter any field before
          submitting to simulate a forgery — the on-chain hash will refuse anything that doesn&apos;t
          match the version the issuer originally anchored.
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

          {edits && selectedRow && (
            <>
              <p className="muted" style={{ marginTop: "1rem" }}>
                These are the credential&apos;s contents as the issuer anchored them. Edit any field to
                submit an altered copy — the verifier will catch the change because the document hash
                will no longer match what&apos;s on the blockchain.
              </p>
              <div className="tamper-grid">
                <div>
                  <label>Student name {changedFields.has("name") && <span className="diff">· altered</span>}</label>
                  <input value={edits.name} onChange={(e) => setField("name", e.target.value)} className={changedFields.has("name") ? "altered" : ""} />
                </div>
                <div>
                  <label>Degree {changedFields.has("degree") && <span className="diff">· altered</span>}</label>
                  <input value={edits.degree} onChange={(e) => setField("degree", e.target.value)} className={changedFields.has("degree") ? "altered" : ""} />
                </div>
                <div>
                  <label>Major {changedFields.has("major") && <span className="diff">· altered</span>}</label>
                  <input value={edits.major} onChange={(e) => setField("major", e.target.value)} className={changedFields.has("major") ? "altered" : ""} />
                </div>
                <div>
                  <label>Graduation {changedFields.has("graduationDate") && <span className="diff">· altered</span>}</label>
                  <input type="date" value={edits.graduationDate} onChange={(e) => setField("graduationDate", e.target.value)} className={changedFields.has("graduationDate") ? "altered" : ""} />
                </div>
                <div>
                  <label>GPA {changedFields.has("gpa") && <span className="diff">· altered</span>}</label>
                  <input value={edits.gpa} onChange={(e) => setField("gpa", e.target.value)} className={changedFields.has("gpa") ? "altered" : ""} />
                </div>
                <div>
                  <label>Student ID {changedFields.has("studentId") && <span className="diff">· altered</span>}</label>
                  <input value={edits.studentId} onChange={(e) => setField("studentId", e.target.value)} className={changedFields.has("studentId") ? "altered" : ""} />
                </div>
              </div>
              <div className="btn-row">
                <button disabled={busy} onClick={verifySelected}>
                  {hasEdits ? `Submit Altered Copy (${changedFields.size} field${changedFields.size === 1 ? "" : "s"} changed)` : "Verify as Recorded"}
                </button>
                <button className="ghost" disabled={!hasEdits || busy} onClick={resetFields}>
                  Reset Fields
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

              <div className="scenario-row">
                <div className="scenario-label">Other forgery scenarios</div>
                <div className="btn-row">
                  <button className="ghost" disabled={busy} onClick={forgeIssuer} title="Submits the credential with an issuer DID that isn't registered on-chain. Expected verdict: unknown issuer.">
                    Forge the issuer
                  </button>
                  <button className="ghost" disabled={busy} onClick={forgeStorageAddress} title="Submits with an IPFS address the issuer never anchored. Expected verdict: tampered (storage mismatch).">
                    Forge the IPFS address
                  </button>
                  <button className="ghost" disabled={busy} onClick={submitMalformed} title="Strips a required field so the schema can't parse it. Expected verdict: invalid.">
                    Strip a required field
                  </button>
                </div>
              </div>
            </>
          )}

          <details className="raw-json" style={{ marginTop: "1.2rem" }}>
            <summary>Advanced — submit raw JSON</summary>
            <p className="muted">For verifying a shareId, CID, or JWT directly. Accepts one of <code>id</code>, <code>cid</code>, <code>jwt</code>, or <code>shareId</code>.</p>
            <textarea value={rawPayload} onChange={(e) => setRawPayload(e.target.value)} placeholder='{"shareId":"…"}' />
            <div className="btn-row">
              <button disabled={busy} onClick={() => { try { verify(JSON.parse(rawPayload || "{}")); } catch { setMessage("Input is not valid JSON."); } }}>
                Verify Raw Payload
              </button>
            </div>
          </details>
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
              <p className="verdict-narrative">{verdictNarrative(result.status)}</p>
              <ScoreBar score={result.score} breakdown={result.breakdown} />
              {result.evidence && <EvidencePanel ev={result.evidence} />}
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
                  Inspected: {result.credential.credentialSubject.name} — {result.credential.credentialSubject.degree},{" "}
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

function shortHash(h?: string) {
  if (!h) return "—";
  if (h.length <= 18) return h;
  return `${h.slice(0, 14)}…${h.slice(-6)}`;
}

function formatVal(v: unknown) {
  if (v === undefined) return <span className="muted">(missing)</span>;
  if (v === null) return <span className="muted">null</span>;
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

function EvidencePanel({ ev }: { ev: VerificationEvidence }) {
  const anyMismatch = !ev.hashesMatch || !ev.cidsMatch || !ev.issuerMatches || ev.revokedOnChain;
  return (
    <div className="evidence">
      <h3>Cryptographic evidence</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        The verifier&apos;s decision is based entirely on the values below. The blockchain holds the
        anchored side; the submitter provides the rest.
      </p>

      <div className="ev-row">
        <span className="ev-label">Document hash</span>
        <span className="ev-cmp">
          <span className="ev-side"><span className="ev-side-tag">anchored on-chain</span><code>{shortHash(ev.anchoredHash)}</code></span>
          <span className={`ev-eq ${ev.hashesMatch ? "ok" : "bad"}`}>{ev.hashesMatch ? "≡" : "≠"}</span>
          <span className="ev-side"><span className="ev-side-tag">computed from submission</span><code>{shortHash(ev.submittedHash)}</code></span>
        </span>
      </div>

      <div className="ev-row">
        <span className="ev-label">IPFS address</span>
        <span className="ev-cmp">
          <span className="ev-side"><span className="ev-side-tag">anchored</span><code>{shortHash(ev.anchoredCid)}</code></span>
          <span className={`ev-eq ${ev.cidsMatch ? "ok" : "bad"}`}>{ev.cidsMatch ? "≡" : "≠"}</span>
          <span className="ev-side"><span className="ev-side-tag">submitted</span><code>{shortHash(ev.submittedCid)}</code></span>
        </span>
      </div>

      <div className="ev-row">
        <span className="ev-label">Issuer DID</span>
        <span className="ev-cmp">
          <span className="ev-side">
            <span className="ev-side-tag">registered{ev.registeredIssuerName ? ` · ${ev.registeredIssuerName}` : ""}</span>
            <code>{shortHash(ev.registeredIssuerDid)}</code>
          </span>
          <span className={`ev-eq ${ev.issuerMatches ? "ok" : "bad"}`}>{ev.issuerMatches ? "≡" : "≠"}</span>
          <span className="ev-side"><span className="ev-side-tag">submitted</span><code>{shortHash(ev.submittedIssuerDid)}</code></span>
        </span>
      </div>

      <div className="ev-row">
        <span className="ev-label">On-chain status</span>
        <span className={`ev-flag ${ev.revokedOnChain ? "bad" : "ok"}`}>
          {ev.revokedOnChain ? "revoked" : "active"}
          {ev.registryBlockNumber !== undefined && <span className="ev-block"> · anchored at block #{ev.registryBlockNumber}</span>}
        </span>
      </div>

      {ev.diff.length > 0 && (
        <div className="ev-diff">
          <h4>What changed between anchored and submitted</h4>
          <table>
            <thead>
              <tr><th>Field</th><th>Anchored on-chain</th><th>Submitted</th></tr>
            </thead>
            <tbody>
              {ev.diff.map((d) => (
                <tr key={d.path}>
                  <td className="mono">{d.path}</td>
                  <td>{formatVal(d.anchored)}</td>
                  <td className="ev-changed">{formatVal(d.submitted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: "0.6rem", fontSize: "0.88rem" }}>
            Even a one-character change in any of these fields produces an entirely different SHA-256.
            That&apos;s why the document hash above no longer matches the value on the blockchain.
          </p>
        </div>
      )}

      {!anyMismatch && (
        <p className="muted" style={{ marginTop: "0.6rem", fontSize: "0.88rem" }}>
          All three anchored values match the submission and the on-chain status is active — the
          credential is mathematically the same one the issuer originally anchored.
        </p>
      )}
    </div>
  );
}
