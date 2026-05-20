import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryRegistryAdapter, LocalStorageAdapter } from "@acme/credentials";
import { createRepository } from "../apps/web/lib/repository";
import { createCredentialService } from "../apps/web/lib/services";

async function seededService() {
  const dir = mkdtempSync(join(tmpdir(), "credverify-api-shape-"));
  const repo = createRepository(join(dir, "store.json"));
  const service = createCredentialService({ repo, registry: new MemoryRegistryAdapter(), storage: new LocalStorageAdapter(join(dir, "ipfs")) });
  await service.seedPresentationRecords();
  return service;
}

describe("zero-param API-compatible service shapes", () => {
  it("keeps credential JWTs in the legacy bare credential list", async () => {
    const service = await seededService();
    const rows = service.listCredentials();
    expect(rows[0].jwt).toBeTruthy();
  });

  it("keeps issuer dashboard credentials in the legacy full row shape", async () => {
    const service = await seededService();
    const dashboard = service.issuerDashboard();
    expect(dashboard.credentials[0].jwt).toBeTruthy();
    expect(Array.isArray(dashboard.auditEvents)).toBe(true);
  });
});
