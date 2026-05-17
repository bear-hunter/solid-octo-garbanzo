"use client";

import { useEffect, useMemo, useState } from "react";

type CredentialRow = { id: string; jwt: string; credential: any; cid: string; hash: string; revoked?: boolean; reason?: string };
async function api(path: string, body?: unknown) { const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined); const json = await res.json(); if (!res.ok) throw new Error(json.error ?? "Request failed"); return json; }

export default function HolderPage(){
  const [credentials,setCredentials]=useState<CredentialRow[]>([]); const [selected,setSelected]=useState(""); const [message,setMessage]=useState("");
  async function refresh(){ const rows=await api("/api/credentials"); setCredentials(rows); setSelected(v=>v || rows[0]?.id || ""); }
  useEffect(()=>{ refresh().catch(()=>undefined); }, []);
  const row=useMemo(()=>credentials.find(c=>c.id===selected),[credentials,selected]);
  async function seed(){ await api("/api/demo/reset",{}); await refresh(); setMessage("Demo credential loaded."); }
  async function revoke(){ if(!row)return; await api("/api/credentials/revoke",{id:row.id,reason:"Credential revoked by institution"}); await refresh(); setMessage("Credential revoked."); }
  async function copyJwt(){ if(!row)return; await navigator.clipboard.writeText(row.jwt); setMessage("JWT copied to clipboard."); }
  async function copyShare(){ if(!row)return; const share=await api("/api/share-links",{credentialId:row.id}); const url=`${location.origin}${share.url}`; await navigator.clipboard.writeText(url); setMessage(`Verifier link copied: ${url}`); }
  return <main><h1>Student Wallet</h1><p className="muted">Holder keeps issued credential JWTs, CIDs, hashes, and verifier share links.</p>{message&&<div className="notice">{message}</div>}<button onClick={seed}>Load Presentation Records</button><section className="card"><h2>My Credentials</h2>{credentials.length===0?<p>No credentials yet. Go to Issue, or load presentation records.</p>:<><select value={selected} onChange={e=>setSelected(e.target.value)}>{credentials.map(c=><option key={c.id} value={c.id}>{c.credential.credentialSubject.name} — {c.revoked?"revoked":"active"}</option>)}</select>{row&&<><p><b>Status:</b> <span className={row.revoked?"bad":"ok"}>{row.revoked?"Revoked":"Active"}</span></p><p><b>CID:</b> {row.cid}</p><p><b>Hash:</b> {row.hash}</p><button onClick={copyJwt}>Copy JWT</button><button onClick={copyShare}>Copy Verifier Link</button><button className="danger" onClick={revoke}>Revoke Credential</button><h3>Human-Readable Credential</h3><div className="grid"><p><b>Student:</b> {row.credential.credentialSubject.name}</p><p><b>Degree:</b> {row.credential.credentialSubject.degree}</p><p><b>Major:</b> {row.credential.credentialSubject.major}</p><p><b>Graduation:</b> {row.credential.credentialSubject.graduationDate}</p></div><h3>Credential JSON</h3><pre>{JSON.stringify(row.credential,null,2)}</pre><h3>JWT</h3><pre>{row.jwt}</pre></>}</>}</section></main>;
}
