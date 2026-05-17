import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryRegistryAdapter, LocalStorageAdapter } from "@acme/credentials";
import { createRepository } from "../apps/web/lib/repository";
import { createCredentialService } from "../apps/web/lib/services";

function buildService() {
  const dir = mkdtempSync(join(tmpdir(), "credverify-"));
  return createCredentialService({
    repo: createRepository(join(dir, "store.json")),
    registry: new MemoryRegistryAdapter(),
    storage: new LocalStorageAdapter(join(dir, "ipfs")),
  });
}

describe("credential service end-to-end", () => {
  it("issues, verifies, revokes, and re-verifies a credential", async () => {
    const service = buildService();
    const institution = await service.makeInstitution("Northbridge State University");
    const student = await service.makeStudent("Ada Lovelace");

    const issued = await service.issue({
      issuerDid: institution.did,
      subjectDid: student.did,
      subject: { studentId: "NSU-1", degree: "BS", major: "CS", graduationDate: "2026-05-17", gpa: 3.9 },
    });
    expect(issued.cid).toBeTruthy();
    expect(issued.chain?.mode).toBe("memory");

    const ok = await service.verify({ id: issued.id });
    expect(ok.status).toBe("valid");
    expect(ok.score).toBe(100);

    await service.revoke(issued.id, "Issued in error");
    const revoked = await service.verify({ id: issued.id });
    expect(revoked.status).toBe("revoked");
  });

  it("detects a tampered credential", async () => {
    const service = buildService();
    const institution = await service.makeInstitution("Northbridge State University");
    const student = await service.makeStudent("Ada Lovelace");
    const issued = await service.issue({ issuerDid: institution.did, subjectDid: student.did });

    const tampered = {
      ...issued.credential,
      credentialSubject: { ...issued.credential.credentialSubject, degree: "Doctor of Philosophy" },
    };
    const result = await service.verify({ id: issued.id, credential: tampered });
    expect(result.status).toBe("tampered");
  });

  it("seeds presentation records with a verifiable credential", async () => {
    const service = buildService();
    const seeded = await service.seedPresentationRecords();
    const result = await service.verify({ shareId: seeded.share.id });
    expect(result.status).toBe("valid");
  });
});
