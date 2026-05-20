import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryRegistryAdapter, LocalStorageAdapter } from "@acme/credentials";
import { createRepository } from "../apps/web/lib/repository";
import { createCredentialService } from "../apps/web/lib/services";

async function buildServiceWithSeed(count: number) {
  const dir = mkdtempSync(join(tmpdir(), "credverify-scale-"));
  const repo = createRepository(join(dir, "store.json"));
  const storage = new LocalStorageAdapter(join(dir, "ipfs"));
  const service = createCredentialService({ repo, registry: new MemoryRegistryAdapter(), storage });
  const institution = await service.makeInstitution("Northbridge State University");
  const issued = [] as { id: string; name: string }[];
  for (let i = 0; i < count; i += 1) {
    const student = await service.makeStudent(`Student ${i.toString().padStart(3, "0")}`);
    const row = await service.issue({
      issuerDid: institution.did,
      subjectDid: student.did,
      subject: { studentId: `S-${i}`, degree: i % 2 === 0 ? "Bachelor of Science" : "Bachelor of Arts", major: "Computer Science" },
    });
    issued.push({ id: row.id, name: student.name });
  }
  return { service, repo, institution, issued };
}

describe("Phase 1 — in-memory indexes", () => {
  it("indexes credentials on issue and tracks metrics", async () => {
    const { repo } = await buildServiceWithSeed(10);
    expect(repo.indexes.metrics.issued).toBe(10);
    expect(repo.indexes.metrics.active).toBe(10);
    expect(repo.indexes.metrics.revoked).toBe(0);
    expect(repo.indexes.byStatus.active.size).toBe(10);
    expect(repo.indexes.byStatus.revoked.size).toBe(0);
    expect(repo.indexes.byCreatedAt.length).toBe(10);
  });

  it("moves a credential from active to revoked on revoke", async () => {
    const { service, repo, issued } = await buildServiceWithSeed(5);
    await service.revoke(issued[2].id, "test");
    expect(repo.indexes.metrics.active).toBe(4);
    expect(repo.indexes.metrics.revoked).toBe(1);
    expect(repo.indexes.byStatus.active.has(issued[2].id)).toBe(false);
    expect(repo.indexes.byStatus.revoked.has(issued[2].id)).toBe(true);
  });

  it("bumps verificationChecks when verified events are audited", async () => {
    const { service, repo, issued } = await buildServiceWithSeed(2);
    await service.verify({ id: issued[0].id });
    await service.verify({ id: issued[0].id });
    expect(repo.indexes.metrics.verificationChecks).toBe(2);
  });

  it("rebuilds indexes from persisted JSON on next createRepository", async () => {
    const { service, repo } = await buildServiceWithSeed(3);
    const dbPath = repo.dbPath;
    repo.persist();
    const reopened = createRepository(dbPath);
    expect(reopened.indexes.metrics.issued).toBe(3);
    expect(reopened.indexes.byStatus.active.size).toBe(3);
    expect(reopened.indexes.byCreatedAt.length).toBe(3);
    void service;
  });
});

describe("Phase 2 — new service methods", () => {
  it("searchCredentials returns rows matching tokens and short prefixes", async () => {
    const { service } = await buildServiceWithSeed(3);
    const result = service.searchCredentials("student 001");
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.rows.some((row) => row.holderName === "Student 001")).toBe(true);
    expect(service.searchCredentials("comp").total).toBeGreaterThan(0);
  });

  it("listAudit returns cursor-paginated descending events", async () => {
    const { service, issued } = await buildServiceWithSeed(2);
    for (let i = 0; i < 15; i += 1) await service.verify({ id: issued[0].id });
    const first = service.listAudit({ limit: 12, type: "verified" });
    expect(first.events.length).toBe(12);
    expect(first.hasMore).toBe(true);
    const second = service.listAudit({ limit: 12, type: "verified", before: first.oldest ?? undefined });
    expect(second.events.length).toBeGreaterThan(0);
    expect(second.events[0].createdAt < (first.oldest ?? "")).toBe(true);
  });

  it("getMetrics matches index counts", async () => {
    const { service, repo } = await buildServiceWithSeed(4);
    const m = service.getMetrics();
    expect(m.issued).toBe(repo.indexes.metrics.issued);
    expect(m.active).toBe(repo.indexes.metrics.active);
  });
});

describe("Phase 3 — listCredentialsPage", () => {
  it("paginates with sort createdAt:desc by default", async () => {
    const { service } = await buildServiceWithSeed(25);
    const page1 = service.listCredentialsPage({ page: 1, pageSize: 10 });
    expect(page1.total).toBe(25);
    expect(page1.rows.length).toBe(10);
    expect(page1.hasMore).toBe(true);
    const page3 = service.listCredentialsPage({ page: 3, pageSize: 10 });
    expect(page3.rows.length).toBe(5);
    expect(page3.hasMore).toBe(false);
  });

  it("filters by status", async () => {
    const { service, issued } = await buildServiceWithSeed(6);
    await service.revoke(issued[0].id, "x");
    await service.revoke(issued[1].id, "x");
    const active = service.listCredentialsPage({ filter: { status: "active" }, pageSize: 100 });
    const revoked = service.listCredentialsPage({ filter: { status: "revoked" }, pageSize: 100 });
    expect(active.total).toBe(4);
    expect(revoked.total).toBe(2);
  });

  it("filters by q token AND across name/degree", async () => {
    const { service } = await buildServiceWithSeed(10);
    const result = service.listCredentialsPage({ filter: { q: "student 003" }, pageSize: 100 });
    expect(result.total).toBe(1);
    expect(result.rows[0].credential?.credentialSubject?.name).toBe("Student 003");
  });

  it("sorts by holderName asc", async () => {
    const { service } = await buildServiceWithSeed(5);
    const result = service.listCredentialsPage({ sort: "holderName:asc", pageSize: 100 });
    const names = result.rows.map((row) => row.credential?.credentialSubject?.name ?? "");
    expect(names).toEqual([...names].sort());
  });

  it("excludes jwt by default, includes when requested", async () => {
    const { service } = await buildServiceWithSeed(2);
    const without = service.listCredentialsPage({ pageSize: 100 });
    expect(without.rows[0].jwt).toBeUndefined();
    const withJwt = service.listCredentialsPage({ pageSize: 100, includeJwt: true });
    expect(withJwt.rows[0].jwt).toBeTruthy();
  });
});
