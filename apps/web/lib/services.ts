import {
  AcademicCredentialSchema,
  createAcademicCredential,
  generateIdentity,
  hashHex,
  signCredential,
  verifyCredential,
  type AcademicCredential,
  type CredentialStorageAdapter,
  type RegistryAdapter,
  type VerificationResult,
} from "@acme/credentials";
import { decodeJwt } from "jose";
import { tokenizeQuery, type AuditEvent, type Repository, type StoredCredential } from "./repository";

export type SearchRow = {
  id: string;
  holderName: string;
  degree: string;
  major: string;
  issuerDid: string;
  subjectDid: string;
  status: "active" | "revoked";
  createdAt: string;
};

export type AuditQuery = {
  limit?: number;
  before?: string;
  type?: string;
  credentialId?: string;
  issuerDid?: string;
  from?: string;
  to?: string;
};

export type CredentialFilter = {
  q?: string;
  status?: "active" | "revoked" | "all";
  issuerDid?: string;
  subjectDid?: string;
  from?: string;
  to?: string;
};

export type CredentialSort =
  | "createdAt:desc"
  | "createdAt:asc"
  | "holderName:asc"
  | "holderName:desc"
  | "degree:asc"
  | "degree:desc";

export type CredentialListPageOptions = {
  filter?: CredentialFilter;
  page?: number;
  pageSize?: number;
  sort?: CredentialSort;
  includeJwt?: boolean;
};

