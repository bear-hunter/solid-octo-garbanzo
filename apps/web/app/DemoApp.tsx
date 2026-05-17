"use client";

import { useEffect, useMemo, useState } from "react";

type Identity = { did: string; name: string; active?: boolean; publicKeyJwk?: unknown };
type CredentialRow = { id: string; jwt: string; credential: any; cid: string; hash: string; issuerDid: string; subjectDid: string; revoked?: boolean; reason?: string };
type VerifyResult = { status: string; valid: boolean; score: number; reasons: string[]; breakdown?: Record<string, number>; credential?: any };

async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed: ${res.status}`);
  return json;
}

export default function DemoApp() {
  const [institutions, setInstitutions] = useState<Identity[]>([]);
  const [students, setStudents] = useState<Identity[]>([]);
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [issuerName, setIssuerName] = useState("Example University");
  const [studentName, setStudentName] = useState("Ada Lovelace");
  const [selectedIssuer, setSelectedIssuer] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [form, setForm] = useState({ studentId: "STU-2026-001", degree: "Bachelor of Science", major: "Computer Science", graduationDate: "2026-05-17", gpa: "3.9" });
  const [selectedCredential, setSelectedCredential] = useState("");
  const [verifyInput, setVerifyInput] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [audit, setAudit] = useState<any>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    const ids = await api("/api/identities");
    const creds = await api("/api/credentials");
    setInstitutions(ids.institutions); setStudents(ids.students); setCredentials(creds);
    setSelectedIssuer(v => v || ids.institutions[0]?.did || "");
    setSelectedStudent(v => v || ids.students[0]?.did || "");
    setSelectedCredential(v => v || creds[0]?.id || "");
  }
  useEffect(() => { refresh().catch(() => undefined); }, []);

  const currentCredential = useMemo(() => credentials.find(c => c.id === selectedCredential), [credentials, selectedCredential]);

  async function seedDemo() { setMessage("Creating demo data..."); const demo = await api("/api/demo/reset", {}); await refresh(); setVerifyInput(JSON.stringify({ id: demo.credential.id }, null, 2)); setMessage("Demo institution, student, and credential created."); }
  async function createInstitution() { const id = await api("/api/identities/institution", { name: issuerName }); await refresh(); setSelectedIssuer(id.did); setMessage(`Created institution ${id.name}`); }
  async function createStudent() { const id = await api("/api/identities/student", { name: studentName }); await refresh(); setSelectedStudent(id.did); setMessage(`Created student ${id.name}`); }
  async function issueCredential() {
    const student = students.find(s => s.did === selectedStudent);
    const row = await api("/api/credentials/issue", { issuerDid: selectedIssuer, subjectDid: selectedStudent, subject: { ...form, name: student?.name ?? "Student", gpa: Number(form.gpa) } });
    await refresh(); setSelectedCredential(row.id); setVerifyInput(JSON.stringify({ id: row.id }, null, 2)); setMessage("Credential issued, signed, hashed, and registered in the local registry adapter.");
  }
  async function revokeCredential() { if (!currentCredential) return; await api("/api/credentials/revoke", { id: currentCredential.id, reason: "Credential revoked during demo" }); await refresh(); setMessage("Credential revoked."); }
  async function verifyCredential(payload?: unknown) {
    const body = payload ?? (verifyInput.trim() ? JSON.parse(verifyInput) : { id: selectedCredential });
    const res = await api("/api/credentials/verify", body); setResult(res);
    if ((body as any).id) setAudit(await api(`/api/credentials/${(body as any).id}/audit`));
  }
  function tamperAndVerify() { if (!currentCredential) return; const tampered = { ...currentCredential.credential, credentialSubject: { ...currentCredential.credential.credentialSubject, degree: "Tampered Degree" } }; verifyCredential({ id: currentCredential.id, credential: tampered }); }

  return <main>
    <h1>Academic Credential Verification Demo</h1>
    <p className="muted">Issue a simulated academic credential, hold/share it as a JWT/CID, and verify issuer, signature, hash, CID, registry, and revocation status.</p>
    {message && <div className="notice">{message}</div>}
    <button onClick={seedDemo}>Reset + Seed Demo Data</button>

    <section className="grid">
      <div className="card"><h2>1. Institution</h2><input value={issuerName} onChange={e=>setIssuerName(e.target.value)} /><button onClick={createInstitution}>Create Institution DID</button><select value={selectedIssuer} onChange={e=>setSelectedIssuer(e.target.value)}>{institutions.map(i=><option key={i.did} value={i.did}>{i.name}</option>)}</select><small>{selectedIssuer}</small></div>
      <div className="card"><h2>2. Student Holder</h2><input value={studentName} onChange={e=>setStudentName(e.target.value)} /><button onClick={createStudent}>Create Student DID</button><select value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}>{students.map(s=><option key={s.did} value={s.did}>{s.name}</option>)}</select><small>{selectedStudent}</small></div>
    </section>

    <section className="card"><h2>3. Issue Credential</h2><div className="grid"><input placeholder="Student ID" value={form.studentId} onChange={e=>setForm({...form,studentId:e.target.value})}/><input placeholder="Degree" value={form.degree} onChange={e=>setForm({...form,degree:e.target.value})}/><input placeholder="Major" value={form.major} onChange={e=>setForm({...form,major:e.target.value})}/><input type="date" value={form.graduationDate} onChange={e=>setForm({...form,graduationDate:e.target.value})}/><input placeholder="GPA" value={form.gpa} onChange={e=>setForm({...form,gpa:e.target.value})}/></div><button disabled={!selectedIssuer || !selectedStudent} onClick={issueCredential}>Issue Signed Credential</button></section>

    <section className="grid"><div className="card"><h2>4. Holder Wallet</h2><select value={selectedCredential} onChange={e=>setSelectedCredential(e.target.value)}>{credentials.map(c=><option key={c.id} value={c.id}>{c.credential.credentialSubject.name} — {c.revoked ? "revoked" : "active"}</option>)}</select>{currentCredential && <><p><b>CID:</b> {currentCredential.cid}</p><p><b>Hash:</b> {currentCredential.hash}</p><button onClick={()=>navigator.clipboard.writeText(currentCredential.jwt)}>Copy JWT</button><button onClick={()=>setVerifyInput(JSON.stringify({ id: currentCredential.id }, null, 2))}>Use Share Link Payload</button><button className="danger" onClick={revokeCredential}>Revoke</button><pre>{JSON.stringify(currentCredential.credential, null, 2)}</pre></>}</div>
    <div className="card"><h2>5. Verifier</h2><textarea value={verifyInput} onChange={e=>setVerifyInput(e.target.value)} placeholder='{"id":"credential-id"} or {"cid":"local..."}'/><button onClick={()=>verifyCredential()}>Verify</button><button onClick={tamperAndVerify}>Verify Tampered Copy</button>{result && <div><h3 className={result.valid ? "ok" : "bad"}>{result.status.toUpperCase()} — {result.score}/100</h3><ul>{result.reasons.length ? result.reasons.map(r=><li key={r}>{r}</li>) : <li>All checks passed.</li>}</ul><pre>{JSON.stringify(result.breakdown, null, 2)}</pre></div>}{audit && <><h3>Audit Trail</h3><pre>{JSON.stringify(audit, null, 2)}</pre></>}</div></section>
  </main>;
}
