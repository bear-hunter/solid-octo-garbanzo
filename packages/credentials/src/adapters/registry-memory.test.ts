import { describe, expect, it } from "vitest";
import { MemoryRegistryAdapter } from "./registry-memory";

describe("MemoryRegistryAdapter", () => {
  const sample = { credentialHash: "0xabc", cid: "cid1", issuerDid: "did:example:1", subjectDidHash: "0xdef" };

  it("rejects credentials from unauthorized issuers", async () => {
    const reg = new MemoryRegistryAdapter();
    await expect(reg.registerCredential(sample)).rejects.toThrow(/not authorized/);
  });

  it("registers, reads back, and revokes a credential for an authorized issuer", async () => {
    const reg = new MemoryRegistryAdapter();
    await reg.registerInstitution("did:example:1", "Test University");
    expect(await reg.isAuthorized("did:example:1")).toBe(true);

    const receipt = await reg.registerCredential(sample);
    expect(receipt.simulated).toBe(true);

    const record = await reg.getCredential("0xabc");
    expect(record).toMatchObject({ cid: "cid1", revoked: false });

    await reg.revokeCredential("0xabc", "issued in error");
    expect((await reg.getCredential("0xabc"))?.revoked).toBe(true);
  });

  it("rejects duplicate credential hashes", async () => {
    const reg = new MemoryRegistryAdapter();
    await reg.registerInstitution("did:example:1", "Test University");
    await reg.registerCredential(sample);
    await expect(reg.registerCredential(sample)).rejects.toThrow(/duplicate/);
  });

  it("reports ok status", async () => {
    expect((await new MemoryRegistryAdapter().status()).ok).toBe(true);
  });
});
