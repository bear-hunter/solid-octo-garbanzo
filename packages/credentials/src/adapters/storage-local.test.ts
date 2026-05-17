import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAcademicCredential } from "../index";
import { LocalStorageAdapter } from "./storage-local";

function sampleCredential() {
  return createAcademicCredential({
    issuerDid: "did:example:issuer",
    subject: { id: "did:example:student", studentId: "S1", name: "Ada", degree: "BS", major: "CS", graduationDate: "2026-05-17" },
  });
}

describe("LocalStorageAdapter", () => {
  it("stores a credential and reads it back by CID", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ipfs-local-"));
    const storage = new LocalStorageAdapter(dir);
    const credential = sampleCredential();

    const { cid } = await storage.add(credential);
    expect(cid).toMatch(/^bafy-local-/);

    const fetched = await storage.get(cid);
    expect(fetched).toEqual(credential);
  });

  it("produces deterministic CIDs for identical content", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ipfs-local-"));
    const storage = new LocalStorageAdapter(dir);
    const credential = sampleCredential();
    const a = await storage.add(credential);
    const b = await storage.add(credential);
    expect(a.cid).toBe(b.cid);
  });

  it("returns undefined for an unknown CID and ok status", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ipfs-local-"));
    const storage = new LocalStorageAdapter(dir);
    expect(await storage.get("bafy-local-missing")).toBeUndefined();
    expect((await storage.status()).ok).toBe(true);
  });
});
