import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, hashHex, type AcademicCredential } from "../index";
import type { CredentialStorageAdapter, StorageStatus } from "./types";

/**
 * Off-chain storage fallback. Writes credential JSON to disk under a
 * content-derived, deterministic CID. Used when no Kubo IPFS node is reachable.
 */
export class LocalStorageAdapter implements CredentialStorageAdapter {
  readonly mode = "local";

  constructor(private readonly dir: string = join(process.cwd(), ".data", "ipfs-local")) {}

  private cidFor(credential: AcademicCredential): string {
    return `bafy-local-${hashHex(canonicalJson(credential)).slice(2, 34)}`;
  }

  async add(credential: AcademicCredential): Promise<{ cid: string }> {
    mkdirSync(this.dir, { recursive: true });
    const cid = this.cidFor(credential);
    writeFileSync(join(this.dir, `${cid}.json`), canonicalJson(credential));
    return { cid };
  }

  async get(cid: string): Promise<AcademicCredential | undefined> {
    const file = join(this.dir, `${cid}.json`);
    if (!existsSync(file)) return undefined;
    return JSON.parse(readFileSync(file, "utf8")) as AcademicCredential;
  }

  async status(): Promise<StorageStatus> {
    return { mode: this.mode, ok: true, detail: "Local disk-backed CID store" };
  }
}
