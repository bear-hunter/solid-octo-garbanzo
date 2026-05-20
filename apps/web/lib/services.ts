import {
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
import type { AuditEvent, Repository, StoredCredential } from "./repository";

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
    const receipt = await registry.revokeCredential(row.hash, reason);
    row.revoked = true;
    row.reason = reason;
    row.revokeChain = receipt;
    const registryRecord = repo.registryRecords.get(row.hash);
    if (registryRecord) {
      registryRecord.status = "revoked";
      registryRecord.updatedAt = now();
    }
    audit(repo, id, "revoked", row.issuerDid, reason, { txHash: receipt.txHash, blockNumber: receipt.blockNumber });
    repo.persist();
    return row;
  }

  async function verify(input: VerifyInput): Promise<VerificationResult & { evidence?: VerificationEvidence }> {
    const shared = input.shareId ? repo.shareLinks.get(input.shareId) : undefined;
    const id = input.id ?? shared?.credentialId;
    const row = id
      ? repo.credentials.get(id)
      : [...repo.credentials.values()].find((item) => item.cid === input.cid || item.jwt === input.jwt);
    if (!row) {
      return { status: "unavailable", valid: false, score: 0, breakdown: emptyBreakdown(), reasons: ["Credential was not found"], evidence: undefined };
    }

    const issuer = repo.institutions.get(row.issuerDid);
    const onChain = await registry.getCredential(row.hash);
    const offChain = input.credential ?? (await storage.get(row.cid)) ?? row.credential;
    const submittedCid = input.cid ?? row.cid;
    const anchoredCid = onChain?.cid ?? row.cid;
    const anchoredHash = onChain?.credentialHash ?? row.hash;
    const submittedHash = offChain ? hashHex(offChain) : "";
    const registeredIssuerDid = row.issuerDid;
    const submittedIssuerDid = offChain?.issuer ?? "";

    const result = await verifyCredential({
      jwt: input.credential ? undefined : input.jwt ?? row.jwt,
      credential: offChain,
      issuer: issuer ? { did: issuer.did, name: issuer.name, active: issuer.active, publicKeyJwk: issuer.publicKeyJwk } : undefined,
      cid: submittedCid,
      expectedCid: anchoredCid,
      storedHash: anchoredHash,
      revoked: row.revoked || onChain?.revoked === true,
      unavailable: !offChain,
    });

    const evidence = buildEvidence({
      submittedHash,
      anchoredHash,
      submittedCid,
      anchoredCid,
      submittedIssuerDid,
      registeredIssuerDid,
      registeredIssuerName: issuer?.name,
      submittedCredential: offChain,
      anchoredCredential: row.credential,
      revokedOnChain: onChain?.revoked === true || row.revoked === true,
      registryBlockNumber: row.chain?.blockNumber,
    });

    audit(repo, row.id, "verified", "verifier", `Verification completed with status ${result.status}.`, {
      status: result.status,
      score: result.score,
      onChain: Boolean(onChain),
    });
    repo.persist();
    return { ...result, evidence };
  }

  function createShareLink(credentialId: string) {
    if (!repo.credentials.has(credentialId)) throw new Error("Credential not found");
    const existing = [...repo.shareLinks.values()].find((link) => link.credentialId === credentialId);
    if (existing) return existing;
    const link = { id: crypto.randomUUID().slice(0, 8), credentialId, createdAt: now() };
    repo.shareLinks.set(link.id, link);
    audit(repo, credentialId, "shared", "holder", "Holder created a verifier share link.", { shareId: link.id });
    repo.persist();
    return link;
  }

  function getAudit(id: string) {
    return repo.auditEvents.filter((event) => event.credentialId === id);
  }

  function listCredentials() {
    return [...repo.credentials.values()];
  }

  function listIdentities() {
    return {
      institutions: [...repo.institutions.values()].map(({ privateKeyJwk, ...rest }) => rest),
      students: [...repo.students.values()].map(({ privateKeyJwk, ...rest }) => rest),
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
      credentials: rows,
      auditEvents: repo.auditEvents.slice(-12).reverse(),
    };
  }

  function holderDashboard(subjectDid?: string) {
    const rows = listCredentials().filter((row) => !subjectDid || row.subjectDid === subjectDid);
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

  return {
    makeInstitution,
    makeStudent,
    issue,
    revoke,
    verify,
    createShareLink,
    getAudit,
    listCredentials,
    listIdentities,
    issuerDashboard,
    holderDashboard,
    seedPresentationRecords,
    chainStatus,
  };
}

