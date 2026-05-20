"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DiplomaCard from "../components/DiplomaCard";
import CopyButton from "../components/CopyButton";
import { LibraryCatalogue, type CatalogueRow } from "../components/LibraryCatalogue";
import { FolioPager } from "../components/FolioPager";
import { Marginalia } from "../components/Marginalia";

type CredentialRow = {
  id: string;
  jwt?: string;
  cid: string;
  hash: string;
  revoked?: boolean;
  credential: { issuer: string; credentialSubject: { name: string; degree: string; major: string; graduationDate: string; gpa?: number } };
  chain?: { mode: string; blockNumber?: number };
  storageMode?: string;
};

async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json", "x-demo-role": "student" }, body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

const PAGE_SIZE = 24;

export default function HolderPage() {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [revealedJwts, setRevealedJwts] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState(false);
  const [message, setMessage] = useState("");

  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("includeJwt", "false");
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (statusFilter !== "all") params.set("status", statusFilter);
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/holder?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load library");
      const fetched = (json.credentials ?? []) as CredentialRow[];
      setRows(fetched);
      const t = json.meta?.credentials?.total ?? fetched.length;
      setTotal(t);
      if (!selectedId && fetched[0]) setSelectedId(fetched[0].id);
      if (selectedId && !fetched.some((r) => r.id === selectedId)) {
        setSelectedId(fetched[0]?.id ?? "");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load library");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, statusFilter, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, statusFilter]);

  useEffect(() => {
    if (total > 12 && viewMode === "cards" && rows.length > 12) setViewMode("list");
  }, [total, viewMode, rows.length]);

  const catalogueRows: CatalogueRow[] = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        name: r.credential.credentialSubject.name,
        degree: r.credential.credentialSubject.degree,
        major: r.credential.credentialSubject.major,
        year: r.credential.credentialSubject.graduationDate?.slice(0, 4),
        revoked: r.revoked,
      })),
    [rows],
  );

  const row = useMemo(() => rows.find((r) => r.id === selectedId), [rows, selectedId]);
  const revealedJwt = row ? revealedJwts[row.id] : undefined;

  async function revealJwt() {
    if (!row || revealedJwt) return;
    setRevealing(true);
    try {
      const res = await fetch(`/api/credentials/${row.id}/jwt`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to reveal JWT");
      setRevealedJwts((prev) => ({ ...prev, [row.id]: json.jwt }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to reveal JWT");
    } finally {
      setRevealing(false);
    }
  }

  async function makeShare() {
    if (!row) return;
    const share = await api("/api/share-links", { credentialId: row.id });
    const url = `${location.origin}${share.url}`;
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Verifier link copied to clipboard.");
    } catch {
      setMessage("Verifier link created (copy it manually below).");
    }
  }

  return (
    <>
      <section className="intro rise d1">
        <div className="kicker">- Estate the Second · The Library -</div>
        <h1>The <em>Holder&apos;s</em> Wallet.</h1>
        <p>
          Your credentials live here as portable, self-sovereign diplomas. Copy the JWT, the CID,
          or mint a verifier link - no university lookup required, no registrar needed on the line.
        </p>
      </section>

      {message && <div className="notice">{message}</div>}

      <div className="btn-row">
        <button
          className="gold"
          onClick={() =>
            fetch("/api/demo/reset", { method: "POST", headers: { "x-demo-role": "institution" } })
              .then(() => load())
              .then(() => setMessage("Presentation records loaded."))
          }
        >
          Load Presentation Records
        </button>
      </div>

      <section className="grid cols-2 rise d2" style={{ marginTop: "1.4rem", alignItems: "start" }}>
        <div className="stack">
          <div className="card">
            <h2>Library <em>Catalogue</em></h2>
            <LibraryCatalogue
              rows={catalogueRows}
              selectedId={selectedId}
              onSelect={setSelectedId}
              viewMode={viewMode}
              onChangeViewMode={setViewMode}
              search={query}
              onSearch={setQuery}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              loading={loading}
              emptyText="The library awaits its first volume — petition the Chancery for an issuance."
            />
            {pageCount > 1 ? <FolioPager page={page} pageCount={pageCount} onChange={setPage} /> : null}
          </div>
          {row && (
            <DiplomaCard
              credential={row.credential}
              hash={row.hash}
              status={row.revoked ? "revoked" : "valid"}
              blockNumber={row.chain?.blockNumber}
            />
          )}
        </div>

        {row && (
          <div className="card stack">
            <h2>Portable <em>Proof</em></h2>
            <div>
              <label>IPFS Address &middot; {row.storageMode ?? "local"}</label>
              <p className="mono">{row.cid}</p>
            </div>
            <div>
              <label>Anchored Hash</label>
              <p className="mono">{row.hash}</p>
            </div>
            <div>
              <label>Sealed Credential &middot; JWT</label>
              {revealedJwt ? (
                <p className="mono">{revealedJwt.slice(0, 96)}…</p>
              ) : (
                <Marginalia variant={revealing ? "loading" : "empty"}>
                  <em>{revealing ? "Unsealing the credential…" : "The JWT lies sealed. Click reveal to retrieve it from the registry."}</em>
                </Marginalia>
              )}
            </div>
            <div className="btn-row">
              {revealedJwt ? (
                <CopyButton value={revealedJwt} label="Copy JWT" />
              ) : (
                <button className="ghost" onClick={revealJwt} disabled={revealing}>
                  {revealing ? "Revealing…" : "Reveal JWT"}
                </button>
              )}
              <CopyButton value={row.cid} label="Copy CID" />
              <button className="gold" onClick={makeShare}>Mint Verifier Link</button>
            </div>
            {shareUrl && (
              <div>
                <label>Verifier Link</label>
                <p className="mono">{shareUrl}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
