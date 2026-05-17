"use client";

import { useEffect, useState } from "react";

type CredentialRow = { id: string; credential: any; cid: string };
type VerifyResult = { status: string; valid: boolean; score: number; reasons: string[]; breakdown?: Record<string, number> };
async function api(path: string, body?: unknown) { const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined); const json = await res.json(); if (!res.ok) throw new Error(json.error ?? "Request failed"); return json; }

export default function VerifyPage({ shareId }: { shareId?: string }){
  const [credentials,setCredentials]=useState<CredentialRow[]>([]); const [payload,setPayload]=useState(""); const [result,setResult]=useState<VerifyResult|null>(null); const [audit,setAudit]=useState<any>(null); const [message,setMessage]=useState("");
  async function refresh(){ const rows=await api("/api/credentials"); setCredentials(rows); if(!payload && shareId) setPayload(JSON.stringify({shareId},null,2)); else if(!payload && rows[0]) setPayload(JSON.stringify({id:rows[0].id},null,2)); }
  useEffect(()=>{ refresh().catch(()=>undefined); }, [shareId]);
  async function seed(){ const demo=await api("/api/demo/reset",{}); await refresh(); setPayload(JSON.stringify({id:demo.credential.id},null,2)); setMessage("Demo credential ready to verify."); }
  async function verify(custom?: unknown){ const body=custom ?? JSON.parse(payload); const res=await api("/api/credentials/verify",body); setResult(res); setAudit((body as any).id ? await api(`/api/credentials/${(body as any).id}/audit`) : null); }
  async function tamper(){ const first=credentials[0]; if(!first)return; const credential={...first.credential,credentialSubject:{...first.credential.credentialSubject,degree:"Fake Degree"}}; await verify({id:first.id,credential}); }
  return <main><h1>Verifier Portal</h1><p className="muted">Checks schema, signature, issuer authorization, content hash, CID, registry presence, and revocation status.</p>{message&&<div className="notice">{message}</div>}<button onClick={seed}>Load Presentation Records</button><section className="grid"><div className="card"><h2>Credential Input</h2><p>Paste a share payload, JWT, CID, or open a holder share URL.</p><textarea value={payload} onChange={e=>setPayload(e.target.value)} placeholder='{"id":"credential-id"}'/><button onClick={()=>verify()}>Verify</button><button onClick={tamper}>Verify Tampered Copy</button></div><div className="card"><h2>Trust Result</h2>{result?<><h3 className={result.valid?"ok":"bad"}>{result.status.toUpperCase()} — {result.score}/100</h3><ul>{result.reasons.length?result.reasons.map(r=><li key={r}>{r}</li>):<li>All checks passed.</li>}</ul><h3>Explainable Checklist</h3><pre>{JSON.stringify(result.breakdown,null,2)}</pre></>:<p>No verification run yet.</p>}{audit&&<><h3>Audit Timeline</h3><pre>{JSON.stringify(audit,null,2)}</pre></>}</div></section></main>;
}
