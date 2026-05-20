"use client";

import { useEffect, useState } from "react";

type ChainStatus = {
  registry: {
    mode: string;
    ok: boolean;
    blockNumber?: number;
    addresses?: { institutionRegistry?: string; credentialRegistry?: string };
    detail?: string;
  };
  storage: { mode: string; ok: boolean; detail?: string };
};

type ChainReceipt = {
  mode: string;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  simulated?: boolean;
};

type Row = {
  id: string;
  hash: string;
  cid: string;
  revoked?: boolean;
  reason?: string;
  createdAt: string;
  chain?: ChainReceipt;
  revokeChain?: ChainReceipt;
  credential: { credentialSubject: { name: string; degree: string } };
};

type Tx = {
  kind: "issued" | "revoked";
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  simulated?: boolean;
  mode?: string;
  holder: string;
  degree: string;
  credentialHash: string;
  reason?: string;
};

function shortHash(h?: string, head = 12, tail = 6) {
  if (!h) return "—";
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

async function api(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export default function LedgerPage() {
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const s: ChainStatus = await api("/api/chain/status");
      setStatus(s);
      const rows: Row[] = await api("/api/credentials");
      const transactions: Tx[] = [];
      for (const row of rows) {
        if (row.chain) {
          transactions.push({
            kind: "issued",
            txHash: row.chain.txHash,
            blockNumber: row.chain.blockNumber,
            gasUsed: row.chain.gasUsed,
            simulated: row.chain.simulated,
            mode: row.chain.mode,
            holder: row.credential.credentialSubject.name,
            degree: row.credential.credentialSubject.degree,
            credentialHash: row.hash,
          });
        }
        if (row.revokeChain) {
          transactions.push({
            kind: "revoked",
            txHash: row.revokeChain.txHash,
            blockNumber: row.revokeChain.blockNumber,
            gasUsed: row.revokeChain.gasUsed,
            simulated: row.revokeChain.simulated,
            mode: row.revokeChain.mode,
            holder: row.credential.credentialSubject.name,
            degree: row.credential.credentialSubject.degree,
            credentialHash: row.hash,
            reason: row.reason,
          });
        }
      }
      transactions.sort((a, b) => (b.blockNumber ?? 0) - (a.blockNumber ?? 0));
      setTxs(transactions);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load ledger");
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <section className="intro rise d1">
        <div className="kicker">— The Ledger —</div>
        <h1>The <em>Public</em> Ledger.</h1>
        <p>
          Every credential this app issues or revokes produces a real transaction on the chain. This
          page shows the network it is bound to, the deployed contract addresses, and every receipt
          the app has produced — block by block.
        </p>
      </section>

      {message && <div className="notice">{message}</div>}

      {status && (
        <section className="grid cols-2 rise d2" style={{ alignItems: "start" }}>
          <div className="card stack">
            <h2>Network</h2>
            <div>
              <label>Chain mode</label>
              <p>
                <strong>{status.registry.mode}</strong> ·{" "}
                {status.registry.ok ? "live" : <span className="bad">unreachable — running fallback</span>}
              </p>
            </div>
            <div>
              <label>Current block</label>
              <p className="mono">#{status.registry.blockNumber ?? "—"}</p>
            </div>
            <div>
              <label>Off-chain storage</label>
              <p>
                <strong>{status.storage.mode}</strong> ·{" "}
                {status.storage.ok ? "live" : <span className="bad">unreachable — running fallback</span>}
                {status.storage.detail ? <span className="muted"> · {status.storage.detail}</span> : null}
              </p>
            </div>
          </div>
          <div className="card stack">
            <h2>Deployed Contracts</h2>
            <div>
              <label>InstitutionRegistry</label>
              <p className="mono">{status.registry.addresses?.institutionRegistry ?? "—"}</p>
            </div>
            <div>
              <label>CredentialRegistry</label>
              <p className="mono">{status.registry.addresses?.credentialRegistry ?? "—"}</p>
            </div>
            <p className="muted" style={{ marginTop: "0.4rem" }}>
              The CredentialRegistry contract holds the immutable record of every credential hash
              this app has anchored. The InstitutionRegistry holds the list of authorised issuer
              DIDs the credential contract gates against.
            </p>
          </div>
        </section>
      )}

      <section className="card rise d3" style={{ marginTop: "1.4rem" }}>
        <h2>Transactions</h2>
        {txs.length === 0 ? (
          <p className="muted">No on-chain transactions yet. Issue or revoke a credential from the Issuer page.</p>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              {txs.length} transaction{txs.length === 1 ? "" : "s"}, most recent first.
            </p>
            <table className="ledger-table">
              <thead>
                <tr><th>Block</th><th>Action</th><th>Tx hash</th><th>Gas</th><th>Credential</th><th>Anchored hash</th></tr>
              </thead>
              <tbody>
                {txs.map((tx, i) => (
                  <tr key={i}>
                    <td className="mono">#{tx.blockNumber ?? "—"}</td>
                    <td>
                      <span className={`tx-kind ${tx.kind}`}>{tx.kind === "issued" ? "Issued" : "Revoked"}</span>
                      {tx.kind === "revoked" && tx.reason ? <div className="muted tx-reason">{tx.reason}</div> : null}
                    </td>
                    <td className="mono" title={tx.txHash}>
                      {tx.txHash ? shortHash(tx.txHash, 12, 6) : (tx.simulated ? <span className="muted">(simulated)</span> : "—")}
                    </td>
                    <td className="mono">{tx.gasUsed ?? "—"}</td>
                    <td>{tx.holder} — {tx.degree}</td>
                    <td className="mono" title={tx.credentialHash}>{shortHash(tx.credentialHash, 10, 6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </>
  );
}
