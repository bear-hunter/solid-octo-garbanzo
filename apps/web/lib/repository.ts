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

export type CredentialMetrics = {
  issued: number;
  active: number;
  revoked: number;
  verificationChecks: number;
};

export type CredentialIndexes = {
  byIssuer: Map<string, Set<string>>;
  bySubject: Map<string, Set<string>>;
  byStatus: { active: Set<string>; revoked: Set<string> };
  byCreatedAt: string[];
  searchTokens: Map<string, Set<string>>;
  metrics: CredentialMetrics;
  auditByType: Map<string, AuditEvent[]>;
  auditByCredential: Map<string, AuditEvent[]>;
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
  indexes: CredentialIndexes;
  indexInsert(row: StoredCredential): void;
  indexRevoke(id: string): void;
  indexAudit(event: AuditEvent): void;
  persist(): void;
  reset(): void;
};

export function tokenizeCredential(row: StoredCredential): string[] {
  const subject = row.credential?.credentialSubject;
  const fields = [
    subject?.name,
    subject?.degree,
    subject?.major,
    row.id,
    row.issuerDid,
    row.subjectDid,
  ];
  const tokens = new Set<string>();
  for (const field of fields) {
    if (!field) continue;
    for (const raw of String(field).toLowerCase().split(/[\s\-_/.,]+/)) {
      if (raw.length >= 2) {
        tokens.add(raw);
        tokens.add(raw.slice(0, 2));
        if (raw.length >= 3) tokens.add(raw.slice(0, 3));
      }
    }
  }
  return [...tokens];
}

export function tokenizeQuery(input: string): string[] {
  const tokens = new Set<string>();
  for (const raw of input.toLowerCase().split(/[\s\-_/.,]+/)) {
    if (raw.length >= 2) tokens.add(raw);
  }
  return [...tokens];
}

function emptyIndexes(): CredentialIndexes {
  return {
    byIssuer: new Map(),
    bySubject: new Map(),
    byStatus: { active: new Set(), revoked: new Set() },
    byCreatedAt: [],
    searchTokens: new Map(),
    metrics: { issued: 0, active: 0, revoked: 0, verificationChecks: 0 },
    auditByType: new Map(),
    auditByCredential: new Map(),
  };
}

function addToSetMap(map: Map<string, Set<string>>, key: string, value: string) {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}


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
    indexes: emptyIndexes(),
    indexInsert(row) {
      addToSetMap(repo.indexes.byIssuer, row.issuerDid, row.id);
      addToSetMap(repo.indexes.bySubject, row.subjectDid, row.id);
      if (row.revoked) repo.indexes.byStatus.revoked.add(row.id);
      else repo.indexes.byStatus.active.add(row.id);
      if (!repo.indexes.byCreatedAt.includes(row.id)) repo.indexes.byCreatedAt.unshift(row.id);
      for (const token of tokenizeCredential(row)) addToSetMap(repo.indexes.searchTokens, token, row.id);
      repo.indexes.metrics.issued += 1;
      if (row.revoked) repo.indexes.metrics.revoked += 1;
      else repo.indexes.metrics.active += 1;
    },
    indexRevoke(id) {
      if (repo.indexes.byStatus.active.delete(id)) {
        repo.indexes.byStatus.revoked.add(id);
        repo.indexes.metrics.active -= 1;
        repo.indexes.metrics.revoked += 1;
      }
    },
    indexAudit(event) {
      let typeBucket = repo.indexes.auditByType.get(event.type);
      if (!typeBucket) {
        typeBucket = [];
        repo.indexes.auditByType.set(event.type, typeBucket);
      }
      typeBucket.push(event);
      let credBucket = repo.indexes.auditByCredential.get(event.credentialId);
      if (!credBucket) {
        credBucket = [];
        repo.indexes.auditByCredential.set(event.credentialId, credBucket);
      }
      credBucket.push(event);
      if (event.type === "verified") repo.indexes.metrics.verificationChecks += 1;
    },
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
      repo.indexes = emptyIndexes();
      repo.users.set("verifier", {
        id: "verifier",
        name: "Public Verifier",
        email: "verifier@example.org",
        role: "verifier",
      });
    },
  };

  for (const row of [...repo.credentials.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    repo.indexInsert(row);
  }
  for (const event of repo.auditEvents) {
    repo.indexAudit(event);
  }

  return repo;
}

const globalStore = globalThis as typeof globalThis & { __credentialRepository?: Repository };

/** Default process-wide repository, persisted to .data/credential-store.json. */
export const repo: Repository = (globalStore.__credentialRepository ??= createRepository(
  join(process.cwd(), ".data", "credential-store.json"),
));
