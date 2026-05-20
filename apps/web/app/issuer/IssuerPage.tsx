"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import { FolioPager } from "../components/FolioPager";
import { Marginalia } from "../components/Marginalia";
import { QuillDropzone } from "../components/QuillDropzone";
import { QuillProgress, type QuillProgressRow } from "../components/QuillProgress";
import { parseCsv } from "../../lib/csv";

type Identity = { did: string; name: string };
type CredentialRow = {
  id: string;
  hash: string;
  revoked?: boolean;
  credential: { credentialSubject: { name: string; degree: string } };
  chain?: { mode: string; txHash?: string; blockNumber?: number };
};
type AuditEvent = { id: string; type: string; note: string; createdAt: string };

type Metrics = { issued: number; active: number; revoked: number; verificationChecks: number };

type Sort = "createdAt:desc" | "createdAt:asc" | "holderName:asc" | "holderName:desc" | "degree:asc" | "degree:desc";

type StatusFilter = "all" | "active" | "revoked";

async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json", "x-demo-role": "institution" }, body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

function nextSort(current: Sort, field: "createdAt" | "holderName" | "degree"): Sort {
  const [activeField, dir] = current.split(":") as [string, "asc" | "desc"];
  if (activeField !== field) return `${field}:asc` as Sort;
  return dir === "asc" ? (`${field}:desc` as Sort) : ("createdAt:desc" as Sort);
}

function sortMark(current: Sort, field: string): string {
  const [activeField, dir] = current.split(":") as [string, "asc" | "desc"];
  if (activeField !== field) return "";
  return dir === "asc" ? "▲" : "▼";
}