function emptyBreakdown() {
  return { schema: 0, issuer: 0, signature: 0, contentIntegrity: 0, onChain: 0, revocation: 0 };
}

export type FieldDiff = { path: string; anchored: unknown; submitted: unknown };

export type VerificationEvidence = {
  submittedHash: string;
  anchoredHash: string;
  hashesMatch: boolean;
  submittedCid: string;
  anchoredCid: string;
  cidsMatch: boolean;
  submittedIssuerDid: string;
  registeredIssuerDid: string;
  registeredIssuerName?: string;
  issuerMatches: boolean;
  revokedOnChain: boolean;
  registryBlockNumber?: number;
  diff: FieldDiff[];
};

function buildEvidence(input: {
  submittedHash: string;
  anchoredHash: string;
  submittedCid: string;
  anchoredCid: string;
  submittedIssuerDid: string;
  registeredIssuerDid: string;
  registeredIssuerName?: string;
  submittedCredential?: AcademicCredential;
  anchoredCredential: AcademicCredential;
  revokedOnChain: boolean;
  registryBlockNumber?: number;
}): VerificationEvidence {
  return {
    submittedHash: input.submittedHash,
    anchoredHash: input.anchoredHash,
    hashesMatch: !!input.submittedHash && input.submittedHash === input.anchoredHash,
    submittedCid: input.submittedCid,
    anchoredCid: input.anchoredCid,
    cidsMatch: input.submittedCid === input.anchoredCid,
    submittedIssuerDid: input.submittedIssuerDid,
    registeredIssuerDid: input.registeredIssuerDid,
    registeredIssuerName: input.registeredIssuerName,
    issuerMatches: input.submittedIssuerDid === input.registeredIssuerDid,
    revokedOnChain: input.revokedOnChain,
    registryBlockNumber: input.registryBlockNumber,
    diff: input.submittedCredential ? diffCredential(input.anchoredCredential, input.submittedCredential) : [],
  };
}

function diffCredential(anchored: AcademicCredential, submitted: AcademicCredential): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const topFields: Array<keyof AcademicCredential> = ["issuer", "issuanceDate", "id"];
  for (const f of topFields) {
    if (anchored[f] !== submitted[f]) {
      diffs.push({ path: f, anchored: anchored[f], submitted: submitted[f] });
    }
  }
  const subjectFields: Array<keyof AcademicCredential["credentialSubject"]> = [
    "id",
    "studentId",
    "name",
    "degree",
    "major",
    "graduationDate",
    "gpa",
  ];
  const a = anchored.credentialSubject as Record<string, unknown>;
  const s = (submitted.credentialSubject ?? {}) as Record<string, unknown>;
  for (const f of subjectFields) {
    if (a[f] !== s[f]) {
      diffs.push({ path: `credentialSubject.${f}`, anchored: a[f], submitted: s[f] });
    }
  }
  const aKeys = Object.keys(a);
  const sKeys = Object.keys(s);
  for (const k of aKeys) if (!(k in s)) diffs.push({ path: `credentialSubject.${k}`, anchored: a[k], submitted: undefined });
  for (const k of sKeys) if (!(k in a)) diffs.push({ path: `credentialSubject.${k}`, anchored: undefined, submitted: s[k] });
  const seen = new Set<string>();
  return diffs.filter((d) => (seen.has(d.path) ? false : seen.add(d.path)));
}

export type CredentialService = ReturnType<typeof createCredentialService>;
