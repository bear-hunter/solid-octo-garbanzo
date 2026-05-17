"use client";

import { useEffect, useState } from "react";
import StatusBadge from "../components/StatusBadge";

type Identity = { did: string; name: string };
type CredentialRow = {
  id: string;
  hash: string;
  revoked?: boolean;
  credential: { credentialSubject: { name: string; degree: string } };
  chain?: { mode: string; txHash?: string; blockNumber?: number };
};
type AuditEvent = { id: string; type: string; note: string; createdAt: string };

async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export default function IssuerPage() {
  const [institutions, setInstitutions] = useState<Identity[]>([]);
  const [students, setStudents] = useState<Identity[]>([]);
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [metrics, setMetrics] = useState({ issued: 0, active: 0, revoked: 0, verificationChecks: 0 });
  const [issuerName, setIssuerName] = useState("Northbridge State University");
  const [studentName, setStudentName] = useState("Grace Hopper");
  const [issuerDid, setIssuerDid] = useState("");
  const [studentDid, setStudentDid] = useState("");
  const [form, setForm] = useState({ studentId: "NSU-2026-014", degree: "Bachelor of Science", major: "Computer Science", graduationDate: "2026-05-17", gpa: "3.85" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const ids = await api("/api/identities");
    const dash = await api("/api/dashboard/issuer");
    setInstitutions(ids.institutions);
    setStudents(ids.students);
    setRows(dash.credentials);
    setEvents(dash.auditEvents);
    setMetrics(dash.metrics);
    setIssuerDid((v) => v || ids.institutions[0]?.did || "");
    setStudentDid((v) => v || ids.students[0]?.did || "");
  }

  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : label + " failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="intro">
        <h1>Institution Dashboard</h1>
        <p>Register issuer and student DIDs, then issue credentials that are signed, stored on IPFS, and anchored on-chain.</p>
      </section>

      {message && <div className="notice">{message}</div>}

      <div className="btn-row">
        <button className="gold" disabled={busy} onClick={() => run("Seed", async () => { await api("/api/demo/reset", {}); await refresh(); setMessage("Presentation records loaded."); })}>
          Load Presentation Records
        </button>
      </div>

      <section className="grid cols-4" style={{ marginTop: "1.1rem" }}>
        <div className="metric"><b>{metrics.issued}</b><span>Issued</span></div>
        <div className="metric"><b>{metrics.active}</b><span>Active</span></div>
        <div className="metric"><b>{metrics.revoked}</b><span>Revoked</span></div>
        <div className="metric"><b>{metrics.verificationChecks}</b><span>Verifier checks</span></div>
      </section>

      <section className="grid cols-2" style={{ marginTop: "1.1rem" }}>
        <div className="card">
          <h2>Issuer Identity</h2>
          <label>Institution name</label>
          <input value={issuerName} onChange={(e) => setIssuerName(e.target.value)} />
          <div className="btn-row">
            <button disabled={busy} onClick={() => run("Create institution", async () => { const id = await api("/api/identities/institution", { name: issuerName }); await refresh(); setIssuerDid(id.did); setMessage("Institution DID registered on-chain: " + id.did); })}>
              Register Institution DID
            </button>
          </div>
          <label>Active issuer</label>
          <select value={issuerDid} onChange={(e) => setIssuerDid(e.target.value)}>
            {institutions.map((i) => (<option key={i.did} value={i.did}>{i.name}</option>))}
          </select>
          <p className="mono muted">{issuerDid}</p>
        </div>

        <div className="card">
          <h2>Student Holder</h2>
          <label>Student name</label>
          <input value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          <div className="btn-row">
            <button disabled={busy} onClick={() => run("Create student", async () => { const id = await api("/api/identities/student", { name: studentName }); await refresh(); setStudentDid(id.did); setMessage("Student DID created: " + id.did); })}>
              Create Student DID
            </button>
          </div>
          <label>Recipient</label>
          <select value={studentDid} onChange={(e) => setStudentDid(e.target.value)}>
            {students.map((s) => (<option key={s.did} value={s.did}>{s.name}</option>))}
          </select>
          <p className="mono muted">{studentDid}</p>
        </div>
      </section>

      <section className="card" style={{ marginTop: "1.1rem" }}>
        <h2>Issue Credential</h2>
        <div className="grid cols-3">
          <div><label>Student ID</label><input value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} /></div>
          <div><label>Degree</label><input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} /></div>
          <div><label>Major</label><input value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} /></div>
          <div><label>Graduation date</label><input type="date" value={form.graduationDate} onChange={(e) => setForm({ ...form, graduationDate: e.target.value })} /></div>
          <div><label>GPA</label><input value={form.gpa} onChange={(e) => setForm({ ...form, gpa: e.target.value })} /></div>
        </div>
        <div className="btn-row">
          <button
            disabled={busy || !issuerDid || !studentDid}
            onClick={() =>
              run("Issue", async () => {
                const student = students.find((s) => s.did === studentDid);
                const row = await api("/api/credentials/issue", {
                  issuerDid,
                  subjectDid: studentDid,
                  subject: { ...form, name: student?.name ?? "Student", gpa: Number(form.gpa) },
                });
                await refresh();
                const tx = row.chain?.txHash ? ` · tx ${row.chain.txHash.slice(0, 12)}…` : "";
                setMessage(`Credential issued and anchored (${row.chain?.mode})${tx}.`);
              })
            }
          >
            Sign &amp; Anchor Credential
          </button>
        </div>
      </section>

      <section className="card" style={{ marginTop: "1.1rem" }}>
        <h2>Issued Credentials</h2>
        {rows.length === 0 ? (
          <p className="muted">No credentials issued yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Holder</th><th>Degree</th><th>On-chain</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.credential.credentialSubject.name}</td>
                  <td>{row.credential.credentialSubject.degree}</td>
                  <td className="mono">{row.chain?.blockNumber !== undefined ? `#${row.chain.blockNumber}` : row.chain?.mode ?? "—"}</td>
                  <td><StatusBadge status={row.revoked ? "revoked" : "valid"} /></td>
                  <td>
                    {!row.revoked && (
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={() => run("Revoke", async () => { await api("/api/credentials/revoke", { id: row.id, reason: "Revoked by institution" }); await refresh(); setMessage("Credential revoked on-chain."); })}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" style={{ marginTop: "1.1rem" }}>
        <h2>Audit Trail</h2>
        {events.length === 0 ? (
          <p className="muted">No activity yet.</p>
        ) : (
          <ul className="timeline">
            {events.map((event) => (
              <li key={event.id}>
                <div className="when">{new Date(event.createdAt).toLocaleString()} · {event.type}</div>
                {event.note}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