export type CredentialListResult = {
  rows: PublicCredential[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  sort: CredentialSort;
  filter: CredentialFilter;
};

export type ServiceDeps = {
  repo: Repository;
  registry: RegistryAdapter;
  storage: CredentialStorageAdapter;
};

export type IssueInput = {
  issuerDid: string;
  subjectDid: string;
  subject?: Partial<AcademicCredential["credentialSubject"]>;
};

export type VerifyInput = {
  id?: string;
  cid?: string;
  jwt?: string;
  shareId?: string;
  credential?: AcademicCredential;
};

export type PublicCredential = Omit<StoredCredential, "jwt"> & { jwt?: string };

const now = () => new Date().toISOString();

function audit(
  repo: Repository,
  credentialId: string,
  type: string,
  actor: string,
  note: string,
  metadata?: Record<string, unknown>,
): AuditEvent {
  const event: AuditEvent = { id: crypto.randomUUID(), credentialId, type, actor, note, createdAt: now(), metadata };
  repo.auditEvents.push(event);
  repo.indexAudit(event);
  return event;
}

export function createCredentialService(deps: ServiceDeps) {
  const { repo, registry, storage } = deps;

  async function makeInstitution(name: string) {
    const id = await generateIdentity(name);
    repo.institutions.set(id.did, { ...id, active: true });
    repo.users.set(`user-${id.did}`, {
      id: `user-${id.did}`,
      name,
      email: "issuer@example.edu",
      role: "institution",
      did: id.did,
    });
    await registry.registerInstitution(id.did, name);
    repo.persist();
    return { did: id.did, name: id.name, publicKeyJwk: id.publicKeyJwk };
  }

  async function makeStudent(name: string) {
    const id = await generateIdentity(name);
    repo.students.set(id.did, id);
    repo.users.set(`user-${id.did}`, {
      id: `user-${id.did}`,
      name,
      email: "student@example.edu",
      role: "student",
      did: id.did,
    });
    repo.persist();
    return { did: id.did, name: id.name, publicKeyJwk: id.publicKeyJwk };
  }

  async function issue(input: IssueInput): Promise<StoredCredential> {
    const issuer = repo.institutions.get(input.issuerDid);
    if (!issuer?.active) throw new Error("Unknown or inactive issuer");
    const student = repo.students.get(input.subjectDid);
    const credential = createAcademicCredential({
      issuerDid: issuer.did,
      subject: {
        id: input.subjectDid,
        studentId: "SIM-001",
        name: student?.name ?? "Sample Student",
        degree: "Bachelor of Science",
        major: "Computer Science",
        graduationDate: "2026-05-17",
        gpa: 3.8,
        ...input.subject,
      },
    });
    const jwt = await signCredential(credential, issuer.privateKeyJwk);
    const hash = hashHex(credential);
    const subjectDidHash = hashHex(input.subjectDid);

    const { cid } = await storage.add(credential);
    if (!(await registry.isAuthorized(issuer.did))) await registry.registerInstitution(issuer.did, issuer.name);
    const receipt = await registry.registerCredential({ credentialHash: hash, cid, issuerDid: issuer.did, subjectDidHash });

    const row: StoredCredential = {
      id: credential.id,
      jwt,
      credential,
      cid,
      hash,
      issuerDid: issuer.did,
      subjectDid: input.subjectDid,
      createdAt: now(),
      chain: receipt,
      storageMode: storage.mode,
    };
    repo.credentials.set(credential.id, row);
    repo.indexInsert(row);
    repo.registryRecords.set(hash, {
      credentialId: credential.id,
      credentialHash: hash,
      cid,
      issuerDid: issuer.did,
      subjectDidHash,
      status: "active",
      updatedAt: row.createdAt,
    });
    audit(repo, credential.id, "issued", issuer.did, `Stored on IPFS (${storage.mode}) and anchored on-chain (${receipt.mode}).`, {
      hash,
      cid,
      txHash: receipt.txHash,
      blockNumber: receipt.blockNumber,
    });
    repo.persist();
    return row;
  }

  async function revoke(id: string, reason = "Revoked by institution"): Promise<StoredCredential | undefined> {
    const row = repo.credentials.get(id);
    if (!row) return undefined;
    let receipt;
    try {
      receipt = await registry.revokeCredential(row.hash, reason);
    } catch (error) {
      const status = await registry.status();
      if (status.mode !== "memory") throw error;
      receipt = { mode: status.mode, simulated: true };
    }
    row.revoked = true;
    row.reason = reason;
    row.revokeChain = receipt;
    repo.indexRevoke(id);
    const registryRecord = repo.registryRecords.get(row.hash);
    if (registryRecord) {
      registryRecord.status = "revoked";
      registryRecord.updatedAt = now();
    }
    audit(repo, id, "revoked", row.issuerDid, reason, { txHash: receipt.txHash, blockNumber: receipt.blockNumber });
    repo.persist();
    return row;
  }

  async function verify(input: VerifyInput): Promise<VerificationResult> {
    const shared = input.shareId ? repo.shareLinks.get(input.shareId) : undefined;
    const id = input.id ?? shared?.credentialId;
    const row = id
      ? repo.credentials.get(id)
      : [...repo.credentials.values()].find((item) => item.cid === input.cid || item.jwt === input.jwt);

    let credential = input.credential ? AcademicCredentialSchema.parse(input.credential) : undefined;
    if (!credential && input.jwt) credential = AcademicCredentialSchema.parse(decodeJwt(input.jwt).vc);
    if (!credential && input.cid) credential = await storage.get(input.cid);
    const offChain = credential ?? (row ? (await storage.get(row.cid)) ?? row.credential : undefined);
    if (!offChain) {
      return { status: "unavailable", valid: false, score: 0, breakdown: emptyBreakdown(), reasons: ["Credential content is unavailable"] };
    }

    const hash = hashHex(offChain);
    const issuer = repo.institutions.get(offChain.issuer) ?? (row ? repo.institutions.get(row.issuerDid) : undefined);
    const onChain = await registry.getCredential(hash);
    const result = await verifyCredential({
      jwt: input.credential ? undefined : input.jwt ?? row?.jwt,
      credential: offChain,
      issuer: issuer ? { did: issuer.did, name: issuer.name, active: issuer.active, publicKeyJwk: issuer.publicKeyJwk } : undefined,
      cid: input.cid ?? onChain?.cid ?? row?.cid,
      expectedCid: onChain?.cid ?? (input.credential && row ? row.cid : undefined),
      storedHash: onChain?.credentialHash ?? (input.credential && row ? row.hash : undefined),
      revoked: row?.revoked || onChain?.revoked === true,
      unavailable: !offChain,
    });

    if (row) {
      audit(repo, row.id, "verified", "verifier", `Verification completed with status ${result.status}.`, {
        status: result.status,
        score: result.score,
        onChain: Boolean(onChain),
      });
      repo.persist();
    }
    return result;
  }

  function createShareLink(credentialId: string) {
    if (!repo.credentials.has(credentialId)) throw new Error("Credential not found");
    const existing = [...repo.shareLinks.values()].find((link) => link.credentialId === credentialId);
    if (existing) return existing;
    const link = { id: crypto.randomUUID().replaceAll("-", ""), credentialId, createdAt: now() };
    repo.shareLinks.set(link.id, link);
    audit(repo, credentialId, "shared", "holder", "Holder created a verifier share link.", { shareId: link.id });
    repo.persist();
    return link;
  }

  function getAudit(id: string) {
    return repo.auditEvents.filter((event) => event.credentialId === id);
  }

  function listCredentials({ includeJwt = true } = {}): PublicCredential[] {
    return [...repo.credentials.values()].map((row) => {
      if (includeJwt) return row;
      const { jwt, ...safe } = row;
      void jwt;
      return safe;
    });
  }

  function getCredentialJwt(id: string) {
    return repo.credentials.get(id)?.jwt;
  }

  function listIdentities() {
    return {
      institutions: [...repo.institutions.values()].map(({ privateKeyJwk: _privateKeyJwk, ...rest }) => rest),
      students: [...repo.students.values()].map(({ privateKeyJwk: _privateKeyJwk, ...rest }) => rest),
    };
  }

  function issuerDashboard() {
    const rows = listCredentials();
    return {
      metrics: {
        issued: rows.length,
        active: rows.filter((row) => !row.revoked).length,
        revoked: rows.filter((row) => row.revoked).length,
        verificationChecks: repo.auditEvents.filter((event) => event.type === "verified").length,
      },
      credentials: listCredentials(),
      auditEvents: repo.auditEvents.slice(-12).reverse(),
    };
  }

  function holderDashboard(subjectDid?: string) {
    const rows = listCredentials({ includeJwt: true }).filter((row) => !subjectDid || row.subjectDid === subjectDid);
    return {
      metrics: {
        held: rows.length,
        active: rows.filter((row) => !row.revoked).length,
        revoked: rows.filter((row) => row.revoked).length,
      },
      credentials: rows.map((row) => ({
        ...row,
        share: [...repo.shareLinks.values()].find((link) => link.credentialId === row.id),
      })),
    };
  }

  async function seedPresentationRecords() {
    // Idempotent and additive: keep any credentials the user already issued.
    // If Ada Lovelace's presentation credential is already present and active,
    // return it; otherwise add it fresh without resetting other data.
    const candidates = [...repo.credentials.values()].filter(
      (c) =>
        c.credential.credentialSubject.name === "Ada Lovelace" &&
        c.credential.credentialSubject.studentId === "NSU-2026-001",
    );
    // Strictly idempotent: if any Ada Lovelace presentation credential exists
    // (active or revoked), return the active one if available, else the first
    // revoked one. Never adds another anchor on repeat clicks.
    const existing = candidates.find((c) => !c.revoked) ?? candidates[0];
    if (existing) {
      const institution = repo.institutions.get(existing.issuerDid);
      const student = repo.students.get(existing.subjectDid);
      const share =
        [...repo.shareLinks.values()].find((link) => link.credentialId === existing.id) ??
        createShareLink(existing.id);
      return {
        institution: institution
          ? { did: institution.did, name: institution.name, publicKeyJwk: institution.publicKeyJwk }
          : undefined,
        student: student
          ? { did: student.did, name: student.name, publicKeyJwk: student.publicKeyJwk }
          : undefined,
        credential: existing,
        share,
      };
    }
    const institution = await makeInstitution("Northbridge State University");
    const student = await makeStudent("Ada Lovelace");
    const credential = await issue({
      issuerDid: institution.did,
      subjectDid: student.did,
      subject: {
        studentId: "NSU-2026-001",
        name: "Ada Lovelace",
        degree: "Bachelor of Science",
        major: "Computer Science",
        graduationDate: "2026-05-17",
        gpa: 3.92,
      },
    });
    const share = createShareLink(credential.id);
    repo.persist();
    return { institution, student, credential, share };
  }

  async function chainStatus() {
    const [registryStatus, storageStatus] = await Promise.all([registry.status(), storage.status()]);
    return { registry: registryStatus, storage: storageStatus };
  }

  function getMetrics() {
    return { ...repo.indexes.metrics };
  }

  function getMetricsAsOf() {
    return now();
  }

  function rowToSearch(row: StoredCredential): SearchRow {
    const subject = row.credential?.credentialSubject;
    return {
      id: row.id,
      holderName: subject?.name ?? "",
      degree: subject?.degree ?? "",
      major: subject?.major ?? "",
      issuerDid: row.issuerDid,
      subjectDid: row.subjectDid,
      status: row.revoked ? "revoked" : "active",
      createdAt: row.createdAt,
    };
  }

  function searchCredentials(q: string, pageSize = 10): { rows: SearchRow[]; total: number } {
    const cap = Math.max(1, Math.min(pageSize, 25));
    const tokens = tokenizeQuery(q);
    if (tokens.length === 0) return { rows: [], total: 0 };
    const sets = tokens
      .map((tok) => repo.indexes.searchTokens.get(tok) ?? (tok.length > 3 ? repo.indexes.searchTokens.get(tok.slice(0, 3)) : undefined))
      .filter((set): set is Set<string> => Boolean(set));
    if (sets.length !== tokens.length) return { rows: [], total: 0 };
    sets.sort((a, b) => a.size - b.size);
    const [smallest, ...rest] = sets;
    const matched: string[] = [];
    for (const id of smallest) {
      if (rest.every((set) => set.has(id))) matched.push(id);
    }
    const rows = matched
      .map((id) => repo.credentials.get(id))
      .filter((row): row is StoredCredential => Boolean(row))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, cap)
      .map(rowToSearch);
    return { rows, total: matched.length };
  }

  function intersectSets(sets: Set<string>[]): string[] {
    if (sets.length === 0) return [];
    sets.sort((a, b) => a.size - b.size);
    const [smallest, ...rest] = sets;
    const matched: string[] = [];
    for (const id of smallest) {
      if (rest.every((set) => set.has(id))) matched.push(id);
    }
    return matched;
  }

  function matchedIdsForFilter(filter: CredentialFilter): string[] {
    const candidateSets: Set<string>[] = [];
    if (filter.issuerDid) {
      const set = repo.indexes.byIssuer.get(filter.issuerDid);
      if (!set) return [];
      candidateSets.push(set);
    }
    if (filter.subjectDid) {
      const set = repo.indexes.bySubject.get(filter.subjectDid);
      if (!set) return [];
      candidateSets.push(set);
    }
    if (filter.status === "active") candidateSets.push(repo.indexes.byStatus.active);
    if (filter.status === "revoked") candidateSets.push(repo.indexes.byStatus.revoked);
    if (filter.q) {
      const tokens = tokenizeQuery(filter.q);
      if (tokens.length === 0) return [];
      for (const tok of tokens) {
        const set = repo.indexes.searchTokens.get(tok) ?? (tok.length > 3 ? repo.indexes.searchTokens.get(tok.slice(0, 3)) : undefined);
        if (!set) return [];
        candidateSets.push(set);
      }
    }
    let ids: string[];
    if (candidateSets.length === 0) ids = [...repo.indexes.byCreatedAt];
    else ids = intersectSets(candidateSets);
    if (filter.from || filter.to) {
      ids = ids.filter((id) => {
        const row = repo.credentials.get(id);
        if (!row) return false;
        if (filter.from && row.createdAt < filter.from) return false;
        if (filter.to && row.createdAt > filter.to) return false;
        return true;
      });
    }
    return ids;
  }

  function sortRows(rows: StoredCredential[], sort: CredentialSort): StoredCredential[] {
    const [field, dir] = sort.split(":") as [string, "asc" | "desc"];
    const mul = dir === "asc" ? 1 : -1;
    const cmp = (a: StoredCredential, b: StoredCredential) => {
      if (field === "createdAt") return a.createdAt.localeCompare(b.createdAt) * mul;
      if (field === "holderName")
        return (a.credential?.credentialSubject?.name ?? "").localeCompare(b.credential?.credentialSubject?.name ?? "") * mul;
      if (field === "degree")
        return (a.credential?.credentialSubject?.degree ?? "").localeCompare(b.credential?.credentialSubject?.degree ?? "") * mul;
      return 0;
    };
    return [...rows].sort(cmp);
  }

  function listCredentialsPage(opts: CredentialListPageOptions = {}): CredentialListResult {
    const filter = opts.filter ?? {};
    const sort = opts.sort ?? "createdAt:desc";
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.max(1, Math.min(opts.pageSize ?? 20, 100));
    const includeJwt = opts.includeJwt ?? false;
    const ids = matchedIdsForFilter(filter);
    const rows = ids
      .map((id) => repo.credentials.get(id))
      .filter((row): row is StoredCredential => Boolean(row));
    const sorted = sortRows(rows, sort);
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const slice = sorted.slice(start, start + pageSize);
    const projected = slice.map((row) => {
      if (includeJwt) return row;
      const { jwt, ...safe } = row;
      void jwt;
      return safe;
    });
    return {
      rows: projected,
      page,
      pageSize,
      total,
      hasMore: start + slice.length < total,
      sort,
      filter,
    };
  }

  function listAudit(query: AuditQuery = {}): { events: AuditEvent[]; hasMore: boolean; oldest: string | null } {
    const limit = Math.max(1, Math.min(query.limit ?? 12, 100));
    let pool: AuditEvent[];
    if (query.credentialId) pool = repo.indexes.auditByCredential.get(query.credentialId) ?? [];
    else if (query.type) pool = repo.indexes.auditByType.get(query.type) ?? [];
    else pool = repo.auditEvents;
    const filtered = pool.filter((event) => {
      if (query.type && event.type !== query.type) return false;
      if (query.credentialId && event.credentialId !== query.credentialId) return false;
      if (query.from && event.createdAt < query.from) return false;
      if (query.to && event.createdAt > query.to) return false;
      if (query.before && event.createdAt >= query.before) return false;
      if (query.issuerDid) {
        const row = repo.credentials.get(event.credentialId);
        if (!row || row.issuerDid !== query.issuerDid) return false;
      }
      return true;
    });
    const descending = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const events = descending.slice(0, limit);
    const hasMore = descending.length > limit;
    const oldest = events.length > 0 ? events[events.length - 1].createdAt : null;
    return { events, hasMore, oldest };
  }

  return {
    makeInstitution,
    makeStudent,
    issue,
    revoke,
    verify,
    createShareLink,
    getAudit,
    listCredentials,
    getCredentialJwt,
    listIdentities,
    issuerDashboard,
    holderDashboard,
    seedPresentationRecords,
    chainStatus,
    getMetrics,
    getMetricsAsOf,
    searchCredentials,
    listAudit,
    listCredentialsPage,
  };
}

function emptyBreakdown() {
  return { schema: 0, issuer: 0, signature: 0, contentIntegrity: 0, onChain: 0, revocation: 0 };
}

export type CredentialService = ReturnType<typeof createCredentialService>;
