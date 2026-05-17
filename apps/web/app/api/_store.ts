import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createAcademicCredential,
  generateIdentity,
  hashHex,
  signCredential,
  verifyCredential,
  type AcademicCredential,
  type InstitutionRecord,
} from "@acme/credentials";
import type { JWK } from "jose";

export type Role = "institution" | "student" | "verifier";
export type UserRecord = { id: string; name: string; email: string; role: Role; did?: string };
export type StudentRecord = { did: string; name: string; publicKeyJwk: JWK; privateKeyJwk: JWK };
export type InstitutionPrivateRecord = InstitutionRecord & { privateKeyJwk: JWK };
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
};
export type AuditEvent = { id: string; credentialId: string; type: string; actor: string; note: string; createdAt: string; metadata?: Record<string, unknown> };
export type RegistryRecord = { credentialId: string; credentialHash: string; cid: string; issuerDid: string; subjectDidHash: string; status: "active" | "revoked"; updatedAt: string };
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

type DemoStore = {
  users: Map<string, UserRecord>;
  institutions: Map<string, InstitutionPrivateRecord>;
  students: Map<string, StudentRecord>;
  credentials: Map<string, StoredCredential>;
  auditEvents: AuditEvent[];
  registryRecords: Map<string, RegistryRecord>;
  shareLinks: Map<string, ShareLink>;
};

const dbPath = join(process.cwd(), ".data", "credential-store.json");
const globalStore = globalThis as typeof globalThis & { __credentialDemoStore?: DemoStore };

function emptyStore(): DemoStore {
  return {
    users: new Map(),
    institutions: new Map(),
    students: new Map(),
    credentials: new Map(),
    auditEvents: [],
    registryRecords: new Map(),
    shareLinks: new Map(),
  };
}

function fromPersisted(data: PersistedStore): DemoStore {
  return {
    users: new Map(data.users.map((row) => [row.id, row])),
    institutions: new Map(data.institutions.map((row) => [row.did, row])),
    students: new Map(data.students.map((row) => [row.did, row])),
    credentials: new Map(data.credentials.map((row) => [row.id, row])),
    auditEvents: data.auditEvents,
    registryRecords: new Map(data.registryRecords.map((row) => [row.credentialHash, row])),
    shareLinks: new Map(data.shareLinks.map((row) => [row.id, row])),
  };
}

function toPersisted(): PersistedStore {
  return {
    users: [...store.users.values()],
    institutions: [...store.institutions.values()],
    students: [...store.students.values()],
    credentials: [...store.credentials.values()],
    auditEvents: store.auditEvents,
    registryRecords: [...store.registryRecords.values()],
    shareLinks: [...store.shareLinks.values()],
  };
}

function loadStore(): DemoStore {
  if (!existsSync(dbPath)) return emptyStore();
  try {
    return fromPersisted(JSON.parse(readFileSync(dbPath, "utf8")) as PersistedStore);
  } catch {
    return emptyStore();
  }
}

const store = (globalStore.__credentialDemoStore ??= loadStore());

export const users = store.users;
export const institutions = store.institutions;
export const students = store.students;
export const credentials = store.credentials;
export const auditEvents = store.auditEvents;
export const registryRecords = store.registryRecords;
export const shareLinks = store.shareLinks;

function persist() {
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, JSON.stringify(toPersisted(), null, 2));
}

function now() {
  return new Date().toISOString();
}

function audit(credentialId: string, type: string, actor: string, note: string, metadata?: Record<string, unknown>) {
  const event = { id: crypto.randomUUID(), credentialId, type, actor, note, createdAt: now(), metadata };
  auditEvents.push(event);
  return event;
}

function cidFor(hash: string) {
  return `bafy-local-${hash.slice(2, 26)}`;
}

export async function makeInstitution(name: string) {
  const id = await generateIdentity(name);
  const institution = { ...id, active: true };
  institutions.set(id.did, institution);
  users.set(`user-${id.did}`, { id: `user-${id.did}`, name, email: "issuer@example.edu", role: "institution", did: id.did });
  persist();
  return id;
}

export async function makeStudent(name: string) {
  const id = await generateIdentity(name);
  students.set(id.did, id);
  users.set(`user-${id.did}`, { id: `user-${id.did}`, name, email: "student@example.edu", role: "student", did: id.did });
  persist();
  return id;
}

export function resetStore() {
  users.clear();
  institutions.clear();
  students.clear();
  credentials.clear();
  auditEvents.splice(0);
  registryRecords.clear();
  shareLinks.clear();
  users.set("verifier", { id: "verifier", name: "Public Verifier", email: "verifier@example.org", role: "verifier" });
}

