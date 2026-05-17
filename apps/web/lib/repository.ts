import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AcademicCredential } from "@acme/credentials";
import type { JWK } from "jose";

export type Role = "institution" | "student" | "verifier";
export type UserRecord = { id: string; name: string; email: string; role: Role; did?: string };
export type StudentRecord = { did: string; name: string; publicKeyJwk: JWK; privateKeyJwk: JWK };
export type InstitutionPrivateRecord = {
  did: string;
  name: string;
  active: boolean;
  publicKeyJwk: JWK;
  privateKeyJwk: JWK;
};
export type StoredCredential = {
  id: string;
  jwt: string;
  credential: AcademicCredential;
  cid: string;
  hash: string;
  issuerDid: string;
  subjectDid: string;
  revoked?: boolean;
  reason?: string;
  createdAt: string;
  chain?: { mode: string; txHash?: string; blockNumber?: number; gasUsed?: string; simulated: boolean };
  revokeChain?: { mode: string; txHash?: string; blockNumber?: number; gasUsed?: string; simulated: boolean };
  storageMode?: string;
};
export type AuditEvent = {
  id: string;
  credentialId: string;
  type: string;
  actor: string;
  note: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};
export type RegistryRecord = {
  credentialId: string;
  credentialHash: string;
  cid: string;
  issuerDid: string;
  subjectDidHash: string;
  status: "active" | "revoked";
  updatedAt: string;
};
export type ShareLink = { id: string; credentialId: string; createdAt: string };

type PersistedStore = {
  users: UserRecord[];
  institutions: InstitutionPrivateRecord[];
  students: StudentRecord[];
  credentials: StoredCredential[];
  auditEvents: AuditEvent[];
  registryRecords: RegistryRecord[];
  shareLinks: ShareLink[];
};

export type Repository = {
  readonly dbPath: string;
  users: Map<string, UserRecord>;
  institutions: Map<string, InstitutionPrivateRecord>;
  students: Map<string, StudentRecord>;
  credentials: Map<string, StoredCredential>;
  auditEvents: AuditEvent[];
  registryRecords: Map<string, RegistryRecord>;
  shareLinks: Map<string, ShareLink>;
  persist(): void;
  reset(): void;
};

function emptyPersisted(): PersistedStore {
  return { users: [], institutions: [], students: [], credentials: [], auditEvents: [], registryRecords: [], shareLinks: [] };
}

export function createRepository(dbPath: string): Repository {
  const data: PersistedStore = existsSync(dbPath)
    ? (() => {
        try {
          return JSON.parse(readFileSync(dbPath, "utf8")) as PersistedStore;
        } catch {
          return emptyPersisted();
        }
      })()
    : emptyPersisted();

  const repo: Repository = {
    dbPath,
    users: new Map(data.users.map((row) => [row.id, row])),
    institutions: new Map(data.institutions.map((row) => [row.did, row])),
    students: new Map(data.students.map((row) => [row.did, row])),
    credentials: new Map(data.credentials.map((row) => [row.id, row])),
    auditEvents: data.auditEvents,
    registryRecords: new Map(data.registryRecords.map((row) => [row.credentialHash, row])),
    shareLinks: new Map(data.shareLinks.map((row) => [row.id, row])),
    persist() {
      mkdirSync(dirname(dbPath), { recursive: true });
      const snapshot: PersistedStore = {
        users: [...repo.users.values()],
        institutions: [...repo.institutions.values()],
        students: [...repo.students.values()],
        credentials: [...repo.credentials.values()],
        auditEvents: repo.auditEvents,
        registryRecords: [...repo.registryRecords.values()],
        shareLinks: [...repo.shareLinks.values()],
      };
      writeFileSync(dbPath, JSON.stringify(snapshot, null, 2));
    },
    reset() {
      repo.users.clear();
      repo.institutions.clear();
      repo.students.clear();
      repo.credentials.clear();
      repo.auditEvents.splice(0);
      repo.registryRecords.clear();
      repo.shareLinks.clear();
      repo.users.set("verifier", {
        id: "verifier",
        name: "Public Verifier",
        email: "verifier@example.org",
        role: "verifier",
      });
    },
  };
  return repo;
}

const globalStore = globalThis as typeof globalThis & { __credentialRepository?: Repository };

/** Default process-wide repository, persisted to .data/credential-store.json. */
export const repo: Repository = (globalStore.__credentialRepository ??= createRepository(
  join(process.cwd(), ".data", "credential-store.json"),
));
