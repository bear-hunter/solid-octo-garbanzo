import type { ChainReceipt, OnChainCredential, RegistryAdapter, RegistryStatus } from "./types";

/**
 * In-process RegistryAdapter. Mirrors the on-chain require() rules of
 * CredentialRegistry.sol so behavior is identical to the real chain. Used for
 * tests and as the fallback when no chain node is reachable.
 */
export class MemoryRegistryAdapter implements RegistryAdapter {
  readonly mode = "memory";
  private institutions = new Set<string>();
  private credentials = new Map<string, OnChainCredential>();

  async registerInstitution(did: string, _name: string): Promise<ChainReceipt> {
    this.institutions.add(did);
    return { mode: this.mode, simulated: true };
  }

  async isAuthorized(did: string): Promise<boolean> {
    return this.institutions.has(did);
  }

  async registerCredential(input: {
    credentialHash: string;
    cid: string;
    issuerDid: string;
    subjectDidHash: string;
  }): Promise<ChainReceipt> {
    if (!this.institutions.has(input.issuerDid)) throw new Error("issuer not authorized");
    if (this.credentials.has(input.credentialHash)) throw new Error("duplicate credential");
    this.credentials.set(input.credentialHash, {
      credentialHash: input.credentialHash,
      cid: input.cid,
      issuerDid: input.issuerDid,
      revoked: false,
      revocationReason: "",
      issuedAt: Math.floor(Date.now() / 1000),
    });
    return { mode: this.mode, simulated: true };
  }

  async revokeCredential(credentialHash: string, reason: string): Promise<ChainReceipt> {
    const record = this.credentials.get(credentialHash);
    if (!record) throw new Error("missing credential");
    if (record.revoked) throw new Error("already revoked");
    record.revoked = true;
    record.revocationReason = reason;
    return { mode: this.mode, simulated: true };
  }

  async getCredential(credentialHash: string): Promise<OnChainCredential | undefined> {
    const record = this.credentials.get(credentialHash);
    return record ? { ...record } : undefined;
  }

  async status(): Promise<RegistryStatus> {
    return { mode: this.mode, ok: true, detail: "In-memory simulated registry" };
  }
}