export async function seedPresentationRecords() {
  resetStore();
  const institution = await makeInstitution("Northbridge State University");
  const student = await makeStudent("Ada Lovelace");
  const credential = await issue({
    issuerDid: institution.did,
    subjectDid: student.did,
    subject: {
      studentId: "NSU-2026-001",
      name: student.name,
      degree: "Bachelor of Science",
      major: "Computer Science",
      graduationDate: "2026-05-17",
      gpa: 3.92,
    },
  });
  const share = createShareLink(credential.id);
  persist();
  return { institution, student, credential, share };
}

export async function issue(input: { issuerDid: string; subjectDid: string; subject?: Partial<AcademicCredential["credentialSubject"]> }) {
  const issuer = institutions.get(input.issuerDid);
  if (!issuer?.active) throw new Error("unknown issuer");
  const student = students.get(input.subjectDid);
  const subject = {
    id: input.subjectDid,
    studentId: "SIM-001",
    name: student?.name ?? "Sample Student",
    degree: "Bachelor of Science",
    major: "Computer Science",
    graduationDate: "2026-05-17",
    gpa: 3.8,
    ...input.subject,
  };
  const credential = createAcademicCredential({ issuerDid: issuer.did, subject });
  const jwt = await signCredential(credential, issuer.privateKeyJwk);
  const hash = hashHex(credential);
  const cid = cidFor(hash);
  const createdAt = now();
  const row = { id: credential.id, jwt, credential, cid, hash, issuerDid: issuer.did, subjectDid: input.subjectDid, createdAt };
  credentials.set(credential.id, row);
  registryRecords.set(hash, {
    credentialId: credential.id,
    credentialHash: hash,
    cid,
    issuerDid: issuer.did,
    subjectDidHash: hashHex(input.subjectDid),
    status: "active",
    updatedAt: createdAt,
  });
  audit(credential.id, "issued", issuer.did, "Credential signed, stored off-chain, and registered in the registry adapter.", { hash, cid });
  persist();
  return row;
}

export function revokeCredential(id: string, reason = "Revoked by institution") {
  const row = credentials.get(id);
  if (!row) return undefined;
  row.revoked = true;
  row.reason = reason;
  const registry = registryRecords.get(row.hash);
  if (registry) {
    registry.status = "revoked";
    registry.updatedAt = now();
  }
  audit(id, "revoked", row.issuerDid, reason);
  persist();
  return row;
}

export async function verifyCredentialRecord(body: { id?: string; cid?: string; jwt?: string; credential?: AcademicCredential; shareId?: string }) {
  const shared = body.shareId ? shareLinks.get(body.shareId) : undefined;
  const id = body.id ?? shared?.credentialId;
  const row = id ? credentials.get(id) : [...credentials.values()].find((item) => item.cid === body.cid || item.jwt === body.jwt);
  if (!row) return { status: "unavailable", valid: false, score: 0, reasons: ["Credential was not found"] };
  const issuer = institutions.get(row.issuerDid);
  const registry = registryRecords.get(row.hash);
  const result = await verifyCredential({
    jwt: body.credential ? undefined : body.jwt ?? row.jwt,
    credential: body.credential ?? row.credential,
    issuer,
    cid: body.cid ?? row.cid,
    expectedCid: registry?.cid ?? row.cid,
    storedHash: registry?.credentialHash ?? row.hash,
    revoked: row.revoked || registry?.status === "revoked",
  });
  audit(row.id, "verified", "verifier", `Verification completed with status ${result.status}.`, { status: result.status, score: result.score });
  persist();
  return result;
}

export function getAudit(id: string) {
  return auditEvents.filter((event) => event.credentialId === id);
}

export function createShareLink(credentialId: string) {
  if (!credentials.has(credentialId)) throw new Error("credential not found");
  const existing = [...shareLinks.values()].find((link) => link.credentialId === credentialId);
  if (existing) return existing;
  const link = { id: crypto.randomUUID().slice(0, 8), credentialId, createdAt: now() };
  shareLinks.set(link.id, link);
  audit(credentialId, "shared", "holder", "Holder created a verifier share link.", { shareId: link.id });
  persist();
  return link;
}

export function issuerDashboard() {
  const rows = [...credentials.values()];
  return {
    metrics: {
      issued: rows.length,
      active: rows.filter((row) => !row.revoked).length,
      revoked: rows.filter((row) => row.revoked).length,
      verificationChecks: auditEvents.filter((event) => event.type === "verified").length,
    },
    credentials: rows,
    auditEvents: auditEvents.slice(-12).reverse(),
  };
}

export function holderDashboard(subjectDid?: string) {
  const rows = [...credentials.values()].filter((row) => !subjectDid || row.subjectDid === subjectDid);
  return {
    metrics: { held: rows.length, active: rows.filter((row) => !row.revoked).length, revoked: rows.filter((row) => row.revoked).length },
    credentials: rows.map((row) => ({ ...row, share: [...shareLinks.values()].find((link) => link.credentialId === row.id) })),
  };
}