export default function IssuerPage() {
  const [institutions, setInstitutions] = useState<Identity[]>([]);
  const [students, setStudents] = useState<Identity[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [auditOldest, setAuditOldest] = useState<string | null>(null);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditType, setAuditType] = useState("all");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [metrics, setMetrics] = useState<Metrics>({ issued: 0, active: 0, revoked: 0, verificationChecks: 0 });
  const [issuerName, setIssuerName] = useState("");
  const [studentName, setStudentName] = useState("Grace Hopper");
  const [issuerDid, setIssuerDid] = useState("");
  const [studentDid, setStudentDid] = useState("");
  const [form, setForm] = useState({ studentId: "", degree: "Bachelor of Science", major: "Computer Science", graduationDate: "2026-05-17", gpa: "3.85" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Register state
  const [registerRows, setRegisterRows] = useState<CredentialRow[]>([]);
  const [registerTotal, setRegisterTotal] = useState(0);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<Sort>("createdAt:desc");

  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Bulk CSV state
  const [bulkRows, setBulkRows] = useState<QuillProgressRow[]>([]);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkFailed, setBulkFailed] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkState, setBulkState] = useState<"idle" | "running" | "paused" | "complete" | "cancelled">("idle");
  const bulkPausedRef = useRef(false);
  const bulkCancelledRef = useRef(false);
  const bulkIndexRef = useRef(0);
  const bulkQueueRef = useRef<{ index: number; name: string; subject: Record<string, unknown> }[]>([]);
  const issuerDidRef = useRef("");
  useEffect(() => {
    issuerDidRef.current = issuerDid;
  }, [issuerDid]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(registerTotal / pageSize)), [registerTotal]);

  const loadRegister = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", sort);
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    setRegisterLoading(true);
    try {
      const res = await fetch(`/api/credentials?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load register");
      setRegisterRows(json.rows ?? []);
      setRegisterTotal(json.meta?.total ?? 0);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load register");
    } finally {
      setRegisterLoading(false);
    }
  }, [page, sort, debouncedQuery, statusFilter, from, to]);

  useEffect(() => {
    void loadRegister();
  }, [loadRegister]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, statusFilter, from, to, sort]);

  const auditQuery = useCallback((before?: string | null) => {
    const params = new URLSearchParams({ limit: "12" });
    if (before) params.set("before", before);
    if (auditType !== "all") params.set("type", auditType);
    if (auditFrom) params.set("from", auditFrom);
    if (auditTo) params.set("to", auditTo);
    return params.toString();
  }, [auditType, auditFrom, auditTo]);

  async function refresh() {
    const [ids, m, audit] = await Promise.all([
      api("/api/identities"),
      api("/api/dashboard/issuer/metrics"),
      api(`/api/credentials/audit?${auditQuery()}`),
    ]);
    setInstitutions(ids.institutions);
    setStudents(ids.students);
    setMetrics(m.metrics);
    setEvents(audit.events);
    setAuditOldest(audit.meta?.oldest ?? null);
    setAuditHasMore(Boolean(audit.meta?.hasMore));
    setIssuerDid((v) => v || ids.institutions[0]?.did || "");
    setStudentDid((v) => v || ids.students[0]?.did || "");
  }

  async function loadEarlierAudit() {
    if (!auditOldest || auditLoading) return;
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/credentials/audit?${auditQuery(auditOldest)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load earlier events");
      setEvents((prev) => [...prev, ...(json.events ?? [])]);
      setAuditOldest(json.meta?.oldest ?? auditOldest);
      setAuditHasMore(Boolean(json.meta?.hasMore));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load earlier events");
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, [auditQuery]);

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

  function onSortClick(field: "createdAt" | "holderName" | "degree") {
    setSort((current) => nextSort(current, field));
  }

  async function bulkWorker() {
    while (true) {
      if (bulkCancelledRef.current) return;
      while (bulkPausedRef.current) {
        await new Promise((r) => setTimeout(r, 200));
        if (bulkCancelledRef.current) return;
      }
      const idx = bulkIndexRef.current;
      bulkIndexRef.current += 1;
      if (idx >= bulkQueueRef.current.length) return;
      const item = bulkQueueRef.current[idx];
      setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, status: "in_progress" } : r)));
      try {
        const issuer = issuerDidRef.current;
        if (!issuer) throw new Error("No active issuer selected");
        const stu = await api("/api/identities/student", { name: item.name });
        await api("/api/credentials/issue", { issuerDid: issuer, subjectDid: stu.did, subject: item.subject });
        setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, status: "ok" } : r)));
        setBulkDone((n) => n + 1);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "failed";
        setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, status: "error", detail: msg } : r)));
        setBulkFailed((n) => n + 1);
      }
    }
  }

  async function startBulk(text: string, filename: string) {
    if (!issuerDid) {
      setMessage("Pick an active issuer before bulk inscribing.");
      return;
    }
    const parsed = parseCsv(text);
    if (parsed.rows.length === 0) {
      setMessage(`No rows found in ${filename}.`);
      return;
    }
    const queue = parsed.rows.map((row, i) => {
      const name = row.NAME ?? row.name ?? `Student ${i + 1}`;
      const gpaRaw = row.GPA ?? row.gpa;
      const gpa = gpaRaw ? Number(gpaRaw) : undefined;
      return {
        index: i,
        name,
        subject: {
          studentId: row.STUDENT_ID ?? row.studentId ?? `BULK-${Date.now()}-${i + 1}`,
          name,
          degree: row.DEGREE ?? row.degree ?? form.degree,
          major: row.MAJOR ?? row.major ?? form.major,
          graduationDate: row.GRADUATION_DATE ?? row.graduationDate ?? form.graduationDate,
          ...(Number.isFinite(gpa) && gpa !== undefined ? { gpa } : {}),
        },
      };
    });
    bulkQueueRef.current = queue;
    bulkIndexRef.current = 0;
    bulkPausedRef.current = false;
    bulkCancelledRef.current = false;
    setBulkRows(queue.map((q) => ({ index: q.index, label: q.name, status: "queued" })));
    setBulkTotal(queue.length);
    setBulkDone(0);
    setBulkFailed(0);
    setBulkState("running");
    if (parsed.errors.length > 0) {
      setMessage(`${parsed.errors.length} row(s) malformed in ${filename}; remaining ${queue.length} will be inscribed.`);
    } else {
      setMessage(`Inscribing ${queue.length} credentials from ${filename}.`);
    }
    const workers = Array.from({ length: 4 }, () => bulkWorker());
    await Promise.all(workers);
    if (bulkCancelledRef.current) setBulkState("cancelled");
    else setBulkState("complete");
    await refresh();
    await loadRegister();
  }

  function bulkPause() {
    bulkPausedRef.current = true;
    setBulkState("paused");
  }

  function bulkResume() {
    bulkPausedRef.current = false;
    setBulkState("running");
  }

  function bulkCancel() {
    bulkCancelledRef.current = true;
    bulkPausedRef.current = false;
  }

  function bulkClear() {
    setBulkRows([]);
    setBulkDone(0);
    setBulkFailed(0);
    setBulkTotal(0);
    setBulkState("idle");
  }

  return (
    <>
      <section className="intro rise d1">
        <div className="kicker">- Estate the First · The Chancery -</div>
        <h1>The <em>Institution&apos;s</em> Dashboard.</h1>
        <p>
          Register an issuer DID, mint a seal, then sign and anchor each academic credential
          upon the chain. Every issuance is sealed, dated, and indelibly published - the registrar&apos;s
          office, for purposes of authentication, becomes optional.
        </p>
      </section>

      {message && <div className="notice">{message}</div>}

      <div className="btn-row">
        <button className="gold" disabled={busy} onClick={() => run("Seed", async () => { await api("/api/demo/reset", {}); await refresh(); await loadRegister(); setMessage("Presentation records loaded."); })}>
          Load Presentation Records
        </button>
      </div>

      <section className="grid cols-4 rise d2" style={{ marginTop: "1.4rem" }}>
        <div className="metric"><b>{metrics.issued}</b><span>Anchors written</span></div>
        <div className="metric"><b>{metrics.active}</b><span>In good standing</span></div>
        <div className="metric"><b>{metrics.revoked}</b><span>Revoked</span></div>
        <div className="metric"><b>{metrics.verificationChecks}</b><span>Tribunals served</span></div>
      </section>

      <section className="grid cols-2 rise d3" style={{ marginTop: "1.4rem" }}>
        <div className="card">
          <h2>Issuer <em>Identity</em></h2>
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
          <h2>Student <em>Holder</em></h2>
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

      <section className="grid cols-2 rise d4" style={{ marginTop: "1.4rem" }}>
        <div className="card">
          <h2>Issue a <em>Credential</em></h2>
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
                  await loadRegister();
                  const tx = row.chain?.txHash ? ` · tx ${row.chain.txHash.slice(0, 12)}…` : "";
                  setMessage(`Credential issued and anchored (${row.chain?.mode})${tx}.`);
                })
              }
            >
              Sign &amp; Anchor Credential
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Bulk <em>Issuances</em> · The Scribe&apos;s Codex</h2>
          <p className="muted" style={{ fontSize: "0.92rem", marginTop: "-0.3rem" }}>
            CSV columns: NAME, DEGREE, MAJOR, GRADUATION_DATE, GPA, STUDENT_ID.
          </p>
          <QuillDropzone onFile={startBulk} disabled={bulkState === "running" || bulkState === "paused"} />
          {bulkTotal > 0 ? (
            <QuillProgress
              total={bulkTotal}
              done={bulkDone}
              failed={bulkFailed}
              state={bulkState}
              rows={bulkRows}
              onPause={bulkPause}
              onResume={bulkResume}
              onCancel={bulkCancel}
              onClear={bulkClear}
            />
          ) : null}
        </div>
      </section>

      <section className="card rise d5" style={{ marginTop: "1.4rem" }}>
        <h2>Register of <em>Issuances</em></h2>
        <div className="register-controls">
          <label>
            <span>Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Holder, degree, or DID"
            />
          </label>
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">All</option>
              <option value="active">In good standing</option>
              <option value="revoked">Revoked</option>
            </select>
          </label>
          <label>
            <span>From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>Until</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {registerLoading ? (
          <Marginalia variant="loading"><em>Consulting the register…</em></Marginalia>
        ) : registerRows.length === 0 ? (
          <Marginalia><em>The folio awaits its first inscription.</em></Marginalia>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th className="sortable" onClick={() => onSortClick("holderName")}>
                    Holder<span className="sort-mark">{sortMark(sort, "holderName")}</span>
                  </th>
                  <th className="sortable" onClick={() => onSortClick("degree")}>
                    Degree<span className="sort-mark">{sortMark(sort, "degree")}</span>
                  </th>
                  <th>On-chain</th>
                  <th className="sortable" onClick={() => onSortClick("createdAt")}>
                    Inscribed<span className="sort-mark">{sortMark(sort, "createdAt")}</span>
                  </th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {registerRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.credential.credentialSubject.name}</td>
                    <td>{row.credential.credentialSubject.degree}</td>
                    <td className="mono">{row.chain?.blockNumber !== undefined ? `#${row.chain.blockNumber}` : row.chain?.mode ?? "-"}</td>
                    <td className="mono muted">{(row as unknown as { createdAt: string }).createdAt?.slice(0, 10) ?? ""}</td>
                    <td><StatusBadge status={row.revoked ? "revoked" : "valid"} /></td>
                    <td>
                      {!row.revoked && (
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() => run("Revoke", async () => { await api("/api/credentials/revoke", { id: row.id, reason: "Revoked by institution" }); await refresh(); await loadRegister(); setMessage("Credential revoked on-chain."); })}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <FolioPager page={page} pageCount={pageCount} onChange={setPage} />
          </>
        )}
      </section>

      <section className="card rise d5" style={{ marginTop: "1.4rem" }}>
        <h2>Audit <em>Trail</em></h2>
        <div className="register-controls">
          <label>
            <span>Type</span>
            <select value={auditType} onChange={(e) => setAuditType(e.target.value)}>
              <option value="all">All</option>
              <option value="issued">Issued</option>
              <option value="verified">Verified</option>
              <option value="revoked">Revoked</option>
              <option value="shared">Shared</option>
            </select>
          </label>
          <label>
            <span>From</span>
            <input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} />
          </label>
          <label>
            <span>Until</span>
            <input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} />
          </label>
        </div>
        {events.length === 0 ? (
          <Marginalia><em>No activity yet.</em></Marginalia>
        ) : (
          <>
            <ul className="timeline">
              {events.map((event) => (
                <li key={event.id}>
                  <div className="when">{new Date(event.createdAt).toLocaleString()} · {event.type}</div>
                  {event.note}
                </li>
              ))}
            </ul>
            {auditHasMore ? (
              <div className="btn-row" style={{ justifyContent: "center" }}>
                <button type="button" className="ghost" onClick={loadEarlierAudit} disabled={auditLoading}>
                  {auditLoading ? "Consulting earlier folios…" : "Earlier folios →"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
