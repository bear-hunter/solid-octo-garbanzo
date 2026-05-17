import { canonicalJson, AcademicCredentialSchema, type AcademicCredential } from "../index";
import type { CredentialStorageAdapter, StorageStatus } from "./types";

export type KuboConfig = { apiUrl: string; gatewayUrl: string };

/**
 * CredentialStorageAdapter backed by a real Kubo IPFS node via its HTTP RPC API.
 * Produces genuine content-addressed CIDs. The signed credential JSON lives
 * here off-chain; only its hash and CID are anchored on-chain.
 */
export class KuboStorageAdapter implements CredentialStorageAdapter {
  readonly mode = "kubo";

  constructor(private readonly config: KuboConfig) {}

  async add(credential: AcademicCredential): Promise<{ cid: string }> {
    const form = new FormData();
    form.append("file", new Blob([canonicalJson(credential)], { type: "application/json" }));
    const res = await fetch(`${this.config.apiUrl}/api/v0/add?cid-version=1&pin=true`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`IPFS add failed: ${res.status}`);
    const parsed = JSON.parse(await res.text()) as { Hash: string };
    return { cid: parsed.Hash };
  }

  async get(cid: string): Promise<AcademicCredential | undefined> {
    const res = await fetch(`${this.config.apiUrl}/api/v0/cat?arg=${encodeURIComponent(cid)}`, {
      method: "POST",
    });
    if (!res.ok) return undefined;
    return AcademicCredentialSchema.parse(JSON.parse(await res.text()));
  }

  async status(): Promise<StorageStatus> {
    try {
      const res = await fetch(`${this.config.apiUrl}/api/v0/version`, { method: "POST" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const version = JSON.parse(await res.text()) as { Version: string };
      return { mode: this.mode, ok: true, gateway: this.config.gatewayUrl, detail: `Kubo ${version.Version}` };
    } catch (error) {
      return { mode: this.mode, ok: false, detail: error instanceof Error ? error.message : "IPFS unreachable" };
    }
  }
}
