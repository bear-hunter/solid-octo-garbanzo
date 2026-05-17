"use client";

import { useEffect, useState } from "react";

type Identity = { did: string; name: string };
async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const json = await res.json(); if (!res.ok) throw new Error(json.error ?? "Request failed"); return json;
}

export default function IssuePage() {
  const [institutions, setInstitutions] = useState<Identity[]>([]);
  const [students, setStudents] = useState<Identity[]>([]);
  const [metrics, setMetrics] = useState({ issued: 0, active: 0, revoked: 0, verificationChecks: 0 });
  const [issuerName, setIssuerName] = useState("Example University");
  const [studentName, setStudentName] = useState("Ada Lovelace");
  const [issuerDid, setIssuerDid] = useState("");
  const [studentDid, setStudentDid] = useState("");
  const [form, setForm] = useState({ studentId: "STU-2026-001", degree: "Bachelor of Science", major: "Computer Science", graduationDate: "2026-05-17", gpa: "3.9" });
  const [message, setMessage] = useState("");
  async function refresh() { const ids = await api("/api/identities"); const dashboard = await api("/api/dashboard/issuer"); setInstitutions(ids.institutions); setStudents(ids.students); setMetrics(dashboard.metrics); setIssuerDid((v)=>v || ids.institutions[0]?.did || ""); setStudentDid((v)=>v || ids.students[0]?.did || ""); }
  useEffect(()=>{ refresh().catch(()=>undefined); }, []);
  async function seed() { const demo = await api("/api/demo/reset", {}); await refresh(); setIssuerDid(demo.institution.did); setStudentDid(demo.student.did); setMessage("Demo data created. Go to Holder to view the credential or Verify to check it."); }
  async function createInstitution() { const id = await api("/api/identities/institution", { name: issuerName }); await refresh(); setIssuerDid(id.did); setMessage(`Institution created: ${id.did}`); }
  async function createStudent() { const id = await api("/api/identities/student", { name: studentName }); await refresh(); setStudentDid(id.did); setMessage(`Student created: ${id.did}`); }
  async function issue() { const student = students.find(s=>s.did===studentDid); const row = await api("/api/credentials/issue", { issuerDid, subjectDid: studentDid, subject: { ...form, name: student?.name ?? "Student", gpa: Number(form.gpa) } }); await refresh(); setMessage(`Credential issued: ${row.id}. Go to Holder or Verify.`); }
  return <main><h1>Institution Dashboard</h1><p className="muted">Issue academic credentials, monitor registry status, and prepare records for verification.</p>{message && <div className="notice">{message}</div>}<button onClick={seed}>Load Presentation Records</button><section className="grid metrics"><div className="card"><b>{metrics.issued}</b><span>Issued</span></div><div className="card"><b>{metrics.active}</b><span>Active</span></div><div className="card"><b>{metrics.revoked}</b><span>Revoked</span></div><div className="card"><b>{metrics.verificationChecks}</b><span>Verifier Checks</span></div></section><section className="grid"><div className="card"><h2>Institution</h2><input value={issuerName} onChange={e=>setIssuerName(e.target.value)} /><button onClick={createInstitution}>Create Institution DID</button><select value={issuerDid} onChange={e=>setIssuerDid(e.target.value)}>{institutions.map(i=><option key={i.did} value={i.did}>{i.name}</option>)}</select><small>{issuerDid}</small></div><div className="card"><h2>Student</h2><input value={studentName} onChange={e=>setStudentName(e.target.value)} /><button onClick={createStudent}>Create Student DID</button><select value={studentDid} onChange={e=>setStudentDid(e.target.value)}>{students.map(s=><option key={s.did} value={s.did}>{s.name}</option>)}</select><small>{studentDid}</small></div></section><section className="card"><h2>Issue Credential</h2><div className="grid"><input placeholder="Student ID" value={form.studentId} onChange={e=>setForm({...form,studentId:e.target.value})}/><input placeholder="Degree" value={form.degree} onChange={e=>setForm({...form,degree:e.target.value})}/><input placeholder="Major" value={form.major} onChange={e=>setForm({...form,major:e.target.value})}/><input type="date" value={form.graduationDate} onChange={e=>setForm({...form,graduationDate:e.target.value})}/><input placeholder="GPA" value={form.gpa} onChange={e=>setForm({...form,gpa:e.target.value})}/></div><button disabled={!issuerDid || !studentDid} onClick={issue}>Issue Signed Credential</button></section></main>;
}
