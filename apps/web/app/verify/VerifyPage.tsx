"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import ScoreBar from "../components/ScoreBar";
import { Marginalia } from "../components/Marginalia";
import { TribunalDocket, loadDocket, saveDocket, type DocketEntry } from "../components/TribunalDocket";

type VerifyResult = {
  status: string;
  valid: boolean;
  score: number;
  reasons: string[];
  breakdown?: Record<string, number>;
  credential?: { credentialSubject: { name: string; degree: string; major: string } };
};
type AuditEvent = { id: string; type: string; note: string; createdAt: string };
type CredentialRow = { id: string; credential: { credentialSubject: { name: string; degree?: string } } };
type SearchRow = { id: string; holderName: string; degree: string; major: string; status: string; createdAt: string };

async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json", "x-demo-role": "institution" }, body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

type Tab = "single" | "search" | "bulk";
type BulkRow = { index: number; label: string; status: "queued" | "in_progress" | "ok" | "error"; verdict?: string; detail?: string };

export default function VerifyPage({ shareId }: { shareId?: string }) {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [payload, setPayload] = useState(shareId ? JSON.stringify({ shareId }, null, 2) : "");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [auditOldest, setAuditOldest] = useState<string | null>(null);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditCredentialId, setAuditCredentialId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("single");

  // Search tab state
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchRow[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // Bulk tab state
  const [bulkInput, setBulkInput] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkCounters, setBulkCounters] = useState<Record<string, number>>({});
  const [bulkState, setBulkState] = useState<"idle" | "running" | "complete">("idle");

  // Docket
  const [docket, setDocket] = useState<DocketEntry[]>([]);
  useEffect(() => {
    setDocket(loadDocket());
  }, []);

  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults([]);
      return;
    }
    fetch(`/api/credentials/search?q=${encodeURIComponent(debouncedSearch)}&pageSize=10`)
      .then((res) => res.json())
      .then((json) => setSearchResults(json.rows ?? []))
      .catch(() => setSearchResults([]));
  }, [debouncedSearch]);

  async function refresh() {
    const data: CredentialRow[] = await api("/api/credentials");
    setRows(data);
    if (!payload && !shareId && data[0]) setPayload(JSON.stringify({ id: data[0].id }, null, 2));
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    if (shareId) verify({ shareId });
  }, [shareId]);

  const pushDocket = useCallback((entry: DocketEntry) => {
    setDocket((prev) => {
      const next = [entry, ...prev.filter((p) => p.id !== entry.id)].slice(0, 200);
      saveDocket(next);
      return next;
    });
  }, []);

  async function loadAudit(credentialId?: string, before?: string | null, append = false) {
    const params = new URLSearchParams({ limit: "12" });
    if (credentialId) params.set("credentialId", credentialId);
    if (before) params.set("before", before);
    const res = await fetch(`/api/credentials/audit?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to load audit trail");
    setEvents((prev) => (append ? [...prev, ...(json.events ?? [])] : (json.events ?? [])));
    setAuditOldest(json.meta?.oldest ?? null);
    setAuditHasMore(Boolean(json.meta?.hasMore));
    setAuditCredentialId(credentialId ?? null);
  }

  async function loadEarlierAudit() {
    if (!auditHasMore || auditLoading) return;
    setAuditLoading(true);
    try {
      await loadAudit(auditCredentialId ?? undefined, auditOldest, true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load earlier events");
    } finally {
      setAuditLoading(false);
    }
  }

  async function verify(body: unknown) {
    setBusy(true);
    try {
      const res: VerifyResult = await api("/api/credentials/verify", body);
      setResult(res);
      const id = (body as { id?: string }).id;
      if (id) await loadAudit(id);
      else await loadAudit();
      const docketEntry: DocketEntry = {
        id: (id ?? (body as { shareId?: string }).shareId ?? `inline-${Date.now()}`) as string,
        holderName: res.credential?.credentialSubject?.name ?? "—",
        status: res.status,
        score: res.score,
        at: new Date().toISOString(),
        payload: JSON.stringify(body),
      };
      pushDocket(docketEntry);
      return res;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Verification failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function verifyTampered() {
    const first = rows[0];
    if (!first) return;
    const full = (await api("/api/dashboard/holder")).credentials;
    const target = full.find((r: { id: string }) => r.id === first.id);
    const tampered = { ...target.credential, credentialSubject: { ...target.credential.credentialSubject, degree: "Doctor of Philosophy" } };
    await verify({ id: first.id, credential: tampered });
    setMessage("Submitted an altered copy - the verifier should flag it as tampered.");
  }

  async function selectSearchResult(rowId: string) {
    setSearchOpen(false);
    setSearchInput("");
    setPayload(JSON.stringify({ id: rowId }, null, 2));
    setTab("single");
    await verify({ id: rowId });
  }

  async function runBulk() {
    const lines = bulkInput.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      setMessage("Paste at least one line — bare id, or JSON like {\"id\":\"…\"}.");
      return;
    }
    setBulkState("running");
    const seeded: BulkRow[] = lines.map((line, idx) => ({ index: idx, label: line.length > 48 ? line.slice(0, 48) + "…" : line, status: "queued" }));
    setBulkRows(seeded);
    setBulkCounters({});
    let cursor = 0;
    const queue = lines.map((line, idx) => ({ idx, line }));

    async function worker() {
      while (true) {
        const my = cursor;
        cursor += 1;
        if (my >= queue.length) return;
        const { idx, line } = queue[my];
        setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, status: "in_progress" } : r)));
        let body: unknown;
        try {
          body = line.startsWith("{") ? JSON.parse(line) : { id: line };
        } catch {
          setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, status: "error", detail: "invalid JSON" } : r)));
          setBulkCounters((c) => ({ ...c, error: (c.error ?? 0) + 1 }));
          continue;
        }
        const verdict = await verify(body);
        if (verdict) {
          setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, status: "ok", verdict: verdict.status } : r)));
          setBulkCounters((c) => ({ ...c, [verdict.status]: (c[verdict.status] ?? 0) + 1 }));
        } else {
          setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, status: "error" } : r)));
          setBulkCounters((c) => ({ ...c, error: (c.error ?? 0) + 1 }));
        }
      }
    }

    await Promise.all(Array.from({ length: 4 }, () => worker()));
    setBulkState("complete");
  }

  function reVerifyFromDocket(entry: DocketEntry) {
    try {
      const body = JSON.parse(entry.payload);
      setPayload(entry.payload);
      setTab("single");
      void verify(body);
    } catch {
      setMessage("Docket entry payload is malformed.");
    }
  }

  function clearDocket() {
    setDocket([]);
    saveDocket([]);
  }

  const verdictCounters = useMemo(() => Object.entries(bulkCounters).filter(([, n]) => n > 0), [bulkCounters]);

  return (
    <>
      <section className="intro rise d1">
        <div className="kicker">- Estate the Third · The Tribunal -</div>
        <h1>The <em>Verifier&apos;s</em> Tribunal.</h1>
        <p>
          Submit a credential - by JWT, CID, ID, or share-link - and the tribunal renders an
          explainable six-part trust score, with the failing predicate named in plain language and
          pinpointed to the contract call that disagreed.
        </p>
      </section>

      {message && <div className="notice">{message}</div>}

      <section className="grid cols-2 rise d2" style={{ alignItems: "start" }}>
        <div className="card stack">
          <h2>Submission to the <em>Tribunal</em></h2>
          <div className="tribunal-tabs">
            <button type="button" className={tab === "single" ? "is-active" : ""} onClick={() => setTab("single")}>Single Submission</button>
            <button type="button" className={tab === "search" ? "is-active" : ""} onClick={() => setTab("search")}>Search the Register</button>
            <button type="button" className={tab === "bulk" ? "is-active" : ""} onClick={() => setTab("bulk")}>Bulk Docket</button>
          </div>

          {tab === "single" ? (
            <>
              <p className="muted">Accepts a JSON object of one key: <code>id</code>, <code>cid</code>, <code>jwt</code>, or <code>shareId</code>.</p>
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
            </>
          ) : null}

          {tab === "search" ? (
            <>
              <p className="muted">Type a holder name, degree, or credential id. Selecting a row auto-verifies.</p>
              <div className="autocomplete">
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => { setSearchInput(e.target.value); setSearchOpen(true); }}
                  placeholder="Ada Lovelace, Bachelor of Science…"
                  onFocus={() => setSearchOpen(true)}
                />
                {searchOpen && searchResults.length > 0 ? (
                  <div className="results">
                    {searchResults.map((r) => (
                      <button type="button" key={r.id} className="result" onClick={() => selectSearchResult(r.id)}>
                        <span>
                          <strong>{r.holderName}</strong> — <em>{r.degree}</em>
                        </span>
                        <span className="meta">{r.status}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {searchOpen && debouncedSearch && searchResults.length === 0 ? (
                <Marginalia><em>No matching records in the register.</em></Marginalia>
              ) : null}
            </>
          ) : null}

          {tab === "bulk" ? (
            <>
              <p className="muted">One per line: bare id, or JSON like <code>{"{\"id\":\"…\"}"}</code>. Concurrency: four.</p>
              <textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} placeholder='urn:uuid:…&#10;{"id":"urn:uuid:…"}' />
              <div className="btn-row">
                <button disabled={busy || bulkState === "running"} onClick={runBulk}>Verify Docket</button>
                <button className="ghost" onClick={() => { setBulkInput(""); setBulkRows([]); setBulkCounters({}); setBulkState("idle"); }}>Clear</button>
              </div>
              {bulkRows.length > 0 ? (
                <div className="quill-progress">
                  <p className="quill-meta">
                    {verdictCounters.length === 0 ? <em>queued</em> : verdictCounters.map(([status, n]) => (
                      <span key={status}><span className={`badge ${status}`}>{status}</span> {n} · </span>
                    ))}
                  </p>
                  <ul className="timeline quill-ledger">
                    {bulkRows.slice(-20).reverse().map((row) => (
                      <li key={row.index}>
                        <span className="when">Row {row.index + 1} ·</span>{" "}
                        {row.status === "ok" && row.verdict ? <span className={`badge ${row.verdict}`}>{row.verdict}</span> : null}
                        {row.status === "error" ? <span className="badge invalid">error</span> : null}
                        {row.status === "in_progress" ? <span className="muted">verifying…</span> : null}
                        {row.status === "queued" ? <span className="muted">queued</span> : null}
                        <span className="row-label"> {row.label}</span>
                        {row.detail ? <span className="muted"> — {row.detail}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="card stack">
          <h2>Verdict of the <em>Tribunal</em></h2>
          {!result ? (
            <Marginalia><em>No verification run yet.</em></Marginalia>
          ) : (
            <>
              <div>
                <StatusBadge status={result.status} />
              </div>
              <ScoreBar score={result.score} breakdown={result.breakdown} />
              <div>
                <h3>Of the predicates that disagreed</h3>
                {result.reasons.length === 0 ? (
                  <p className="muted">- Six predicates, six lights of inspection · all confirmed -</p>
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
                  {result.credential.credentialSubject.name} - {result.credential.credentialSubject.degree},{" "}
                  {result.credential.credentialSubject.major}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <TribunalDocket entries={docket} onReVerify={reVerifyFromDocket} onClear={clearDocket} />

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
          {auditHasMore ? (
            <div className="btn-row" style={{ justifyContent: "center" }}>
              <button type="button" className="ghost" onClick={loadEarlierAudit} disabled={auditLoading}>
                {auditLoading ? "Consulting earlier folios…" : "Earlier folios →"}
              </button>
            </div>
          ) : null}
        </section>
      )}
    </>
  );
}
